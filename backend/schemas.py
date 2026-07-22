from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


# --- Content ---
class ContentCreate(BaseModel):
    title: str
    content_text: str = ""
    source_platform: str = ""
    source_url: str = ""
    author: str = ""
    content_type: str = "text"
    tags: List[str] = []
    likes: int = 0
    comments: int = 0
    shares: int = 0
    collects: int = 0


class ContentBatchImport(BaseModel):
    items: List[ContentCreate]


class ContentResponse(BaseModel):
    id: int
    title: str
    content_text: str
    source_platform: str
    source_url: str
    author: str
    content_type: str
    tags: List[str]
    likes: int
    comments: int
    shares: int
    collects: int
    has_deconstruction: bool
    categories: List[dict] = []
    created_at: datetime

    class Config:
        from_attributes = True


class ContentSearch(BaseModel):
    keyword: str
    platform: Optional[str] = None
    category_id: Optional[int] = None


# --- Deconstruction ---
class DeconstructRequest(BaseModel):
    content_id: int


class DeconstructionResponse(BaseModel):
    id: int
    content_id: int
    title_formula: str
    hook_type: str
    content_structure: str
    emotion_curve: str
    golden_sentences: List[str]
    engagement_hooks: str
    visual_style: str
    reusable_genes: List[dict]
    score: float
    created_at: datetime

    class Config:
        from_attributes = True


# --- Rewrite ---
class RewriteRequest(BaseModel):
    template_content_id: int
    hotword_combo: List[str] = []
    style: str = "default"
    count: int = 3


class RewriteResponse(BaseModel):
    id: int
    generated_title: str
    generated_content: str
    style: str
    version: int

    class Config:
        from_attributes = True


# --- Category ---
class CategoryCreate(BaseModel):
    name: str
    description: str = ""
    parent_id: Optional[int] = None


class CategoryResponse(BaseModel):
    id: int
    name: str
    description: str
    parent_id: Optional[int]
    content_count: int = 0

    class Config:
        from_attributes = True


# --- HotWord ---
class HotWordResponse(BaseModel):
    id: int
    word: str
    frequency: int
    combinations: List[dict]
    trend: str

    class Config:
        from_attributes = True


class HotWordComboRequest(BaseModel):
    word: str


# --- API Config ---
class APIConfigUpdate(BaseModel):
    api_key: str
    api_base: str = "https://api.openai.com/v1"
    model: str = "gpt-4o-mini"


class APIConfigResponse(BaseModel):
    api_base: str
    model: str
    has_key: bool
