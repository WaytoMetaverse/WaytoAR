const manifestUrl = 'data/models.json';

const dom = {
  grid: document.getElementById('modelGrid'),
  status: document.getElementById('statusBar'),
  search: document.getElementById('searchInput'),
  refresh: document.getElementById('refreshButton'),
  template: document.getElementById('modelCardTemplate'),
};

const env = detectEnvironment();

const state = {
  items: [],
  pendingFocusId: new URLSearchParams(window.location.search).get('model') ?? '',
};

init();

function init() {
  dom.search.addEventListener('input', () => applyFilter(dom.search.value));
  dom.refresh.addEventListener('click', () => loadModels(true));
  loadModels();
}

async function loadModels(forceReload = false) {
  setStatus('載入模型中…');
  try {
    const response = await fetch(forceReload ? `${manifestUrl}?v=${Date.now()}` : manifestUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    state.items = Array.isArray(payload.items) ? payload.items : [];
    renderGrid(state.items);
    if (state.pendingFocusId) {
      focusModel(state.pendingFocusId);
      state.pendingFocusId = '';
    }
    setStatus(buildStatusMessage(state.items.length, payload.generatedAt));
  } catch (error) {
    console.error('[WaytoAR] 載入模型清單失敗', error);
    dom.grid.innerHTML = `<div class="empty-state">無法載入模型清單，請先執行 <code>npm run generate</code> 或檢查網路。<br />錯誤：${error.message}</div>`;
    setStatus('載入模型時發生錯誤，請稍後再試。', 'warning');
  }
}

function applyFilter(keywordRaw) {
  const keyword = keywordRaw.trim().toLowerCase();
  if (!keyword) {
    renderGrid(state.items);
    setStatus(`共 ${state.items.length} 筆模型`);
    return;
  }
  const filtered = state.items.filter((item) =>
    [item.displayName, item.id, item.fileName]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(keyword))
  );
  renderGrid(filtered);
  setStatus(`符合「${keywordRaw}」的模型：${filtered.length} / ${state.items.length}`);
}

function renderGrid(list) {
  dom.grid.innerHTML = '';
  if (!list.length) {
    dom.grid.innerHTML = `<div class="empty-state">找不到符合條件的模型。</div>`;
    return;
  }
  const fragment = document.createDocumentFragment();
  list.forEach((item) => {
    fragment.appendChild(createCard(item));
  });
  dom.grid.appendChild(fragment);
}

function createCard(item) {
  const node = dom.template.content.firstElementChild.cloneNode(true);
  node.dataset.modelId = item.id;

  const nameEl = node.querySelector('[data-name]');
  const metaEl = node.querySelector('[data-meta]');
  const badgesEl = node.querySelector('[data-badges]');
  const thumbnailEl = node.querySelector('[data-thumbnail]');
  const placeholderEl = node.querySelector('[data-placeholder]');
  const arButton = node.querySelector('[data-ar-button]');
  const copyButton = node.querySelector('[data-copy]');

  nameEl.textContent = item.displayName || item.id;
  metaEl.textContent = `${item.size?.humanReadable ?? '---'} ｜ 更新：${formatDate(item.updatedAt)}`;

  renderBadges(badgesEl, item);

  if (item.thumbnailPath) {
    thumbnailEl.src = encodeURI(item.thumbnailPath);
    thumbnailEl.alt = `${nameEl.textContent} 縮圖`;
    placeholderEl.hidden = true;
  } else {
    thumbnailEl.remove();
    placeholderEl.hidden = false;
    placeholderEl.textContent = getInitials(nameEl.textContent);
  }

  configureArButton(arButton, item, nameEl.textContent);
  configureCopyButton(copyButton, item);

  return node;
}

function configureArButton(button, item, displayName) {
  const availability = getArAvailability(item);
  button.textContent = availability.label;
  button.href = availability.fallbackHref ?? '#';
  if (availability.available) {
    button.removeAttribute('aria-disabled');
    button.classList.remove('is-disabled');
  } else {
    button.setAttribute('aria-disabled', 'true');
    button.classList.add('is-disabled');
  }
  if (availability.hint) {
    button.title = availability.hint;
  } else {
    button.removeAttribute('title');
  }

  if (!availability.available) return;

  button.addEventListener('click', (event) => {
    event.preventDefault();
    handleArLaunch(item, displayName);
  });
}

