import json
import os
import httpx

# API config stored in a simple JSON file for MVP
CONFIG_FILE = os.path.join(os.path.dirname(__file__), "..", "api_config.json")


def load_config():
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"api_key": "", "api_base": "https://api.openai.com/v1", "model": "gpt-4o-mini"}


def save_config(config: dict):
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(config, f, ensure_ascii=False, indent=2)


async def call_ai(prompt: str, system_prompt: str = "", temperature: float = 0.7) -> str:
    config = load_config()
    if not config.get("api_key"):
        raise ValueError("请先配置 API Key")

    async with httpx.AsyncClient(timeout=120.0) as client:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        resp = await client.post(
            f"{config['api_base']}/chat/completions",
            headers={
                "Authorization": f"Bearer {config['api_key']}",
                "Content-Type": "application/json",
            },
            json={
                "model": config["model"],
                "messages": messages,
                "temperature": temperature,
            },
        )
        if resp.status_code != 200:
            raise ValueError(f"AI API 调用失败: {resp.status_code} {resp.text}")

        data = resp.json()
        return data["choices"][0]["message"]["content"]


DECONSTRUCT_PROMPT = """你是一个爆款内容拆解专家。请分析以下内容，用 JSON 格式返回拆解结果。

要求返回严格 JSON，不要包含 markdown 代码块标记，不要有任何额外说明文字。

格式：
{
  "title_formula": "标题使用的公式类型（如：数字+悬念、痛点+解决方案、反常识+解释、热点+人格化等）",
  "hook_type": "开篇钩子类型（如：提问式、故事式、数据冲击、情绪共鸣、冲突制造等）及原文前3句分析",
  "content_structure": "正文结构框架和比例（如：总起10%+分述70%+总结20%）",
  "emotion_curve": "情绪起伏曲线（如：好奇→共鸣→焦虑→释然→被激励）",
  "golden_sentences": ["金句1", "金句2"],
  "engagement_hooks": "结尾互动引导方式（如：提问、投票暗示、收藏提示、转发理由）",
  "visual_style": "如果是图文内容，分析封面/配图风格；如果是纯文字，写'纯文字内容'",
  "reusable_genes": [
    {"element": "基因元素名", "description": "为什么有效", "use_case": "如何在其他内容中复用"}
  ],
  "score": 85
}

待分析内容：
标题：{title}
正文：{content}
"""


REWRITE_PROMPT = """你是一个爆款内容创作专家。请根据以下爆款基因模板和热词组合，生成 {count} 条全新的同类内容。

核心要求：
1. 保留原爆款的结构基因（标题公式、开篇方式、正文框架、情绪曲线），但内容主题和具体表述必须完全不同
2. 融入给定的热词组合
3. 风格：{style_desc}
4. 生成的内容不能和原文雷同，查重相似度应低于 30%

输出严格 JSON 格式（不要 markdown 代码块标记）：

{
  "results": [
    {
      "title": "新标题",
      "content": "完整正文内容"
    }
  ]
}

参考爆款基因模板：
- 标题公式：{title_formula}
- 开篇方式：{hook_type}
- 正文结构：{content_structure}
- 情绪曲线：{emotion_curve}
- 可复用基因：{genes}

热词组合：{hotwords}

原文（仅作结构参考，不要模仿内容）：
标题：{original_title}
正文：{original_content}
"""


CATEGORY_CLASSIFY_PROMPT = """你是一个内容分类专家。请将以下内容归类到最合适的分类中。

可用分类：占星星座, 玄学命理, 情感关系, 职场成长, 养生健康, 变美穿搭, 生活干货, 自媒体运营, 赚钱副业, 带货种草, 家居生活, 其他

请只返回最匹配的 1-3 个分类名，用逗号分隔，不要任何额外文字。

标题：{title}
正文（前500字）：{content}
"""

STYLE_DESC = {
    "default": "自然流畅，有个人观点，适合大众阅读",
    "healing": "温柔治愈，共情力强，给人安全感和力量感",
    "sharp": "观点犀利，一针见血，有冲击力和记忆点",
    "dry": "干货满满，结构清晰，实用性强，减少情绪渲染",
    "story": "以故事叙事为主，有画面感和代入感",
}
