from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional
from database import get_db
from models import Content, Category
from schemas import ContentCreate, ContentResponse, ContentSearch, ContentBatchImport
import csv
import io

router = APIRouter(prefix="/api/content", tags=["content"])


@router.post("/", response_model=ContentResponse)
def create_content(data: ContentCreate, db: Session = Depends(get_db)):
    content = Content(
        title=data.title,
        content_text=data.content_text,
        source_platform=data.source_platform,
        source_url=data.source_url,
        author=data.author,
        content_type=data.content_type,
        tags=data.tags,
        likes=data.likes,
        comments=data.comments,
        shares=data.shares,
        collects=data.collects,
    )
    db.add(content)
    db.commit()
    db.refresh(content)
    return _to_response(content)


@router.get("/", response_model=List[ContentResponse])
def list_contents(
    skip: int = 0,
    limit: int = 50,
    platform: Optional[str] = None,
    category_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    query = db.query(Content)
    if platform:
        query = query.filter(Content.source_platform == platform)
    if category_id:
        query = query.join(Content.categories).filter(Category.id == category_id)
    contents = query.order_by(Content.created_at.desc()).offset(skip).limit(limit).all()
    return [_to_response(c) for c in contents]


@router.post("/search", response_model=List[ContentResponse])
def search_content(params: ContentSearch, db: Session = Depends(get_db)):
    query = db.query(Content)
    if params.keyword:
        kw = f"%{params.keyword}%"
        query = query.filter(
            or_(Content.title.ilike(kw), Content.content_text.ilike(kw))
        )
    if params.platform:
        query = query.filter(Content.source_platform == params.platform)
    if params.category_id:
        query = query.join(Content.categories).filter(Category.id == params.category_id)
    contents = query.order_by(Content.created_at.desc()).limit(50).all()
    return [_to_response(c) for c in contents]


@router.get("/{content_id}", response_model=ContentResponse)
def get_content(content_id: int, db: Session = Depends(get_db)):
    content = db.query(Content).filter(Content.id == content_id).first()
    if not content:
        raise HTTPException(status_code=404, detail="内容不存在")
    return _to_response(content)


@router.put("/{content_id}", response_model=ContentResponse)
def update_content(content_id: int, data: ContentCreate, db: Session = Depends(get_db)):
    content = db.query(Content).filter(Content.id == content_id).first()
    if not content:
        raise HTTPException(status_code=404, detail="内容不存在")
    for key, value in data.model_dump().items():
        setattr(content, key, value)
    db.commit()
    db.refresh(content)
    return _to_response(content)


@router.delete("/{content_id}")
def delete_content(content_id: int, db: Session = Depends(get_db)):
    content = db.query(Content).filter(Content.id == content_id).first()
    if not content:
        raise HTTPException(status_code=404, detail="内容不存在")
    db.delete(content)
    db.commit()
    return {"ok": True}


@router.post("/batch-import")
def batch_import(data: ContentBatchImport, db: Session = Depends(get_db)):
    created = []
    for item in data.items:
        content = Content(
            title=item.title,
            content_text=item.content_text,
            source_platform=item.source_platform,
            source_url=item.source_url,
            author=item.author,
            content_type=item.content_type,
            tags=item.tags,
            likes=item.likes,
            comments=item.comments,
            shares=item.shares,
            collects=item.collects,
        )
        db.add(content)
        created.append(content)
    db.commit()
    return {"count": len(created), "message": f"成功导入 {len(created)} 条内容"}


@router.post("/import-csv")
async def import_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    contents = await file.read()
    reader = csv.DictReader(io.StringIO(contents.decode("utf-8-sig")))
    count = 0
    for row in reader:
        content = Content(
            title=row.get("title", ""),
            content_text=row.get("content_text", row.get("content", "")),
            source_platform=row.get("source_platform", row.get("platform", "")),
            source_url=row.get("source_url", row.get("url", "")),
            author=row.get("author", ""),
            content_type=row.get("content_type", "text"),
            tags=[t.strip() for t in row.get("tags", "").split(",") if t.strip()],
            likes=int(row.get("likes", 0)),
            comments=int(row.get("comments", 0)),
            shares=int(row.get("shares", 0)),
            collects=int(row.get("collects", 0)),
        )
        db.add(content)
        count += 1
    db.commit()
    return {"count": count, "message": f"成功导入 {count} 条内容"}


def _to_response(content: Content) -> dict:
    return {
        "id": content.id,
        "title": content.title,
        "content_text": content.content_text,
        "source_platform": content.source_platform,
        "source_url": content.source_url,
        "author": content.author,
        "content_type": content.content_type,
        "tags": content.tags or [],
        "likes": content.likes or 0,
        "comments": content.comments or 0,
        "shares": content.shares or 0,
        "collects": content.collects or 0,
        "has_deconstruction": content.has_deconstruction or False,
        "categories": [{"id": c.id, "name": c.name} for c in content.categories],
        "created_at": content.created_at,
    }