function configureCopyButton(button, item) {
  const shareUrl = buildShareUrl(item.id);
  button.addEventListener('click', () => copyLink(shareUrl, button));
}

function renderBadges(container, item) {
  const badges = [];
  if (item.modelPath && item.androidModelPath) {
    badges.push({ label: 'iOS & Android', tone: 'info' });
  } else if (item.modelPath) {
    badges.push({ label: 'iOS / USDZ', tone: 'warning' });
  } else if (item.androidModelPath) {
    badges.push({ label: 'Android / GLB', tone: 'warning' });
  }

  if (!badges.length) {
    container.innerHTML = '';
    container.hidden = true;
    return;
  }

  container.hidden = false;
  container.innerHTML = badges
    .map((badge) => `<span class="badge ${badge.tone ?? ''}">${badge.label}</span>`)
    .join('');
}

function getArAvailability(item) {
  if (env.isIOS) {
    if (!item.modelPath) {
      return {
        available: false,
        label: '缺少 USDZ',
        hint: '請在 model/ 放入同名 .usdz 才能在 iOS 開啟。',
      };
    }
    if (!env.supportsQuickLook) {
      const label = env.isLine ? '請於 Safari 開啟' : '不支援 Quick Look';
      const hint = env.isLine
        ? 'LINE 內建瀏覽器無法啟動 AR，請點右上角以 Safari 開啟。'
        : '請改用 Safari，以啟動 Apple Quick Look。';
      return { available: false, label, hint };
    }
    return {
      available: true,
      label: '開啟 AR (iOS)',
      fallbackHref: encodeURI(item.modelPath),
    };
  }

  if (env.isAndroid) {
    if (!item.androidModelPath) {
      return {
        available: false,
        label: '缺少 GLB',
        hint: '請提供同名 .glb 以支援 Android Scene Viewer。',
      };
    }
    if (!env.supportsSceneViewer) {
      const label = env.isLine ? '請用 Chrome 開啟' : '瀏覽器不支援 AR';
      const hint = env.isLine
        ? 'LINE 內建瀏覽器無法開啟 Scene Viewer，請右上角改用 Chrome。'
        : '請使用 Android Chrome（支援 ARCore）開啟。';
      return { available: false, label, hint };
    }
    return {
      available: true,
      label: '開啟 AR (Android)',
      fallbackHref: '#',
    };
  }

  const fallbackPath = item.modelPath ?? item.androidModelPath;
  if (!fallbackPath) {
    return { available: false, label: '無可用檔案', hint: '請補上 USDZ 或 GLB。' };
  }
  return {
    available: true,
    label: '下載模型',
    fallbackHref: encodeURI(fallbackPath),
  };
}

function handleArLaunch(item, displayName) {
  if (env.isIOS) {
    openIosQuickLook(item);
    return;
  }
  if (env.isAndroid) {
    openAndroidSceneViewer(item, displayName);
    return;
  }
  openDefaultDownload(item);
}

function openIosQuickLook(item) {
  if (!item.modelPath) {
    setStatus('此模型尚無 USDZ 檔案，無法在 iOS 開啟。', 'warning');
    return;
  }
  if (!env.supportsQuickLook) {
    setStatus('請改用 Safari 或從 LINE 右上角以瀏覽器開啟後再試一次。', 'warning');
    return;
  }
  window.location.href = encodeURI(item.modelPath);
}

function openAndroidSceneViewer(item, displayName) {
  if (!item.androidModelPath) {
    setStatus('此模型尚無 GLB 檔案，無法在 Android 啟動 AR。', 'warning');
    return;
  }
  if (!env.supportsSceneViewer) {
    setStatus('此瀏覽器不支援 ARCore Scene Viewer，請改用 Android Chrome。', 'warning');
    return;
  }

  const intentUrl = buildSceneViewerIntent(item.androidModelPath, displayName);
  window.location.href = intentUrl;
}

