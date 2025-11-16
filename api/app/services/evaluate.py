import os
import io
import re
import base64
import asyncio
import multiprocessing
from typing import List, Optional
from PIL import Image
import backoff
from openai import APIConnectionError, APIError, RateLimitError, OpenAI


class EvaluationService:
    MAX_IMAGE = 50

    # ============================================================
    # INIT
    # ============================================================
    def __init__(self):
        # Hardcoded API key and model
        api_key = os.getenv("OPENAI_API_KEY")
        assert api_key is not None, "OPENAI_API_KEY must be set in environment"
        self.api_keys = [api_key]
        self.model = os.getenv("OPENAI_MODEL") or "gpt-4o"
        self.temperature = 0
        self.request_interval = 0
        self.next_avil_time = [0] * len(self.api_keys)
        self.client = OpenAI(api_key=api_key)

    # ============================================================
    # OPENAI UTIL
    # ============================================================
    @staticmethod
    def log_error(details):
        print(f"Retrying in {details['wait']:0.1f}s due to {details['exception']}")

    def generate(self, messages, max_new_tokens=512, temperature=0, model=None, **kwargs):
        model = model if model else self.model

        @backoff.on_exception(
            backoff.expo,
            (APIError, RateLimitError, APIConnectionError),
            max_tries=3,
            on_backoff=self.log_error
        )
        def _call():
            response = self.client.chat.completions.create(
                model=model,
                messages=messages,
                max_tokens=max_new_tokens,
                temperature=temperature,
                **kwargs
            )
            return [choice.message.content for choice in response.choices]

        return _call()

    @staticmethod
    def extract_prediction(response: str) -> int:
        try:
            if "success" in response.lower().split('status:')[1]:
                return 1
            else:
                return 0
        except:
            return 0

    # ============================================================
    # IMAGE UTILITIES
    # ============================================================
    @staticmethod
    def encode_image(image: Image.Image) -> str:
        # Convert any unsupported mode to RGB
        if image.mode not in ["RGB", "L"]:
            image = image.convert("RGB")
        elif image.mode == "L":  # grayscale can be left as-is or converted
            image = image.convert("RGB")

        buffered = io.BytesIO()
        image.save(buffered, format="JPEG")
        return base64.b64encode(buffered.getvalue()).decode('utf-8')


    @staticmethod
    def load_image(image_input):
        if isinstance(image_input, Image.Image):
            return image_input
        elif isinstance(image_input, str):
            try:
                if image_input.startswith("data:image"):
                    image_input = image_input.split(",")[1]
                image_bytes = base64.b64decode(image_input)
                return Image.open(io.BytesIO(image_bytes))
            except Exception:
                return Image.open(image_input)
        else:
            raise ValueError("Unsupported image input type")

    @staticmethod
    def decode_base64_screenshots(screenshots: List[str]) -> List[Image.Image]:
        images = []
        for img_b64 in screenshots:
            # Remove any data URI prefix if present
            if img_b64.startswith("data:image"):
                img_b64 = img_b64.split(",")[1]

            # Fix padding
            missing_padding = len(img_b64) % 4
            if missing_padding != 0:
                img_b64 += "=" * (4 - missing_padding)

            img_bytes = base64.b64decode(img_b64)
            images.append(Image.open(io.BytesIO(img_bytes)))
        return images


    # ============================================================
    # CORE EVALUATION LOGIC
    # ============================================================
    async def identify_key_points(self, task: str, input_images: Optional[List[Image.Image]]) -> str:
        system_msg = "Extract explicit key points from the task description as a numbered list only."
        prompt = f"Task: {task}"
        input_images_msg = []
        if input_images:
            for img_input in input_images:
                img = self.load_image(img_input)
                input_images_msg.append({
                    "type": "image_url",
                    "image_url": {"url": f"data:image/png;base64,{self.encode_image(img)}", "detail": "high"}
                })
        messages = [
            {"role": "system", "content": system_msg},
            {"role": "user", "content": [{"type": "text", "text": prompt}] + input_images_msg},
        ]
        responses = await asyncio.to_thread(self.generate, messages)
        return responses[0]

    async def judge_image(self, task, input_images, image_input, key_points):
        system_msg = """Evaluate if image contains steps to complete task. Format:
### Reasoning: [reasoning]
### Score: [1-5]"""
        prompt = f"Task: {task}\nKey Points: {key_points}\nSnapshot of the web page."
        context_img_msgs = []
        if input_images:
            for img_input in input_images:
                img = self.load_image(img_input)
                context_img_msgs.append({
                    "type": "image_url",
                    "image_url": {"url": f"data:image/png;base64,{self.encode_image(img)}", "detail": "high"}
                })
        eval_img = self.load_image(image_input)
        eval_img_b64 = self.encode_image(eval_img)
        messages = [{"role": "system", "content": system_msg}]
        if context_img_msgs:
            messages.append({"role": "user", "content": [{"type": "text", "text": "Context images:"}] + context_img_msgs})
        messages.append({
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{eval_img_b64}", "detail": "high"}},
            ]
        })
        responses = await asyncio.to_thread(self.generate, messages)
        return responses[0]

    async def WebJudge_general_eval(
        self, task: str, input_images: Optional[List[Image.Image]], action_thoughts: Optional[List[str]],
        last_actions: Optional[List[str]], image_list: List[Image.Image], score_threshold: int = 3
    ):
        system_msg = "Evaluate web navigation agent performance. Format: Thoughts:<reasoning> Status:'success'/'failure'"
        key_points = await self.identify_key_points(task, input_images)
        key_points_text = key_points.split("Key Points:")[-1].strip()
        tasks = [self.judge_image(task, input_images, img, key_points_text) for img in image_list]
        image_responses = await asyncio.gather(*tasks)
        record, relevant_imgs, relevant_thoughts = [], [], []
        pattern = r"[1-5]"
        for response, img_input in zip(image_responses, image_list):
            try:
                score_text = re.findall(pattern, response)
                score = int(score_text[-1]) if score_text else 0
                reasoning = response.split("### Reasoning:")[-1].split("### Score")[0].strip().replace("\n", " ")
            except Exception:
                score, reasoning = 0, response.strip()
            record.append({"Response": response, "Score": score})
            if score >= score_threshold:
                img = self.load_image(img_input)
                relevant_imgs.append({"type": "image_url", "image_url": {"url": f"data:image/png;base64,{self.encode_image(img)}", "detail": "high"}})
                relevant_thoughts.append(reasoning)
        relevant_imgs = relevant_imgs[:self.MAX_IMAGE]
        relevant_thoughts = relevant_thoughts[:self.MAX_IMAGE]
        text_prompt = f"User Task: {task}\nKey Points: {key_points_text}\nAction History:\n{chr(10).join(f'{i+1}. {a}' for i, a in enumerate(last_actions or []))}\nThoughts from relevant images:\n{chr(10).join(f'{i+1}. {t}' for i, t in enumerate(relevant_thoughts))}"
        messages = [{"role": "system", "content": system_msg},{"role": "user", "content": [{"type": "text", "text": text_prompt}] + relevant_imgs}]
        return messages, text_prompt, system_msg, record, key_points_text

    # ============================================================
    # TASKS
    # ============================================================
    def auto_eval_task(
        self, task_id: str, task_description: str, screenshots: List[str],
        action_history: Optional[List[str]], thoughts: Optional[List[str]],
        final_result_response: Optional[str], input_image_paths: Optional[List[str]],
        score_threshold: int = 3
    ) -> dict:
        decoded_images = self.decode_base64_screenshots(screenshots)
        messages, text, system_msg, record, key_points = asyncio.run(
            self.WebJudge_general_eval(task_description, input_image_paths, thoughts, action_history, decoded_images, score_threshold)
        )
        response = self.generate(messages)[0]
        predicted_label = self.extract_prediction(response)
        return {
            "task_id": task_id,
            "task_description": task_description,
            "response": response,
            "predicted_label": predicted_label,
            "system_msg": system_msg,
            "action_history": action_history,
            "thoughts": thoughts,
            "final_result_response": final_result_response,
            "screenshots": [f"screenshot_{i+1}.png" for i in range(len(decoded_images))],
            "image_judge_record": record,
            "key_points": key_points
        }

    def evaluate_tasks(self, tasks: List[dict], score_threshold: int = 3, num_workers: int = 1) -> List[dict]:
        lock = multiprocessing.Lock()
        results = []

        def worker(task_subset):
            local_results = []
            for t in task_subset:
                res = self.auto_eval_task(
                    task_id=t["task_id"],
                    task_description=t["task_description"],
                    screenshots=t["screenshots"],  # base64 strings
                    action_history=t.get("action_history"),
                    thoughts=t.get("thoughts"),
                    final_result_response=t.get("final_result_response"),
                    input_image_paths=t.get("input_image_paths"),
                    score_threshold=score_threshold,
                )
                local_results.append(res)
            with lock:
                results.extend(local_results)

        if num_workers > 1:
            chunk_size = max(1, len(tasks) // num_workers)
            task_subsets = [tasks[i:i + chunk_size] for i in range(0, len(tasks), chunk_size)]
            processes = []
            for subset in task_subsets:
                p = multiprocessing.Process(target=worker, args=(subset,))
                p.start()
                processes.append(p)
            for p in processes:
                p.join()
        else:
            worker(tasks)

        return results
