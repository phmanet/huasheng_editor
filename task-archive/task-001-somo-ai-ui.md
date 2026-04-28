# Task 001 - 苏墨 - AI 界面完善与广告移除

## 任务概述
完善华声编辑器的 AI 功能界面，修复样式问题，并移除所有广告元素。

## 背景
项目路径：`D:\Dev\Project\huasheng_editor`
- 主 JS 文件：`app_v5.js`（实际被 index.html 加载）
- 页面文件：`index.html`
- 样式文件：`styles.js`

## 现有状态
✅ 已完成：AI 生成界面 UI（HTML 结构存在）、AI 配置界面 UI、Vue 数据结构、AI 核心方法（generateAIContent、testAIConnection、handleImageFolderSelect 等）、AIAPIClient 类
❌ 待完善：广告移除、样式统一、浮动广告 Vue 逻辑移除、AI 面板 CSS 细节

## 工作内容

### 1. 移除广告（最高优先级）

#### 顶部广告链接（index.html 顶部 header 区域）
- 搜索 `header-link` 相关 HTML，找到并删除所有非标签导航的广告链接
- PRD 提到需删除：BookAI 主站、AI产品购买 链接
- 注意保留：标签导航（tab-nav）、GitHub 链接
- 搜索关键字：`header-link`、`header-links`、`BookAI`

#### 右下角浮动广告（index.html + app_v5.js）
- **CSS 部分**：删除所有 `.floating-ad` 相关样式（从 `.floating-ad` 到相关 keyframes）
- **HTML 部分**：删除整个浮动广告 DOM 元素（搜索 `<aside class="floating-ad` 或相关结构）
- **JS 部分**（app_v5.js）：
  - 在 Vue data 中注释掉或删除 `floatingAd: { ... }` 对象
  - 删除 `mounted` 中的 `this.initFloatingAd()` 调用
  - 删除 `beforeUnmount` 中的 `this.stopFloatingAdRotation()` 调用
  - 删除所有 `floatingAdTimer` 相关逻辑
  - 删除 `initFloatingAd`、`startFloatingAdRotation`、`stopFloatingAdRotation`、`currentFloatingAd` 方法
  - 删除 `floatingAd` computed 属性

### 2. AI 面板样式统一（次优先级）

#### 现有样式问题排查
AI 面板（`.ai-panel`）在 index.html 中定义了基础样式，但可能存在以下问题：
- 与编辑器面板风格不一致（padding、背景色、边框）
- 表单元素（select、input、textarea）样式与整体风格不统一
- 按钮样式与现有 `.copy-btn`、`.ai-generate-btn` 等风格可能不一致
- AI 面板宽度在移动端可能溢出

#### 样式检查清单
确保以下元素与整体风格一致（Apple-like 简约风）：
- `.ai-panel-content` 的 padding 和 max-width
- `.ai-form-group label` 颜色、字体
- `.ai-form-group select/input/textarea` 的 border、border-radius、focus 状态
- `.ai-generate-btn` 的背景色（应与 `.copy-btn` 一致或使用 accent 蓝色）
- `.ai-result` 区域的样式（标题、正文、操作按钮）
- 图片预览网格 `.ai-image-preview-grid` 的样式

#### 修复方案
直接在 index.html 的 `<style>` 标签内调整，无需新建文件。遵循现有 CSS 变量（`--color-primary`、`--color-accent` 等）。

### 3. 界面一致性检查
- AI 面板与编辑器面板的圆角、阴影是否一致
- 字体大小、行高是否统一
- 按钮 hover 状态是否协调

## 交付物
1. 修改后的 `index.html`（广告 HTML 移除 + CSS 调整）
2. 修改后的 `app_v5.js`（floatingAd 相关 Vue 逻辑移除）
3. 修改说明（简单描述改了什么）

## 注意事项
- 不要改变现有功能逻辑，只移除广告和调整样式
- 使用 index.html 的现有 CSS 变量保持风格统一
- JS 修改后确保 Vue app 仍正常运行
- 删除广告代码时，仔细对照行号，不要误删相邻的正常功能代码

## 参考
- PRD 文档：`D:\Dev\Project\huasheng_editor\docs\PRD-AI功能增强.md` 第 2.4 节
- 现有 AI 面板代码：index.html 中 `<template v-if="currentTab === 'ai-generate'">` 和 `<template v-if="currentTab === 'ai-settings'">`
