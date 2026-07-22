from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Category, Content
from schemas import CategoryCreate, CategoryResponse
from services.ai_service import call_ai, CATEGORY_CLASSIFY_PROMPT

router = APIRouter(prefix="/api/categories", tags=["categories"])


DEFAULT_CATEGORIES = [
    {"name": "占星星座", "description": "星座运势、星盘解析、合盘分析"},
    {"name": "玄学命理", "description": "八字、塔罗、风水、紫微斗数"},
    {"name": "情感关系", "description": "恋爱技巧、分手疗愈、亲密关系"},
    {"name": "职场成长", "description": "职场沟通、副业、效率提升"},
    {"name": "养生健康", "description": "中医养生、季节调理、情绪健康"},
    {"name": "变美穿搭", "description": "护肤、妆容、穿搭、体态管理"},
    {"name": "生活干货", "description": "收纳、做饭、省钱技巧"},
    {"name": "自媒体运营", "description": "涨粉、文案、拍摄、平台算法"},
    {"name": "赚钱副业", "description": "副业思路、理财、创业经验"},
    {"name": "带货种草", "description": "好物推荐、测评、开箱"},
    {"name": "家居生活", "description": "装修、软装、居家好物"},
    {"name": "其他", "description": "无法归类的临时分类"},
]


@router.get("/", response_model=list[CategoryResponse])
def list_categories(db: Session = Depends(get_db)):
    categories = db.query(Category).all()
    result = []
    for c in categories:
        content_count = len(c.contents)
        result.append({
            "id": c.id,
            "name": c.name,
            "description": c.description or "",
            "parent_id": c.parent_id,
            "content_count": content_count,
        })
    return result


@router.post("/", response_model=CategoryResponse)
def create_category(data: CategoryCreate, db: Session = Depends(get_db)):
    existing = db.query(Category).filter(Category.name == data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="分类已存在")
    cat = Category(name=data.name, description=data.description, parent_id=data.parent_id)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return {
        "id": cat.id,
        "name": cat.name,
        "description": cat.description or "",
        "parent_id": cat.parent_id,
        "content_count": 0,
    }


@router.delete("/{category_id}")
def delete_category(category_id: int, db: Session = Depends(get_db)):
    cat = db.query(Category).filter(Category.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="分类不存在")
    db.delete(cat)
    db.commit()
    return {"ok": True}


@router.post("/auto-classify/{content_id}")
async def auto_classify(content_id: int, db: Session = Depends(get_db)):
    content = db.query(Content).filter(Content.id == content_id).first()
    if not content:
        raise HTTPException(status_code=404, detail="内容不存在")

    # Try AI classification
    try:
        prompt = CATEGORY_CLASSIFY_PROMPT.format(
            title=content.title,
            content=content.content_text[:500],
        )
        result = await call_ai(prompt, temperature=0.2)
        category_names = [n.strip() for n in result.split(",")]
    except Exception:
        # Fallback: keyword-based
        category_names = _keyword_classify(content.title + " " + content.content_text[:500])

    # Assign categories
    content.categories = []
    for name in category_names[:3]:
        cat = db.query(Category).filter(Category.name == name).first()
        if cat:
            content.categories.append(cat)

    db.commit()
    return {
        "categories": [{"id": c.id, "name": c.name} for c in content.categories]
    }


@router.post("/{category_id}/add-content/{content_id}")
def add_content_to_category(category_id: int, content_id: int, db: Session = Depends(get_db)):
    cat = db.query(Category).filter(Category.id == category_id).first()
    content = db.query(Content).filter(Content.id == content_id).first()
    if not cat or not content:
        raise HTTPException(status_code=404, detail="分类或内容不存在")
    if cat not in content.categories:
        content.categories.append(cat)
        db.commit()
    return {"ok": True}


@router.post("/{category_id}/remove-content/{content_id}")
def remove_content_from_category(category_id: int, content_id: int, db: Session = Depends(get_db)):
    cat = db.query(Category).filter(Category.id == category_id).first()
    content = db.query(Content).filter(Content.id == content_id).first()
    if not cat or not content:
        raise HTTPException(status_code=404, detail="分类或内容不存在")
    if cat in content.categories:
        content.categories.remove(cat)
        db.commit()
    return {"ok": True}


def _keyword_classify(text: str) -> list:
    rules = {
        "占星星座": ["星座", "星盘", "水逆", "上升", "太阳", "月亮", "金星", "火星", "12星座", "十二星座", "运势"],
        "玄学命理": ["八字", "塔罗", "风水", "紫微", "命理", "算命", "手相", "面相", "六爻", "奇门"],
        "情感关系": ["恋爱", "分手", "前任", "暗恋", "暧昧", "婚姻", "出轨", "亲密关系", "情侣"],
        "职场成长": ["职场", "工作", "面试", "升职", "跳槽", "副业", "效率", "成长", "自律"],
        "养生健康": ["养生", "中医", "调理", "气血", "睡眠", "焦虑", "抑郁", "健康", "身体"],
        "变美穿搭": ["穿搭", "护肤", "化妆", "变美", "减肥", "瘦身", "发型", "美甲", "体态"],
        "生活干货": ["收纳", "做饭", "省钱", "租房", "搬家", "攻略", "技巧", "妙招"],
        "自媒体运营": ["涨粉", "文案", "拍摄", "剪辑", "选题", "流量", "算法", "自媒体", "博主"],
        "赚钱副业": ["赚钱", "理财", "基金", "股票", "创业", "副业", "收入", "存款"],
        "带货种草": ["推荐", "好物", "测评", "开箱", "种草", "必入", "平替", "神器"],
        "家居生活": ["装修", "软装", "改造", "家居", "房间", "布置", "好物", "居家"],
    }

    scores = {}
    for cat, keywords in rules.items():
        score = sum(1 for kw in keywords if kw in text)
        if score > 0:
            scores[cat] = score

    sorted_cats = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    result = [cat for cat, _ in sorted_cats[:3]]
    if not result:
        result = ["其他"]
    return result
