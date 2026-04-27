---
name: huasheng-ai-article
description: |
  公众号文案 AI 生成技能。根据用户需求和图片内容，使用 AI 生成标题、副标题、正文，并混合排版输出 Markdown 文件。

  使用场景：
  - 用户说"帮我生成文案"、"AI 写文章"、"根据图片生成内容"
  - 需要输入文案类型、风格、字数、图片文件夹来生成公众号文章
  - 生成后需要将 Markdown 文件保存到项目 data/generated 目录

  输入参数：
  - 文案类型：产品介绍、新闻资讯、情感故事、技术教程、活动宣传等
  - 文案风格：专业严谨、轻松活泼、文艺清新、幽默风趣、简约大方等
  - 字数范围：如 500-800字、1000-1500字
  - 图片文件夹：用户提供的图片所在目录
  - 自定义控制：用户额外的要求或限制

  输出：
  - 生成标题、副标题、正文
  - 文案内容与图片混合排版
  - 保存为 Markdown 文件到 data/generated 目录
---

# 公众号文案 AI 生成技能

## 工作流程

1. **收集用户需求**
   - 确认文案类型、风格、字数范围
   - 获取图片文件夹路径
   - 记录用户自定义要求

2. **读取图片目录**
   - 扫描指定目录下的所有图片文件
   - 获取图片文件名和路径
   - 记录图片数量

3. **构建 AI 请求**
   - 根据项目类型构建 prompt
   - 将图片路径信息包含在 prompt 中
   - 包含排版要求

4. **调用 AI 生成**
   - 调用配置的 AI API
   - 支持 OpenAI、Google、Anthropic、本地模型
   - 处理响应内容

5. **生成 Markdown 文件**
   - 构建包含标题、副标题、正文的 Markdown
   - 按适当位置插入图片引用
   - 保存到 `data/generated/` 目录

6. **返回结果**
   - 返回生成的文件路径
   - 显示文案预览

## 支持的 AI API 提供商

### OpenAI
- 模型：gpt-4o、gpt-4o-mini、gpt-4-turbo
- API 格式：`https://api.openai.com/v1/chat/completions`
- 需要 API Key

### Google (Gemini)
- 模型：gemini-2.0-flash、gemini-1.5-pro、gemini-1.5-flash
- API 格式：`https://generativelanguage.googleapis.com/v1beta/models/xxx:generateContent`
- 需要 API Key

### Anthropic (Claude)
- 模型：claude-sonnet-4-20250514、claude-3-5-sonnet-20241022、claude-3-5-haiku-20241022
- API 格式：`https://api.anthropic.com/v1/messages`
- 需要 API Key

### 本地模型
- 支持兼容 OpenAI API 格式的本地部署模型
- 如 Ollama、LM Studio 等
- 可配置自定义 API 地址

## API 配置

API 配置通过 WebUI 的配置界面设置，保存到 `data/api-config.json`：
```json
{
  "provider": "openai|google|anthropic|local",
  "apiKey": "xxx",
  "model": "gpt-4o-mini",
  "apiUrl": "https://api.openai.com/v1/chat/completions",  // 仅本地模型需要
  "maxTokens": 4096,
  "temperature": 0.7
}
```

## Prompt 构建模板

根据文案类型选择对应模板，详见 [references/prompts.md](references/prompts.md)

## 排版规范

生成的 Markdown 文件应遵循以下排版规范：
- 标题使用 `#` 标记（一级标题）
- 副标题使用 `##` 标记（二级标题）
- 正文段落使用 `>` 标记引用样式突出重点
- 图片使用 `![](图片路径)` 格式
- 列表使用 `-` 标记
- 强调使用 `**加粗**` 和 `*斜体*`

## 执行脚本

使用 `scripts/generate_article.py` 执行生成：

```bash
python scripts/generate_article.py \
  --type "产品介绍" \
  --style "专业严谨" \
  --min-words 500 \
  --max-words 800 \
  --image-dir "D:/images" \
  --custom "强调环保特性" \
  --output "data/generated"
```

脚本参数说明：
- `--type`: 文案类型
- `--style`: 文案风格
- `--min-words`: 最少字数
- `--max-words`: 最多字数
- `--image-dir`: 图片目录路径
- `--custom`: 用户自定义要求
- `--output`: 输出目录（默认 data/generated）

## 错误处理

- 图片目录不存在：提示用户检查路径
- API 调用失败：显示具体错误信息，提供重试选项
- 生成内容为空：提示调整参数或检查 API 配置
- 文件保存失败：检查目录权限