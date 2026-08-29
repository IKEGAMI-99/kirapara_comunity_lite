const FEEDS = [
  {
    id: 'discovery',
    label: 'おすすめ',
    description: 'ゲーム内のDiscoveryフィードを閲覧専用で表示します。',
    dataUrl: './data/discovery.json',
    enabled: true,
  },
  // Future feeds can be added here without changing the card renderer.
  // { id: 'latest', label: '新着', dataUrl: './data/latest.json', enabled: true },
];

const state = {
  activeFeedId: 'discovery',
};

const elements = {
  tabs: document.querySelector('#tabs'),
  feed: document.querySelector('#feed'),
  empty: document.querySelector('#emptyState'),
  notice: document.querySelector('#notice'),
  title: document.querySelector('#feedTitle'),
  updatedAt: document.querySelector('#updatedAt'),
  refresh: document.querySelector('#refreshButton'),
  template: document.querySelector('#postTemplate'),
};

function formatDate(value) {
  if (!value) return '日時不明';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '日時不明';
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function plainText(value) {
  return String(value || '').replace(/<br\s*\/?\s*>/gi, '\n').trim();
}

function createImage(url, alt) {
  const img = document.createElement('img');
  img.src = url;
  img.alt = alt;
  img.loading = 'lazy';
  img.decoding = 'async';
  img.addEventListener('error', () => {
    img.classList.add('image-error');
    img.removeAttribute('src');
  }, { once: true });
  return img;
}

function renderPost(post) {
  const node = elements.template.content.firstElementChild.cloneNode(true);
  const avatar = node.querySelector('.avatar');
  const authorName = node.querySelector('.author-name');
  const meta = node.querySelector('.post-meta');
  const title = node.querySelector('.post-title');
  const content = node.querySelector('.post-content');
  const images = node.querySelector('.post-images');

  if (post.author?.avatarUrl) {
    avatar.src = post.author.avatarUrl;
  } else {
    avatar.classList.add('avatar-empty');
  }
  avatar.alt = `${post.author?.roleName || '投稿者'}のアイコン`;
  authorName.textContent = post.author?.roleName || '名前不明';
  meta.textContent = `Server ${post.author?.serverId || '?'} ・ ${formatDate(post.createdAt)}`;

  const titleText = plainText(post.title);
  const contentText = plainText(post.content);
  title.textContent = titleText;
  content.textContent = contentText;
  title.hidden = !titleText;
  content.hidden = !contentText;

  const imageList = Array.isArray(post.images) ? post.images.filter(Boolean) : [];
  images.dataset.count = String(imageList.length);
  imageList.forEach((url, index) => {
    images.append(createImage(url, `${titleText || authorName.textContent} ${index + 1}`));
  });
  images.hidden = imageList.length === 0;

  node.querySelector('.stat-votes').textContent = `♡ ${post.stats?.votes ?? 0}`;
  node.querySelector('.stat-replies').textContent = `⌁ ${post.stats?.replies ?? 0}`;
  node.querySelector('.stat-collections').textContent = `◇ ${post.stats?.collections ?? 0}`;
  node.dataset.momentId = post.momentId || '';

  return node;
}

function renderTabs() {
  elements.tabs.replaceChildren();
  for (const feed of FEEDS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tab';
    button.textContent = feed.label;
    button.disabled = !feed.enabled;
    button.dataset.active = String(feed.id === state.activeFeedId);
    button.addEventListener('click', () => {
      if (!feed.enabled || feed.id === state.activeFeedId) return;
      state.activeFeedId = feed.id;
      renderTabs();
      loadFeed();
    });
    elements.tabs.append(button);
  }
}

async function loadFeed() {
  const feedConfig = FEEDS.find((feed) => feed.id === state.activeFeedId);
  if (!feedConfig) return;

  elements.title.textContent = feedConfig.label;
  elements.notice.hidden = true;
  elements.empty.hidden = true;
  elements.feed.setAttribute('aria-busy', 'true');
  elements.feed.replaceChildren();
  elements.updatedAt.textContent = '読み込み中…';

  try {
    const response = await fetch(`${feedConfig.dataUrl}?v=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const posts = Array.isArray(payload.posts) ? payload.posts : [];

    for (const post of posts) {
      elements.feed.append(renderPost(post));
    }

    elements.empty.hidden = posts.length !== 0;
    elements.updatedAt.textContent = payload.meta?.updatedAt
      ? `最終取得 ${formatDate(payload.meta.updatedAt)}`
      : '取得待ち';
  } catch (error) {
    elements.notice.textContent = `フィードを読み込めませんでした: ${error.message}`;
    elements.notice.hidden = false;
    elements.updatedAt.textContent = '取得エラー';
  } finally {
    elements.feed.setAttribute('aria-busy', 'false');
  }
}

elements.refresh.addEventListener('click', loadFeed);
renderTabs();
loadFeed();
