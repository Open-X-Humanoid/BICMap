/*
 * @Author: houser.hao@humanoid.com
 * @Date: 2025-04-27 16:40:30
 * @LastEditTime: 2025-06-18 11:39:18
 * @LastEditors: houser.hao@humanoid.com
 * @Description: 脚本和样式加载工具
 * @FilePath: /bic-map-plugin/src/bicMap/core/utils/loaders.js
 * Copyright (c) 2024 houser.hao@humanoid.com, All Rights Reserved.
 * 
 * 使用说明：
 * 1. 对于移动端开发，本文件提供了安全的资源加载函数
 * 2. isLocalFile() - 检测是否为本地文件路径
 * 3. safeFetch() - 安全的fetch封装，自动拒绝本地文件
 * 4. safeImageLoader() - 安全的图片加载，自动处理本地/网络资源
 * 5. proxyImageLoader() - 专用的图片代理加载器
 * 
 * 移动端本地文件路径包括：
 * - file:// 协议
 * - /android_asset/ Android应用资源
 * - /var/ iOS应用沙盒
 * - cdvfile:// Cordova文件系统
 * - Cordova环境下的非http路径
 */

/**
 * 检测是否为移动端本地文件路径
 * @param {string} url - 文件URL
 * @returns {boolean} - 是否为本地文件
 */
export const isLocalFile = (url) => {
  return url.startsWith('file://') || 
         url.startsWith('/android_asset/') ||
         url.startsWith('/var/') ||
         url.startsWith('cdvfile://') ||
         (typeof window !== 'undefined' && window.cordova && !url.startsWith('http'));
};

/**
 * 检测是否为iOS环境
 * @returns {boolean} - 是否为iOS环境
 */
export const isIOS = () => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

/**
 * 将iOS本地文件路径转换为可用的路径
 * @param {string} url - 原始URL
 * @returns {string} - 转换后的URL
 */
export const convertIOSLocalPath = (url) => {
  if (!isIOS() || !url.startsWith('file://')) {
    return url;
  }
  
  // iOS WebView中，file://协议可能被限制，尝试转换为相对路径
  // 从file:///var/mobile/...路径中提取相对路径部分
  const match = url.match(/file:\/\/.*?\/www\/(.+)$/);
  if (match) {
    const relativePath = match[1];
    console.log('iOS本地文件路径转换:', url, '->', relativePath);
    return relativePath;
  }
  
  return url;
};

/**
 * 安全的fetch封装函数，自动处理移动端本地文件
 * @param {string} url - 请求URL
 * @param {RequestInit} options - fetch选项
 * @returns {Promise<Response>} - fetch响应或抛出错误
 */
export const safeFetch = (url, options = {}) => {
  // 如果是移动端本地文件，直接抛出错误提示不要使用fetch
  if (isLocalFile(url)) {
    return Promise.reject(new Error('本地文件不应使用fetch方法，请使用直接加载方式'));
  }
  
  // 对于网络资源，正常使用fetch
  return fetch(url, options);
};

/**
 * 安全的图片加载函数，自动处理本地文件和网络资源
 * @param {string} url - 图片URL
 * @returns {Promise<HTMLImageElement>} - 加载好的图片元素
 */