function openDefaultDownload(item) {
  const target = item.modelPath ?? item.androidModelPath;
  if (!target) {
    setStatus('暫無可下載的模型檔案。', 'warning');
    return;
  }
  window.open(target, '_blank', 'noopener');
}

function buildSceneViewerIntent(modelPath, title) {
  const absoluteUrl = new URL(modelPath, window.location.href).href;
  const params = new URLSearchParams({
    file: absoluteUrl,
    mode: 'ar_preferred',
  });
  if (title) {
    params.set('title', title);
  }
  const query = params.toString();
  return `intent://arvr.google.com/scene-viewer/1.0?${query}#Intent;scheme=https;package=com.google.ar.core;action=android.intent.action.VIEW;S.browser_fallback_url=${encodeURIComponent(
    window.location.href
  )};end;`;
}

async function copyLink(url, button) {
  try {
    if (!navigator.clipboard) {
      throw new Error('Clipboard API 不支援');
    }
    await navigator.clipboard.writeText(url);
    flashButton(button, '已複製');
  } catch (error) {
    console.warn('複製失敗', error);
    flashButton(button, '無法複製', true);
  }
}

function flashButton(button, label, isError = false) {
  const originalText = button.textContent;
  button.textContent = label;
  button.classList.toggle('error', isError);
  button.disabled = true;
  setTimeout(() => {
    button.textContent = originalText;
    button.classList.remove('error');
    button.disabled = false;
  }, 1400);
}

function setStatus(message, tone = 'default') {
  dom.status.textContent = message;
  dom.status.dataset.tone = tone;
}

function buildStatusMessage(total, generatedAt) {
  const base = `共 ${total} 筆模型。資料最後更新：${generatedAt ? formatDate(generatedAt) : '未知'}`;
  const hint = getEnvironmentHint();
  return hint ? `${base} ｜ ${hint}` : base;
}

function formatDate(input) {
  if (!input) return '未知';
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return '未知';
  return date.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getInitials(name = '') {
  const trimmed = name.trim();
  if (!trimmed) return 'AR';
  return [...trimmed].slice(0, 2).join('').toUpperCase();
}

function detectEnvironment() {
  const ua = navigator.userAgent || '';
  const lower = ua.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(lower);
  const isAndroid = lower.includes('android');
  const isLine = /line\//i.test(ua);
  const isChrome = /chrome\//i.test(ua) && !/edg\//i.test(ua);
  const isSafari = isIOS && /safari/i.test(ua) && !/crios|fxios|edgios|opios|line\//i.test(ua);

  return {
    isIOS,
    isAndroid,
    isLine,
    isSafari,
    isChrome,
    supportsQuickLook: isIOS && isSafari && !isLine,
    supportsSceneViewer: isAndroid && isChrome && !isLine,
  };
}

function getEnvironmentHint() {
  if (env.isIOS && env.isLine) {
    return 'LINE 內建瀏覽器無法啟動 AR，請改用 Safari。';
  }
  if (env.isIOS && !env.supportsQuickLook) {
    return '請改用 iOS Safari 以啟用 Quick Look。';
  }
  if (env.isAndroid && env.isLine) {
    return 'LINE 內建瀏覽器無法使用 AR，請選「在 Chrome 中開啟」。';
  }
  if (env.isAndroid && !env.supportsSceneViewer) {
    return '請改用支援 ARCore Scene Viewer 的 Chrome 瀏覽器。';
  }
  return '';
}

function focusModel(modelId) {
  if (!modelId) return;
  const selector = `[data-model-card][data-model-id="${escapeCss(modelId)}"]`;
  const target = dom.grid.querySelector(selector);
  if (target) {
    target.classList.add('is-highlighted');
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => target.classList.remove('is-highlighted'), 1600);
  }
}

function escapeCss(value) {
  if (window.CSS && typeof window.CSS.escape === 'function') {
    return window.CSS.escape(value);
  }
  return value.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
}

function buildShareUrl(modelId) {
  const url = new URL(window.location.href);
  url.searchParams.set('model', modelId);
  return url.href;
}

