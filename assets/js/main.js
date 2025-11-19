const manifestUrl = 'data/models.json';

const dom = {
  grid: document.getElementById('modelGrid'),
  status: document.getElementById('statusBar'),
  search: document.getElementById('searchInput'),
  refresh: document.getElementById('refreshButton'),
  template: document.getElementById('modelCardTemplate'),
};

const state = {
  items: [],
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
    setStatus(
      `共 ${state.items.length} 筆模型。資料最後更新：${
        payload.generatedAt ? formatDate(payload.generatedAt) : '未知'
      }`
    );
  } catch (error) {
    console.error('[WaytoAR] 載入模型清單失敗', error);
    dom.grid.innerHTML = `<div class="empty-state">無法載入模型清單，請先執行 <code>npm run generate</code> 或檢查網路。<br />錯誤：${error.message}</div>`;
    setStatus('載入模型時發生錯誤，請稍後再試。');
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
  const nameEl = node.querySelector('[data-name]');
  const metaEl = node.querySelector('[data-meta]');
  const thumbnailEl = node.querySelector('[data-thumbnail]');
  const placeholderEl = node.querySelector('[data-placeholder]');
  const arButton = node.querySelector('[data-ar-button]');
  const copyButton = node.querySelector('[data-copy]');

  nameEl.textContent = item.displayName || item.id;
  metaEl.textContent = `${item.size?.humanReadable ?? '---'} ｜ 更新：${formatDate(item.updatedAt)}`;

  if (item.thumbnailPath) {
    thumbnailEl.src = encodeURI(item.thumbnailPath);
    thumbnailEl.alt = `${nameEl.textContent} 縮圖`;
    placeholderEl.hidden = true;
  } else {
    thumbnailEl.remove();
    placeholderEl.hidden = false;
    placeholderEl.textContent = getInitials(nameEl.textContent);
  }

  const arUrl = encodeURI(item.modelPath);
  arButton.href = arUrl;
  arButton.setAttribute('aria-label', `開啟 ${nameEl.textContent} 的 AR`);

  copyButton.addEventListener('click', () => copyLink(arUrl, copyButton));

  return node;
}

async function copyLink(url, button) {
  const absoluteUrl = new URL(url, window.location.href).href;
  try {
    if (!navigator.clipboard) {
      throw new Error('Clipboard API 不支援');
    }
    await navigator.clipboard.writeText(absoluteUrl);
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

function setStatus(message) {
  dom.status.textContent = message;
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

