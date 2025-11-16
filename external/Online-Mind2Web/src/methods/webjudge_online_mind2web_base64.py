from utils import encode_image
from PIL import Image
import re
import asyncio
import io

MAX_IMAGE = 50

async def identify_key_points(task, model):
    system_msg = """You are an expert tasked with analyzing a given task to identify the key points explicitly stated in the task description.

**Objective**: Carefully analyze the task description and extract the critical elements explicitly mentioned in the task for achieving its goal.

**Instructions**:
1. Read the task description carefully.
2. Identify and extract **key points** directly stated in the task description.
   - Do not infer or add any unstated elements.

**Respond with**:
- **Key Points**: A numbered list of the explicit key points for completing this task, one per line, without explanations or additional details."""
    
    prompt = f"Task: {task}"
    messages = [
        {"role": "system", "content": system_msg},
        {"role": "user", "content": [{"type": "text", "text": prompt}]}
    ]
    responses = await asyncio.to_thread(model.generate, messages)
    return responses[0]

async def judge_image(task, image_input, key_points, model):
    """Evaluate a single image for task completion."""
    system_msg = """You are an expert evaluator tasked with determining whether an image contains necessary steps or evidence for completing a task.
Provide a reasoning and a score from 1 (irrelevant) to 5 (fully relevant)."""
    
    # Handle PIL.Image or file path
    if isinstance(image_input, Image.Image):
        img = image_input
    else:
        img = Image.open(image_input)
    
    jpg_base64_str = encode_image(img)

    prompt = f"""**Task**: {task}
**Key Points for Task Completion**: {key_points}
Snapshot of the web page is shown in the image."""

    messages = [
        {"role": "system", "content": system_msg},
        {"role": "user", "content": [
            {"type": "text", "text": prompt},
            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{jpg_base64_str}", "detail": "high"}}
        ]}
    ]

    responses = await asyncio.to_thread(model.generate, messages)
    return responses[0]

async def WebJudge_Online_Mind2Web_eval(task, last_actions, images_list, model, score_threshold=3):
    """
    Evaluate a task with given images and action history.
    Returns: messages, text, system_msg, record, key_points
    """
    system_msg = """You are an expert in evaluating the performance of a web navigation agent.
Format your response into two lines: Thoughts: <reasoning>, Status: "success" or "failure"."""

    # Identify key points
    key_points_text = await identify_key_points(task, model)
    key_points = key_points_text.split("Key Points:")[-1].strip()

    # Prepare tasks for image evaluation
    tasks_list = [judge_image(task, img, key_points, model) for img in images_list]
    image_responses = await asyncio.gather(*tasks_list)

    # Process responses
    record = []
    whole_content_img = []
    whole_thoughts = []
    pattern = r"[1-5]"

    for response, img_input in zip(image_responses, images_list):
        thought = ""
        score = 0
        try:
            if "Score" in response:
                score_text = response.split("Score")[1]
                score = int(re.findall(pattern, score_text)[0])
                thought = response.split("**Reasoning**:")[-1].strip().split("\n\n")[0].replace('\n', ' ')
            else:
                score = 0
                thought = response.replace('\n',' ')
        except Exception as e:
            print(f"Error processing response: {e}")
            score = 0
            thought = response.replace('\n',' ')

        record.append({"Response": response, "Score": score})

        if score >= score_threshold:
            # Add images that passed the threshold
            if isinstance(img_input, Image.Image):
                img = img_input
            else:
                img = Image.open(img_input)
            jpg_base64_str = encode_image(img)
            whole_content_img.append({
                'type': 'image_url',
                'image_url': {"url": f"data:image/png;base64,{jpg_base64_str}", "detail": "high"}
            })
            if thought:
                whole_thoughts.append(thought)

    whole_content_img = whole_content_img[:MAX_IMAGE]
    whole_thoughts = whole_thoughts[:MAX_IMAGE]

    # Prepare final text prompt for overall evaluation
    text_prompt = f"""User Task: {task}

Key Points: {key_points}

Action History:
{chr(10).join(f"{i+1}. {a}" for i, a in enumerate(last_actions))}

Thoughts from relevant images:
{chr(10).join(f"{i+1}. {t}" for i, t in enumerate(whole_thoughts))}"""

    messages = [
        {"role": "system", "content": system_msg},
        {"role": "user", "content": [{"type": "text", "text": text_prompt}] + whole_content_img}
    ]

    return messages, text_prompt, system_msg, record, key_points
