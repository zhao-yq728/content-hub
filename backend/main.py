from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from database import init_db, SessionLocal
from models import Category
from routers import content, deconstruct, rewrite, categories, hotwords, config
import os

app = FastAPI(title="爆款内容智库", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(content.router)
app.include_router(deconstruct.router)
app.include_router(rewrite.router)
app.include_router(categories.router)
app.include_router(hotwords.router)
app.include_router(config.router)

# Static files for uploads
uploads_dir = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")


@app.on_event("startup")
def startup():
    init_db()
    _seed_categories()


def _seed_categories():
    db = SessionLocal()
    try:
        defaults = [
            "占星星座", "玄学命理", "情感关系", "职场成长", "养生健康",
            "变美穿搭", "生活干货", "自媒体运营", "赚钱副业", "带货种草",
            "家居生活", "其他"
        ]
        for name in defaults:
            existing = db.query(Category).filter(Category.name == name).first()
            if not existing:
                db.add(Category(name=name))
        db.commit()
    finally:
        db.close()


@app.get("/api/health")
def health():
    return {"status": "ok", "name": "爆款内容智库 API"}
