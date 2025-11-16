# app/routes/runs.py
from fastapi import APIRouter, HTTPException
from app.models import (
    RunRequest,
    RunResponse,
    EvaluationDetailsRequest,
    EvaluationDetailsResponse,
    RobotsAnalysisRequest,
    RobotsAnalysisResponse,
    AIRules,
    CreateSessionRequest,
    CreateSessionResponse
)

from app.services.sessions import create_browser_session
from app.services.robots_service import RobotsAnalysisService
from app.services.evaluate import EvaluationService

router = APIRouter()  # /v1 prefix comes from main.py

@router.post("/session/create")
def create_session(req: CreateSessionRequest):
    return create_browser_session(req.url)

@router.post("/runs", response_model=RunResponse)
def create_run(req: RunRequest) -> RunResponse:
    # TODO: enqueue & persist; return real IDs/URLs
    return RunResponse(
        run_id="run_demo_1",
        session_live_view_url="https://provider.live/sessions/sess_demo_1",
        session_id="sess_demo_1",
    )


@router.post("/runs/evaluate_task", response_model=EvaluationDetailsResponse)
def evaluate_task(req: EvaluationDetailsRequest):
    # Instantiate the evaluation service (no arguments)
    evaluator = EvaluationService()

    # Run the evaluation task
    result = evaluator.auto_eval_task(
        task_id=req.task_id,
        task_description=req.task_description,
        screenshots=req.screenshots,  # base64 strings
        action_history=req.action_history,
        thoughts=req.thoughts,
        final_result_response=req.final_result_response,
        input_image_paths=req.input_image_paths,
        score_threshold=3
    )

    # Extract fields from the evaluation result
    image_judge_record = result["image_judge_record"]
    key_points = result["key_points"]
    input_text = f"User Task: {req.task_description}\nAction History: {req.action_history}\nThoughts: {req.thoughts}"
    system_msg = f"Evaluating task: {req.task_id}"

    # The final model response is already in `result['response']`
    final_response = result["response"]
    predicted_label = result["predicted_label"]

    return EvaluationDetailsResponse(
        image_judge_record=image_judge_record,
        key_points=key_points,
        input_text=input_text,
        system_msg=system_msg,
        evaluation_details={
            "response": final_response,
            "predicted_label": predicted_label,
        },
        predicted_label=predicted_label
    )


@router.post("/robots/analyze", response_model=RobotsAnalysisResponse)
def analyze_robots(req: RobotsAnalysisRequest) -> RobotsAnalysisResponse:
    """Analyze robots.txt using a URL"""
    robots_service = RobotsAnalysisService()
    
    try:
        # Convert URL to string for the service
        url = str(req.url)
        
        # Check if robots.txt exists and get content
        has_robots, robots_url, content = robots_service.check_robots_txt(url)
        
        # Handle case where no robots.txt exists
        if not has_robots:
            content = None  # Don't return status codes, just None
        
        # Analyze AI rules if robots.txt exists
        ai_rules = None
        llm_suggestions = None
        
        if has_robots and content:
            # Analyze AI permissions
            ai_analysis = robots_service.analyze_ai_permissions(content)
            ai_rules = AIRules(**ai_analysis)
            
            # Get LLM suggestions (method expects website, ai_rules dict, robots_content)
            llm_suggestions = robots_service.suggest_agent_tasks_with_llm(url, ai_analysis, content)
        
        return RobotsAnalysisResponse(
            has_robots_txt=has_robots,
            robots_url=robots_url,
            robots_content=content,
            ai_rules=ai_rules,
            llm_suggestions=llm_suggestions
        )
        
    except Exception as e:
        return RobotsAnalysisResponse(
            has_robots_txt=False,
            error=str(e)
        )
