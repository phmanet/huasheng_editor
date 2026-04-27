# PRD - 公众号编辑器 AI 功能增强

> 文档版本：v1.0  
> 创建日期：2026-04-27  
> 负责人：温瑜  

---

## 1. 产品概述

### 1.1 产品名称
公众号编辑器 AI 功能增强

### 1.2 产品定位
在现有公众号 Markdown 编辑器基础上，集成 AI 文案生成能力，让用户能够通过 AI 快速生成高质量公众号内容，提升创作效率。

### 1.3 目标用户
- 公众号运营者
- 内容创作者
- 自媒体从业者
- 需要频繁产出公众号文章的团队

---

## 2. 需求详述

### 2.1 需求 1：增强 AI 文案生成能力

#### 功能描述
用户通过界面输入参数，AI 根据参数和图片内容生成公众号文案。

#### 用户输入参数
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 文案类型 | 下拉选择 | 是 | 产品介绍、新闻资讯、情感故事、技术教程、活动宣传 |
| 文案风格 | 下拉选择 | 是 | 专业严谨、轻松活泼、文艺清新、幽默风趣、简约大方 |
| 字数范围 | 数字区间 | 是 | 如 500-800字、1000-1500字 |
| 图片文件夹 | 文件夹路径 | 否 | 用户选择的图片所在目录 |
| 自定义内容 | 文本输入 | 否 | 用户额外的要求或限制 |

#### 功能流程
```
用户选择参数 → 选择图片文件夹（可选）→ 输入自定义内容（可选）→ 点击生成 → AI 处理 → 输出结果
```

#### 交互设计
- 左侧：参数配置区（类型、风格、字数、图片文件夹）
- 右侧：预览区（显示生成的文案）
- 底部：操作按钮（生成、复制、保存）

#### 边界情况
- 图片文件夹不存在 → 提示用户检查路径
- 图片格式不支持 → 跳过不支持的文件，提示用户
- 文件夹为空 → 提示用户选择包含图片的文件夹
- AI API 未配置 → 引导用户先配置 API

---

### 2.2 需求 2：AI 生成 Skill 完善

#### 功能描述
完善现有的 `huasheng-ai-article` Skill，实现完整的 AI 文案生成流程。

#### 输出内容
- **标题**：吸引眼球的文章标题（20字以内）
- **副标题**：概括核心内容的副标题（30字以内）
- **正文**：结构清晰的正文内容
- **图片混排**：文案与图片按适当位置混合排版

#### 输出格式
```markdown
# 标题

## 副标题

正文段落...

![图片描述](图片路径)

更多正文...
```

#### 保存规则
- 文件名：`{日期}_{类型}_{时间戳}.md`，如 `20260427_产品介绍_143052.md`
- 保存路径：`data/generated/`
- 文件编码：UTF-8

#### Prompt 模板
根据文案类型选择对应模板（详见 `skills/huasheng-ai-article/references/prompts.md`）：
- 产品介绍 → 突出产品特点、使用场景
- 新闻资讯 → 倒金字塔结构、权威引用
- 情感故事 → 起承转合、情感共鸣
- 技术教程 → 步骤清晰、代码示例
- 活动宣传 → 时间地点、参与方式

---

### 2.3 需求 3：WebUI 新增 AI 界面

#### 3.3.1 AI 生成操作界面

##### 界面布局
在现有编辑器界面新增 "AI 生成" 标签页，包含：

| 区域 | 内容 |
|------|------|
| 参数配置区 | 文案类型、风格、字数范围选择器 |
| 图片选择区 | 图片文件夹选择 + 图片预览列表 |
| 自定义输入区 | 多行文本框，支持输入额外要求 |
| 生成按钮 | 点击触发 AI 生成 |
| 结果预览区 | 显示生成的 Markdown 内容 |
| 操作按钮组 | 复制到编辑器、复制到剪贴板、保存文件 |

##### 交互流程
1. 用户选择文案类型、风格、字数范围
2. 用户选择图片文件夹（可选）
3. 系统扫描文件夹，显示图片列表预览
4. 用户输入自定义要求（可选）
5. 用户点击"生成"按钮
6. 系统调用 AI API，显示加载状态
7. 生成完成，显示预览
8. 用户可选择：复制到编辑器继续编辑 / 直接保存

