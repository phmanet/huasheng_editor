/**
 * 在线编辑器 - 独立页面
 * 基于 app.js 的 STYLES，复用样式系统
 */

/**
 * 图片存储管理器 - 使用 IndexedDB 持久化存储压缩后的图片
 */
class ImageStore {
  constructor() {
    this.dbName = 'WechatEditorImages';
    this.storeName = 'images';
    this.version = 1;
    this.db = null;
  }

  // 初始化 IndexedDB
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        console.error('IndexedDB 打开失败:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('IndexedDB 初始化成功');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // 创建对象存储（如果不存在）
        if (!db.objectStoreNames.contains(this.storeName)) {
          const objectStore = db.createObjectStore(this.storeName, { keyPath: 'id' });

          // 创建索引
          objectStore.createIndex('createdAt', 'createdAt', { unique: false });
          objectStore.createIndex('name', 'name', { unique: false });

          console.log('ImageStore 对象存储已创建');
        }
      };
    });
  }

  // 保存图片
  async saveImage(id, blob, metadata = {}) {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const objectStore = transaction.objectStore(this.storeName);

      const imageData = {
        id: id,
        blob: blob,
        name: metadata.name || 'image',
        originalSize: metadata.originalSize || 0,
        compressedSize: blob.size,
        createdAt: Date.now(),
        ...metadata
      };

      const request = objectStore.put(imageData);

      request.onsuccess = () => {
        console.log(`图片已保存: ${id}`);
        resolve(id);
      };

      request.onerror = () => {
        console.error('保存图片失败:', request.error);
        reject(request.error);
      };
    });
  }

  // 获取图片（返回 Object URL）
  async getImage(id) {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.get(id);

      request.onsuccess = () => {
        const result = request.result;
        if (result && result.blob) {
          const objectURL = URL.createObjectURL(result.blob);
          resolve(objectURL);
        } else {
          console.warn(`图片不存在: ${id}`);
          resolve(null);
        }
      };

      request.onerror = () => {
        console.error('读取图片失败:', request.error);
        reject(request.error);
      };
    });
  }

  // 获取图片 Blob（用于复制时转 Base64）
  async getImageBlob(id) {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.get(id);

      request.onsuccess = () => {
        const result = request.result;
        if (result && result.blob) {
          resolve(result.blob);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        console.error('读取图片 Blob 失败:', request.error);
        reject(request.error);
      };
    });
  }

  // 获取完整图片记录（blob + 元数据，用于 GIF 判断等）
  async getImageRecord(id) {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.get(id);

      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          resolve(result);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        console.error('读取图片记录失败:', request.error);
        reject(request.error);
      };
    });
  }

  // 删除图片
  async deleteImage(id) {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.delete(id);

      request.onsuccess = () => {
        console.log(`图片已删除: ${id}`);
        resolve();
      };

      request.onerror = () => {
        console.error('删除图片失败:', request.error);
        reject(request.error);
      };
    });
  }

  // 获取所有图片列表（用于管理）
  async getAllImages() {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        console.error('获取图片列表失败:', request.error);
        reject(request.error);
      };
    });
  }

  // 清空所有图片
  async clearAll() {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.clear();

      request.onsuccess = () => {
        console.log('所有图片已清空');
        resolve();
      };

      request.onerror = () => {
        console.error('清空图片失败:', request.error);
        reject(request.error);
      };
    });
  }

  // 计算总存储大小
  async getTotalSize() {
    const images = await this.getAllImages();
    return images.reduce((total, img) => total + (img.compressedSize || 0), 0);
  }
}

/**
 * 图片压缩器 - 使用 Canvas API 压缩图片
 */
class ImageCompressor {
  constructor(options = {}) {
    this.maxWidth = options.maxWidth || 1920;
    this.maxHeight = options.maxHeight || 1920;
    this.quality = options.quality || 0.85;
    this.mimeType = options.mimeType || 'image/jpeg';
  }

  // 压缩图片
  async compress(file) {
    return new Promise((resolve, reject) => {
      // 如果是 GIF 或 SVG，不压缩（保持动画或矢量）
      if (file.type === 'image/gif' || file.type === 'image/svg+xml') {
        resolve(file);
        return;
      }

      const reader = new FileReader();

      reader.onerror = () => {
        reject(new Error('文件读取失败'));
      };

      reader.onload = (e) => {
        const img = new Image();

        img.onerror = () => {
          reject(new Error('图片加载失败'));
        };

        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            // 计算缩放比例
            let scale = 1;
            if (width > this.maxWidth) {
              scale = this.maxWidth / width;
            }
            if (height > this.maxHeight) {
              scale = Math.min(scale, this.maxHeight / height);
            }

            // 应用缩放
            width = Math.floor(width * scale);
            height = Math.floor(height * scale);

            canvas.width = width;
            canvas.height = height;

            // 绘制图片
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#fff'; // 白色背景（针对透明 PNG）
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);

            // 转为 Blob
            canvas.toBlob(
              (blob) => {
                if (blob) {
                  // 如果压缩后反而更大，使用原文件
                  if (blob.size < file.size) {
                    resolve(blob);
                  } else {
                    console.log('压缩后体积更大，使用原文件');
                    resolve(file);
                  }
                } else {
                  reject(new Error('Canvas toBlob 失败'));
                }
              },
              // PNG 保持 PNG，其他转 JPEG
              file.type === 'image/png' ? 'image/png' : this.mimeType,
              this.quality
            );
          } catch (error) {
            reject(error);
          }
        };

        img.src = e.target.result;
      };

      reader.readAsDataURL(file);
    });
  }

  // 格式化文件大小
  static formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
}

/**
 * 图床管理器 - 支持多个图床服务，智能降级
 */
class ImageHostManager {
  constructor() {
    // 图床服务列表（仅保留可靠且无CORS限制的服务）
    this.hosts = [
      {
        name: 'SM.MS',
        upload: this.uploadToSmms.bind(this),
        maxSize: 5 * 1024 * 1024, // 5MB
        priority: 1,
        timeout: 10000 // 10秒超时
      }
    ];

    // 失败记录（用于临时降低优先级）
    this.failureCount = {};
    this.lastFailureTime = {};

    // 启用/禁用状态（可以手动禁用某些服务）
    this.disabledHosts = new Set();
  }

  // 智能选择图床（根据失败记录和文件大小）
  selectHost(fileSize) {
    const now = Date.now();
    const cooldownTime = 3 * 60 * 1000; // 3分钟冷却时间（缩短以便更快重试）

    return this.hosts
      .filter(host => {
        // 过滤条件：1) 文件大小符合 2) 未被禁用 3) 不在冷却期或失败次数不太多
        if (fileSize > host.maxSize) return false;
        if (this.disabledHosts.has(host.name)) return false;

        const failures = this.failureCount[host.name] || 0;
        const lastFail = this.lastFailureTime[host.name] || 0;
        const inCooldown = (now - lastFail) < cooldownTime;

        // 如果失败次数超过3次且在冷却期内，跳过
        if (failures >= 3 && inCooldown) return false;

        return true;
      })
      .sort((a, b) => {
        // 如果最近失败过，降低优先级
        const aFailures = this.failureCount[a.name] || 0;
        const bFailures = this.failureCount[b.name] || 0;
        const aLastFail = this.lastFailureTime[a.name] || 0;
        const bLastFail = this.lastFailureTime[b.name] || 0;

        // 如果在冷却期内，大幅降低优先级
        const aInCooldown = (now - aLastFail) < cooldownTime;
        const bInCooldown = (now - bLastFail) < cooldownTime;

        if (aInCooldown && !bInCooldown) return 1;
        if (!aInCooldown && bInCooldown) return -1;

        // 按失败次数和原始优先级排序
        const aPenalty = aFailures * 5 + a.priority;
        const bPenalty = bFailures * 5 + b.priority;

        return aPenalty - bPenalty;
      });
  }

  // 记录失败
  recordFailure(hostName) {
    this.failureCount[hostName] = (this.failureCount[hostName] || 0) + 1;
    this.lastFailureTime[hostName] = Date.now();
  }

  // 记录成功（重置失败计数）
  recordSuccess(hostName) {
    this.failureCount[hostName] = 0;
    delete this.lastFailureTime[hostName];
  }

  // 尝试上传到所有可用图床
  async upload(file, onProgress) {
    const availableHosts = this.selectHost(file.size);

    if (availableHosts.length === 0) {
      throw new Error('没有可用的图床服务（文件可能太大或所有服务都在冷却期）');
    }

    let lastError = null;
    let attemptCount = 0;

    for (const host of availableHosts) {
      attemptCount++;
      try {
        if (onProgress) {
          onProgress(`🔄 尝试 ${host.name} (${attemptCount}/${availableHosts.length})`);
        }

        // 使用Promise.race实现超时控制
        const uploadPromise = host.upload(file);
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('上传超时')), host.timeout);
        });

        const result = await Promise.race([uploadPromise, timeoutPromise]);
        this.recordSuccess(host.name);

        if (onProgress) {
          onProgress(`✅ ${host.name} 上传成功`);
        }

        return {
          url: result.url,
          host: host.name,
          deleteUrl: result.deleteUrl
        };
      } catch (error) {
        const errorMsg = error.message || error.toString();
        console.warn(`${host.name} 上传失败:`, errorMsg);
        this.recordFailure(host.name);
        lastError = error;

        // 如果还有其他图床可以尝试，继续
        if (attemptCount < availableHosts.length && onProgress) {
          onProgress(`⚠️ ${host.name} 失败，尝试下一个...`);
        }
      }
    }

    // 所有图床都失败了
    throw new Error(`所有图床均上传失败 (尝试了${attemptCount}个)\n最后错误: ${lastError?.message || '未知错误'}`);
  }

  // SM.MS 图床（唯一支持浏览器端直接上传的稳定图床）
  async uploadToSmms(file) {
    const formData = new FormData();
    formData.append('smfile', file);

    const response = await fetch('https://sm.ms/api/v2/upload', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();

    if (result.success || (result.code === 'image_repeated' && result.images)) {
      return {
        url: result.data?.url || result.images,
        deleteUrl: result.data?.delete || null
      };
    }

    throw new Error(result.message || 'SM.MS响应失败');
  }

  // 辅助：文件转 Base64
  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  }
}

/**
 * AI API 封装器 - 支持多个 AI Provider 的统一调用
 * 支持：OpenAI、Google Gemini、Anthropic Claude、本地模型（兼容 OpenAI 格式）
 */
class AIAPIClient {
  constructor() {
    this.timeout = 60000; // 默认 60 秒超时
  }

  /**
   * 统一调用接口
   * @param {Object} options - 调用参数
   * @returns {Promise<Object>} - 返回结果 { success: boolean, content: string, error?: string }
   */
  async call(options) {
    const { provider, apiKey, model, messages, maxTokens = 4096, temperature = 0.7, baseUrl } = options;

    // 验证必填参数（本地模型不需要 apiKey）
    if (!provider || !model || !messages) {
      return { success: false, error: '缺少必填参数：provider, model, messages' };
    }
    // 云服务商需要 apiKey
    if (provider !== 'local' && !apiKey) {
      return { success: false, error: '缺少必填参数：apiKey' };
    }

    try {
      let result;
      switch (provider) {
        case 'openai':
          result = await this.callOpenAI({ apiKey, model, messages, maxTokens, temperature });
          break;
        case 'gemini':
          result = await this.callGemini({ apiKey, model, messages, maxTokens, temperature });
          break;
        case 'claude':
          result = await this.callClaude({ apiKey, model, messages, maxTokens, temperature });
          break;
        case 'local':
          result = await this.callLocal({ apiKey, model, messages, maxTokens, temperature, baseUrl }, options.localFormat || 'openai');
          break;
        default:
          return { success: false, error: `不支持的 Provider: ${provider}` };
      }
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // OpenAI API 调用
  async callOpenAI({ apiKey, model, messages, maxTokens, temperature }) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return { success: true, content: data.choices[0].message.content };
  }

  // Google Gemini API 调用
  async callGemini({ apiKey, model, messages, maxTokens, temperature }) {
    // 转换消息格式
    const contents = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: { maxOutputTokens: maxTokens, temperature }
        })
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return { success: true, content: data.candidates[0].content.parts[0].text };
  }

  // Anthropic Claude API 调用
  async callClaude({ apiKey, model, messages, maxTokens, temperature }) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return { success: true, content: data.content[0].text };
  }

  // 本地模型调用（兼容 OpenAI 格式）
  async callLocal({ apiKey, model, messages, maxTokens, temperature, baseUrl }, localFormat) {
    // 本地模型不强制 baseUrl，提供默认值
    if (!baseUrl || baseUrl.trim() === '') {
      baseUrl = localFormat === 'ollama' ? 'http://localhost:11434' : 'http://localhost:1234/v1';
    }

    // 根据格式选择调用方式
    if (localFormat === 'ollama') {
      return await this.callLocalOllama({ apiKey, model, messages, maxTokens, temperature, baseUrl });
    }

    // OpenAI 兼容格式
    const url = baseUrl.endsWith('/v1') ? `${baseUrl}/chat/completions` : `${baseUrl.replace(/\/$/, '')}/v1/chat/completions`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {})
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || error.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return { success: true, content: data.choices[0].message.content };
  }

  // Ollama 原生格式调用 (/api/chat)
  async callLocalOllama({ model, messages, maxTokens, temperature, baseUrl }) {
    const url = baseUrl.replace(/\/$/, '');
    
    // 转换消息格式为 Ollama 格式
    const ollamaMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    // 如果有图片（多模态），需要用 Ollama 的多模态消息格式
    const hasImages = messages.some(msg => 
      Array.isArray(msg.content) && msg.content.some(part => part.type === 'image_url')
    );

    let requestBody;
    if (hasImages) {
      // 多模态：使用 /api/chat 并带上 images
      ollamaMessages.forEach(msg => {
        if (Array.isArray(msg.content)) {
          const images = [];
          let textContent = '';
          msg.content.forEach(part => {
            if (part.type === 'text') textContent += part.text;
            if (part.type === 'image_url' && part.image_url && part.image_url.url) {
              // 提取 base64 数据
              const base64Data = part.image_url.url.replace(/^data:image\/\w+;base64,/, '');
              images.push(base64Data);
            }
          });
          msg.content = textContent;
          if (images.length > 0) msg.images = images;
        }
      });
    }

    requestBody = {
      model,
      messages: ollamaMessages,
      stream: false,
      options: {
        num_predict: maxTokens,
        temperature: temperature
      }
    };

    const response = await fetch(`${url}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Ollama HTTP ${response.status}`);
    }

    const data = await response.json();
    return { success: true, content: data.message?.content || '' };
  }

  // 获取模型列表
  async fetchModels({ provider, apiKey, baseUrl, localFormat }) {
    try {
      let models = [];

      switch (provider) {
        case 'openai': {
          const resp = await fetch('https://api.openai.com/v1/models', {
            headers: { 'Authorization': `Bearer ${apiKey}` }
          });
          if (!resp.ok) throw new Error(`OpenAI API ${resp.status}`);
          const data = await resp.json();
          models = (data.data || []).map(m => ({ id: m.id, owned_by: m.owned_by }))
            .sort((a, b) => a.id.localeCompare(b.id));
          break;
        }

        case 'gemini': {
          // Gemini 使用 listModels API
          const resp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
          );
          if (!resp.ok) throw new Error(`Gemini API ${resp.status}`);
          const data = await resp.json();
          models = (data.models || [])
            .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
            .map(m => ({ id: m.name.replace('models/', ''), owned_by: 'google' }));
          break;
        }

        case 'claude': {
          // Claude 没有公开的模型列表API，返回常用模型
          models = [
            { id: 'claude-sonnet-4-20250514', owned_by: 'anthropic' },
            { id: 'claude-opus-4-20250514', owned_by: 'anthropic' },
            { id: 'claude-3-5-sonnet-20241022', owned_by: 'anthropic' },
            { id: 'claude-3-5-haiku-20241022', owned_by: 'anthropic' },
            { id: 'claude-3-opus-20240229', owned_by: 'anthropic' }
          ];
          break;
        }

        case 'local': {
          // 本地模型不强制 baseUrl，提供默认值
          if (!baseUrl || baseUrl.trim() === '') {
            baseUrl = localFormat === 'ollama' ? 'http://localhost:11434' : 'http://localhost:1234/v1';
          }
          const url = baseUrl.replace(/\/$/, '');

          if (localFormat === 'ollama') {
            // Ollama: GET /api/tags
            try {
              const resp = await fetch(`${url}/api/tags`);
              if (!resp.ok) throw new Error(`Ollama HTTP ${resp.status}`);
              const data = await resp.json();
              models = (data.models || []).map(m => ({ 
                id: m.name, 
                owned_by: m.details?.family || 'local',
                size: m.size,
                modified_at: m.modified_at
              }));
            } catch (e) {
              console.warn('Ollama /api/tags 失败:', e);
              throw new Error(`无法连接到 Ollama 服务 (${url})，请确认服务已启动`);
            }
          } else {
            // OpenAI 兼容格式: GET /v1/models
            const apiUrl = url.endsWith('/v1') ? `${url}/models` : `${url}/v1/models`;
            try {
              const resp = await fetch(apiUrl, {
                headers: apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}
              });
              if (!resp.ok) {
                const errData = await resp.json().catch(() => ({}));
                throw new Error(errData.error?.message || `HTTP ${resp.status}`);
              }
              const data = await resp.json();
              models = (data.data || []).map(m => ({ id: m.id, owned_by: m.owned_by || 'local' }))
                .sort((a, b) => a.id.localeCompare(b.id));
            } catch (e) {
              if (e.message.includes('无法连接')) throw e;
              throw new Error(`无法获取模型列表 (${apiUrl})，请确认服务地址正确`);
            }
          }
          break;
        }

        default:
          return { success: false, error: `不支持的 Provider: ${provider}` };
      }

      return { success: true, models };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  async testConnection({ provider, apiKey, model, baseUrl, localFormat }) {
    const result = await this.call({
      provider,
      apiKey,
      model,
      messages: [{ role: 'user', content: '测试连接' }],
      maxTokens: 50,
      baseUrl,
      localFormat
    });
    return result;
  }
}

