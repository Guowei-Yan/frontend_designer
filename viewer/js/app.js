import { ManifestManager } from './manifest.js';
import { Scaler } from './scaler.js';
import { ResizeEngine } from './resizeEngine.js';
import { Gallery } from './gallery.js';
import { SocketClient } from './socketClient.js';
import { ThemeManager } from './themeManager.js';
import { StateManager } from './stateManager.js';

const DOM = {
  wizard: document.getElementById('setup-wizard'),
  iframe: document.getElementById('design-frame'),
  navCount: document.getElementById('nav-count'),
  navTitle: document.getElementById('nav-title'),
  navStatus: document.getElementById('nav-status'),
  btnPrev: document.getElementById('btn-prev'),
  btnNext: document.getElementById('btn-next'),
  btnRefresh: document.getElementById('btn-refresh'),
  btnCopyPath: document.getElementById('btn-copy-path'),
  alert: document.getElementById('dev-alert'),
  themeBtn: document.getElementById('btn-theme'),
  mockWrapper: document.getElementById('mock-screen-wrapper'),
  mockScreen: document.getElementById('mock-screen'),
  ratioSelect: document.getElementById('select-ratio'),
  badge: document.getElementById('badge-dimensions'),
  frameLoading: document.getElementById('frame-loading'),
  dimModal: document.getElementById('dim-modal'),
  dimModalCard: document.getElementById('dim-modal-card'),
  dimInputW: document.getElementById('dim-input-w'),
  dimInputH: document.getElementById('dim-input-h'),
  btnDimApply: document.getElementById('btn-dim-apply'),
  btnDimCancel: document.getElementById('btn-dim-cancel'),
  dimPresetButtons: Array.from(document.querySelectorAll('[data-dim-size]'))
};

class App {
  constructor() {
    this.manifest = new ManifestManager();
    this.scaler = new Scaler(DOM.mockWrapper, DOM.mockScreen);
    this.gallery = new Gallery(this.manifest, (index) => this.loadDesign(index));
    this.resizeEngine = new ResizeEngine(
      DOM.mockScreen,
      this.scaler,
      DOM.badge,
      DOM.ratioSelect,
      (payload) => this.onDimensionsChange(payload)
    );
    this.themeManager = new ThemeManager(DOM.themeBtn, DOM.iframe, () => this.onThemeChange());
    this.stateManager = new StateManager(this, DOM.iframe, DOM.alert);
    this.socketClient = new SocketClient(
      this.manifest,
      () => this.onManifestChange(),
      (filePath) => this.onFileChange(filePath)
    );

    this.frameFocused = false;
    this.alertTimer = null;
    this.slowLoadTimer = null;
    this.stateSyncTimer = null;
    this.pendingFramePath = '';

    this.init();
  }

  async init() {
    this.setupEventListeners();
    setTimeout(() => this.scaler.rescale(), 50);

    const initialState = this.stateManager.getUrlState();

    if (initialState.theme) {
      this.themeManager.setTheme(initialState.theme, { silent: true });
    }

    this.applyViewportStateFromUrl(initialState);

    const hasManifest = await this.manifest.loadManifest();
    if (!hasManifest) {
      this.showWizard();
      this.syncStateToUrl();
      return;
    }

    DOM.wizard.classList.add('hidden');

    const targetIndex = this.resolveInitialIndex(initialState.page);
    if (targetIndex !== null) {
      this.loadDesign(targetIndex);
    }
  }

  resolveInitialIndex(requestedPage) {
    const entries = this.manifest.getEntries();
    if (entries.length === 0) return null;

    if (Number.isInteger(requestedPage)) {
      if (this.manifest.hasIndex(requestedPage)) {
        return requestedPage;
      }
      const closest = this.manifest.getClosestIndex(requestedPage);
      if (closest !== null) {
        this.showDevAlert(`Requested page ${requestedPage} is unavailable. Snapped to ${closest}.`);
        return closest;
      }
    }

    return entries[0].index;
  }

  applyViewportStateFromUrl(state) {
    const options = new Set(Array.from(DOM.ratioSelect.options).map((o) => o.value));
    let applied = false;

    if (state.ratio && options.has(state.ratio) && state.ratio !== 'free') {
      DOM.ratioSelect.value = state.ratio;
      this.resizeEngine.setFromRatio(state.ratio, { silent: true });
      applied = true;
    }

    if (!applied && state.ratio === 'free' && Number.isFinite(state.width) && Number.isFinite(state.height)) {
      DOM.ratioSelect.value = 'free';
      this.resizeEngine.setDimensions(state.width, state.height, { silent: true });
      applied = true;
    }

    if (!applied && Number.isFinite(state.width) && Number.isFinite(state.height)) {
      DOM.ratioSelect.value = 'free';
      this.resizeEngine.setDimensions(state.width, state.height, { silent: true });
    }

    const dims = this.resizeEngine.getDimensions();
    this.gallery.setRatio(dims.width, dims.height);
    this.scaler.rescale();
  }

