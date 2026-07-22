from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from models import HotWord
from schemas import HotWordResponse, HotWordComboRequest
from services.hotword_service import update_hot_words, get_hotword_combinations

router = APIRouter(prefix="/api/hotwords", tags=["hotwords"])


@router.get("/", response_model=list[HotWordResponse])
def list_hotwords(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    words = db.query(HotWord).order_by(HotWord.frequency.desc()).offset(skip).limit(limit).all()
    return [
        {
            "id": w.id,
            "word": w.word,
            "frequency": w.frequency or 0,
            "combinations": w.combinations or [],
            "trend": w.trend or "stable",
        }
        for w in words
    ]


@router.get("/top/{n}", response_model=list[HotWordResponse])
def top_hotwords(n: int = 20, db: Session = Depends(get_db)):
    words = db.query(HotWord).order_by(HotWord.frequency.desc()).limit(n).all()
    return [
        {
            "id": w.id,
            "word": w.word,
            "frequency": w.frequency or 0,
            "combinations": w.combinations or [],
            "trend": w.trend or "stable",
        }
        for w in words
    ]


@router.post("/combinations", response_model=list[dict])
def word_combinations(req: HotWordComboRequest, db: Session = Depends(get_db)):
    return get_hotword_combinations(db, req.word)


@router.post("/refresh")
def refresh_hotwords(db: Session = Depends(get_db)):
    update_hot_words(db)
    return {"message": "热词库已更新"}


@router.get("/trending", response_model=list[HotWordResponse])
def trending_words(db: Session = Depends(get_db)):
    words = db.query(HotWord).filter(HotWord.trend == "rising").order_by(
        HotWord.frequency.desc()
    ).limit(20).all()
    return [
        {
            "id": w.id,
            "word": w.word,
            "frequency": w.frequency or 0,
            "combinations": w.combinations or [],
            "trend": w.trend or "stable",
        }
        for w in words
    ]
