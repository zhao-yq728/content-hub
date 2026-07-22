import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Float, Boolean, DateTime,
    ForeignKey, Table, JSON
)
from sqlalchemy.orm import relationship
from database import Base


# Many-to-many: content <-> category
content_category = Table(
    "content_category", Base.metadata,
    Column("content_id", Integer, ForeignKey("contents.id"), primary_key=True),
    Column("category_id", Integer, ForeignKey("categories.id"), primary_key=True),
)


class Content(Base):
    __tablename__ = "contents"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(500), nullable=False)
    content_text = Column(Text, default="")
    source_platform = Column(String(50), default="")   # xiaohongshu, douyin, shipinhao, gongzhonghao, manual
    source_url = Column(String(1000), default="")
    author = Column(String(200), default="")
    content_type = Column(String(20), default="text")   # text, image_text, video
    cover_image = Column(String(1000), default="")
    media_files = Column(JSON, default=[])
    likes = Column(Integer, default=0)
    comments = Column(Integer, default=0)
    shares = Column(Integer, default=0)
    collects = Column(Integer, default=0)
    tags = Column(JSON, default=[])
    has_deconstruction = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    categories = relationship("Category", secondary=content_category, back_populates="contents")
    deconstruction = relationship("Deconstruction", back_populates="content", uselist=False, cascade="all, delete-orphan")
    generated_contents = relationship("GeneratedContent", back_populates="source_content", cascade="all, delete-orphan")


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(String(500), default="")
    parent_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    icon = Column(String(50), default="")

    contents = relationship("Content", secondary=content_category, back_populates="categories")
    sub_categories = relationship("Category", backref="parent", remote_side=[id])
    hot_words = relationship("HotWord", back_populates="category")


class Deconstruction(Base):
    __tablename__ = "deconstructions"

    id = Column(Integer, primary_key=True, index=True)
    content_id = Column(Integer, ForeignKey("contents.id"), unique=True, nullable=False)
    title_formula = Column(String(500), default="")
    hook_type = Column(String(500), default="")
    content_structure = Column(Text, default="")
    emotion_curve = Column(String(500), default="")
    golden_sentences = Column(JSON, default=[])
    engagement_hooks = Column(String(500), default="")
    visual_style = Column(String(500), default="")
    reusable_genes = Column(JSON, default=[])
    raw_analysis = Column(Text, default="")
    score = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    content = relationship("Content", back_populates="deconstruction")


class HotWord(Base):
    __tablename__ = "hot_words"

    id = Column(Integer, primary_key=True, index=True)
    word = Column(String(200), nullable=False)
    frequency = Column(Integer, default=0)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    related_words = Column(JSON, default=[])
    combinations = Column(JSON, default=[])
    trend = Column(String(20), default="stable")   # rising, stable, declining
    last_updated = Column(DateTime, default=datetime.datetime.utcnow)

    category = relationship("Category", back_populates="hot_words")


class GeneratedContent(Base):
    __tablename__ = "generated_contents"

    id = Column(Integer, primary_key=True, index=True)
    source_content_id = Column(Integer, ForeignKey("contents.id"), nullable=True)
    template_id = Column(Integer, ForeignKey("deconstructions.id"), nullable=True)
    hotword_combo = Column(JSON, default=[])
    generated_title = Column(String(500), default="")
    generated_content = Column(Text, default="")
    style = Column(String(50), default="default")
    version = Column(Integer, default=1)
    is_starred = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    source_content = relationship("Content", back_populates="generated_contents")
