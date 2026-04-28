# Task 003 - 温瑜 - 项目文档更新

## 任务概述
更新华声编辑器的项目文档，反映新完成的 AI 功能。

## 背景
项目路径：`D:\Dev\Project\huasheng_editor`
- 核心文档：`AGENTS.md`、`CLAUDE.md`（两个文件内容相同，是技术文档入口）
- 功能文档：`README.md`
- PRD 文档：`docs/PRD-AI功能增强.md`（已完成）

## 现有状态
✅ PRD 已完成（温瑜负责）
❌ CLAUDE.md/AGENTS.md 未更新（仍只有基础 Markdown 编辑器功能描述）
❌ README.md 未提及 AI 功能
❌ 无测试用例文档

## 工作内容

### 1. 更新 CLAUDE.md / AGENTS.md

在现有技术文档基础上，新增 AI 功能增强章节：

#### 新增章节建议
```markdown
## 8. AI 功能增强（v2.0 - 2026-04）

### 8.1 功能概述
- AI 文案生成：根据参数自动生成公众号文案
- 多 Provider 支持：OpenAI / Gemini / Claude / 本地模型
- 图片辅助：支持选择图片文件夹，AI 根据图片内容生成文案

### 8.2 AI 界面
- 入口：顶部导航 → ✨ AI 生成
- 三个标签页：编辑器 / AI 生成 / 设置
- AI 生成页面：参数配置 → 图片选择 → 生成 → 预览 → 复制/保存
- 设置页面：API Provider / Key / Model / 参数配置

### 8.3 AI 配置
- 存储位置：`data/api-config.json`
- 加载时机：Vue mounted 时自动加载 localStorage 配置
- 支持 Provider：openai / gemini / claude / local
- 本地模型支持：OpenAI 兼容格式 / Ollama 原生格式

### 8.4 AI API 调用流程
1. 用户配置 Provider + API Key + Model
2. 保存配置到 localStorage
3. 用户填写生成参数（类型、风格、字数、图片）
4. 点击「开始生成」
5. 构建 Prompt（包含模板 + 参数 + 图片列表）
6. 调用 AIAPIClient 发送请求
7. 解析响应，渲染 Markdown 预览
8. 用户可复制到编辑器或剪贴板

### 8.5 核心组件
- AIAPIClient 类（app_v5.js:514-750）
  - 支持多 Provider 统一调用接口
  - 内嵌 OpenAI/Gemini/Claude/Local 调用方法
  - fetchModels: 获取可用模型列表
- generateAIContent 方法（app_v5.js:3804+）
  - 构建 Prompt
  - 调用 AIAPIClient
  - 处理响应和错误
```

### 2. 更新 README.md

在 README.md 的功能特点部分，新增 AI 功能介绍：
- 位置：在「13 种精美样式」后新增「AI 智能生成」
- 内容：描述 AI 文案生成、参数配置、多 Provider 支持
- 保持与现有风格一致

### 3. 创建测试用例文档

新建 `docs/test-cases.md`：

#### 内容结构
```markdown
# 华声编辑器 AI 功能测试用例

## 测试环境
- 浏览器：Chrome 90+
- Python：3.x（用于 Skill 脚本测试）

## 前置条件
- 已配置有效的 AI API Key

## 测试用例

### 1. AI 配置界面
| ID | 功能 | 测试步骤 | 预期结果 |
|----|------|---------|---------|
| TC-001 | 保存配置 | 配置 OpenAI Key → 保存 | localStorage 保存成功，刷新后保留 |
| TC-002 | 测试连接 | 配置正确 Key → 测试连接 | 显示「连接成功」 |
| TC-003 | 模型获取 | 配置 Key → 获取模型列表 | 显示可用模型列表 |
| TC-004 | Provider 切换 | 切换到 Gemini | 默认模型自动切换 |

### 2. AI 生成功能
| ID | 功能 | 测试步骤 | 预期结果 |
|----|------|---------|---------|
| TC-101 | 基础生成 | 选择类型/风格/字数 → 生成 | 正确调用 API，返回文案 |
| TC-102 | 错误处理 | 使用无效 Key 生成 | 显示具体错误信息 |
| TC-103 | 图片选择 | 选择图片文件夹 | 显示图片预览网格 |
| TC-104 | 复制到编辑器 | 生成后点击复制 | 编辑器内容被替换 |

### 3. 广告移除
| ID | 功能 | 测试步骤 | 预期结果 |
|----|------|---------|---------|
| TC-201 | 顶部广告 | 检查顶部导航 | 无 BookAI、AI产品购买 链接 |
| TC-202 | 浮动广告 | 检查右下角 | 无浮动广告面板 |

...（更多用例）
```

## 交付物
1. 更新后的 `CLAUDE.md` / `AGENTS.md`
2. 更新后的 `README.md`
3. 新建 `docs/test-cases.md`

## 注意事项
- 保持文档风格与现有内容一致
- 技术细节需与实际代码对应（如行号可标注 approximate）
- 测试用例应覆盖主要功能和边界情况