const { createApp } = Vue;

const EMPHASIS_MARKERS = new Set([
  0x2A, // *
  0x5F, // _
  0x7E  // ~
]);

function isCjkLetter(charCode) {
  if (!charCode || charCode < 0) {
    return false;
  }

  return (
    (charCode >= 0x3400 && charCode <= 0x4DBF) ||  // CJK Unified Ideographs Extension A
    (charCode >= 0x4E00 && charCode <= 0x9FFF) ||  // CJK Unified Ideographs
    (charCode >= 0xF900 && charCode <= 0xFAFF) ||  // CJK Compatibility Ideographs
    (charCode >= 0xFF01 && charCode <= 0xFF60) ||  // Full-width ASCII variants
    (charCode >= 0xFF61 && charCode <= 0xFF9F) ||  // Half-width Katakana
    (charCode >= 0xFFA0 && charCode <= 0xFFDC)     // Full-width Latin letters
  );
}

function isCjkPunctuation(charCode) {
  if (!charCode || charCode < 0) {
    return false;
  }

  return (
    (charCode >= 0x3000 && charCode <= 0x303F) ||  // CJK 标点符号（。、，；：！？等）
    (charCode >= 0xFF01 && charCode <= 0xFF0F) ||  // 全角标点（！＂＃等）
    (charCode >= 0xFF1A && charCode <= 0xFF20) ||  // 全角标点（：；等）
    (charCode >= 0xFF3B && charCode <= 0xFF40) ||  // 全角标点（［＼等）
    (charCode >= 0xFF5B && charCode <= 0xFF65) ||  // 全角标点（｛｜等）
    (charCode >= 0xFE10 && charCode <= 0xFE1F) ||  // 竖排标点变体
    (charCode >= 0xFE30 && charCode <= 0xFE6F)     // CJK 兼容标点（小写变体）
  );
}

function withTimeout(promise, ms, message = '操作超时') {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms))
  ]);
}