  showWizard() {
    DOM.wizard.classList.remove('hidden');
    DOM.navTitle.textContent = 'No Manifest';
    DOM.navCount.textContent = '- / -';
    DOM.navStatus.textContent = '';
    DOM.btnPrev.disabled = true;
    DOM.btnNext.disabled = true;
  }

  loadDesign(index) {
    if (!this.manifest.setCurrentIndex(index)) {
      const fallback = this.manifest.getClosestIndex(index);
      if (fallback === null || !this.manifest.setCurrentIndex(fallback)) {
        return;
      }
      index = fallback;
    }

    const entry = this.manifest.getCurrentEntry();
    if (!entry) return;

    this.updateNavMeta(index);
    this.updateNavButtons();

    const normalizedPath = `/${entry.filePath.replace(/^\/+/, '')}`;
    const url = new URL(normalizedPath, window.location.origin);
    url.searchParams.set('cache', String(Date.now()));
    this.pendingFramePath = normalizedPath;

    this.startFrameLoading();
    DOM.iframe.src = url.toString();

    this.queueStateSync();
  }

  updateNavMeta(index) {
    const entries = this.manifest.getEntries();
    const pos = entries.findIndex((e) => e.index === index) + 1;
    const entry = this.manifest.getCurrentEntry();

    DOM.navCount.textContent = `${pos} / ${entries.length}`;
    DOM.navTitle.textContent = entry ? (entry.title || `Design ${index}`) : `Design ${index}`;
  }

  updateNavButtons() {
    DOM.btnPrev.disabled = this.manifest.getPrevIndex() === null;
    DOM.btnNext.disabled = this.manifest.getNextIndex() === null;
  }

  startFrameLoading() {
    if (this.slowLoadTimer) {
      clearTimeout(this.slowLoadTimer);
      this.slowLoadTimer = null;
    }

    DOM.frameLoading.classList.remove('hidden');
    DOM.navStatus.textContent = 'Loading';
    DOM.navStatus.classList.remove('slow');

    this.slowLoadTimer = setTimeout(() => {
      DOM.navStatus.textContent = 'Slow';
      DOM.navStatus.classList.add('slow');
      this.showDevAlert('This design is taking longer than expected to load.');
    }, 3000);
  }

  onFrameLoaded() {
    let loadedPath = '';
    try {
      loadedPath = DOM.iframe.contentWindow.location.pathname;
    } catch (e) {
      loadedPath = '';
    }

    if (this.pendingFramePath && loadedPath && loadedPath !== this.pendingFramePath) {
      return;
    }

    this.pendingFramePath = '';

    if (this.slowLoadTimer) {
      clearTimeout(this.slowLoadTimer);
      this.slowLoadTimer = null;
    }

    DOM.frameLoading.classList.add('hidden');
    DOM.navStatus.textContent = '';
    DOM.navStatus.classList.remove('slow');
  }

  setFrameFocus(active) {
    this.frameFocused = Boolean(active);
    DOM.mockScreen.classList.toggle('is-focused', this.frameFocused);
  }

  onDimensionsChange(payload) {
    this.gallery.setRatio(payload.width, payload.height);
    this.queueStateSync();
  }

  onThemeChange() {
    this.queueStateSync();
  }

  queueStateSync() {
    if (this.stateSyncTimer) clearTimeout(this.stateSyncTimer);
    this.stateSyncTimer = setTimeout(() => this.syncStateToUrl(), 80);
  }

  syncStateToUrl() {
    const current = this.manifest.getCurrentEntry();
    const ratio = DOM.ratioSelect.value || 'free';
    const dims = this.resizeEngine.getDimensions();
    const theme = this.themeManager.getTheme();

    this.stateManager.updateUrlState({
      page: current ? current.index : null,
      ratio,
      width: ratio === 'free' ? dims.width : null,
      height: ratio === 'free' ? dims.height : null,
      theme
    });
  }

  showDevAlert(msg) {
    DOM.alert.textContent = msg;
    DOM.alert.classList.remove('hidden');

    if (this.alertTimer) clearTimeout(this.alertTimer);
    this.alertTimer = setTimeout(() => {
      DOM.alert.classList.add('hidden');
    }, 4000);
  }

  refreshFrame() {
    const entry = this.manifest.getCurrentEntry();
    if (!entry) return;
    this.loadDesign(entry.index);
  }

  onManifestChange() {
    const entries = this.manifest.getEntries();

    if (entries.length === 0) {
      this.showWizard();
      DOM.iframe.src = 'about:blank';
      this.queueStateSync();
      if (this.gallery.isOpen) this.gallery.render();
      return;
    }

    DOM.wizard.classList.add('hidden');

    const currentIndex = this.manifest.currentIndex;
    if (!this.manifest.hasIndex(currentIndex)) {
      const snapped = this.manifest.getClosestIndex(currentIndex, { excludeReference: true }) ?? entries[0].index;
      this.showDevAlert(`Current page is unavailable. Snapped to ${snapped}.`);
      this.loadDesign(snapped);
    } else {
      this.updateNavMeta(currentIndex);
      this.updateNavButtons();
      this.queueStateSync();
    }

    if (this.gallery.isOpen) {
      this.gallery.render();
    }
  }