export const safeImageLoader = (url) => {
  const resolvedUrl = url.startsWith('http') || url.startsWith('//') ? 
  url : new URL(url, window.location.href).href;
  return new Promise((resolve, reject) => {
    const img = new Image();
    console.log('safeImageLoader url  >>>>  ', resolvedUrl);
    if (isLocalFile(resolvedUrl)) {
      console.log('检测到本地图片文件，使用直接加载方式:', resolvedUrl);
      
      // iOS特殊处理：尝试转换file://路径为相对路径
      let loadUrl = resolvedUrl;
      if (isIOS() && resolvedUrl.startsWith('file://')) {
        const convertedUrl = convertIOSLocalPath(resolvedUrl);
        if (convertedUrl !== resolvedUrl) {
          console.log('iOS环境，尝试使用转换后的路径:', convertedUrl);
          loadUrl = convertedUrl;
        }
      }
      
      // 对于本地文件，不设置crossOrigin，避免CORS问题
      img.onload = function() {
        console.log('本地图片加载成功，尺寸:', img.width, 'x', img.height);
        resolve(img);
      };
      
      img.onerror = function(e) {
        console.error('本地图片加载失败:', e);
        
        // iOS特殊处理：如果转换后的路径也失败，尝试其他方案
        if (isIOS() && loadUrl !== resolvedUrl) {
          console.log('转换路径失败，尝试原始路径:', resolvedUrl);
          img.onload = function() {
            console.log('使用原始路径加载成功');
            resolve(img);
          };
          img.onerror = function(e2) {
            console.error('所有本地路径均失败:', e2);
            reject(new Error('本地图片加载失败'));
          };
          img.src = resolvedUrl;
          return;
        }
        
        reject(new Error('本地图片加载失败'));
      };
      
      // 设置src
      img.src = loadUrl;
    } else {
      console.log('检测到网络图片，使用fetch方式加载:', resolvedUrl);
      
      // 对于网络资源，使用fetch + blob方式
      safeFetch(resolvedUrl, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        headers: {
          'Accept': 'image/*'
        },
        cache: 'no-cache'
      })
      .then(response => {
        if (!response.ok) {
          throw new Error(`服务器响应错误: ${response.status} ${response.statusText}`);
        }
        return response.blob();
      })
      .then(blob => {
        const objectUrl = URL.createObjectURL(blob);
        
        img.onload = function() {
          console.log('网络图片加载成功，尺寸:', img.width, 'x', img.height);
          URL.revokeObjectURL(objectUrl);
          resolve(img);
        };
        
        img.onerror = function(e) {
          console.error('网络图片元素加载失败:', e);
          URL.revokeObjectURL(objectUrl);
          reject(new Error('网络图片元素加载失败'));
        };
        
        img.src = objectUrl;
      })
      .catch(error => {
        console.error('网络图片fetch失败，尝试直接加载:', error);
        
        // 备选方案：直接加载
        img.crossOrigin = 'anonymous';
        
        img.onload = function() {
          console.log('直接加载网络图片成功');
          resolve(img);
        };
        
        img.onerror = function(e) {
          console.error('所有图片加载方法均失败:', e);
          reject(new Error('所有图片加载方法均失败'));
        };
        
        // 添加时间戳避免缓存
        const timeStamp = new Date().getTime();
        const imageUrl = resolvedUrl.includes('?') ? 
          `${resolvedUrl}&t=${timeStamp}` : 
          `${resolvedUrl}?t=${timeStamp}`;
          
        img.src = imageUrl;
      });
    }
  });
};

/**
 * 加载外部JavaScript脚本
 * @param {string} src - 脚本URL，支持相对路径、绝对路径和完整URL
 * @returns {Promise} - 加载完成的Promise
 */
export const loadScript = (src) => {
  // 处理URL：如果是相对路径且不以http开头，则相对于当前域名解析
  const resolvedUrl = src.startsWith('http') || src.startsWith('//') ? 
    src : new URL(src, window.location.href).href;
  
  console.log('尝试从以下地址加载脚本:', src, '解析后URL:', resolvedUrl);
  
  return new Promise((resolve, reject) => {
    // 检查脚本是否已经加载
    const existingScripts = document.querySelectorAll('script');
    for (const script of existingScripts) {
      if (script.src === resolvedUrl) {
        console.log('脚本已存在，跳过加载:', resolvedUrl);
        resolve();
        return;
      }
    }
    
    const script = document.createElement('script');
    script.src = resolvedUrl;
    script.async = true;
    script.onload = () => {
      console.log('成功加载脚本:', resolvedUrl);
      resolve();
    };
    script.onerror = (error) => {
      console.error('加载脚本失败:', resolvedUrl, error);
      reject(new Error(`加载脚本失败: ${resolvedUrl}`));
    };
    document.head.appendChild(script);
  });
};

/**
 * 加载CSS样式文件
 * @param {string} href - CSS文件URL，支持相对路径、绝对路径和完整URL
 * @returns {Promise} - 加载完成的Promise
 */
export const loadCSS = (href) => {
  // 处理URL：如果是相对路径且不以http开头，则相对于当前域名解析
  const resolvedUrl = href.startsWith('http') || href.startsWith('//') ? 
    href : new URL(href, window.location.href).href;
  
  console.log('尝试从以下地址加载CSS:', href, '解析后URL:', resolvedUrl);
  
  return new Promise((resolve, reject) => {
    // 检查CSS是否已经加载
    const existingLinks = document.querySelectorAll('link[rel="stylesheet"]');
    for (const link of existingLinks) {
      if (link.href === resolvedUrl) {
        console.log('CSS已存在，跳过加载:', resolvedUrl);
        resolve();
        return;
      }
    }
    
    // 如果尚未加载则加载CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = resolvedUrl;
    link.onload = () => {
      console.log('成功加载CSS:', resolvedUrl);
      resolve();
    };
    link.onerror = (error) => {
      console.error('加载CSS失败:', resolvedUrl, error);
      reject(new Error(`加载CSS失败: ${resolvedUrl}`));
    };
    document.head.appendChild(link);
  });
};

/**
 * 通过Blob和ObjectURL加载图片，更好地解决CORS问题
 * @param {string} url - 图片URL
 * @returns {Promise<HTMLImageElement>} - 加载好的图片元素
 */
