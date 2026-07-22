from fastapi import APIRouter, Depends
from schemas import APIConfigUpdate, APIConfigResponse
from services.ai_service import load_config, save_config

router = APIRouter(prefix="/api/config", tags=["config"])


@router.get("/", response_model=APIConfigResponse)
def get_config():
    config = load_config()
    return {
        "api_base": config.get("api_base", "https://api.openai.com/v1"),
        "model": config.get("model", "gpt-4o-mini"),
        "has_key": bool(config.get("api_key")),
    }


@router.put("/", response_model=APIConfigResponse)
def update_config(data: APIConfigUpdate):
    config = load_config()
    config["api_key"] = data.api_key
    config["api_base"] = data.api_base
    config["model"] = data.model
    save_config(config)
    return {
        "api_base": config["api_base"],
        "model": config["model"],
        "has_key": bool(config["api_key"]),
    }
