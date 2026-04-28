#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
公众号文案 AI 生成脚本

根据用户需求和图片内容，使用 AI 生成标题、副标题、正文，
并混合排版输出 Markdown 文件。

使用方法:
    python generate_article.py \
        --type "产品介绍" \
        --style "专业严谨" \
        --min-words 500 \
        --max-words 800 \
        --image-dir "D:/images" \
        --custom "强调环保特性" \
        --output "data/generated"
"""

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

try:
    import requests
except ImportError:
    print("请安装 requests: pip install requests")
    sys.exit(1)


# ============================================================================
# 配置
# ============================================================================

DEFAULT_CONFIG = {
    "provider": "openai",
    "apiKey": "",
    "model": "gpt-4o-mini",
    "baseUrl": "",
    "maxTokens": 4096,
    "temperature": 0.7,
    "localFormat": "openai"
}

CONFIG_PATH = Path(__file__).parent.parent.parent / "data" / "api-config.json"

SUPPORTED_IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}


# ============================================================================
# API 客户端
# ============================================================================

class AIAPIClient:
    """AI API 客户端，支持多种提供商"""
    
    def __init__(self, config: dict):
        self.config = config
        self.provider = config.get("provider", "openai")
        self.api_key = config.get("apiKey", "")
        self.model = config.get("model", "gpt-4o-mini")
        self.base_url = config.get("baseUrl", "")
        self.max_tokens = config.get("maxTokens", 4096)
        self.temperature = config.get("temperature", 0.7)
        self.local_format = config.get("localFormat", "openai")
    
    def generate(self, prompt: str, system_prompt: str = "") -> str:
        """生成内容"""
        if self.provider == "openai":
            return self._call_openai(prompt, system_prompt)
        elif self.provider == "google":
            return self._call_gemini(prompt, system_prompt)
        elif self.provider == "anthropic":
            return self._call_claude(prompt, system_prompt)
        elif self.provider == "local":
            return self._call_local(prompt, system_prompt)
        else:
            raise ValueError(f"不支持的提供商: {self.provider}")
    
    def _call_openai(self, prompt: str, system_prompt: str) -> str:
        """调用 OpenAI API"""
        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        data = {
            "model": self.model,
            "messages": messages,
            "max_tokens": self.max_tokens,
            "temperature": self.temperature
        }
        
        response = requests.post(url, headers=headers, json=data, timeout=60)
        response.raise_for_status()
        result = response.json()
        return result["choices"][0]["message"]["content"]
    
    def _call_gemini(self, prompt: str, system_prompt: str) -> str:
        """调用 Google Gemini API"""
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent"
        headers = {
            "Content-Type": "application/json",
            "x-goog-api-key": self.api_key
        }
        
        contents = []
        if system_prompt:
            contents.append({"role": "user", "parts": [{"text": system_prompt}]})
            contents.append({"role": "model", "parts": [{"text": "好的，我明白了。"}]})
        contents.append({"role": "user", "parts": [{"text": prompt}]})
        
        data = {
            "contents": contents,
            "generationConfig": {
                "maxOutputTokens": self.max_tokens,
                "temperature": self.temperature
            }
        }
        
        response = requests.post(url, headers=headers, json=data, timeout=60)
        response.raise_for_status()
        result = response.json()
        return result["candidates"][0]["content"]["parts"][0]["text"]
    
    def _call_claude(self, prompt: str, system_prompt: str) -> str:
        """调用 Anthropic Claude API"""
        url = "https://api.anthropic.com/v1/messages"
        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json"
        }
        
        data = {
            "model": self.model,
            "max_tokens": self.max_tokens,
            "system": system_prompt if system_prompt else "",
            "messages": [{"role": "user", "content": prompt}]
        }
        
        response = requests.post(url, headers=headers, json=data, timeout=60)
        response.raise_for_status()
        result = response.json()
        return result["content"][0]["text"]
    
    def _call_local(self, prompt: str, system_prompt: str) -> str:
        """调用本地模型"""
        if self.local_format == "ollama":
            return self._call_ollama(prompt, system_prompt)
        else:
            return self._call_openai_compatible(prompt, system_prompt)
    
    def _call_openai_compatible(self, prompt: str, system_prompt: str) -> str:
        """调用 OpenAI 兼容格式的本地模型"""
        if not self.base_url:
            self.base_url = "http://localhost:1234/v1"
        
        url = f"{self.base_url}/chat/completions"
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        data = {
            "model": self.model,
            "messages": messages,
            "max_tokens": self.max_tokens,
            "temperature": self.temperature
        }
        
        response = requests.post(url, headers=headers, json=data, timeout=120)
        response.raise_for_status()
        result = response.json()
        return result["choices"][0]["message"]["content"]
    
    def _call_ollama(self, prompt: str, system_prompt: str) -> str:
        """调用 Ollama 原生 API"""
        if not self.base_url:
            self.base_url = "http://localhost:11434"
        
        url = f"{self.base_url}/api/chat"
        headers = {"Content-Type": "application/json"}
        
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        data = {
            "model": self.model,
            "messages": messages,
            "stream": False
        }
        
        response = requests.post(url, headers=headers, json=data, timeout=120)
        response.raise_for_status()
        result = response.json()
        return result["message"]["content"]


# ============================================================================
# Prompt 模板
# ============================================================================

def get_system_prompt(article_type: str, style: str) -> str:
    """获取系统提示词"""
    return f"""你是一位专业的公众号文案撰写专家。你擅长撰写{article_type}类型的文章，文风{style}。