export const proxyImageLoader = (url) => {
  return new Promise(async (resolve, reject) => {
    try {
      console.log('开始加载图片:', url);
      
      // 创建一个新的图片元素
      const img = new Image();
      
      // 检查是否为本地文件路径
      if (isLocalFile(url)) {
        console.log('检测到本地文件，使用直接加载方式:', url);
        
        // iOS特殊处理：尝试转换file://路径为相对路径
        let loadUrl = url;
        if (isIOS() && url.startsWith('file://')) {
          const convertedUrl = convertIOSLocalPath(url);
          if (convertedUrl !== url) {
            console.log('iOS环境，尝试使用转换后的路径:', convertedUrl);
            loadUrl = convertedUrl;
          }
        }
        
        // 对于本地文件，直接加载，不使用fetch
        img.onload = function() {
          console.log('本地图片加载成功，尺寸:', img.width, 'x', img.height);
          resolve(img);
        };
        
        img.onerror = function(e) {
          console.error('本地图片加载失败:', e);
          
          // iOS特殊处理：如果转换后的路径也失败，尝试其他方案
          if (isIOS() && loadUrl !== url) {
            console.log('转换路径失败，尝试原始路径:', url);
            img.onload = function() {
              console.log('使用原始路径加载成功');
              resolve(img);
            };
            img.onerror = function(e2) {
              console.error('所有本地路径均失败:', e2);
              reject(new Error('本地图片加载失败'));
            };
            img.src = url;
            return;
          }
          
          reject(new Error('本地图片加载失败'));
        };
        
        // 直接设置src，不添加时间戳和crossOrigin
        img.src = loadUrl;
        return;
      }
      
      // 处理URL，确保授权参数不会被破坏
      const fetchUrl = url;
      
      try {
        // 使用fetch API获取图片内容为blob
        // 关闭credentials，避免干扰授权
        const response = await fetch(fetchUrl, { 
          method: 'GET',
          mode: 'cors',
          credentials: 'omit', // 重要：不发送cookies
          headers: {
            'Accept': 'image/*'
          },
          cache: 'no-cache'
        });
        
        if (!response.ok) {
          console.error('服务器响应错误:', response.status, response.statusText);
          throw new Error(`服务器响应错误: ${response.status} ${response.statusText}`);
        }
        
        // 将响应转换为Blob
        const blob = await response.blob();
        
        // 创建blob URL
        const objectUrl = URL.createObjectURL(blob);
        
        // 监听图片加载完成事件
        img.onload = function() {
          console.log('图片加载成功，尺寸:', img.width, 'x', img.height);
          // 释放blob URL以避免内存泄漏
          URL.revokeObjectURL(objectUrl);
          resolve(img);
        };
        
        img.onerror = function(e) {
          console.error('图片元素加载失败:', e);
          URL.revokeObjectURL(objectUrl);
          reject(new Error('图片元素加载失败'));
        };
        
        // 设置src
        img.src = objectUrl;
      } catch (fetchError) {
        console.error('使用fetch加载图片失败，尝试直接加载:', fetchError);
        
        // 作为备选方案，尝试直接加载
        img.crossOrigin = 'anonymous';
        
        img.onload = function() {
          console.log('直接加载图片成功');
          resolve(img);
        };
        
        img.onerror = function(e) {
          console.error('直接加载图片也失败:', e);
          reject(new Error('所有图片加载方法均失败'));
        };
        
        // 添加时间戳避免缓存
        const timeStamp = new Date().getTime();
        const imageUrl = url.includes('?') ? 
          `${url}&t=${timeStamp}` : 
          `${url}?t=${timeStamp}`;
          
        img.src = imageUrl;
      }
    } catch (error) {
      console.error('图片加载过程出错:', error);
      reject(error);
    }
  });
};

/**
 * 批量加载多个脚本文件
 * @param {Array<string>} scripts - 脚本URL数组
 * @returns {Promise} - 所有脚本加载完成的Promise
 */
export const loadScripts = (scripts) => {
  return Promise.all(scripts.map(src => loadScript(src)));
};

/**
 * 批量加载多个CSS文件
 * @param {Array<string>} stylesheets - CSS文件URL数组
 * @returns {Promise} - 所有CSS加载完成的Promise
 */
export const loadStylesheets = (stylesheets) => {
  return Promise.all(stylesheets.map(href => loadCSS(href)));
};

/**
 * 同时加载CSS和JS资源
 * @param {Object} options - 加载选项
 * @param {Array<string>|string} [options.scripts] - 脚本URL或URL数组
 * @param {Array<string>|string} [options.stylesheets] - CSS文件URL或URL数组
 * @returns {Promise} - 所有资源加载完成的Promise
 */
export const loadResources = async ({ scripts = [], stylesheets = [] }) => {
  const scriptPromises = Array.isArray(scripts) ? 
    loadScripts(scripts) : 
    scripts ? [loadScript(scripts)] : [];
    
  const stylesheetPromises = Array.isArray(stylesheets) ? 
    loadStylesheets(stylesheets) : 
    stylesheets ? [loadCSS(stylesheets)] : [];
  
  return Promise.all([...scriptPromises, ...stylesheetPromises]);
}; 