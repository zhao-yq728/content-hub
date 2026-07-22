import json
import re
import jieba
import jieba.analyse
from collections import Counter
from sqlalchemy.orm import Session
from models import Content, HotWord, Category


STOP_WORDS = set([
    "的", "了", "在", "是", "我", "有", "和", "就", "不", "人", "都", "一",
    "一个", "上", "也", "很", "到", "说", "要", "去", "你", "会", "着",
    "没有", "看", "好", "自己", "这", "他", "她", "它", "们", "那", "些",
    "什么", "怎么", "如何", "为什么", "可以", "这个", "那个", "还是", "但是",
    "如果", "因为", "所以", "而且", "然后", "虽然", "不过", "只是", "已经",
    "比较", "非常", "真的", "特别", "太", "更", "最", "很", "都", "才",
    "把", "被", "让", "给", "对", "从", "以", "之", "中", "等", "哦",
    "啊", "呢", "吧", "吗", "呀", "嘛", "哈", "嗯", "呵", "哎",
    "一下", "一点", "一些", "很多", "觉得", "感觉", "知道", "应该",
    "可能", "一定", "必须", "需要", "希望", "喜欢", "想", "能", "会",
    "今天", "明天", "昨天", "现在", "以后", "以前", "时候", "真的",
    "有点", "一点", "一下", "这次", "上次", "下次", "每次",
    "视频", "图片", "照片", "链接", "评论", "点赞", "关注", "收藏", "转发",
    "大家", "朋友", "姐妹", "兄弟", "宝子", "家人们", "小伙伴",
])


def extract_keywords(text: str, top_k: int = 30) -> list:
    words = jieba.analyse.extract_tags(text, topK=top_k, withWeight=True)
    return [(w, round(s, 4)) for w, s in words if w not in STOP_WORDS and len(w) >= 2]


def update_hot_words(db: Session):
    contents = db.query(Content).all()
    all_text = []
    word_content_map = {}

    for c in contents:
        text = c.title + " " + (c.content_text or "")[:2000]
        all_text.append(text)

        words = jieba.analyse.extract_tags(text, topK=20)
        for w in words:
            if w not in STOP_WORDS and len(w) >= 2:
                if w not in word_content_map:
                    word_content_map[w] = {"count": 0, "category_ids": set(), "titles": []}
                word_content_map[w]["count"] += 1
                word_content_map[w]["titles"].append(c.title[:50])
                for cat in c.categories:
                    word_content_map[w]["category_ids"].add(cat.id)

    # Update database
    for word, data in word_content_map.items():
        if data["count"] < 2:
            continue

        existing = db.query(HotWord).filter(HotWord.word == word).first()

        # Find most common category
        category_id = None
        if data["category_ids"]:
            category_id = list(data["category_ids"])[0]

        # Find related words (co-occurring)
        related = []
        combos = []
        for title in data["titles"][:5]:
            combo_words = []
            for w2, d2 in word_content_map.items():
                if w2 != word and any(w2 in t for t in data["titles"]):
                    combo_words.append(w2)
            for cw in combo_words[:5]:
                combos.append({"word": cw, "sample": title[:40]})

        trend = "rising" if data["count"] >= 5 else "stable"

        if existing:
            existing.frequency = data["count"]
            existing.combinations = combos
            existing.trend = trend
            existing.last_updated = None  # will use default
        else:
            hw = HotWord(
                word=word,
                frequency=data["count"],
                category_id=category_id,
                combinations=combos,
                trend=trend,
            )
            db.add(hw)

    db.commit()


def get_hotword_combinations(db: Session, word: str) -> list:
    hw = db.query(HotWord).filter(HotWord.word == word).first()
    if hw and hw.combinations:
        return hw.combinations

    # Fallback: search in content
    contents = db.query(Content).filter(
        (Content.title.contains(word)) | (Content.content_text.contains(word))
    ).limit(20).all()

    counter = Counter()
    for c in contents:
        text = c.title + " " + (c.content_text or "")[:1000]
        words = jieba.analyse.extract_tags(text, topK=15)
        for w in words:
            if w != word and w not in STOP_WORDS and len(w) >= 2:
                counter[w] += 1

    return [{"word": w, "count": c} for w, c in counter.most_common(10)]