const editorApp = createApp({
  data() {
    return {
      markdownInput: '',
      renderedContent: '',
      currentStyle: 'wechat-default',
      copySuccess: false,
      starredStyles: [],
      toast: {
        show: false,
        message: '',
        type: 'success'
      },
      md: null,
      scanDelimsPatched: false,
      STYLES: STYLES,  // 将样式对象暴露给模板
      turndownService: null,  // Turndown 服务实例
      isDraggingOver: false,  // 拖拽状态
      imageHostManager: new ImageHostManager(),  // 图床管理器（已废弃，保留兼容）
      imageStore: null,  // 图片存储管理器（IndexedDB）
      imageCompressor: null,  // 图片压缩器
      imageIdToObjectURL: {},  // 图片 ID 到 Object URL 的映射（用于预览时替换）
      // 小红书相关
      previewMode: 'wechat',  // 预览模式：'wechat' 或 'xiaohongshu'
      xiaohongshuImages: [],  // 生成的小红书图片数组
      xiaohongshuGenerating: false,  // 是否正在生成小红书图片
      // 文章历史记录
      articleHistory: [],           // 历史文章列表
      showHistoryPanel: false,      // 侧边栏显示状态
      currentArticleId: null,       // 当前编辑的文章ID（用于防止重复保存）
      copyXSuccess: false,            // 复制到 X 成功状态

      // AI 功能相关
      aiClient: null,                  // AI API 客户端实例
      aiConfig: {
        provider: 'openai',            // 当前选中的 Provider
        apiKey: '',                    // API Key
        model: 'gpt-4o-mini',          // 模型名称
        baseUrl: '',                   // 自定义 API 地址（本地模型用）
        maxTokens: 4096,               // 最大输出 token
        temperature: 0.7               // 温度参数
      },
      aiGenerating: false,             // 是否正在生成
      aiGeneratedContent: '',          // AI 生成的内容
      aiGeneratedContentWithImages: '', // AI 生成内容 + 图片（用于带图片的完整内容）
      aiGenerateParams: {
        type: 'product',               // 文案类型
        customType: '',               // 自定义文案类型
        style: 'professional',         // 文案风格
        customStyle: '',              // 自定义文案风格
        minWords: 500,                 // 最小字数
        maxWords: 1500,                // 最大字数
        customContent: '',             // 自定义内容
        imagesForLayoutOnly: false     // 图片仅用于排版，不发给 AI
      },

      // AI 图片文件夹选择
      aiSelectedImages: [],           // 已选择的图片列表 [{name, file, preview, base64}]

      // 模型列表相关
      availableModels: [],            // 从API获取的模型列表
      loadingModels: false,           // 是否正在获取模型列表
      localFormat: 'openai',          // 本地模型格式: openai | ollama
      customModel: '',                // 手动输入的模型名称

      // 标签导航
      currentTab: 'editor',            // 当前标签: 'editor' | 'ai-generate' | 'ai-settings'
      showApiKey: false               // 是否显示 API Key
    };
  },

  computed: {
    // 是否可以获取模型列表（根据当前provider判断必要条件是否满足）
    canFetchModels() {
      const p = this.aiConfig.provider;
      if (p === 'openai' || p === 'gemini' || p === 'claude') {
        return this.aiConfig.apiKey && this.aiConfig.apiKey.trim().length > 0;
      }
      if (p === 'local') {
        // 本地模式：始终允许尝试获取（有baseUrl用默认地址）
        return true;
      }
      return false;
    }
  },

  async mounted() {
    // 初始化 AI 客户端
    this.aiClient = new AIAPIClient();
    this.loadAIConfig();

    // 加载星标样式
    this.loadStarredStyles();

    // 加载用户偏好设置
    this.loadUserPreferences();

    // 加载文章历史记录
    this.loadArticleHistory();

    // 初始化图片存储管理器
    this.imageStore = new ImageStore();
    try {
      await this.imageStore.init();
      console.log('图片存储系统已就绪');
    } catch (error) {
      console.error('图片存储系统初始化失败:', error);
      this.showToast('图片存储系统初始化失败', 'error');
    }

    // 初始化图片压缩器（最大宽度 1920px，质量 85%）
    this.imageCompressor = new ImageCompressor({
      maxWidth: 1920,
      maxHeight: 1920,
      quality: 0.85
    });

    // 初始化 Turndown 服务（HTML 转 Markdown）
    this.initTurndownService();

    // 初始化 markdown-it
    const md = window.markdownit({
      html: true,
      linkify: true,
      typographer: false,  // 禁用 typographer 以避免智能引号干扰加粗标记
      highlight: function (str, lang) {
        // macOS 风格的窗口装饰
        const dots = '<div style="display: flex; align-items: center; gap: 6px; padding: 10px 12px; background: #2a2c33; border-bottom: 1px solid #1e1f24;"><span style="width: 12px; height: 12px; border-radius: 50%; background: #ff5f56;"></span><span style="width: 12px; height: 12px; border-radius: 50%; background: #ffbd2e;"></span><span style="width: 12px; height: 12px; border-radius: 50%; background: #27c93f;"></span></div>';

        // 检查 hljs 是否加载
        let codeContent = '';
        if (lang && typeof hljs !== 'undefined') {
          try {
            if (hljs.getLanguage(lang)) {
              codeContent = hljs.highlight(str, { language: lang }).value;
            } else {
              codeContent = md.utils.escapeHtml(str);
            }
          } catch (__) {
            codeContent = md.utils.escapeHtml(str);
          }
        } else {
          codeContent = md.utils.escapeHtml(str);
        }

        return `<div style="margin: 20px 0; border-radius: 8px; overflow: hidden; background: #383a42; box-shadow: 0 2px 8px rgba(0,0,0,0.15);">${dots}<div style="padding: 16px; overflow-x: auto; background: #383a42;"><code style="display: block; color: #abb2bf; font-family: 'SF Mono', Monaco, 'Cascadia Code', Consolas, monospace; font-size: 14px; line-height: 1.6; white-space: pre;">${codeContent}</code></div></div>`;
      }
    });

    this.patchMarkdownScanner(md);
    this.md = md;

    // 手动触发一次渲染（确保初始内容显示）
    this.$nextTick(() => {
      this.renderMarkdown();
    });
  },

  beforeUnmount() {
  },

  computed: {
    // 渲染 AI 生成的内容
    renderedAIContent() {
      if (!this.aiGeneratedContent || !this.md) return '';
      return this.md.render(this.aiGeneratedContent);
    }
  },

  watch: {
    currentStyle() {
      if (this.md) {
        this.renderMarkdown();
      }
      // 保存样式偏好
      this.saveUserPreferences();
    },
    markdownInput(newVal, oldVal) {
      if (this.md) {
        this.renderMarkdown();
      }
      // 自动保存内容（防抖）
      clearTimeout(this._saveTimeout);
      this._saveTimeout = setTimeout(() => {
        this.saveUserPreferences();
      }, 1000); // 1秒后保存

      // 当内容被清空时，重置当前文章ID（下次保存会创建新文章）
      if (!newVal || !newVal.trim()) {
        this.currentArticleId = null;
      }
      // 当从空内容粘贴大量内容时，也视为新文章
      else if ((!oldVal || oldVal.trim().length < 10) && newVal.trim().length > 100) {
        this.currentArticleId = null;
      }
    }
  },

  methods: {
    loadStarredStyles() {
      try {
        const saved = localStorage.getItem('starredStyles');
        if (saved) {
          this.starredStyles = JSON.parse(saved);
        }
      } catch (error) {
        console.error('加载星标样式失败:', error);
        this.starredStyles = [];
      }
    },

    // 加载用户偏好设置（样式和内容）
    loadUserPreferences() {
      try {
        // 加载样式偏好
        const savedStyle = localStorage.getItem('currentStyle');
        if (savedStyle && STYLES[savedStyle]) {
          this.currentStyle = savedStyle;
        }

        // 加载上次的内容
        const savedContent = localStorage.getItem('markdownInput');
        if (savedContent) {
          this.markdownInput = savedContent;
        } else {
          // 如果没有保存的内容，加载默认示例
          this.loadDefaultExample();
        }
      } catch (error) {
        console.error('加载用户偏好失败:', error);
        // 加载失败时使用默认示例
        this.loadDefaultExample();
      }
    },

    // 保存用户偏好设置
    saveUserPreferences() {
      try {
        // 保存当前样式
        localStorage.setItem('currentStyle', this.currentStyle);

        // 保存当前内容
        localStorage.setItem('markdownInput', this.markdownInput);
      } catch (error) {
        console.error('保存用户偏好失败:', error);
      }
    },

    // 加载默认示例文章
    loadDefaultExample() {
      this.markdownInput = `![](https://images.unsplash.com/photo-1499951360447-b19be8fe80f5?w=1200&h=400&fit=crop)

# 公众号 Markdown 编辑器

欢迎使用这款专为**微信公众号**设计的 Markdown 编辑器！✨

## 🎯 核心功能

### 1. 智能图片处理

![](https://images.unsplash.com/photo-1618005198919-d3d4b5a92ead?w=800&h=500&fit=crop)

- **粘贴即用**：支持从任何地方复制粘贴图片（截图、浏览器、文件管理器）
- **自动压缩**：图片自动压缩，平均压缩 50%-80%
- **本地存储**：使用 IndexedDB 持久化，刷新不丢失
- **编辑流畅**：编辑器中使用短链接，告别卡顿

### 2. 多图排版展示

支持朋友圈式的多图网格布局，2-3 列自动排版：

![](https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=600&h=400&fit=crop)
![](https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&h=400&fit=crop)
![](https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=600&h=400&fit=crop)

### 3. 13 种精美样式

1. **经典公众号系列**：默认、技术、优雅、深度阅读
2. **传统媒体系列**：杂志、纽约时报、金融时报、Jony Ive
3. **现代数字系列**：Wired、Medium、Apple、Claude、AI Coder

### 4. 一键复制

点击「复制到公众号」按钮，直接粘贴到公众号后台，格式完美保留！

## 💻 代码示例

\`\`\`javascript
// 图片自动压缩并存储到 IndexedDB
const compressedBlob = await imageCompressor.compress(file);
await imageStore.saveImage(imageId, compressedBlob);

// 编辑器中插入短链接
const markdown = \`![图片](img://\${imageId})\`;
\`\`\`

## 📖 引用样式

> 这是一段引用文字，展示编辑器的引用样式效果。
>
> 不同的样式主题会有不同的引用样式，试试切换样式看看效果！

## 📊 表格支持

| 功能 | 支持情况 | 说明 |
|------|---------|------|
| 图片粘贴 | ✅ | 100% 成功率 |
| 刷新保留 | ✅ | IndexedDB 存储 |
| 样式主题 | ✅ | 13 种精选样式 |
| 代码高亮 | ✅ | 多语言支持 |

---

**💡 提示**：

- 试着切换不同的样式主题，体验各种风格的排版效果
- 粘贴图片试试智能压缩功能
- 刷新页面看看内容是否保留

**🌟 开源项目**：如果觉得有用，欢迎访问 [GitHub 仓库](https://github.com/alchaincyf/huasheng_editor) 给个 Star！`;
    },

    handleFileUpload(event) {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        this.markdownInput = e.target.result;
      };
      reader.onerror = () => {
        this.showToast('文件读取失败', 'error');
      };
      reader.readAsText(file);

      // 清空 input，允许重复上传同一文件
      event.target.value = '';
    },

    async renderMarkdown() {
      if (!this.markdownInput.trim()) {
        this.renderedContent = '';
        return;
      }

      // 检查 markdown-it 是否已初始化
      if (!this.md) {
        console.warn('markdown-it 尚未初始化，跳过渲染');
        return;
      }

      // 预处理 Markdown
      const processedContent = this.preprocessMarkdown(this.markdownInput);

      // 渲染
      let html = this.md.render(processedContent);

      // 处理 img:// 协议（从 IndexedDB 加载图片）
      html = await this.processImageProtocol(html);

      // 应用样式
      html = this.applyInlineStyles(html);

      this.renderedContent = html;
    },

    preprocessMarkdown(content) {
      // 规范化水平分割线格式（修复从飞书等复制时的解析问题）
      // 匹配 * * *、- - -、_ _ _ 等格式（包括带空格的变体）
      // 确保它们被正确解析为 <hr> 而非无序列表
      content = content.replace(/^[ ]{0,3}(\*[ ]*\*[ ]*\*[\* ]*)[ \t]*$/gm, '***');
      content = content.replace(/^[ ]{0,3}(-[ ]*-[ ]*-[- ]*)[ \t]*$/gm, '---');
      content = content.replace(/^[ ]{0,3}(_[ ]*_[ ]*_[_ ]*)[ \t]*$/gm, '___');

      // 修复飞书等复制时的加粗格式断裂问题
      // 例如：**text** **more** -> **text more**（合并相邻的加粗片段）
      // 处理 **空白** (结束后紧跟开始，中间有任意空白) -> 单个空格
      content = content.replace(/\*\*\s+\*\*/g, ' ');
      // 处理 **** 或更多连续星号（通常是格式错误）-> 移除
      content = content.replace(/\*{4,}/g, '');
      // 处理 word** 或 **word 紧贴标点的情况（中文标点）
      // 在中文右标点前的 ** 后添加零宽空格，帮助解析
      content = content.replace(/\*\*([）」』》〉】〕〗］｝"'。，、；：？！])/g, '**\u200B$1');
      // 在中文左标点后的 ** 前添加零宽空格
      content = content.replace(/([（「『《〈【〔〖［｛"'])\*\*/g, '$1\u200B**');
      // 同样处理下划线格式
      content = content.replace(/__\s+__/g, ' ');
      content = content.replace(/_{4,}/g, '');

      // 规范化列表项格式
      content = content.replace(/^(\s*(?:\d+\.|-|\*)\s+[^:\n]+)\n\s*:\s*(.+?)$/gm, '$1: $2');
      content = content.replace(/^(\s*(?:\d+\.|-|\*)\s+.+?:)\s*\n\s+(.+?)$/gm, '$1 $2');
      content = content.replace(/^(\s*(?:\d+\.|-|\*)\s+[^:\n]+)\n:\s*(.+?)$/gm, '$1: $2');
      content = content.replace(/^(\s*(?:\d+\.|-|\*)\s+.+?)\n\n\s+(.+?)$/gm, '$1 $2');

      // 修复：markdown-it 对图片紧跟文本时解析异常
      // 当图片（img标签或 ![](img://xxx) 格式）紧跟在文本后面时，
      // markdown-it 可能把部分文本误解析到图片的 alt 属性中
      // 解决方案：在图片前后添加空行，确保图片在独立的段落
      
      // 处理 ![...](img://xxx) 格式：在前面加空行
      content = content.replace(/\n(!\[[^\]]*\]\(img:\/\/[^)]+\))/g, '\n\n$1')
      // 处理 ![...](img://xxx) 格式：在后面加空行  
      content = content.replace(/(!\[[^\]]*\]\(img:\/\/[^)]+\))\n/g, '$1\n\n')
      // 处理单个图片引用前后没有空行的情况（多种格式）
      content = content.replace(/([^\n])\n(!\[)/g, '$1\n\n$2')  // 文本后直接跟图片
      content = content.replace(/(!\])\n([^\n])/g, '$1\n\n$2')  // 图片后直接跟文本
      
      return content;
    },

    // 处理 img:// 协议（从 IndexedDB 加载图片）
    async processImageProtocol(html) {
      if (!this.imageStore) {
        return html;
      }

      // 使用 DOMParser 解析 HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // 查找所有 img 标签
      const images = doc.querySelectorAll('img');

      // 处理每个图片
      for (const img of images) {
        const src = img.getAttribute('src');

        // 检查是否是 img:// 协议
        if (src && src.startsWith('img://')) {
          // 提取图片 ID
          const imageId = src.replace('img://', '');

          try {
            // 从 IndexedDB 获取图片
            let objectURL = this.imageIdToObjectURL[imageId];

            if (!objectURL) {
              // 如果还没有创建 Object URL，现在创建
              objectURL = await this.imageStore.getImage(imageId);

              if (objectURL) {
                // 缓存 Object URL
                this.imageIdToObjectURL[imageId] = objectURL;
              } else {
                console.warn(`图片不存在: ${imageId}`);
                // 图片不存在，显示占位符
                img.setAttribute('src', 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23ddd" width="200" height="200"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3E图片丢失%3C/text%3E%3C/svg%3E');
                continue;
              }
            }

            // 替换 src 为 Object URL
            img.setAttribute('src', objectURL);

            // 添加 data-image-id 属性（用于复制时识别）
            img.setAttribute('data-image-id', imageId);
          } catch (error) {
            console.error(`加载图片失败 (${imageId}):`, error);
            // 显示错误占位符
            img.setAttribute('src', 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23fee" width="200" height="200"/%3E%3Ctext fill="%23c00" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3E加载失败%3C/text%3E%3C/svg%3E');
          }
        }
      }

      return doc.body.innerHTML;
    },

    applyInlineStyles(html) {
      const style = STYLES[this.currentStyle].styles;
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const headingInlineOverrides = {
        strong: 'font-weight: 700; color: inherit !important; background-color: transparent !important;',
        em: 'font-style: italic; color: inherit !important; background-color: transparent !important;',
        a: 'color: inherit !important; text-decoration: none !important; border-bottom: 1px solid currentColor !important; background-color: transparent !important;',
        code: 'color: inherit !important; background-color: transparent !important; border: none !important; padding: 0 !important;',
        span: 'color: inherit !important; background-color: transparent !important;',
        b: 'font-weight: 700; color: inherit !important; background-color: transparent !important;',
        i: 'font-style: italic; color: inherit !important; background-color: transparent !important;',
        del: 'color: inherit !important; background-color: transparent !important;',
        mark: 'color: inherit !important; background-color: transparent !important;',
        s: 'color: inherit !important; background-color: transparent !important;',
        u: 'color: inherit !important; text-decoration: underline !important; background-color: transparent !important;',
        ins: 'color: inherit !important; text-decoration: underline !important; background-color: transparent !important;',
        kbd: 'color: inherit !important; background-color: transparent !important; border: none !important; padding: 0 !important;',
        sub: 'color: inherit !important; background-color: transparent !important;',
        sup: 'color: inherit !important; background-color: transparent !important;'
      };
      const headingInlineSelectorList = Object.keys(headingInlineOverrides).join(', ');

      // 先处理图片网格布局（在应用样式之前）
      this.groupConsecutiveImages(doc);

      Object.keys(style).forEach(selector => {
        if (selector === 'pre' || selector === 'code' || selector === 'pre code') {
          return;
        }

        // 跳过已经在网格容器中的图片
        const elements = doc.querySelectorAll(selector);
        elements.forEach(el => {
          // 如果是图片且在网格容器内，跳过样式应用
          if (el.tagName === 'IMG' && el.closest('.image-grid')) {
            return;
          }

          const currentStyle = el.getAttribute('style') || '';
          el.setAttribute('style', currentStyle + '; ' + style[selector]);
        });
      });

      // 标题内的行内元素统一继承标题颜色，避免各主题样式冲突
      const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
      headings.forEach(heading => {
        const inlineNodes = heading.querySelectorAll(headingInlineSelectorList);
        inlineNodes.forEach(node => {
          const tag = node.tagName.toLowerCase();
          let override = headingInlineOverrides[tag];
          if (!override) {
            return;
          }

          const currentStyle = node.getAttribute('style') || '';
          const sanitizedStyle = currentStyle
            .replace(/color:\s*[^;]+;?/gi, '')
            .replace(/background(?:-color)?:\s*[^;]+;?/gi, '')
            .replace(/border(?:-bottom)?:\s*[^;]+;?/gi, '')
            .replace(/text-decoration:\s*[^;]+;?/gi, '')
            .replace(/box-shadow:\s*[^;]+;?/gi, '')
            .replace(/padding:\s*[^;]+;?/gi, '')
            .replace(/;\s*;/g, ';')
            .trim();
          node.setAttribute('style', sanitizedStyle + '; ' + override);
        });
      });

      const container = doc.createElement('div');
      container.setAttribute('style', style.container);
      container.innerHTML = doc.body.innerHTML;

      return container.outerHTML;
    },

    groupConsecutiveImages(doc) {
      const body = doc.body;
      const children = Array.from(body.children);

      let imagesToProcess = [];

      // 找出所有图片元素，处理两种情况：
      // 1. 多个图片在同一个<p>标签内（连续图片）
      // 2. 每个图片在单独的<p>标签内（分隔的图片）
      children.forEach((child, index) => {
        if (child.tagName === 'P') {
          const images = child.querySelectorAll('img');
          if (images.length > 0) {
            // 如果一个P标签内有多个图片，它们肯定是连续的
            if (images.length > 1) {
              // 多个图片在同一个P标签内，作为一组
              const group = Array.from(images).map(img => ({
                element: child,
                img: img,
                index: index,
                inSameParagraph: true,
                paragraphImageCount: images.length
              }));
              imagesToProcess.push(...group);
            } else if (images.length === 1) {
              // 单个图片在P标签内
              imagesToProcess.push({
                element: child,
                img: images[0],
                index: index,
                inSameParagraph: false,
                paragraphImageCount: 1
              });
            }
          }
        } else if (child.tagName === 'IMG') {
          // 直接是图片元素（少见情况）
          imagesToProcess.push({
            element: child,
            img: child,
            index: index,
            inSameParagraph: false,
            paragraphImageCount: 1
          });
        }
      });

      // 分组逻辑
      let groups = [];
      let currentGroup = [];

      imagesToProcess.forEach((item, i) => {
        if (i === 0) {
          currentGroup.push(item);
        } else {
          const prevItem = imagesToProcess[i - 1];

          // 判断是否连续的条件：
          // 1. 在同一个P标签内的图片肯定是连续的
          // 2. 不同P标签的图片，要看索引是否相邻（差值为1表示相邻）
          let isContinuous = false;

          if (item.index === prevItem.index) {
            // 同一个P标签内的图片
            isContinuous = true;
          } else if (item.index - prevItem.index === 1) {
            // 相邻的P标签，表示连续（没有空行）
            isContinuous = true;
          }
          // 如果索引差大于1，说明中间有其他元素或空行，不连续

          if (isContinuous) {
            currentGroup.push(item);
          } else {
            if (currentGroup.length > 0) {
              groups.push([...currentGroup]);
            }
            currentGroup = [item];
          }
        }
      });

      if (currentGroup.length > 0) {
        groups.push(currentGroup);
      }

      // 对每组图片进行处理
      groups.forEach(group => {
        // 只有2张及以上的图片才需要特殊布局
        if (group.length < 2) return;

        const imageCount = group.length;
        const firstElement = group[0].element;

        // 创建容器
        const gridContainer = doc.createElement('div');
        gridContainer.setAttribute('class', 'image-grid');
        gridContainer.setAttribute('data-image-count', imageCount);

        // 根据图片数量设置网格样式
        let gridStyle = '';
        let columns = 2; // 默认2列

        if (imageCount === 2) {
          gridStyle = `
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            margin: 20px auto;
            max-width: 100%;
            align-items: start;
          `;
          columns = 2;
        } else if (imageCount === 3) {
          gridStyle = `
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
            margin: 20px auto;
            max-width: 100%;
            align-items: start;
          `;
          columns = 3;
        } else if (imageCount === 4) {
          gridStyle = `
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            margin: 20px auto;
            max-width: 100%;
            align-items: start;
          `;
          columns = 2;
        } else {
          // 5张及以上，使用3列
          gridStyle = `
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
            margin: 20px auto;
            max-width: 100%;
            align-items: start;
          `;
          columns = 3;
        }

        gridContainer.setAttribute('style', gridStyle);
        gridContainer.setAttribute('data-columns', columns);

        // 将图片添加到容器中
        group.forEach((item) => {
          const imgWrapper = doc.createElement('div');

          imgWrapper.setAttribute('style', `
            width: 100%;
            height: auto;
            overflow: hidden;
          `);

          const img = item.img.cloneNode(true);
          // 修改图片样式以适应容器，添加圆角
          img.setAttribute('style', `
            width: 100%;
            height: auto;
            display: block;
            border-radius: 8px;
          `.trim());

          imgWrapper.appendChild(img);
          gridContainer.appendChild(imgWrapper);
        });

        // 替换原来的图片元素
        firstElement.parentNode.insertBefore(gridContainer, firstElement);

        // 删除原来的图片元素（需要去重，避免重复删除同一个元素）
        const elementsToRemove = new Set();
        group.forEach(item => {
          elementsToRemove.add(item.element);
        });
        elementsToRemove.forEach(element => {
          if (element.parentNode) {
            element.parentNode.removeChild(element);
          }
        });
      });
    },

    convertGridToTable(doc) {
      // 找到所有的图片网格容器
      const imageGrids = doc.querySelectorAll('.image-grid');

      imageGrids.forEach(grid => {
        // 从data属性获取列数（我们在创建时设置的）
        const columns = parseInt(grid.getAttribute('data-columns')) || 2;
        this.convertToTable(doc, grid, columns);
      });
    },

    convertToTable(doc, grid, columns) {
      // 获取所有图片包装器
      const imgWrappers = Array.from(grid.children);

      // 创建 table 元素
      const table = doc.createElement('table');
      table.setAttribute('style', `
        width: 100% !important;
        border-collapse: collapse !important;
        margin: 20px auto !important;
        table-layout: fixed !important;
        border: none !important;
        background: transparent !important;
      `.trim());

      // 计算需要多少行
      const rows = Math.ceil(imgWrappers.length / columns);

      // 创建表格行
      for (let i = 0; i < rows; i++) {
        const tr = doc.createElement('tr');

        // 创建表格单元格
        for (let j = 0; j < columns; j++) {
          const index = i * columns + j;
          const td = doc.createElement('td');

          td.setAttribute('style', `
            padding: 4px !important;
            vertical-align: top !important;
            width: ${100 / columns}% !important;
            border: none !important;
            background: transparent !important;
          `.trim());

          // 如果有对应的图片，添加到单元格
          if (index < imgWrappers.length) {
            const imgWrapper = imgWrappers[index];
            const img = imgWrapper.querySelector('img');

            if (img) {
              // 根据列数设置不同的图片最大高度 - 确保单行最高360px
              let imgMaxHeight;
              let containerHeight;
              if (columns === 2) {
                imgMaxHeight = '340px';  // 2列布局单张最高340px（留出padding空间）
                containerHeight = '360px';  // 容器高度360px
              } else if (columns === 3) {
                imgMaxHeight = '340px';  // 3列布局单张最高340px
                containerHeight = '360px';  // 容器高度360px
              } else {
                imgMaxHeight = '340px';  // 默认高度340px
                containerHeight = '360px';  // 容器高度360px
              }

              // 创建一个新的包装 div - 添加背景和居中样式（使用table-cell方式，更兼容）
              const wrapper = doc.createElement('div');
              wrapper.setAttribute('style', `
                width: 100% !important;
                height: ${containerHeight} !important;
                text-align: center !important;
                background-color: #f5f5f5 !important;
                border-radius: 4px !important;
                padding: 10px !important;
                box-sizing: border-box !important;
                overflow: hidden !important;
                display: table !important;
              `.trim());

              // 创建内部居中容器
              const innerWrapper = doc.createElement('div');
              innerWrapper.setAttribute('style', `
                display: table-cell !important;
                vertical-align: middle !important;
                text-align: center !important;
              `.trim());

              // 克隆图片并直接设置最大高度
              const newImg = img.cloneNode(true);
              newImg.setAttribute('style', `
                max-width: calc(100% - 20px) !important;
                max-height: ${imgMaxHeight} !important;
                width: auto !important;
                height: auto !important;
                display: inline-block !important;
                margin: 0 auto !important;
                border-radius: 4px !important;
                object-fit: contain !important;
              `.trim());

              innerWrapper.appendChild(newImg);
              wrapper.appendChild(innerWrapper);
              td.appendChild(wrapper);
            }
          }

          tr.appendChild(td);
        }

        table.appendChild(tr);
      }

      // 替换网格为 table
      grid.parentNode.replaceChild(table, grid);
    },

    async copyToClipboard() {
      if (!this.renderedContent) {
        this.showToast('没有内容可复制', 'error');
        return;
      }

      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(this.renderedContent, 'text/html');

        // 将图片网格转换为 table 布局（公众号兼容）
        this.convertGridToTable(doc);

        // 处理图片：转为 Base64（串行处理，降低内存峰值）
        const images = doc.querySelectorAll('img');
        if (images.length > 0) {
          this.showToast(`正在处理 ${images.length} 张图片...`, 'success');

          let successCount = 0;
          let failCount = 0;

          let gifCount = 0;

          for (const img of Array.from(images)) {
            try {
              // 检测 GIF：跳过并替换为提示信息
              const isGif = await this.isGifImage(img);
              if (isGif) {
                gifCount++;
                const placeholder = doc.createElement('p');
                placeholder.setAttribute('style',
                  'background-color: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; ' +
                  'padding: 12px 16px; color: #856404; font-size: 14px; text-align: center; ' +
                  'margin: 16px 0; line-height: 1.6;'
                );
                placeholder.textContent = '⚠️ 此处为 GIF 动图，无法直接复制到公众号排版，请在公众号编辑器中重新上传。';
                img.parentNode.replaceChild(placeholder, img);
                continue;
              }

              const base64 = await this.convertImageToBase64(img);
              img.setAttribute('src', base64);
              successCount++;
            } catch (error) {
              console.error('图片转换失败:', img.getAttribute('src'), error);
              failCount++;
              // 失败时保持原URL
            }
          }

          if (gifCount > 0) {
            this.showToast(`${gifCount} 张 GIF 动图已替换为提示，请在公众号中重新上传`, 'warning');
          }

          if (failCount > 0) {
            this.showToast(`图片处理完成：${successCount} 成功，${failCount} 失败（保留原链接）`, 'error');
          }
        }

        // Section 容器包裹
        const styleConfig = STYLES[this.currentStyle];
        const containerBg = this.extractBackgroundColor(styleConfig.styles.container);

        if (containerBg && containerBg !== '#fff' && containerBg !== '#ffffff') {
          const section = doc.createElement('section');
          const containerStyle = styleConfig.styles.container;
          const paddingMatch = containerStyle.match(/padding:\s*([^;]+)/);
          const maxWidthMatch = containerStyle.match(/max-width:\s*([^;]+)/);
          const padding = paddingMatch ? paddingMatch[1].trim() : '40px 20px';
          const maxWidth = maxWidthMatch ? maxWidthMatch[1].trim() : '100%';

          section.setAttribute('style',
            `background-color: ${containerBg}; ` +
            `padding: ${padding}; ` +
            `max-width: ${maxWidth}; ` +
            `margin: 0 auto; ` +
            `box-sizing: border-box; ` +
            `word-wrap: break-word;`
          );

          while (doc.body.firstChild) {
            section.appendChild(doc.body.firstChild);
          }

          const allElements = section.querySelectorAll('*');
          allElements.forEach(el => {
            const currentStyle = el.getAttribute('style') || '';
            let newStyle = currentStyle;
            newStyle = newStyle.replace(/max-width:\s*[^;]+;?/g, '');
            newStyle = newStyle.replace(/margin:\s*0\s+auto;?/g, '');
            if (newStyle.includes(`background-color: ${containerBg}`)) {
              newStyle = newStyle.replace(new RegExp(`background-color:\\s*${containerBg.replace(/[()]/g, '\\$&')};?`, 'g'), '');
            }
            newStyle = newStyle.replace(/;\s*;/g, ';').replace(/^\s*;\s*|\s*;\s*$/g, '').trim();
            if (newStyle) {
              el.setAttribute('style', newStyle);
            } else {
              el.removeAttribute('style');
            }
          });

          doc.body.appendChild(section);
        }

        // 代码块简化
        const codeBlocks = doc.querySelectorAll('div[style*="border-radius: 8px"]');
        codeBlocks.forEach(block => {
          const codeElement = block.querySelector('code');
          if (codeElement) {
            const codeText = codeElement.textContent || codeElement.innerText;
            const pre = doc.createElement('pre');
            const code = doc.createElement('code');

            pre.setAttribute('style',
              'background: linear-gradient(to bottom, #2a2c33 0%, #383a42 8px, #383a42 100%);' +
              'padding: 0;' +
              'border-radius: 6px;' +
              'overflow: hidden;' +
              'margin: 24px 0;' +
              'box-shadow: 0 2px 8px rgba(0,0,0,0.15);'
            );

            code.setAttribute('style',
              'color: #abb2bf;' +
              'font-family: "SF Mono", Consolas, Monaco, "Courier New", monospace;' +
              'font-size: 14px;' +
              'line-height: 1.7;' +
              'display: block;' +
              'white-space: pre;' +
              'padding: 16px 20px;' +
              '-webkit-font-smoothing: antialiased;' +
              '-moz-osx-font-smoothing: grayscale;'
            );

            code.textContent = codeText;
            pre.appendChild(code);
            block.parentNode.replaceChild(pre, block);
          }
        });

        // 列表项扁平化
        const listItems = doc.querySelectorAll('li');
        listItems.forEach(li => {
          let text = li.textContent || li.innerText;
          text = text.replace(/\n/g, ' ').replace(/\r/g, ' ').replace(/\s+/g, ' ').trim();
          li.innerHTML = '';
          li.textContent = text;
          const currentStyle = li.getAttribute('style') || '';
          li.setAttribute('style', currentStyle);
        });

        // 深色模式适配：调整引用块样式，使用透明黑色让微信自动转换
        const blockquotes = doc.querySelectorAll('blockquote');
        blockquotes.forEach(blockquote => {
          const currentStyle = blockquote.getAttribute('style') || '';

          // 移除现有的背景色和文字颜色
          let newStyle = currentStyle
            .replace(/background(?:-color)?:\s*[^;]+;?/gi, '')
            .replace(/color:\s*[^;]+;?/gi, '');

          // 添加深色模式友好的样式
          // 使用半透明黑色背景和文字，微信会在深色模式下自动反转
          newStyle += '; background: rgba(0, 0, 0, 0.05) !important';
          newStyle += '; color: rgba(0, 0, 0, 0.8) !important';

          // 清理多余的分号
          newStyle = newStyle.replace(/;\s*;/g, ';').replace(/^\s*;\s*|\s*;\s*$/g, '').trim();
          blockquote.setAttribute('style', newStyle);
        });

        const simplifiedHTML = doc.body.innerHTML;
        const plainText = doc.body.textContent || '';

        // 检查焦点：异步处理图片后窗口可能失焦
        if (document.hasFocus()) {
          const htmlBlob = new Blob([simplifiedHTML], { type: 'text/html' });
          const textBlob = new Blob([plainText], { type: 'text/plain' });

          const clipboardItem = new ClipboardItem({
            'text/html': htmlBlob,
            'text/plain': textBlob
          });

          await navigator.clipboard.write([clipboardItem]);

          this.copySuccess = true;
          this.showToast('复制成功', 'success');

          // 自动保存到历史记录
          this.saveToHistory();

          setTimeout(() => {
            this.copySuccess = false;
          }, 2000);
        } else {
          // 焦点丢失，降级到 execCommand
          console.warn('窗口失焦，使用降级复制方案');
          this.clipboardFallback(simplifiedHTML);
        }
      } catch (error) {
        console.error('复制失败:', error);
        // 尝试降级方案
        try {
          const fallbackHTML = doc ? doc.body.innerHTML : this.renderedContent;
          this.clipboardFallback(fallbackHTML);
        } catch (fallbackError) {
          console.error('降级复制也失败:', fallbackError);
          this.showToast('复制失败', 'error');
        }
      }
    },

    // 复制到 X Articles（纯净语义化 HTML）
    async copyToXArticles() {
      if (!this.renderedContent) return;

      try {
        this.showToast('正在准备 X Articles 格式...', 'processing');

        const parser = new DOMParser();
        const doc = parser.parseFromString(this.renderedContent, 'text/html');

        this.sanitizeForXArticles(doc);

        const html = doc.body.innerHTML;
        const plainText = doc.body.innerText || doc.body.textContent || '';

        if (document.hasFocus()) {
          const blob = new Blob([html], { type: 'text/html' });
          const textBlob = new Blob([plainText], { type: 'text/plain' });
          await navigator.clipboard.write([
            new ClipboardItem({
              'text/html': blob,
              'text/plain': textBlob
            })
          ]);

          this.copyXSuccess = true;
          this.showToast('已复制 X Articles 格式', 'success');
          this.saveToHistory();

          setTimeout(() => {
            this.copyXSuccess = false;
          }, 2000);
        } else {
          console.warn('窗口失焦，使用降级复制方案');
          this.clipboardFallbackX(html);
        }
      } catch (error) {
        console.error('复制到 X 失败:', error);
        try {
          const parser = new DOMParser();
          const doc = parser.parseFromString(this.renderedContent, 'text/html');
          this.sanitizeForXArticles(doc);
          this.clipboardFallbackX(doc.body.innerHTML);
        } catch (fallbackError) {
          console.error('降级复制也失败:', fallbackError);
          this.showToast('复制失败', 'error');
        }
      }
    },

    // X Articles 降级复制
    clipboardFallbackX(html) {
      try {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        tempDiv.setAttribute('style', 'position:fixed;left:-9999px;top:-9999px;opacity:0;');
        document.body.appendChild(tempDiv);

        const range = document.createRange();
        range.selectNodeContents(tempDiv);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);

        const success = document.execCommand('copy');
        selection.removeAllRanges();
        document.body.removeChild(tempDiv);

        if (success) {
          this.copyXSuccess = true;
          this.showToast('已复制 X Articles 格式（降级模式）', 'success');
          this.saveToHistory();
          setTimeout(() => { this.copyXSuccess = false; }, 2000);
        } else {
          this.showToast('复制失败', 'error');
        }
      } catch (e) {
        console.error('降级复制也失败:', e);
        this.showToast('复制失败', 'error');
      }
    },

    // 清洗 HTML 为 X Articles 兼容格式
    sanitizeForXArticles(doc) {
      // X Articles 白名单标签
      const ALLOWED_TAGS = new Set([
        'h2', 'h3', 'p', 'strong', 'em', 'del', 'a',
        'ul', 'ol', 'li', 'blockquote', 'br', 'b', 'i', 's'
      ]);

      // 1. h1 → h2（X Articles 的 H1 保留给文章标题）
      doc.querySelectorAll('h1').forEach(h1 => {
        const h2 = doc.createElement('h2');
        h2.innerHTML = h1.innerHTML;
        h1.parentNode.replaceChild(h2, h1);
      });

      // 2. h4/h5/h6 → h3（仅支持 H2 和 H3）
      doc.querySelectorAll('h4, h5, h6').forEach(h => {
        const h3 = doc.createElement('h3');
        h3.innerHTML = h.innerHTML;
        h.parentNode.replaceChild(h3, h);
      });

      // 3. 代码块 → blockquote（不支持 pre/code）
      //    匹配代码块容器（div 包含 code 或 pre）
      doc.querySelectorAll('div[style*="border-radius"], pre').forEach(block => {
        const codeEl = block.querySelector('code') || block;
        const codeText = codeEl.textContent || codeEl.innerText || '';
        const bq = doc.createElement('blockquote');
        const lines = codeText.split('\n');
        lines.forEach((line, i) => {
          if (i > 0) bq.appendChild(doc.createElement('br'));
          bq.appendChild(doc.createTextNode(line || '\u00A0'));
        });
        block.parentNode.replaceChild(bq, block);
      });

      // 4. table → blockquote 管道符分隔文本
      doc.querySelectorAll('table').forEach(table => {
        const bq = doc.createElement('blockquote');
        const rows = table.querySelectorAll('tr');
        rows.forEach((row, ri) => {
          if (ri > 0) {
            bq.appendChild(doc.createElement('br'));
          }
          const cells = row.querySelectorAll('th, td');
          const cellTexts = Array.from(cells).map(c => (c.textContent || '').trim());
          bq.appendChild(doc.createTextNode('| ' + cellTexts.join(' | ') + ' |'));
        });
        table.parentNode.replaceChild(bq, table);
      });

      // 5. img → 占位符（不支持 img 标签粘贴）
      doc.querySelectorAll('img').forEach(img => {
        const p = doc.createElement('p');
        const alt = img.getAttribute('alt') || '图片';
        p.textContent = `[${alt}]`;
        // 如果 img 在 p 内，替换整个 p
        const parent = img.parentNode;
        if (parent && parent.tagName === 'P') {
          parent.parentNode.replaceChild(p, parent);
        } else {
          img.parentNode.replaceChild(p, img);
        }
      });

      // 6. hr → 分隔符文本
      doc.querySelectorAll('hr').forEach(hr => {
        const p = doc.createElement('p');
        p.textContent = '———';
        hr.parentNode.replaceChild(p, hr);
      });

      // 7. 移除所有 style/class 属性，解包非白名单标签
      const cleanNode = (node) => {
        if (node.nodeType === Node.TEXT_NODE) return;
        if (node.nodeType !== Node.ELEMENT_NODE) return;

        // 递归处理子节点（从后向前遍历，避免修改导致跳过）
        const children = Array.from(node.childNodes);
        children.forEach(child => cleanNode(child));

        const tag = node.tagName.toLowerCase();

        // 移除所有属性（保留 href）
        if (tag !== 'a') {
          while (node.attributes.length > 0) {
            node.removeAttribute(node.attributes[0].name);
          }
        } else {
          // a 标签只保留 href
          const href = node.getAttribute('href');
          while (node.attributes.length > 0) {
            node.removeAttribute(node.attributes[0].name);
          }
          if (href) node.setAttribute('href', href);
        }

        // 解包非白名单标签（保留内容）
        if (!ALLOWED_TAGS.has(tag) && tag !== 'body') {
          const fragment = doc.createDocumentFragment();
          while (node.firstChild) {
            fragment.appendChild(node.firstChild);
          }
          node.parentNode.replaceChild(fragment, node);
        }
      };

      cleanNode(doc.body);

      // 8. 清理空的 blockquote/p
      doc.querySelectorAll('blockquote, p').forEach(el => {
        if (!el.textContent.trim() && !el.querySelector('br, img')) {
          el.remove();
        }
      });
    },

    // 判断图片是否为 GIF（通过 IndexedDB 记录或 src 后缀判断）
    async isGifImage(imgElement) {
      const imageId = imgElement.getAttribute('data-image-id');
      if (imageId && this.imageStore) {
        try {
          const record = await withTimeout(
            this.imageStore.getImageRecord(imageId),
            3000,
            'GIF 检测超时'
          );
          if (record) {
            const mime = record.mimeType || (record.blob && record.blob.type) || '';
            if (mime === 'image/gif') return true;
          }
        } catch (e) {
          console.warn('GIF 检测失败:', e);
        }
      }
      // 后备：通过 src 后缀判断
      const src = (imgElement.getAttribute('src') || '').toLowerCase();
      return src.endsWith('.gif') || src.includes('.gif?');
    },

    // 复制时压缩大图（>1MB 二次压缩）
    async compressForClipboard(blob, mimeType) {
      if (blob.size > 1024 * 1024) {
        try {
          return await this.recompressForClipboard(blob);
        } catch (e) {
          console.warn('二次压缩失败，使用原图:', e);
        }
      }
      return blob;
    },

    // 二次压缩大图（质量 0.6，最大 1200x1200）
    async recompressForClipboard(blob) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(blob);
        img.onload = () => {
          try {
            const maxDim = 1200;
            let w = img.naturalWidth;
            let h = img.naturalHeight;
            const ratio = Math.min(maxDim / w, maxDim / h, 1);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            canvas.toBlob(
              (result) => {
                URL.revokeObjectURL(url);
                if (result && result.size < blob.size) {
                  resolve(result);
                } else {
                  resolve(blob); // 压缩后更大则用原图
                }
              },
              'image/jpeg',
              0.6
            );
          } catch (e) {
            URL.revokeObjectURL(url);
            reject(e);
          }
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('图片加载失败'));
        };
        img.src = url;
      });
    },

    // 剪贴板降级方案：使用 execCommand('copy')
    clipboardFallback(html) {
      try {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        tempDiv.setAttribute('style', 'position:fixed;left:-9999px;top:-9999px;opacity:0;');
        document.body.appendChild(tempDiv);

        const range = document.createRange();
        range.selectNodeContents(tempDiv);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);

        const success = document.execCommand('copy');
        selection.removeAllRanges();
        document.body.removeChild(tempDiv);

        if (success) {
          this.copySuccess = true;
          this.showToast('复制成功（降级模式）', 'success');
          this.saveToHistory();
          setTimeout(() => { this.copySuccess = false; }, 2000);
        } else {
          this.showToast('复制失败', 'error');
        }
      } catch (e) {
        console.error('降级复制也失败:', e);
        this.showToast('复制失败', 'error');
      }
    },

    async convertImageToBase64(imgElement) {
      const src = imgElement.getAttribute('src');

      // 如果已经是Base64，直接返回
      if (src.startsWith('data:')) {
        return src;
      }

      // 优先处理：检查是否有 data-image-id（来自 IndexedDB）
      const imageId = imgElement.getAttribute('data-image-id');
      if (imageId && this.imageStore) {
        try {
          // 从 IndexedDB 获取完整记录（含 mimeType），加 8s 超时
          const record = await withTimeout(
            this.imageStore.getImageRecord(imageId),
            8000,
            `IndexedDB 读取超时: ${imageId}`
          );

          if (record && record.blob) {
            // 复制前压缩：GIF 降级首帧，大图二次压缩
            const processedBlob = await this.compressForClipboard(
              record.blob,
              record.mimeType || record.blob.type || 'image/jpeg'
            );

            // 将 Blob 转为 Base64
            return new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result);
              reader.onerror = (error) => reject(new Error('FileReader failed: ' + error));
              reader.readAsDataURL(processedBlob);
            });
          } else {
            console.warn(`图片记录不存在: ${imageId}`);
            // 继续尝试用 fetch 方式（兜底）
          }
        } catch (error) {
          console.error(`从 IndexedDB 读取图片失败 (${imageId}):`, error);
          // 继续尝试用 fetch 方式（兜底）
        }
      }

      // 后备方案：尝试通过 URL 获取图片（加 AbortController 超时）
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(src, {
          mode: 'cors',
          cache: 'default',
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const blob = await response.blob();

        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = (error) => reject(new Error('FileReader failed: ' + error));
          reader.readAsDataURL(blob);
        });
      } catch (error) {
        // CORS、网络或超时错误时，抛出错误让外层处理
        throw new Error(`图片加载失败 (${src}): ${error.message}`);
      }
    },

    extractBackgroundColor(styleString) {
      if (!styleString) return null;

      const bgColorMatch = styleString.match(/background-color:\s*([^;]+)/);
      if (bgColorMatch) {
        return bgColorMatch[1].trim();
      }

      const bgMatch = styleString.match(/background:\s*([#rgb][^;]+)/);
      if (bgMatch) {
        const bgValue = bgMatch[1].trim();
        if (bgValue.startsWith('#') || bgValue.startsWith('rgb')) {
          return bgValue;
        }
      }

      return null;
    },

    isStyleStarred(styleKey) {
      return this.starredStyles.includes(styleKey);
    },

    isRecommended(styleKey) {
      // 推荐的样式
      const recommended = ['nikkei', 'wechat-anthropic', 'wechat-ft', 'wechat-nyt', 'latepost-depth', 'wechat-tech'];
      return recommended.includes(styleKey);
    },

    toggleStarStyle(styleKey) {
      const index = this.starredStyles.indexOf(styleKey);
      if (index > -1) {
        this.starredStyles.splice(index, 1);
        this.showToast('已取消收藏', 'success');
      } else {
        this.starredStyles.push(styleKey);
        this.showToast('已收藏样式', 'success');
      }
      this.saveStarredStyles();
    },

    saveStarredStyles() {
      try {
        localStorage.setItem('starredStyles', JSON.stringify(this.starredStyles));
      } catch (error) {
        console.error('保存星标样式失败:', error);
      }
    },

    getStyleName(styleKey) {
      const style = STYLES[styleKey];
      return style ? style.name : styleKey;
    },

    showToast(message, type = 'success') {
      this.toast.show = true;
      this.toast.message = message;
      this.toast.type = type;

      setTimeout(() => {
        this.toast.show = false;
      }, 3000);
    },

    patchMarkdownScanner(md) {
      if (!md || !md.inline || !md.inline.State || this.scanDelimsPatched) {
        return;
      }

      const utils = md.utils;
      const StateInline = md.inline.State;
      const allowLeadingPunctuation = this.createSafeLeadingPunctuationChecker();

      const originalScanDelims = StateInline.prototype.scanDelims;

      StateInline.prototype.scanDelims = function (start, canSplitWord) {
        const max = this.posMax;
        const marker = this.src.charCodeAt(start);

        if (!EMPHASIS_MARKERS.has(marker)) {
          return originalScanDelims.call(this, start, canSplitWord);
        }

        const lastChar = start > 0 ? this.src.charCodeAt(start - 1) : 0x20;

        let pos = start;
        while (pos < max && this.src.charCodeAt(pos) === marker) {
          pos++;
        }

        const count = pos - start;
        const nextChar = pos < max ? this.src.charCodeAt(pos) : 0x20;

        const isLastWhiteSpace = utils.isWhiteSpace(lastChar);
        const isNextWhiteSpace = utils.isWhiteSpace(nextChar);

        let isLastPunctChar =
          utils.isMdAsciiPunct(lastChar) || utils.isPunctChar(String.fromCharCode(lastChar));

        let isNextPunctChar =
          utils.isMdAsciiPunct(nextChar) || utils.isPunctChar(String.fromCharCode(nextChar));

        if (isNextPunctChar && allowLeadingPunctuation(nextChar, marker)) {
          isNextPunctChar = false;
        }

        if (marker === 0x5F /* _ */) {
          if (!isLastWhiteSpace && !isLastPunctChar && isCjkLetter(lastChar)) {
            isLastPunctChar = true;
          }
          if (!isNextWhiteSpace && !isNextPunctChar && isCjkLetter(nextChar)) {
            isNextPunctChar = true;
          }
        }

        // 修复 * 标记：CJK 标点（如中文逗号、句号）不应阻止加粗闭合
        // 例如 **提示词妙招，** 中的 "，" 是 CJK 标点，不应视为 ASCII 标点
        if (marker === 0x2A /* * */) {
          if (isLastPunctChar && isCjkPunctuation(lastChar) && !utils.isMdAsciiPunct(lastChar)) {
            isLastPunctChar = false;
          }
          if (isNextPunctChar && isCjkPunctuation(nextChar) && !utils.isMdAsciiPunct(nextChar)) {
            isNextPunctChar = false;
          }
        }

        const left_flanking =
          !isNextWhiteSpace && (!isNextPunctChar || isLastWhiteSpace || isLastPunctChar);
        const right_flanking =
          !isLastWhiteSpace && (!isLastPunctChar || isNextWhiteSpace || isNextPunctChar);

        const can_open = left_flanking && (canSplitWord || !right_flanking || isLastPunctChar);
        const can_close = right_flanking && (canSplitWord || !left_flanking || isNextPunctChar);

        return { can_open, can_close, length: count };
      };

      this.scanDelimsPatched = true;
    },

    createSafeLeadingPunctuationChecker() {
      const fallbackChars = '「『《〈（【〔〖［｛﹁﹃﹙﹛﹝“‘（';
      const fallbackSet = new Set(
        fallbackChars.split('').map(char => char.codePointAt(0))
      );

      let unicodeRegex = null;
      try {
        unicodeRegex = new RegExp('[\\p{Ps}\\p{Pi}]', 'u');
      } catch (_error) {
        unicodeRegex = null;
      }

      return (charCode, marker) => {
        if (!EMPHASIS_MARKERS.has(marker)) {
          return false;
        }

        if (unicodeRegex) {
          const char = String.fromCharCode(charCode);
          if (unicodeRegex.test(char)) {
            return true;
          }
        }

        return fallbackSet.has(charCode);
      };
    },

    // 初始化 Turndown 服务
    initTurndownService() {
      if (typeof TurndownService === 'undefined') {
        console.warn('Turndown 库未加载，智能粘贴功能将不可用');
        return;
      }

      this.turndownService = new TurndownService({
        headingStyle: 'atx',        // 使用 # 样式的标题
        bulletListMarker: '-',       // 无序列表使用 -
        codeBlockStyle: 'fenced',    // 代码块使用 ```
        fence: '```',                // 代码块围栏
        emDelimiter: '*',            // 斜体使用 *
        strongDelimiter: '**',       // 加粗使用 **
        linkStyle: 'inlined'         // 链接使用内联样式
      });

      // 配置表格支持
      this.turndownService.keep(['table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td']);

      // 自定义规则：保留表格结构
      this.turndownService.addRule('table', {
        filter: 'table',
        replacement: (_content, node) => {
          // 简单的表格转换为 Markdown 表格
          const rows = Array.from(node.querySelectorAll('tr'));
          if (rows.length === 0) return '';

          let markdown = '\n\n';
          let headerProcessed = false;

          rows.forEach((row, index) => {
            const cells = Array.from(row.querySelectorAll('td, th'));
            const cellContents = cells.map(cell => {
              // 清理单元格内容
              const text = cell.textContent.replace(/\n/g, ' ').trim();
              return text;
            });

            if (cellContents.length > 0) {
              markdown += '| ' + cellContents.join(' | ') + ' |\n';

              // 第一行后添加分隔符
              if (index === 0 || (!headerProcessed && row.querySelector('th'))) {
                markdown += '| ' + cells.map(() => '---').join(' | ') + ' |\n';
                headerProcessed = true;
              }
            }
          });

          return markdown + '\n';
        }
      });

      // 自定义规则：优化图片处理
      this.turndownService.addRule('image', {
        filter: 'img',
        replacement: (_content, node) => {
          const alt = node.alt || '图片';
          const src = node.src || '';
          const title = node.title || '';

          // 处理 base64 图片（截取前30个字符作为标识）
          if (src.startsWith('data:image')) {
            const type = src.match(/data:image\/(\w+);/)?.[1] || 'image';
            return `![${alt}](data:image/${type};base64,...)${title ? ` "${title}"` : ''}\n`;
          }

          return `![${alt}](${src})${title ? ` "${title}"` : ''}\n`;
        }
      });
    },

    // 处理粘贴事件
    async handleSmartPaste(event) {
      console.log('===== handleSmartPaste 被调用 =====');

      const clipboardData = event.clipboardData || event.originalEvent?.clipboardData;

      if (!clipboardData) {
        console.log('不支持 clipboardData');
        return; // 不支持的浏览器，使用默认行为
      }

      // 调试模式（需要时可以打开）
      const DEBUG = true;
      if (DEBUG) {
        console.log('剪贴板数据类型:', Array.from(clipboardData.types || []));
      }

      // 检查是否有文件（某些应用复制图片会作为文件）
      if (clipboardData.files && clipboardData.files.length > 0) {
        if (DEBUG) console.log('检测到文件:', clipboardData.files[0]);
        const file = clipboardData.files[0];
        if (file && file.type && file.type.startsWith('image/')) {
          event.preventDefault();
          await this.handleImageUpload(file, event.target);
          return;
        }
      }

      // 检查 items（浏览器复制的图片通常在这里）
      const items = clipboardData.items;
      if (items) {
        for (let item of items) {
          if (DEBUG) console.log('Item 类型:', item.type, 'Kind:', item.kind);

          // 检查是否是图片
          if (item.kind === 'file' && item.type && item.type.indexOf('image') !== -1) {
            event.preventDefault();
            const file = item.getAsFile();
            if (file) {
              await this.handleImageUpload(file, event.target);
              return; // 处理完图片就返回
            }
          }
        }
      }

      // 获取剪贴板中的各种格式数据
      const htmlData = clipboardData.getData('text/html');
      const textData = clipboardData.getData('text/plain');

      // 检查是否是类似 [Image #2] 这样的占位符文本
      if (textData && /^\[Image\s*#?\d*\]$/i.test(textData.trim())) {
        if (DEBUG) console.warn('检测到图片占位符文本，但无法获取实际图片数据');
        this.showToast('⚠️ 请尝试：截图工具 / 浏览器复制 / 拖拽文件', 'error');
        event.preventDefault();
        return; // 不插入占位符文本
      }

      if (DEBUG) {
        console.log('纯文本数据:', textData?.substring(0, 200));
        console.log('HTML 数据:', htmlData?.substring(0, 200));
        console.log('是否检测为 Markdown:', textData && this.isMarkdown(textData));
        console.log('是否有 turndownService:', !!this.turndownService);
      }

      // 检查是否来自 IDE/代码编辑器的 HTML（需要特殊处理）
      const isFromIDE = this.isIDEFormattedHTML(htmlData, textData);

      if (DEBUG) {
        console.log('是否来自 IDE:', isFromIDE);
      }

      if (isFromIDE && textData && this.isMarkdown(textData)) {
        // 来自 IDE 的 Markdown 代码，直接使用纯文本（避免转义）
        if (DEBUG) console.log('检测到 IDE 复制的 Markdown 代码，使用纯文本');
        return; // 使用默认粘贴行为
      }

      // 处理 HTML 数据（富文本编辑器或其他来源）
      if (htmlData && htmlData.trim() !== '' && this.turndownService) {
        // 检查是否是从代码编辑器复制的（精确匹配真正的代码块标签，避免误判）
        // 只有当 HTML 主要由 <pre> 或 <code> 组成时才跳过转换
        const hasPreTag = /<pre[\s>]/.test(htmlData);
        const hasCodeTag = /<code[\s>]/.test(htmlData);
        const isMainlyCode = (hasPreTag || hasCodeTag) && !htmlData.includes('<p') && !htmlData.includes('<div');

        if (isMainlyCode) {
          // 真正的代码编辑器内容，使用纯文本
          if (DEBUG) console.log('检测到代码编辑器格式，使用纯文本');
          return; // 使用默认粘贴行为
        }

        // 检查 HTML 中是否包含本地文件路径的图片（如 file:/// 协议）
        if (htmlData.includes('file:///') || htmlData.includes('src="file:')) {
          if (DEBUG) console.warn('检测到本地文件路径的图片，无法直接上传');
          this.showToast('⚠️ 本地图片请直接拖拽文件到编辑器', 'error');
          event.preventDefault();
          return;
        }

        event.preventDefault(); // 阻止默认粘贴

        try {
          // 将 HTML 转换为 Markdown
          let markdown = this.turndownService.turndown(htmlData);

          // 清理多余的空行
          markdown = markdown.replace(/\n{3,}/g, '\n\n');

          // 获取当前光标位置
          const textarea = event.target;
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          const value = textarea.value;

          // 插入转换后的 Markdown
          const newValue = value.substring(0, start) + markdown + value.substring(end);

          // 更新文本框内容
          this.markdownInput = newValue;

          // 恢复光标位置
          this.$nextTick(() => {
            textarea.selectionStart = textarea.selectionEnd = start + markdown.length;
            textarea.focus();
          });

          // 显示提示
          this.showToast('✨ 已智能转换为 Markdown 格式', 'success');
        } catch (error) {
          if (DEBUG) console.error('HTML 转 Markdown 失败:', error);
          // 转换失败，使用纯文本
          this.insertTextAtCursor(event.target, textData);
        }
      }
      // 检查纯文本是否为 Markdown（后备方案，只有在没有 HTML 时才检查）
      else if (textData && this.isMarkdown(textData)) {
        // 已经是 Markdown，直接使用纯文本
        if (DEBUG) console.log('没有 HTML，但检测到 Markdown 格式，使用纯文本');
        return; // 使用默认粘贴行为
      }
      // 普通文本，使用默认粘贴行为
      else {
        if (DEBUG) console.log('普通文本，使用默认粘贴行为');
        return; // 使用默认行为
      }
    },

    // 检测文本是否为 Markdown 格式
    isMarkdown(text) {
      if (!text) return false;

      // Markdown 特征模式
      const patterns = [
        /^#{1,6}\s+/m,           // 标题
        /\*\*[^*]+\*\*/,         // 加粗
        /\*[^*\n]+\*/,           // 斜体
        /\[[^\]]+\]\([^)]+\)/,   // 链接
        /!\[[^\]]*\]\([^)]+\)/,  // 图片
        /^[\*\-\+]\s+/m,         // 无序列表
        /^\d+\.\s+/m,            // 有序列表
        /^>\s+/m,                // 引用
        /`[^`]+`/,               // 内联代码
        /```[\s\S]*?```/,        // 代码块
        /^\|.*\|$/m,             // 表格
        /<!--.*?-->/,            // HTML 注释（我们的图片注释）
        /^---+$/m                // 分隔线
      ];

      // 计算匹配的特征数量
      const matchCount = patterns.filter(pattern => pattern.test(text)).length;

      // 如果有 2 个或以上的 Markdown 特征，认为是 Markdown
      // 或者如果包含我们的图片注释，也认为是 Markdown
      return matchCount >= 2 || text.includes('<!-- img:');
    },

    // 检测 HTML 是否来自 IDE/代码编辑器
    isIDEFormattedHTML(htmlData, textData) {
      if (!htmlData || !textData) return false;

      // IDE 复制的 HTML 特征（VS Code、Cursor、Sublime Text 等）
      const ideSignatures = [
        // VS Code 特征
        /<meta\s+charset=['"]utf-8['"]/i,
        /<div\s+class=["']ace_line["']/,
        /style=["'][^"']*font-family:\s*['"]?(?:Consolas|Monaco|Menlo|Courier)/i,

        // 简单的 div/span 结构（没有富文本语义标签）
        // 检查：有 HTML 标签，但几乎没有 <p>, <h1-h6>, <strong>, <em> 等富文本标签
        function(html) {
          const hasDivSpan = /<(?:div|span)[\s>]/.test(html);
          const hasSemanticTags = /<(?:p|h[1-6]|strong|em|ul|ol|li|blockquote)[\s>]/i.test(html);
          // 如果有 div/span 但几乎没有语义标签，可能是代码编辑器
          return hasDivSpan && !hasSemanticTags;
        },

        // 检查 HTML 是否只是简单包裹纯文本（几乎没有格式化）
        function(html) {
          // 去除所有 HTML 标签，看是否与纯文本几乎一致
          const strippedHtml = html.replace(/<[^>]+>/g, '').trim();
          const similarity = strippedHtml === textData.trim();
          return similarity;
        }
      ];

      // 检查是否匹配任何 IDE 特征
      let matchCount = 0;
      for (const signature of ideSignatures) {
        if (typeof signature === 'function') {
          if (signature(htmlData)) matchCount++;
        } else if (signature.test(htmlData)) {
          matchCount++;
        }
      }

      // 如果匹配 2 个或以上特征，认为是 IDE 格式
      return matchCount >= 2;
    },

    // 在光标位置插入文本
    insertTextAtCursor(textarea, text) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const value = textarea.value;

      const newValue = value.substring(0, start) + text + value.substring(end);
      this.markdownInput = newValue;

      this.$nextTick(() => {
        textarea.selectionStart = textarea.selectionEnd = start + text.length;
        textarea.focus();
      });
    },

    // 处理图片上传 - 压缩并存储到 IndexedDB
    async handleImageUpload(file, textarea) {
      // 检查文件类型
      if (!file.type.startsWith('image/')) {
        this.showToast('请上传图片文件', 'error');
        return;
      }

      // 检查文件大小（10MB限制）
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        this.showToast('图片大小不能超过 10MB', 'error');
        return;
      }

      const imageName = file.name.replace(/\.[^/.]+$/, '') || '图片';
      const originalSize = file.size;

      try {
        // 第一步：压缩图片
        this.showToast('🔄 正在压缩图片...', 'success');

        const compressedBlob = await this.imageCompressor.compress(file);
        const compressedSize = compressedBlob.size;

        // 计算压缩率
        const compressionRatio = ((1 - compressedSize / originalSize) * 100).toFixed(0);
        console.log(`图片压缩完成: ${ImageCompressor.formatSize(originalSize)} → ${ImageCompressor.formatSize(compressedSize)} (压缩 ${compressionRatio}%)`);

        // 第二步：生成唯一 ID
        const imageId = `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // 第三步：存储到 IndexedDB
        await this.imageStore.saveImage(imageId, compressedBlob, {
          name: imageName,
          originalName: file.name,
          originalSize: originalSize,
          compressedSize: compressedSize,
          compressionRatio: compressionRatio,
          mimeType: compressedBlob.type || file.type
        });

        // 第四步：插入 img:// 协议的短链接到编辑器
        const markdownImage = `![${imageName}](img://${imageId})`;

        if (textarea) {
          const currentPos = textarea.selectionStart;
          const before = this.markdownInput.substring(0, currentPos);
          const after = this.markdownInput.substring(currentPos);

          this.markdownInput = before + markdownImage + after;

          this.$nextTick(() => {
            const newPos = currentPos + markdownImage.length;
            textarea.selectionStart = textarea.selectionEnd = newPos;
            textarea.focus();
          });
        } else {
          this.markdownInput += '\n' + markdownImage;
        }

        // 第五步：显示成功提示
        if (compressionRatio > 10) {
          this.showToast(`✅ 已保存 (${ImageCompressor.formatSize(originalSize)} → ${ImageCompressor.formatSize(compressedSize)})`, 'success');
        } else {
          this.showToast(`✅ 已保存 (${ImageCompressor.formatSize(compressedSize)})`, 'success');
        }
      } catch (error) {
        console.error('图片处理失败:', error);
        this.showToast('❌ 图片处理失败: ' + error.message, 'error');
      }
    },

    // 处理文件拖拽
    handleDrop(event) {
      event.preventDefault();
      event.stopPropagation();

      this.isDraggingOver = false;

      const files = event.dataTransfer.files;
      if (files.length > 0) {
        const file = files[0];
        if (file.type.startsWith('image/')) {
          this.handleImageUpload(file, event.target);
        } else {
          this.showToast('只支持拖拽图片文件', 'error');
        }
      }
    },

    // 阻止默认拖拽行为
    handleDragOver(event) {
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = 'copy';
      this.isDraggingOver = true;
    },

    // 处理拖拽进入
    handleDragEnter(event) {
      event.preventDefault();
      this.isDraggingOver = true;
    },

    // 处理拖拽离开
    handleDragLeave(event) {
      event.preventDefault();
      // 只有当真正离开编辑器时才移除状态
      if (event.target.classList.contains('markdown-input')) {
        this.isDraggingOver = false;
      }
    },

    // ============ 小红书功能相关方法 ============

    // 生成小红书图片
    async generateXiaohongshuImages() {
      if (!this.renderedContent) {
        this.showToast('没有内容可生成', 'error');
        return;
      }

      if (typeof html2canvas === 'undefined') {
        this.showToast('html2canvas 库未加载', 'error');
        return;
      }

      this.xiaohongshuGenerating = true;
      this.xiaohongshuImages = [];

      try {
        // 创建临时渲染容器
        const tempContainer = this.createXiaohongshuContainer();
        document.body.appendChild(tempContainer);

        // 计算文章信息
        const articleInfo = this.calculateArticleInfo();

        // 分页
        const pages = await this.splitContentIntoPages(tempContainer, articleInfo);

        if (pages.length === 0) {
          throw new Error('内容为空，无法生成图片');
        }

        // 生成每一页的图片
        for (let i = 0; i < pages.length; i++) {
          const pageElement = pages[i];

          // 添加页码
          this.addPageNumber(pageElement, i + 1, pages.length);

          // 如果是首页，添加信息面板
          if (i === 0) {
            this.addInfoPanel(pageElement, articleInfo);
          }

          // 将页面元素添加到容器中，确保 html2canvas 可以找到它
          tempContainer.appendChild(pageElement);

          // 等待一小段时间确保元素渲染完成
          await new Promise(resolve => setTimeout(resolve, 100));

          // 生成图片
          const canvas = await html2canvas(pageElement, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: this.getBackgroundColor(),
            width: 750,
            height: 1000,
            windowWidth: 750,
            windowHeight: 1000,
            logging: false
          });

          const dataUrl = canvas.toDataURL('image/png');
          this.xiaohongshuImages.push({
            dataUrl: dataUrl,
            pageNumber: i + 1,
            totalPages: pages.length
          });

          // 移除页面元素，准备下一页
          tempContainer.removeChild(pageElement);
        }

        // 清理临时容器
        document.body.removeChild(tempContainer);

        this.showToast(`成功生成 ${pages.length} 张小红书图片`, 'success');
      } catch (error) {
        console.error('生成小红书图片失败:', error);
        this.showToast('生成失败: ' + error.message, 'error');

        // 确保清理临时容器
        const existingContainer = document.querySelector('div[style*="-9999px"]');
        if (existingContainer) {
          document.body.removeChild(existingContainer);
        }
      } finally {
        this.xiaohongshuGenerating = false;
      }
    },

    // 创建小红书渲染容器
    createXiaohongshuContainer() {
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.width = '750px';
      container.style.pointerEvents = 'none';
      container.style.zIndex = '-1';
      // 不设置 visibility: hidden，因为 html2canvas 需要可见元素
      return container;
    },

    // 计算文章信息
    calculateArticleInfo() {
      const parser = new DOMParser();
      const doc = parser.parseFromString(this.renderedContent, 'text/html');

      // 计算字数（去除HTML标签）
      const textContent = doc.body.textContent || '';
      const charCount = textContent.replace(/\s/g, '').length;

      // 计算阅读时长（假设每分钟阅读400字）
      const readingTime = Math.ceil(charCount / 400);

      // 计算图片数量
      const imageCount = doc.querySelectorAll('img').length;

      return {
        charCount,
        readingTime,
        imageCount
      };
    },

    // 分页算法 - 完全简化版本
    async splitContentIntoPages(container, articleInfo) {
      // 解析 Markdown 为纯文本结构（不使用复杂的渲染样式）
      const simplifiedContent = this.createSimplifiedContent();

      const pages = [];
      const maxPageHeight = 850; // 留出空间给页码和首页信息面板

      // 创建测量容器
      const measureContainer = this.createPageElement();
      container.appendChild(measureContainer);

      let currentPageContent = [];
      let currentHeight = 0;
      const firstPageOffset = 120; // 首页信息面板占用空间

      for (let i = 0; i < simplifiedContent.length; i++) {
        const block = simplifiedContent[i];

        // 创建元素
        const element = this.createSimplifiedElement(block);

        // 添加到测量容器
        measureContainer.appendChild(element);
        const elementHeight = element.offsetHeight || 50;

        // 计算是否超出页面高度
        const heightLimit = pages.length === 0 ? maxPageHeight - firstPageOffset : maxPageHeight;
        const wouldExceed = currentHeight + elementHeight > heightLimit;

        if (wouldExceed && currentPageContent.length > 0) {
          // 创建新页面
          const page = this.createPageElement();
          currentPageContent.forEach(el => page.appendChild(el));
          pages.push(page);

          currentPageContent = [];
          currentHeight = 0;
        }

        // 从测量容器移除
        measureContainer.removeChild(element);
        currentPageContent.push(element);
        currentHeight += elementHeight;
      }

      // 添加最后一页
      if (currentPageContent.length > 0) {
        const page = this.createPageElement();
        currentPageContent.forEach(el => page.appendChild(el));
        pages.push(page);
      }

      // 清理测量容器
      container.removeChild(measureContainer);

      return pages;
    },

    // 创建简化的内容结构（纯文本，无复杂样式）
    createSimplifiedContent() {
      const lines = this.markdownInput.split('\n');
      const content = [];

      lines.forEach(line => {
        line = line.trim();
        if (!line) return;

        // 标题
        if (line.startsWith('# ')) {
          content.push({ type: 'h1', text: line.substring(2) });
        } else if (line.startsWith('## ')) {
          content.push({ type: 'h2', text: line.substring(3) });
        } else if (line.startsWith('### ')) {
          content.push({ type: 'h3', text: line.substring(4) });
        }
        // 列表
        else if (line.startsWith('- ') || line.startsWith('* ')) {
          content.push({ type: 'li', text: line.substring(2) });
        }
        // 引用
        else if (line.startsWith('> ')) {
          content.push({ type: 'quote', text: line.substring(2) });
        }
        // 代码块标记（跳过）
        else if (line.startsWith('```')) {
          // 跳过代码块
        }
        // 图片（跳过，小红书图片由外链显示）
        else if (line.startsWith('![')) {
          // 跳过图片
        }
        // 分隔线
        else if (line === '---') {
          content.push({ type: 'hr' });
        }
        // 普通段落
        else {
          // 移除 Markdown 格式标记
          let text = line.replace(/\*\*(.+?)\*\*/g, '$1'); // 粗体
          text = text.replace(/\*(.+?)\*/g, '$1'); // 斜体
          text = text.replace(/`(.+?)`/g, '$1'); // 行内代码
          content.push({ type: 'p', text: text });
        }
      });

      return content;
    },

    // 创建简化的元素（只使用基本的内联样式）
    createSimplifiedElement(block) {
      const el = document.createElement('div');

      switch (block.type) {
        case 'h1':
          el.textContent = block.text;
          el.style.fontSize = '28px';
          el.style.fontWeight = 'bold';
          el.style.margin = '20px 0 10px 0';
          el.style.color = '#000';
          break;
        case 'h2':
          el.textContent = block.text;
          el.style.fontSize = '24px';
          el.style.fontWeight = 'bold';
          el.style.margin = '16px 0 8px 0';
          el.style.color = '#000';
          break;
        case 'h3':
          el.textContent = block.text;
          el.style.fontSize = '20px';
          el.style.fontWeight = 'bold';
          el.style.margin = '12px 0 6px 0';
          el.style.color = '#333';
          break;
        case 'p':
          el.textContent = block.text;
          el.style.fontSize = '16px';
          el.style.lineHeight = '1.8';
          el.style.margin = '8px 0';
          el.style.color = '#333';
          break;
        case 'li':
          el.textContent = '• ' + block.text;
          el.style.fontSize = '16px';
          el.style.lineHeight = '1.8';
          el.style.margin = '4px 0';
          el.style.paddingLeft = '10px';
          el.style.color = '#333';
          break;
        case 'quote':
          el.textContent = block.text;
          el.style.fontSize = '15px';
          el.style.lineHeight = '1.8';
          el.style.margin = '8px 0';
          el.style.padding = '10px 15px';
          el.style.borderLeft = '3px solid #0066FF';
          el.style.background = '#f5f5f5';
          el.style.color = '#666';
          break;
        case 'hr':
          el.style.height = '1px';
          el.style.background = '#ddd';
          el.style.margin = '20px 0';
          el.style.border = 'none';
          break;
      }

      return el;
    },

    // 创建页面元素
    createPageElement() {
      const page = document.createElement('div');
      page.style.width = '750px';
      page.style.height = '1000px';
      page.style.backgroundColor = this.getBackgroundColor();
      page.style.padding = '80px 40px 40px 40px';
      page.style.boxSizing = 'border-box';
      page.style.position = 'relative';
      page.style.overflow = 'hidden';
      page.style.fontFamily = 'Arial';
      page.style.fontSize = '16px';
      page.style.lineHeight = '1.8';
      page.style.color = '#333';
      return page;
    },

    // 添加页码
    addPageNumber(pageElement, currentPage, totalPages) {
      const pageNumber = document.createElement('div');
      pageNumber.textContent = `${currentPage}/${totalPages}`;
      pageNumber.style.position = 'absolute';
      pageNumber.style.bottom = '30px';
      pageNumber.style.right = '40px';
      pageNumber.style.fontSize = '14px';
      pageNumber.style.color = '#999';
      pageNumber.style.fontWeight = '500';
      pageElement.appendChild(pageNumber);
    },

    // 添加首页信息面板
    addInfoPanel(pageElement, articleInfo) {
      const panel = document.createElement('div');
      panel.style.position = 'absolute';
      panel.style.top = '20px';
      panel.style.left = '40px';
      panel.style.right = '40px';
      panel.style.padding = '20px';
      panel.style.backgroundColor = '#E6F0FF';
      panel.style.borderRadius = '8px';
      panel.style.border = '1px solid #99CCFF';

      const infoItems = [
        { label: '字数', value: articleInfo.charCount },
        { label: '阅读', value: `${articleInfo.readingTime}分钟` },
        { label: '图片', value: `${articleInfo.imageCount}张` }
      ];

      // 创建容器（使用 table 布局）
      const table = document.createElement('table');
      table.style.width = '100%';
      table.style.borderCollapse = 'collapse';
      const tr = document.createElement('tr');

      infoItems.forEach(item => {
        const td = document.createElement('td');
        td.style.textAlign = 'center';
        td.style.padding = '5px';

        const valueDiv = document.createElement('div');
        valueDiv.textContent = item.value;
        valueDiv.style.fontSize = '24px';
        valueDiv.style.fontWeight = 'bold';
        valueDiv.style.color = '#0066FF';
        valueDiv.style.marginBottom = '4px';

        const labelDiv = document.createElement('div');
        labelDiv.textContent = item.label;
        labelDiv.style.fontSize = '12px';
        labelDiv.style.color = '#666';

        td.appendChild(valueDiv);
        td.appendChild(labelDiv);
        tr.appendChild(td);
      });

      table.appendChild(tr);
      panel.appendChild(table);

      // 插入到页面顶部
      pageElement.insertBefore(panel, pageElement.firstChild);
    },

    // 获取背景色
    getBackgroundColor() {
      const styleConfig = STYLES[this.currentStyle];
      if (styleConfig && styleConfig.styles && styleConfig.styles.container) {
        const bgColor = this.extractBackgroundColor(styleConfig.styles.container);
        return bgColor || '#FFFFFF';
      }
      return '#FFFFFF';
    },

    // 下载单张小红书图片
    downloadXiaohongshuImage(image, index) {
      const link = document.createElement('a');
      link.download = `小红书-第${index + 1}张-共${this.xiaohongshuImages.length}张.png`;
      link.href = image.dataUrl;
      link.click();
      this.showToast(`下载第 ${index + 1} 张图片`, 'success');
    },

    // 批量下载小红书图片
    async downloadAllXiaohongshuImages() {
      if (this.xiaohongshuImages.length === 0) {
        this.showToast('没有图片可下载', 'error');
        return;
      }

      this.showToast(`开始下载 ${this.xiaohongshuImages.length} 张图片...`, 'success');

      for (let i = 0; i < this.xiaohongshuImages.length; i++) {
        const image = this.xiaohongshuImages[i];

        // 添加延迟，避免浏览器阻止批量下载
        await new Promise(resolve => setTimeout(resolve, 300));

        const link = document.createElement('a');
        link.download = `小红书-第${i + 1}张-共${this.xiaohongshuImages.length}张.png`;
        link.href = image.dataUrl;
        link.click();
      }

      this.showToast('批量下载完成', 'success');
    },

    // ==================== 文章历史记录功能 ====================

    // 从 Markdown 内容提取标题
    extractTitle(markdownContent) {
      if (!markdownContent || !markdownContent.trim()) {
        return '无标题';
      }

      // 尝试匹配第一个 # 标题
      const titleMatch = markdownContent.match(/^#\s+(.+)$/m);
      if (titleMatch && titleMatch[1]) {
        // 清理标题中的 markdown 格式
        let title = titleMatch[1].trim();
        title = title.replace(/\*\*/g, '').replace(/\*/g, '').replace(/`/g, '');
        return title.substring(0, 50); // 最多 50 字符
      }

      // 如果没有标题，取前 20 个字符
      const cleanContent = markdownContent
        .replace(/^!\[.*?\]\(.*?\)$/gm, '') // 移除图片
        .replace(/^#+\s*/gm, '') // 移除标题标记
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // 移除链接格式
        .replace(/[*_~`]/g, '') // 移除格式标记
        .trim();

      if (cleanContent) {
        return cleanContent.substring(0, 20) + (cleanContent.length > 20 ? '...' : '');
      }

      return '无标题';
    },

    // 保存当前文章到历史记录
    saveToHistory() {
      const content = this.markdownInput;
      if (!content || !content.trim()) {
        this.showToast('内容为空，无法保存', 'error');
        return;
      }

      const title = this.extractTitle(content);
      const now = Date.now();

      // 如果有当前文章ID，直接更新该文章
      if (this.currentArticleId) {
        const existingIndex = this.articleHistory.findIndex(
          article => article.id === this.currentArticleId
        );

        if (existingIndex !== -1) {
          // 更新已存在的文章
          this.articleHistory[existingIndex].title = title;
          this.articleHistory[existingIndex].content = content;
          this.articleHistory[existingIndex].style = this.currentStyle;
          this.articleHistory[existingIndex].updatedAt = now;

          // 移到最前面
          const article = this.articleHistory.splice(existingIndex, 1)[0];
          this.articleHistory.unshift(article);

          this.saveArticleHistory();
          this.showToast('已更新历史记录', 'success');
          return;
        }
      }

      // 没有当前文章ID，创建新文章
      const newArticleId = `article-${now}-${Math.random().toString(36).substring(2, 8)}`;
      const newArticle = {
        id: newArticleId,
        title: title,
        content: content,
        style: this.currentStyle,
        createdAt: now,
        updatedAt: now
      };

      // 添加到列表开头
      this.articleHistory.unshift(newArticle);

      // 设置为当前文章
      this.currentArticleId = newArticleId;

      // 限制最多 20 篇
      if (this.articleHistory.length > 20) {
        this.articleHistory = this.articleHistory.slice(0, 20);
      }

      // 保存到 localStorage
      this.saveArticleHistory();
      this.showToast('已保存到历史记录', 'success');
    },

    // 从历史记录加载文章
    loadFromHistory(articleId) {
      const article = this.articleHistory.find(a => a.id === articleId);
      if (!article) {
        this.showToast('文章不存在', 'error');
        return;
      }

      // 恢复内容和样式
      this.markdownInput = article.content;
      if (article.style && STYLES[article.style]) {
        this.currentStyle = article.style;
      }

      // 设置当前文章ID，后续编辑会更新这篇文章
      this.currentArticleId = articleId;

      // 关闭侧边栏
      this.showHistoryPanel = false;

      this.showToast('已加载文章', 'success');
    },

    // 从历史记录删除文章
    deleteFromHistory(articleId) {
      const index = this.articleHistory.findIndex(a => a.id === articleId);
      if (index === -1) {
        this.showToast('文章不存在', 'error');
        return;
      }

      this.articleHistory.splice(index, 1);
      this.saveArticleHistory();
      this.showToast('已删除', 'success');
    },

    // 从 localStorage 加载历史记录
    loadArticleHistory() {
      try {
        const saved = localStorage.getItem('articleHistory');
        if (saved) {
          const data = JSON.parse(saved);
          if (data && Array.isArray(data.articles)) {
            this.articleHistory = data.articles;
          }
        }
      } catch (error) {
        console.error('加载历史记录失败:', error);
        this.articleHistory = [];
      }
    },

    // 保存历史记录到 localStorage
    saveArticleHistory() {
      try {
        const data = {
          articles: this.articleHistory
        };
        localStorage.setItem('articleHistory', JSON.stringify(data));
      } catch (error) {
        console.error('保存历史记录失败:', error);
        this.showToast('保存历史记录失败', 'error');
      }
    },

    // 切换历史记录侧边栏
    toggleHistoryPanel() {
      this.showHistoryPanel = !this.showHistoryPanel;
    },

    // 格式化历史记录时间显示
    formatHistoryDate(timestamp) {
      if (!timestamp) return '';

      const date = new Date(timestamp);
      const now = new Date();
      const diff = now - date;

      // 不到 1 分钟
      if (diff < 60 * 1000) {
        return '刚刚';
      }

      // 不到 1 小时
      if (diff < 60 * 60 * 1000) {
        const minutes = Math.floor(diff / (60 * 1000));
        return `${minutes} 分钟前`;
      }

      // 不到 24 小时
      if (diff < 24 * 60 * 60 * 1000) {
        const hours = Math.floor(diff / (60 * 60 * 1000));
        return `${hours} 小时前`;
      }

      // 今年内
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hour = String(date.getHours()).padStart(2, '0');
      const minute = String(date.getMinutes()).padStart(2, '0');

      if (year === now.getFullYear()) {
        return `${month}-${day} ${hour}:${minute}`;
      }

      // 往年
      return `${year}-${month}-${day}`;
    },

    // ==================== AI 功能相关方法 ====================

    // 保存 AI 配置
    saveAIConfig() {
      try {
        // 如果有自定义模型名，先同步到 aiConfig.model
        if (this.customModel && this.customModel.trim()) {
          this.aiConfig.model = this.customModel.trim();
        }
        // API Key 使用 Base64 加密（简单加密，非安全方案）
        const configToSave = { ...this.aiConfig };
        if (configToSave.apiKey) {
          configToSave.apiKey = btoa(configToSave.apiKey);
        }
        localStorage.setItem('aiConfig', JSON.stringify(configToSave));
        this.showToast('AI 配置已保存', 'success');
      } catch (error) {
        console.error('保存 AI 配置失败:', error);
        this.showToast('保存配置失败', 'error');
      }
    },

    // 加载配置时解密 API Key
    loadAIConfig() {
      try {
        const saved = localStorage.getItem('aiConfig');
        if (saved) {
          const config = JSON.parse(saved);
          if (config.apiKey) {
            config.apiKey = atob(config.apiKey);
          }
          // 先清空 availableModels，避免 model 不在列表中时条件不触发
          this.availableModels = this.availableModels || [];
          this.aiConfig = { ...this.aiConfig, ...config };
          // 如果保存的模型名不在列表中，说明是自定义的，需要恢复 customModel
          const savedModel = this.aiConfig.model;
          if (savedModel && !this.availableModels.some(m => (m.id || m.name) === savedModel)) {
            this.customModel = savedModel;
          }
        }
      } catch (error) {
        console.error('加载 AI 配置失败:', error);
      }
    },

    // ===== 模型列表相关方法 =====

    // Provider 切换时重置模型相关状态
    onProviderChange() {
      this.availableModels = [];
      this.customModel = '';
      // 根据provider设置默认模型
      const defaults = {
        openai: 'gpt-4o',
        gemini: 'gemini-1.5-pro',
        claude: 'claude-sonnet-4-20250514',
        local: ''
      };
      this.aiConfig.model = defaults[this.aiConfig.provider] || '';
      // 本地模式时自动设置默认baseUrl
      if (this.aiConfig.provider === 'local' && !this.aiConfig.baseUrl) {
        this.aiConfig.baseUrl = this.localFormat === 'ollama' ? 'http://localhost:11434' : 'http://localhost:1234/v1';
      }
    },

    // 本地模型格式切换
    onLocalFormatChange() {
      if (!this.aiConfig.baseUrl || this.aiConfig.baseUrl.includes('11434') || this.aiConfig.baseUrl.includes('1234')) {
        this.aiConfig.baseUrl = this.localFormat === 'ollama' ? 'http://localhost:11434' : 'http://localhost:1234/v1';
      }
      this.availableModels = [];
      this.customModel = '';
    },

    // 从API获取模型列表
    async fetchModelList() {
      if (this.loadingModels) return;

      this.loadingModels = true;
      this.availableModels = [];

      try {
        const result = await this.aiClient.fetchModels({
          provider: this.aiConfig.provider,
          apiKey: this.aiConfig.apiKey,
          baseUrl: this.aiConfig.baseUrl,
          localFormat: this.localFormat
        });

        if (result.success && result.models && result.models.length > 0) {
          this.availableModels = result.models;
          this.showToast(`获取到 ${result.models.length} 个模型`, 'success');
        } else if (result.success && (!result.models || result.models.length === 0)) {
          this.showToast('未找到可用模型，请手动输入模型名称', 'error');
        } else {
          this.showToast(`获取失败: ${result.error}`, 'error');
        }
      } catch (error) {
        console.error('获取模型列表失败:', error);
        this.showToast(`获取失败: ${error.message}`, 'error');
      } finally {
        this.loadingModels = false;
      }
    },

    // 手动输入模型名称 - 失焦/回车时同步到 aiConfig.model
    onCustomModelBlur() {
      if (this.customModel && this.customModel.trim()) {
        this.aiConfig.model = this.customModel.trim();
      }
    },

    // 测试 AI 连接
    async testAIConnection() {
      // 本地模型不需要 apiKey
      if (this.aiConfig.provider !== 'local' && !this.aiConfig.apiKey) {
        this.showToast('请先输入 API Key', 'error');
        return;
      }
      // 本地模型没有强制 baseUrl（使用默认地址）

      this.showToast('正在测试连接...', 'processing');

      const result = await this.aiClient.testConnection({
        provider: this.aiConfig.provider,
        apiKey: this.aiConfig.apiKey,
        model: this.aiConfig.model,
        baseUrl: this.aiConfig.baseUrl,
        localFormat: this.localFormat
      });

      if (result.success) {
        this.showToast('✅ 连接成功', 'success');
      } else {
        this.showToast(`❌ 连接失败: ${result.error}`, 'error');
      }
    },

    // 生成 AI 文案
    async generateAIContent() {
      // 本地模型不需要 apiKey
      if (this.aiConfig.provider !== 'local' && !this.aiConfig.apiKey) {
        this.showToast('请先配置 API Key', 'error');
        this.currentTab = 'ai-settings';
        return;
      }
      // 本地模型需要 baseUrl
      if (this.aiConfig.provider === 'local' && !this.aiConfig.baseUrl) {
        this.showToast('请先配置 API 地址', 'error');
        this.currentTab = 'ai-settings';
        return;
      }

      this.aiGenerating = true;
      this.aiGeneratedContent = '';

      try {
        // 构建提示词
        const prompt = this.buildAIPrompt();
        const messages = [];

        // 处理图片：如果有选中的图片
        let imageMarkdown = '';  // 用于排版的图片 Markdown
        const imagesForLayoutOnly = this.aiGenerateParams.imagesForLayoutOnly;

        if (this.aiSelectedImages.length > 0) {
          // 构建用于排版的图片 markdown（始终需要）
          for (let i = 0; i < this.aiSelectedImages.length; i++) {
            const img = this.aiSelectedImages[i];
            imageMarkdown += `![${img.name}]\n`;
          }

          if (!imagesForLayoutOnly) {
            // 发送给 AI 作为参考图片
            const contentParts = [
              { type: 'text', text: prompt + '\n\n以下是我提供的参考图片，请根据这些图片的内容来生成文案。每张图片都应该在文章中被引用和描述。' }
            ];

            // 读取所有图片的 base64
            for (let i = 0; i < this.aiSelectedImages.length; i++) {
              const img = this.aiSelectedImages[i];
              if (img.base64) {
                contentParts.push({
                  type: 'image_url',
                  image_url: {
                    url: img.base64,
                    detail: 'auto'
                  }
                });
              } else if (img.file) {
                // 如果还没有 base64，尝试读取
                try {
                  const base64 = await this.readFileAsBase64(img.file);
                  img.base64 = base64;
                  contentParts.push({
                    type: 'image_url',
                    image_url: {
                      url: base64,
                      detail: 'auto'
                    }
                  });
                } catch (e) {
                  console.warn(`读取图片失败: ${img.name}`, e);
                }
              }
            }

            messages.push({ role: 'user', content: contentParts });
          } else {
            // 图片仅用于排版，不发给 AI
            messages.push({ role: 'user', content: prompt });
          }
        } else {
          // 纯文本模式
          messages.push({ role: 'user', content: prompt });
        }

        const result = await this.aiClient.call({
          provider: this.aiConfig.provider,
          apiKey: this.aiConfig.apiKey,
          model: this.aiConfig.model,
          messages: messages,
          maxTokens: this.aiConfig.maxTokens,
          temperature: this.aiConfig.temperature,
          baseUrl: this.aiConfig.baseUrl,
          localFormat: this.localFormat
        });

        if (result.success) {
          // 如果有图片，将图片插入到生成内容中并保存
          if (imageMarkdown && result.content) {
            // 将 AI 生成的文案和图片一起存储
            this.aiGeneratedContentWithImages = result.content + '\n\n---\n\n## 📷 参考图片\n\n' + imageMarkdown;
            this.aiGeneratedContent = result.content;
          } else {
            this.aiGeneratedContent = result.content;
            this.aiGeneratedContentWithImages = '';
          }
          this.showToast('✅ 生成成功', 'success');
        } else {
          this.showToast(`❌ 生成失败: ${result.error}`, 'error');
        }
      } catch (error) {
        console.error('AI 生成失败:', error);
        this.showToast(`❌ 生成失败: ${error.message}`, 'error');
      } finally {
        this.aiGenerating = false;
      }
    },

    // 构建 AI 提示词
    buildAIPrompt() {
      const { type, customType, style, customStyle, minWords, maxWords, customContent } = this.aiGenerateParams;

      const typeNames = {
        product: '产品介绍',
        brand: '品牌宣传',
        news: '新闻资讯',
        activity: '活动推广',
        event: '活动报道/回顾',
        tutorial: '教程/指南',
        review: '测评/体验',
        story: '情感故事',
        opinion: '观点评论',
        interview: '人物专访',
        list: '盘点/榜单',
        faq: '问答/FAQ'
      };

      const styleNames = {
        professional: '专业严谨',
        casual: '轻松活泼',
        artistic: '文艺清新',
        humorous: '幽默风趣',
        simple: '简约大方',
        warm: '温暖治愈',
        urgent: '紧迫感/促销风格',
        academic: '学术/深度分析',
        storytelling: '故事化叙事',
        conversational: '对话式/口语化'
      };

      const typeName = type === 'custom' ? (customType || '自定义类型') : (typeNames[type] || type);
      const styleName = style === 'custom' ? (customStyle || '自定义风格') : (styleNames[style] || style);

      let prompt = `请帮我写一篇${typeName}文章，风格要求${styleName}，字数在${minWords}-${maxWords}字之间。\n\n`;

      if (customContent) {
        prompt += `具体要求：${customContent}\n\n`;
      }

      // === 新增：图片信息 ===
      if (this.aiSelectedImages.length > 0) {
        prompt += `\n【图片资源】\n`;
        prompt += `你有 ${this.aiSelectedImages.length} 张图片可用，请在文章合适的位置插入这些图片。\n`;
        prompt += `插入图片的格式：![图片描述](图N)\n`;
        prompt += `例如：![产品展示图](图1)、![使用场景](图2)\n`;
        prompt += `注意：必须使用“图1”、“图2”这样的序号格式，不要使用文件名！\n\n`;
        prompt += `图片列表：\n`;
        this.aiSelectedImages.forEach((img, index) => {
          prompt += `- 图${index + 1}：${img.name}\n`;
        });
        prompt += `\n注意：\n`;
        prompt += `1. 根据文章内容在合适的位置插入图片，实现图文混排\n`;
        prompt += `2. 每张图片都要有简洁的描述文字\n`;
        prompt += `3. 图片数量不要超过提供的数量\n`;
        prompt += `4. 如果图片名称包含关键词，优先在相关内容附近插入\n\n`;
      }

      // === 新增：去AI感指令 ===
      prompt += '【写作要求】\n';
      prompt += '1. 文章要有真实感和人情味，避免AI痕迹\n';
      prompt += '2. 避免使用"首先、其次、最后、综上所述"等AI常用连接词\n';
      prompt += '3. 避免使用"作为一个人工智能"等元叙述\n';
      prompt += '4. 用具体细节、真实案例、生活化语言增加可信度\n';
      prompt += '5. 段落过渡要自然，像真人在对话\n';
      prompt += '6. 标题要吸引人，避免"XXX的方法"这类模板化标题\n\n';

      prompt += '请直接输出文章内容，使用 Markdown 格式。';

      return prompt;
    },

    // 将 AI 生成的内容复制到编辑器
    async copyAIToEditor() {
      if (!this.aiGeneratedContent) {
        this.showToast('没有生成内容', 'error');
        return;
      }

      let finalContent = this.aiGeneratedContent;

      // 如果有选中的图片，处理图片占位符
      if (this.aiSelectedImages.length > 0) {
        this.showToast('正在处理图片...', 'info');

        // 先处理转义符：\![ → !
        finalContent = finalContent.replace(/\\!/g, '!');

        // 解析并替换图片占位符
        for (let i = 0; i < this.aiSelectedImages.length; i++) {
          const img = this.aiSelectedImages[i];

          // 支持两种格式：(图N) 或 (原始文件名)
          const patterns = [
            new RegExp(`!\\[([^\\]]*)\\]\\(图${i + 1}\\)`, 'g'),  // ![描述](图1)
            new RegExp(`!\\[([^\\]]*)\\]\\(${this.escapeRegExp(img.name)}\\)`, 'g')  // ![描述](文件名)
          ];

          try {
            // 压缩并存储图片到 IndexedDB
            const compressedFile = await this.imageCompressor.compress(img.file);
            const imageId = `ai-img-${Date.now()}-${i}`;
            await this.imageStore.saveImage(imageId, compressedFile, img.name);

            // 替换所有匹配的占位符
            for (const pattern of patterns) {
              finalContent = finalContent.replace(pattern, `![$1](img://${imageId})`);
            }
          } catch (e) {
            console.error(`图片处理失败: ${img.name}`, e);
          }
        }
      }

      this.markdownInput = finalContent;
      this.currentTab = 'editor';
      // 触发渲染
      this.$nextTick(() => {
        this.renderMarkdown();
      });
      this.showToast('✅ 已复制到编辑器', 'success');
    },

    // 复制 AI 内容到剪贴板
    async copyAIToClipboard() {
      if (!this.aiGeneratedContent) {
        this.showToast('没有生成内容', 'error');
        return;
      }

      try {
        await navigator.clipboard.writeText(this.aiGeneratedContent);
        this.showToast('已复制到剪贴板', 'success');
      } catch (error) {
        console.error('复制失败:', error);
        this.showToast('复制失败', 'error');
      }
    },

    // 转义正则特殊字符
    escapeRegExp(string) {
      return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    },

    // ===== 图片选择相关方法 =====

    // 处理图片文件选择
    async handleImageSelect(event) {
      const files = event.target.files;
      if (!files || files.length === 0) return;

      const imageFiles = [...this.aiSelectedImages];
      let addedCount = 0;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith('image/')) {
          // 检查是否已存在同名文件
          const exists = imageFiles.some(f => f.name === file.name && f.file.size === file.size);
          if (!exists) {
            try {
              const preview = await this.readFileAsDataURL(file);
              imageFiles.push({
                name: file.name,
                file: file,
                preview: preview,
                base64: null
              });
              addedCount++;
            } catch (e) {
              console.warn(`预览图片失败: ${file.name}`, e);
            }
          }
        }
      }

      if (addedCount === 0) {
        this.showToast('没有新图片可添加（可能已存在）', 'error');
        return;
      }

      this.aiSelectedImages = imageFiles;
      this.showToast(`已添加 ${addedCount} 张图片，共 ${imageFiles.length} 张`, 'success');
      // 重置 input 以便再次选择同一文件
      event.target.value = '';
    },

    // 处理图片文件夹选择
    async handleImageFolderSelect(event) {
      const files = event.target.files;
      if (!files || files.length === 0) return;

      const imageFiles = [...this.aiSelectedImages];

      // 只过滤图片文件
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith('image/')) {
          try {
            const preview = await this.readFileAsDataURL(file);
            imageFiles.push({
              name: file.name,
              file: file,
              preview: preview,
              base64: null  // 延迟读取，生成时再转 base64
            });
          } catch (e) {
            console.warn(`预览图片失败: ${file.name}`, e);
          }
        }
      }

      if (imageFiles.length === 0) {
        this.showToast('所选文件夹中没有找到图片文件', 'error');
        return;
      }

      this.aiSelectedImages = imageFiles;
      this.showToast(`已选择 ${imageFiles.length} 张图片`, 'success');
    },

    // 清除已选图片
    clearSelectedImages() {
      this.aiSelectedImages = [];
    },

    // 删除单张已选图片
    removeSelectedImage(index) {
      this.aiSelectedImages.splice(index, 1);
    },

    // 读取文件为 DataURL（用于预览）
    readFileAsDataURL(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e);
        reader.readAsDataURL(file);
      });
    },

    // 读取文件为 Base64（用于发送给 AI，不带 data:image/xxx;base64, 前缀的版本）
    readFileAsBase64(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          // 返回完整的 data URL（包含 MIME 类型的 base64）
          resolve(e.target.result);
        };
        reader.onerror = (e) => reject(e);
        reader.readAsDataURL(file);
      });
    }
  }
});

editorApp.mount('#app');