#### 3.3.2 AI API 配置界面

##### 支持的 API 提供商
| 提供商 | 模型示例 | API 地址 |
|--------|---------|---------|
| OpenAI | gpt-4o, gpt-4o-mini, gpt-4-turbo | https://api.openai.com/v1/chat/completions |
| Google | gemini-2.0-flash, gemini-1.5-pro | https://generativelanguage.googleapis.com/v1beta/models/xxx:generateContent |
| Anthropic | claude-sonnet-4-20250514, claude-3-5-sonnet | https://api.anthropic.com/v1/messages |
| 本地模型 | Ollama, LM Studio 等 | 用户自定义 |

##### 配置参数
| 参数 | 说明 |
|------|------|
| provider | API 提供商选择 |
| apiKey | API 密钥 |
| model | 模型选择 |
| apiUrl | API 地址（本地模型需要） |
| maxTokens | 最大输出 Token 数 |
| temperature | 生成温度（0-2） |

##### 配置存储
- 存储位置：`data/api-config.json`
- 加密：API Key 需要加密存储（Base64 或简单混淆）
- 迁移：支持配置导入/导出

##### 配置界面设计
```
┌─────────────────────────────────────┐
│  AI API 配置                         │
├─────────────────────────────────────┤
│  提供商：[OpenAI ▼]                  │
│  API Key：[••••••••••••] [显示]      │
│  模型：  [gpt-4o-mini ▼]             │
│  API 地址：[默认，不可编辑]           │
│                                      │
│  高级设置                             │
│  ├─ 最大 Token：[4096]               │
│  └─ 温度：[0.7] ──────────○          │
│                                      │
│  [测试连接]  [保存配置]               │
└─────────────────────────────────────┘
```

---

### 2.4 需求 4：去除广告

#### 2.4.1 顶部广告
**位置**：`index.html` 第 1557-1580 行  
**内容**：header 中的导航链接
- `BookAI 主站` 链接
- `AI产品购买` 链接

**修改方式**：删除 `.header-links` 中的这两个链接，保留 GitHub 链接（可选保留或删除）

#### 2.4.2 右下角广告
**位置**：`index.html`  
**CSS 样式**：第 809-901 行，`.floating-ad` 相关样式  
**HTML 结构**：第 1868-1950 行，浮动广告组件

**修改方式**：
1. 删除 `.floating-ad` 相关 CSS 样式
2. 删除浮动广告 HTML 结构
3. 删除 `app.js` 中 `floatingAd` 相关的 Vue 数据和方法

---

## 3. 技术约束

### 3.1 前端技术栈
- **框架**：Vue 3（CDN 引入，无需构建）
- **样式**：纯 CSS（CSS Variables + 内联样式）
- **Markdown 渲染**：markdown-it 14.0.0
- **代码高亮**：highlight.js 11.9.0

### 3.2 API 对接要求

#### OpenAI API
```javascript
// 请求格式
POST https://api.openai.com/v1/chat/completions
Headers: Authorization: Bearer {apiKey}
Body: {
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "..." }],
  max_tokens: 4096,
  temperature: 0.7
}
```

#### Google Gemini API
```javascript
// 请求格式
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent
Headers: x-goog-api-key: {apiKey}
Body: {
  contents: [{ parts: [{ text: "..." }] }]
}
```

#### Anthropic Claude API
```javascript
// 请求格式
POST https://api.anthropic.com/v1/messages
Headers: 
  x-api-key: {apiKey}
  anthropic-version: 2023-06-01
Body: {
  model: "claude-sonnet-4-20250514",
  max_tokens: 4096,
  messages: [{ role: "user", content: "..." }]
}
```

#### 本地模型 API
- 支持兼容 OpenAI API 格式的本地部署
- 用户需配置自定义 API 地址

### 3.3 数据存储方案
| 数据类型 | 存储方式 | 位置 |
|---------|---------|------|
| API 配置 | JSON 文件 | `data/api-config.json` |
| 生成的文案 | Markdown 文件 | `data/generated/*.md` |
| 用户偏好 | localStorage | 浏览器本地 |

### 3.4 图片处理
- 读取用户指定文件夹中的图片
- 支持格式：jpg, jpeg, png, gif, webp
- 图片转 Base64 或 URL 发送给 AI（根据 API 能力）
- 本地图片使用 `img://` 协议存储在 IndexedDB

