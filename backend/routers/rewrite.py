import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Content, Deconstruction, GeneratedContent
from schemas import RewriteRequest, RewriteResponse
from services.ai_service import call_ai, REWRITE_PROMPT, STYLE_DESC

router = APIRouter(prefix="/api/rewrite", tags=["rewrite"])


@router.post("/")
async def rewrite_content(req: RewriteRequest, db: Session = Depends(get_db)):
    content = db.query(Content).filter(Content.id == req.template_content_id).first()
    if not content:
        raise HTTPException(status_code=404, detail="模板内容不存在")

    decon = db.query(Deconstruction).filter(Deconstruction.content_id == content.id).first()
    if not decon:
        raise HTTPException(status_code=400, detail="请先对该内容进行拆解分析")

    style_desc = STYLE_DESC.get(req.style, STYLE_DESC["default"])

    prompt = REWRITE_PROMPT.format(
        count=req.count,
        style_desc=style_desc,
        title_formula=decon.title_formula,
        hook_type=decon.hook_type,
        content_structure=decon.content_structure,
        emotion_curve=decon.emotion_curve,
        genes=json.dumps(decon.reusable_genes or [], ensure_ascii=False),
        hotwords=", ".join(req.hotword_combo) if req.hotword_combo else "无特定热词",
        original_title=content.title,
        original_content=content.content_text[:2000],
    )

    try:
        result_text = await call_ai(prompt, temperature=0.8)
        result_text = result_text.strip()
        if result_text.startswith("```"):
            result_text = result_text.split("\n", 1)[1].rsplit("\n", 1)[0]
        data = json.loads(result_text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 仿写失败: {str(e)}")

    # Save generated results
    results = []
    for i, item in enumerate(data.get("results", [])):
        gen = GeneratedContent(
            source_content_id=content.id,
            template_id=decon.id,
            hotword_combo=req.hotword_combo,
            generated_title=item.get("title", ""),
            generated_content=item.get("content", ""),
            style=req.style,
            version=i + 1,
        )
        db.add(gen)
        results.append(gen)

    db.commit()
    for g in results:
        db.refresh(g)

    return [
        {
            "id": g.id,
            "generated_title": g.generated_title,
            "generated_content": g.generated_content,
            "style": g.style,
            "version": g.version,
        }
        for g in results
    ]


@router.get("/")
def list_generated(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    gens = db.query(GeneratedContent).order_by(GeneratedContent.created_at.desc()).offset(skip).limit(limit).all()
    return [
        {
            "id": g.id,
            "source_content_id": g.source_content_id,
            "generated_title": g.generated_title,
            "generated_content": g.generated_content,
            "style": g.style,
            "version": g.version,
            "is_starred": g.is_starred,
            "created_at": g.created_at,
        }
        for g in gens
    ]


@router.post("/{gen_id}/star")
def toggle_star(gen_id: int, db: Session = Depends(get_db)):
    gen = db.query(GeneratedContent).filter(GeneratedContent.id == gen_id).first()
    if not gen:
        raise HTTPException(status_code=404, detail="生成内容不存在")
    gen.is_starred = not gen.is_starred
    db.commit()
    return {"is_starred": gen.is_starred}


@router.delete("/{gen_id}")
def delete_generated(gen_id: int, db: Session = Depends(get_db)):
    gen = db.query(GeneratedContent).filter(GeneratedContent.id == gen_id).first()
    if not gen:
        raise HTTPException(status_code=404, detail="生成内容不存在")
    db.delete(gen)
    db.commit()
    return {"ok": True}
