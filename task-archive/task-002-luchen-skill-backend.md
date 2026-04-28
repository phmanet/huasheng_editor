# Task 002 - 陆沉 - 后端逻辑完善与 Skill 脚本开发

## 任务概述
完善 AI 功能的图片处理逻辑，并实现 `generate_article.py` Skill 脚本。

## 背景
项目路径：`D:\Dev\Project\huasheng_editor`
- 主 JS 文件：`app_v5.js`
- Skill 目录：`skills/huasheng-ai-article/`
- 脚本目录：`skills/huasheng-ai-article/scripts/`（当前为空）

## 现有状态
✅ 已完成：AIAPIClient 类（支持 OpenAI/Gemini/Claude/本地）、各 Provider API 调用、配置保存/加载
✅ 已完成：generateAIContent 方法（JS 端生成逻辑）
❌ 待完成：generate_article.py Skill 脚本

## 工作内容

### 1. 实现 generate_article.py Skill 脚本

#### 脚本功能
根据命令行参数，使用配置的 AI API 生成公众号文案，保存为 Markdown 文件。

#### 脚本位置
`D:\Dev\Project\huasheng_editor\skills\huasheng-ai-article\scripts\generate_article.py`

#### 命令行参数
```
python generate_article.py ^
  --type "产品介绍" ^
  --style "专业严谨" ^
  --min-words 500 ^
  --max-words 800 ^
  --image-dir "D:/images" ^
  --custom "强调环保特性" ^
  --output "data/generated"
```

#### 参数说明
| 参数 | 必填 | 说明 |
|------|------|------|
| --type | 是 | 文案类型：产品介绍/新闻资讯/情感故事/技术教程/活动宣传 |
| --style | 是 | 文案风格：专业严谨/轻松活泼/文艺清新/幽默风趣/简约大方 |
| --min-words | 是 | 最少字数 |
| --max-words | 是 | 最多字数 |
| --image-dir | 否 | 图片目录路径 |
| --custom | 否 | 用户自定义要求 |
| --output | 否 | 输出目录（默认 data/generated） |
| --api-config | 否 | API 配置文件路径（默认 data/api-config.json） |

#### API 配置读取
读取 `data/api-config.json`（JSON 格式）：
```json
{
  "provider": "openai",
  "apiKey": "sk-xxx",
  "model": "gpt-4o-mini",
  "baseUrl": "https://api.openai.com/v1",
  "maxTokens": 4096,
  "temperature": 0.7
}
```

#### Prompt 构建逻辑
根据 `--type` 参数，从 `references/prompts.md` 中读取对应模板，替换占位符：
- `{type}` → 文案类型
- `{style}` → 文案风格
- `{min_words}` → 最少字数
- `{max_words}` → 最多字数
- `{image_list}` → 图片文件名列表（从目录扫描）
- `{custom}` → 用户自定义要求

#### 图片处理
- 如果指定了 `--image-dir`，扫描目录下所有图片（jpg/jpeg/png/gif/webp）
- 在 prompt 的 `{image_list}` 部分列出图片文件名（共 N 张）
- **注意**：不实际读取图片内容，只传递文件名列表（节省 token）

#### 输出文件
- 文件名格式：`{日期}_{类型}_{时间戳}.md`，如 `20260428_产品介绍_143052.md`
- 保存路径：`data/generated/`（相对于项目根目录）
- 文件编码：UTF-8

#### 输出内容格式
```
# 标题（20字以内）

## 副标题（30字以内）

正文内容...

正文内容...

![图片描述](可选：图片路径）

更多正文...
```

#### 错误处理
- API 调用失败：打印错误信息，退出码 1
- 图片目录不存在：提示用户检查路径
- 配置文件不存在：提示用户先在 WebUI 配置
- 生成内容为空：提示调整参数

### 2. 检查 JS 端图片处理逻辑

在 `app_v5.js` 中检查 `handleImageFolderSelect` 和相关图片处理逻辑：
- 确保 `aiSelectedImages` 数据结构正确（包含 name、file、preview）
- 确保 `generateAIContent` 正确处理已选择的图片
- 如果发现逻辑问题，修复并标注

### 3. API 配置 JSON 文件创建

确保 `data/api-config.json` 存在并包含正确的默认结构。

## 交付物
1. `skills/huasheng-ai-article/scripts/generate_article.py`（完整可运行脚本）
2. 如有修改，更新后的 `app_v5.js` 片段

## 技术要求
- 使用 Python 3.x
- 使用 `requests` 库进行 HTTP 请求
- 处理多种 API 格式（OpenAI/Gemini/Claude/Ollama/OpenAI兼容本地）
- 所有文件读写使用 UTF-8 编码
- 兼容 Windows 路径

## 参考
- AIAPIClient 实现参考：`app_v5.js` 中的 `AIAPIClient` 类（行 514+）
- Prompt 模板：`skills/huasheng-ai-article/references/prompts.md`
- PRD：`docs/PRD-AI功能增强.md` 第 2.2 节