  onFileChange(filePath) {
    const current = this.manifest.getCurrentEntry();

    if (current) {
      const normalizedCurrent = `/${current.filePath.replace(/^\/+/, '')}`;
      const normalizedChanged = `/${String(filePath).replace(/^\/+/, '')}`;
      if (normalizedCurrent === normalizedChanged) {
        this.refreshFrame();
      }
    }

    if (this.gallery.isOpen) {
      this.gallery.render();
    }
  }

  async copyCurrentPath() {
    const entry = this.manifest.getCurrentEntry();
    if (!entry) return;

    const value = `/${entry.filePath.replace(/^\/+/, '')}`;

    try {
      await navigator.clipboard.writeText(value);
      this.showDevAlert(`Copied path: ${value}`);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.setAttribute('readonly', 'readonly');
      ta.style.position = 'absolute';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      this.showDevAlert(`Copied path: ${value}`);
    }
  }

  openDimModal() {
    if (!window.matchMedia('(max-width: 768px)').matches) return;
    const dims = this.resizeEngine.getDimensions();
    DOM.dimInputW.value = String(dims.width);
    DOM.dimInputH.value = String(dims.height);
    DOM.dimModal.classList.remove('hidden');
    DOM.dimInputW.focus();
  }

  closeDimModal() {
    DOM.dimModal.classList.add('hidden');
  }

  applyDimModal() {
    const width = Number.parseInt(DOM.dimInputW.value, 10);
    const height = Number.parseInt(DOM.dimInputH.value, 10);

    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      this.showDevAlert('Please enter valid width and height values.');
      return;
    }

    DOM.ratioSelect.value = 'free';
    this.resizeEngine.setDimensions(width, height);
    this.closeDimModal();
  }

  setupEventListeners() {
    document.addEventListener('dev-alert', (e) => this.showDevAlert(e.detail));

    DOM.btnPrev.addEventListener('click', () => {
      const prev = this.manifest.getPrevIndex();
      if (prev !== null) this.loadDesign(prev);
    });

    DOM.btnNext.addEventListener('click', () => {
      const next = this.manifest.getNextIndex();
      if (next !== null) this.loadDesign(next);
    });

    DOM.btnRefresh.addEventListener('click', () => this.refreshFrame());
    DOM.btnCopyPath.addEventListener('click', () => this.copyCurrentPath());

    DOM.iframe.addEventListener('load', () => this.onFrameLoaded());
    DOM.iframe.addEventListener('pointerdown', () => this.setFrameFocus(true));

    DOM.badge.addEventListener('click', () => this.openDimModal());
    DOM.btnDimApply.addEventListener('click', () => this.applyDimModal());
    DOM.btnDimCancel.addEventListener('click', () => this.closeDimModal());

    DOM.dimPresetButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-dim-size') || '';
        const [w, h] = val.split('x').map((n) => Number.parseInt(n, 10));
        if (Number.isFinite(w) && Number.isFinite(h)) {
          DOM.dimInputW.value = String(w);
          DOM.dimInputH.value = String(h);
        }
      });
    });

    DOM.dimModal.addEventListener('click', (e) => {
      if (e.target === DOM.dimModal) this.closeDimModal();
    });

    DOM.ratioSelect.addEventListener('change', () => {
      if (DOM.ratioSelect.value === 'free') {
        this.queueStateSync();
      }
    });

    document.addEventListener('pointerdown', (e) => {
      const clickInsideScreen = DOM.mockScreen.contains(e.target);
      const clickInsideDimModal = !DOM.dimModal.classList.contains('hidden') && DOM.dimModalCard.contains(e.target);
      if (!clickInsideScreen && !clickInsideDimModal) {
        this.setFrameFocus(false);
      }
    });

    document.addEventListener('keydown', (e) => {
      if (!DOM.dimModal.classList.contains('hidden')) {
        if (e.key === 'Escape') {
          this.closeDimModal();
        }
        return;
      }

      if (this.gallery.isOpen) {
        if (e.key === 'Escape') this.gallery.close();
        return;
      }

      const tagName = e.target && e.target.tagName ? e.target.tagName.toLowerCase() : '';
      if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
        if (e.key === 'Escape') e.target.blur();
        return;
      }

      if (this.frameFocused) {
        if (e.key === 'Escape') {
          this.setFrameFocus(false);
          window.focus();
        }
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'arrowright': {
          const next = this.manifest.getNextIndex();
          if (next !== null) this.loadDesign(next);
          break;
        }
        case 'arrowleft': {
          const prev = this.manifest.getPrevIndex();
          if (prev !== null) this.loadDesign(prev);
          break;
        }
        case 'g':
          this.gallery.toggle();
          break;
        case 'r':
          this.refreshFrame();
          break;
        case 'd':
          DOM.themeBtn.click();
          break;
        default:
          break;
      }
    });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.viewerApp = new App();
});
