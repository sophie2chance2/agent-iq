api_key=os.getenv("OPENAI_API_KEY")
model_name=os.getenv("OPENAI_MODEL") # "o4-mini" | "gpt-4o-mini" | "gpt-4o" | "gpt-5-mini-2025-08-07"

#Automatic evaluation method
modes=(
    "WebJudge_Online_Mind2Web_eval"
    "WebJudge_general_eval"
    # "Autonomous_eval"
    # "WebVoyager_eval"
    # "AgentTrek_eval"
)

base_dir="./data/example"
for mode in "${modes[@]}"; do
    python ./src/run.py \
        --mode "$mode" \
        --model "${model_name}" \
        --trajectories_dir "$base_dir" \
        --api_key "${api_key}" \
        --output_path ${base_dir}_result \
        --num_worker 1 \
        --score_threshold 3
done