请根据用户提供的信息生成高质量的公众号文案，包括：
1. 吸引眼球的标题
2. 简洁有力的副标题
3. 正文内容，包含适当的段落划分和重点标注

要求：
- 标题要有吸引力，能引发读者好奇心
- 副标题概括文章核心价值
- 正文逻辑清晰，层次分明
- 适当使用小标题划分章节
- 重点内容用加粗标注
- 文末可以加简短总结或互动引导

输出格式要求使用 Markdown 格式：
# 标题
## 副标题

正文内容...
"""


def get_user_prompt(
    article_type: str,
    style: str,
    min_words: int,
    max_words: int,
    custom: Optional[str],
    images: list
) -> str:
    """构建用户提示词"""
    
    prompt_parts = [
        f"请撰写一篇{article_type}类型的公众号文章，文风要求{style}。",
        f"字数控制在{min_words}-{max_words}字之间。"
    ]
    
    if custom:
        prompt_parts.append(f"用户特别要求：{custom}")
    
    if images:
        prompt_parts.append(f"\n用户提供了{len(images)}张图片用于配图：")
        for i, img in enumerate(images, 1):
            prompt_parts.append(f"  {i}. {img}")
        prompt_parts.append("\n请在文章中合适的位置标注图片插入点，格式为：![图片描述](图片文件名)")
    
    prompt_parts.append("\n请直接输出 Markdown 格式的文章内容。")
    
    return "\n".join(prompt_parts)


# ============================================================================
# 主流程
# ============================================================================

def load_config() -> dict:
    """加载配置"""
    if CONFIG_PATH.exists():
        with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    return DEFAULT_CONFIG.copy()


def scan_images(image_dir: str) -> list:
    """扫描图片目录"""
    images = []
    path = Path(image_dir)
    if not path.exists():
        return images
    
    for f in path.iterdir():
        if f.suffix.lower() in SUPPORTED_IMAGE_EXTENSIONS:
            images.append(f.name)
    return sorted(images)


def generate_article(
    article_type: str,
    style: str,
    min_words: int,
    max_words: int,
    image_dir: Optional[str],
    custom: Optional[str],
    output_dir: str
) -> str:
    """生成文章"""
    
    # 加载配置
    config = load_config()
    
    # 扫描图片
    images = []
    if image_dir:
        images = scan_images(image_dir)
        if not images:
            print(f"警告：图片目录 {image_dir} 中未找到图片")
    
    # 创建客户端
    client = AIAPIClient(config)
    
    # 构建提示词
    system_prompt = get_system_prompt(article_type, style)
    user_prompt = get_user_prompt(article_type, style, min_words, max_words, custom, images)
    
    print(f"正在生成文章...")
    print(f"  类型: {article_type}")
    print(f"  风格: {style}")
    print(f"  字数: {min_words}-{max_words}")
    print(f"  图片: {len(images)}张")
    
    # 调用 AI
    content = client.generate(user_prompt, system_prompt)
    
    # 保存文件
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"article_{timestamp}.md"
    filepath = output_path / filename
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"\n文章已保存: {filepath}")
    return str(filepath)


def main():
    parser = argparse.ArgumentParser(description='公众号文案 AI 生成工具')
    parser.add_argument('--type', required=True, help='文案类型')
    parser.add_argument('--style', required=True, help='文案风格')
    parser.add_argument('--min-words', type=int, default=500, help='最少字数')
    parser.add_argument('--max-words', type=int, default=800, help='最多字数')
    parser.add_argument('--image-dir', help='图片目录路径')
    parser.add_argument('--custom', help='自定义要求')
    parser.add_argument('--output', default='data/generated', help='输出目录')
    
    args = parser.parse_args()
    
    try:
        filepath = generate_article(
            article_type=args.type,
            style=args.style,
            min_words=args.min_words,
            max_words=args.max_words,
            image_dir=args.image_dir,
            custom=args.custom,
            output_dir=args.output
        )
        print(f"\n生成成功！文件路径: {filepath}")
    except Exception as e:
        print(f"\n生成失败: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()
