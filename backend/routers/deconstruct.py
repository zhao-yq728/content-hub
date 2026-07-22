import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Content, Deconstruction
from schemas import DeconstructRequest, DeconstructionResponse
from services.ai_service import call_ai, DECONSTRUCT_PROMPT

router = APIRouter(prefix="/api/deconstruct", tags=["deconstruct"])


@router.post("/", response_model=DeconstructionResponse)
async def deconstruct_content(req: DeconstructRequest, db: Session = Depends(get_db)):
    content = db.query(Content).filter(Content.id == req.content_id).first()
    if not content:
        raise HTTPException(status_code=404, detail="内容不存在")

    # Check if already deconstructed
    existing = db.query(Deconstruction).filter(Deconstruction.content_id == req.content_id).first()
    if existing:
        return _to_response(existing)

    # Call AI for deconstruction
    prompt = DECONSTRUCT_PROMPT.format(
        title=content.title,
        content=content.content_text[:3000],
    )

    try:
        result_text = await call_ai(prompt, temperature=0.3)
        result_text = result_text.strip()
        if result_text.startswith("```"):
            result_text = result_text.split("\n", 1)[1].rsplit("\n", 1)[0]
        data = json.loads(result_text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 拆解失败: {str(e)}")

    decon = Deconstruction(
        content_id=content.id,
        title_formula=data.get("title_formula", ""),
        hook_type=data.get("hook_type", ""),
        content_structure=data.get("content_structure", ""),
        emotion_curve=data.get("emotion_curve", ""),
        golden_sentences=data.get("golden_sentences", []),
        engagement_hooks=data.get("engagement_hooks", ""),
        visual_style=data.get("visual_style", ""),
        reusable_genes=data.get("reusable_genes", []),
        raw_analysis=json.dumps(data, ensure_ascii=False),
        score=float(data.get("score", 75)),
    )
    db.add(decon)

    # Mark content as deconstructed
    content.has_deconstruction = True
    db.commit()
    db.refresh(decon)

    return _to_response(decon)


@router.get("/{content_id}", response_model=DeconstructionResponse)
def get_deconstruction(content_id: int, db: Session = Depends(get_db)):
    decon = db.query(Deconstruction).filter(Deconstruction.content_id == content_id).first()
    if not decon:
        raise HTTPException(status_code=404, detail="该内容尚未拆解")
    return _to_response(decon)


@router.get("/", response_model=list[DeconstructionResponse])
def list_deconstructions(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    decons = db.query(Deconstruction).order_by(Deconstruction.created_at.desc()).offset(skip).limit(limit).all()
    return [_to_response(d) for d in decons]


@router.delete("/{content_id}")
def delete_deconstruction(content_id: int, db: Session = Depends(get_db)):
    decon = db.query(Deconstruction).filter(Deconstruction.content_id == content_id).first()
    if not decon:
        raise HTTPException(status_code=404, detail="拆解记录不存在")
    content = db.query(Content).filter(Content.id == content_id).first()
    if content:
        content.has_deconstruction = False
    db.delete(decon)
    db.commit()
    return {"ok": True}


def _to_response(decon: Deconstruction) -> dict:
    return {
        "id": decon.id,
        "content_id": decon.content_id,
        "title_formula": decon.title_formula,
        "hook_type": decon.hook_type,
        "content_structure": decon.content_structure,
        "emotion_curve": decon.emotion_curve,
        "golden_sentences": decon.golden_sentences or [],
        "engagement_hooks": decon.engagement_hooks,
        "visual_style": decon.visual_style,
        "reusable_genes": decon.reusable_genes or [],
        "score": decon.score or 0,
        "created_at": decon.created_at,
    }