---

## 4. 非功能需求

### 4.1 性能要求
| 指标 | 要求 |
|------|------|
| 页面加载 | < 3 秒 |
| AI 生成响应 | < 30 秒（视 API 响应） |
| 图片扫描 | 100 张图片 < 2 秒 |
| 文件保存 | < 1 秒 |

### 4.2 兼容性要求
- **浏览器**：Chrome 90+, Safari 14+, Firefox 88+, Edge 90+
- **移动端**：响应式设计，支持移动端操作
- **公众号**：生成的 Markdown 需兼容公众号编辑器

### 4.3 安全要求
- API Key 加密存储，不明文显示
- 支持 HTTPS API 调用
- 本地数据处理，不上传用户敏感信息
- 提供清除配置的选项

### 4.4 可用性要求
- API 配置失败时提供清晰的错误提示
- 支持配置测试功能
- 生成失败时提供重试选项

---

## 5. 排期建议

### 阶段 1：基础设施（2 天）
| 任务 | 负责人 | 预估时间 |
|------|--------|---------|
| API 配置界面开发 | 苏墨 | 1 天 |
| API 配置存储逻辑 | 陆沉 | 0.5 天 |
| 多 Provider API 封装 | 陆沉 | 0.5 天 |

### 阶段 2：AI 生成功能（3 天）
| 任务 | 负责人 | 预估时间 |
|------|--------|---------|
| AI 生成界面开发 | 苏墨 | 1 天 |
| Skill 脚本完善 | 陆沉 | 1 天 |
| Prompt 模板优化 | 温瑜 | 0.5 天 |
| 图片处理逻辑 | 陆沉 | 0.5 天 |

### 阶段 3：集成与优化（2 天）
| 任务 | 负责人 | 预估时间 |
|------|--------|---------|
| 界面集成测试 | 南星 | 0.5 天 |
| API 联调测试 | 南星 | 0.5 天 |
| 去除广告 | 苏墨 | 0.5 天 |
| Bug 修复 | 全员 | 0.5 天 |

### 阶段 4：验收（1 天）
| 任务 | 负责人 | 预估时间 |
|------|--------|---------|
| 功能验收 | 温瑜 + 用户 | 0.5 天 |
| 文档更新 | 温瑜 | 0.5 天 |

**总计：约 8 个工作日**

---

## 6. 交付物清单

| 交付物 | 文件/位置 | 负责人 |
|--------|----------|--------|
| PRD 文档 | `docs/PRD-AI功能增强.md` | 温瑜 |
| API 配置界面 | `index.html` 修改 | 苏墨 |
| AI 生成界面 | `index.html` 修改 | 苏墨 |
| API 封装模块 | `app.js` 新增 | 陆沉 |
| Skill 脚本 | `skills/huasheng-ai-article/` | 陆沉 |
| 测试用例 | `docs/test-cases.md` | 南星 |

---

## 7. 风险与对策

| 风险 | 影响 | 对策 |
|------|------|------|
| AI API 调用失败 | 用户无法生成文案 | 提供重试机制，显示清晰错误信息 |
| API Key 泄露 | 安全风险 | 本地加密存储，不明文传输 |
| 图片过大导致上传失败 | 生成失败 | 压缩图片或使用图片 URL |
| 本地模型不兼容 | 部分用户无法使用 | 提供兼容性检测和配置指导 |

---

## 8. 附录

### 8.1 参考文件
- 项目技术文档：`D:\Dev\Project\huasheng_editor\CLAUDE.md`
- 现有 AI Skill：`D:\Dev\Project\huasheng_editor\skills\huasheng-ai-article\SKILL.md`
- Prompt 模板：`D:\Dev\Project\huasheng_editor\skills\huasheng-ai-article\references\prompts.md`
- WebUI 主页面：`D:\Dev\Project\huasheng_editor\index.html`
- Vue 应用逻辑：`D:\Dev\Project\huasheng_editor\app.js`

### 8.2 变更记录
| 版本 | 日期 | 修改内容 | 修改人 |
|------|------|---------|--------|
| v1.0 | 2026-04-27 | 初版 | 温瑜 |
