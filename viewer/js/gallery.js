export class Gallery {
  constructor(manifestManager, onSelectCallback) {
    this.manifest = manifestManager;
    this.onSelect = onSelectCallback;

    this.el = document.getElementById('gallery');
    this.grid = document.getElementById('gallery-grid');
    this.searchInput = document.getElementById('gallery-search-input');
    this.btnOpen = document.getElementById('btn-gallery');
    this.btnClose = document.getElementById('btn-gallery-close');

    this.isOpen = false;
    this.ratioWidth = 375;
    this.ratioHeight = 812;
    this.selectedVisibleIndex = 0;

    this.boundKeydown = (e) => this.handleKeydown(e);
    this.boundResize = () => this.fitThumbnails();

    this.init();
  }

  init() {
    if (!this.el) return;

    this.btnOpen.addEventListener('click', () => this.open());
    this.btnClose.addEventListener('click', () => this.close());

    this.searchInput.addEventListener('input', (e) => this.filter(e.target.value));

    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) this.close();
    });
  }

  setRatio(width, height) {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return;
    }

    this.ratioWidth = Math.round(width);
    this.ratioHeight = Math.round(height);

    if (this.grid) {
      this.grid.style.setProperty('--gallery-aspect', `${this.ratioWidth} / ${this.ratioHeight}`);
    }

    if (this.isOpen) {
      this.render();
    }
  }

  open() {
    this.isOpen = true;
    this.el.classList.remove('hidden');
    this.render();
    this.searchInput.focus();
    document.addEventListener('keydown', this.boundKeydown);
    window.addEventListener('resize', this.boundResize);
  }

  close() {
    this.isOpen = false;
    this.el.classList.add('hidden');
    this.searchInput.value = '';
    document.removeEventListener('keydown', this.boundKeydown);
    window.removeEventListener('resize', this.boundResize);
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  render() {
    this.grid.innerHTML = '';
    this.grid.style.setProperty('--gallery-aspect', `${this.ratioWidth} / ${this.ratioHeight}`);

    const entries = this.manifest.getEntries();
    const current = this.manifest.getCurrentEntry();

    if (entries.length === 0) {
      this.grid.innerHTML = `<div class="gallery-empty">No designs found in manifest</div>`;
      return;
    }

    const stamp = Date.now();

    entries.forEach((entry) => {
      const isActive = current && current.index === entry.index;
      const title = this.escapeHtml(entry.title || `Design ${entry.index}`);
      const desc = this.escapeHtml(entry.description || 'No description provided');
      const filePath = String(entry.filePath || '').replace(/^\/+/, '');
      const separator = filePath.includes('?') ? '&' : '?';
      const src = `/${filePath}${separator}thumb=${stamp}`;

      const card = document.createElement('div');
      card.className = `gallery-item ${isActive ? 'active' : ''}`;
      card.dataset.index = String(entry.index);
      card.dataset.search = `${entry.index} ${entry.title || ''} ${entry.description || ''}`.toLowerCase();

      card.innerHTML = `
        <div class="gallery-thumb">
          <span class="gallery-badge">#${entry.index}</span>
          <div class="gallery-thumb-wrapper">
            <iframe src="${src}" loading="lazy" scrolling="no" tabindex="-1"></iframe>
          </div>
        </div>
        <div class="gallery-meta">
          <h3>${title}</h3>
          <p title="${desc}">${desc}</p>
        </div>
      `;

      card.addEventListener('click', () => {
        this.onSelect(entry.index);
        this.close();
      });

      this.grid.appendChild(card);
    });

    requestAnimationFrame(() => {
      this.fitThumbnails();
      this.applyInitialSelection();
    });
  }

  fitThumbnails() {
    if (!this.isOpen) return;

    const thumbs = this.grid.querySelectorAll('.gallery-thumb');
    thumbs.forEach((thumb) => {
      const iframe = thumb.querySelector('iframe');
      if (!iframe) return;

      const width = thumb.clientWidth;
      const height = thumb.clientHeight;
      if (width <= 0 || height <= 0) return;

      const scale = Math.min(width / this.ratioWidth, height / this.ratioHeight);
      iframe.style.width = `${this.ratioWidth}px`;
      iframe.style.height = `${this.ratioHeight}px`;
      iframe.style.transform = `scale(${scale})`;
    });
  }

  getVisibleCards() {
    return Array.from(this.grid.querySelectorAll('.gallery-item')).filter(
      (card) => card.style.display !== 'none'
    );
  }

  applyInitialSelection() {
    const visible = this.getVisibleCards();
    if (visible.length === 0) return;

    const activeIdx = visible.findIndex((card) => card.classList.contains('active'));
    this.selectedVisibleIndex = activeIdx >= 0 ? activeIdx : 0;
    this.applySelection();
  }

  applySelection() {
    const visible = this.getVisibleCards();
    visible.forEach((card) => card.classList.remove('kbd-selected'));

    if (visible.length === 0) return;

    if (this.selectedVisibleIndex < 0) this.selectedVisibleIndex = 0;
    if (this.selectedVisibleIndex >= visible.length) this.selectedVisibleIndex = visible.length - 1;

    const selected = visible[this.selectedVisibleIndex];
    selected.classList.add('kbd-selected');
    selected.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  filter(term) {
    const value = String(term || '').toLowerCase().trim();
    const cards = this.grid.querySelectorAll('.gallery-item');

    cards.forEach((card) => {
      if (card.dataset.search.includes(value)) {
        card.style.display = 'flex';
      } else {
        card.style.display = 'none';
      }
    });

    this.selectedVisibleIndex = 0;
    this.applySelection();
    requestAnimationFrame(() => this.fitThumbnails());
  }

  getColumnCount(visibleCards) {
    if (visibleCards.length <= 1) return 1;

    const first = visibleCards[0].getBoundingClientRect();
    const second = visibleCards[1].getBoundingClientRect();

    if (!first.width || !second.width) return 1;
    if (Math.abs(first.top - second.top) < 4) return 2;

    const gridWidth = this.grid.getBoundingClientRect().width;
    const cardWidth = first.width;
    return Math.max(1, Math.round(gridWidth / cardWidth));
  }

  handleKeydown(e) {
    if (!this.isOpen) return;

    const isSearchActive = document.activeElement === this.searchInput;
    const actionableKeys = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Enter', 'Escape'];
    if (isSearchActive && !actionableKeys.includes(e.key)) return;

    const visible = this.getVisibleCards();
    if (visible.length === 0) return;

    const columns = this.getColumnCount(visible);

    if (e.key === 'Escape') {
      this.close();
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const selected = visible[this.selectedVisibleIndex];
      if (!selected) return;
      const index = Number.parseInt(selected.dataset.index, 10);
      if (Number.isInteger(index)) {
        this.onSelect(index);
        this.close();
      }
      return;
    }

    let nextIndex = this.selectedVisibleIndex;

    if (e.key === 'ArrowRight') nextIndex += 1;
    if (e.key === 'ArrowLeft') nextIndex -= 1;
    if (e.key === 'ArrowDown') nextIndex += columns;
    if (e.key === 'ArrowUp') nextIndex -= columns;

    if (nextIndex !== this.selectedVisibleIndex) {
      e.preventDefault();
      if (nextIndex < 0) nextIndex = 0;
      if (nextIndex >= visible.length) nextIndex = visible.length - 1;
      this.selectedVisibleIndex = nextIndex;
      this.applySelection();
    }
  }
}
