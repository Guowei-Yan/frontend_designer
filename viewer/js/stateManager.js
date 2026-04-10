export class StateManager {
  constructor(appInstance, iframe, alertUi) {
    this.app = appInstance;
    this.iframe = iframe;
    this.alertUi = alertUi;

    this.init();
  }

  init() {
    if (!this.iframe) return;
    this.iframe.addEventListener('load', () => this.onIframeLoad());
  }

  getUrlState() {
    const url = new URL(window.location.href);

    const pageRaw = url.searchParams.get('p');
    const ratioRaw = url.searchParams.get('ratio');
    const wRaw = url.searchParams.get('w');
    const hRaw = url.searchParams.get('h');
    const themeRaw = url.searchParams.get('theme');

    const page = Number.parseInt(pageRaw, 10);
    const width = Number.parseInt(wRaw, 10);
    const height = Number.parseInt(hRaw, 10);

    const ratio = ratioRaw ? ratioRaw.trim() : null;
    const theme = themeRaw === 'light' || themeRaw === 'dark' ? themeRaw : null;

    return {
      page: Number.isInteger(page) ? page : null,
      ratio,
      width: Number.isInteger(width) ? width : null,
      height: Number.isInteger(height) ? height : null,
      theme
    };
  }

  updateUrlState(state) {
    const url = new URL(window.location.href);

    if (Number.isInteger(state.page)) url.searchParams.set('p', String(state.page));
    else url.searchParams.delete('p');

    if (typeof state.ratio === 'string' && state.ratio.length > 0) url.searchParams.set('ratio', state.ratio);
    else url.searchParams.delete('ratio');

    if (Number.isFinite(state.width)) url.searchParams.set('w', String(Math.round(state.width)));
    else url.searchParams.delete('w');

    if (Number.isFinite(state.height)) url.searchParams.set('h', String(Math.round(state.height)));
    else url.searchParams.delete('h');

    if (state.theme === 'light' || state.theme === 'dark') url.searchParams.set('theme', state.theme);
    else url.searchParams.delete('theme');

    window.history.replaceState({}, '', url.toString());
  }

  normalizePath(filePath) {
    return decodeURIComponent(String(filePath || ''))
      .split('?')[0]
      .split('#')[0]
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')
      .trim();
  }

  onIframeLoad() {
    try {
      const doc = this.iframe.contentDocument;
      const win = this.iframe.contentWindow;
      if (!doc || !win) return;

      const bodyText = (doc.body?.textContent || '').trim();
      if (bodyText.startsWith('File not found:')) {
        this.handleGhostFile();
        return;
      }

      doc.addEventListener(
        'pointerdown',
        () => {
          this.app.setFrameFocus(true);
        },
        true
      );

      this.bindJumpProtocol(doc);
      this.bindAnchorProtocol(doc, win);
    } catch (e) {
    }
  }

  bindJumpProtocol(doc) {
    doc.addEventListener(
      'click',
      (e) => {
        const target = e.target.closest('[data-jump-to]');
        if (!target) return;

        e.preventDefault();

        const targetIndex = Number.parseInt(target.getAttribute('data-jump-to'), 10);
        if (!Number.isInteger(targetIndex)) return;

        if (targetIndex === this.app.manifest.currentIndex) {
          this.app.refreshFrame();
          return;
        }

        this.app.loadDesign(targetIndex);
      },
      true
    );
  }

  bindAnchorProtocol(doc, win) {
    doc.addEventListener(
      'click',
      (e) => {
        if (e.defaultPrevented) return;

        const anchor = e.target.closest('a[href]');
        if (!anchor) return;

        if (anchor.hasAttribute('download')) return;

        const rawHref = (anchor.getAttribute('href') || '').trim();
        if (!rawHref) return;
        if (rawHref.startsWith('#')) return;
        if (rawHref.toLowerCase().startsWith('javascript:')) return;

        let resolved;
        try {
          resolved = new URL(rawHref, win.location.href);
        } catch (err) {
          return;
        }

        if (resolved.protocol === 'mailto:' || resolved.protocol === 'tel:') {
          return;
        }

        if (resolved.origin !== window.location.origin) {
          e.preventDefault();
          window.open(resolved.toString(), '_blank', 'noopener,noreferrer');
          return;
        }

        const filePath = this.normalizePath(resolved.pathname);
        const matchingIndex = this.app.manifest.findIndexByFilePath(filePath);

        if (matchingIndex !== null) {
          e.preventDefault();
          this.app.loadDesign(matchingIndex);
        }
      },
      true
    );
  }

  handleGhostFile() {
    const current = this.app.manifest.getCurrentEntry();
    const expected = current ? current.filePath : 'unknown file';
    this.app.showDevAlert(`Ghost File: Could not locate /${expected}`);

    if (!this.iframe.contentDocument) return;

    this.iframe.contentDocument.body.innerHTML = `
      <div style="font-family: Inter, system-ui, sans-serif; display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:100vh; background:#fee2e2; color:#991b1b; text-align:center; padding:24px;">
        <h1 style="margin:0 0 12px 0;">File Not Found</h1>
        <p style="margin:0 0 24px 0;">Expected file at: <code>/${expected}</code></p>
        <button id="skip-btn" style="padding:12px 20px; background:#ef4444; color:#fff; border:none; border-radius:8px; cursor:pointer;">Ignore and Skip</button>
      </div>
    `;

    const btn = this.iframe.contentDocument.getElementById('skip-btn');
    if (!btn) return;

    btn.addEventListener('click', () => {
      const currentIndex = current ? current.index : this.app.manifest.currentIndex;
      const next = this.app.manifest.getNextIndex(currentIndex);
      const prev = this.app.manifest.getPrevIndex(currentIndex);
      const target = next ?? prev;

      if (target !== null) {
        this.app.loadDesign(target);
      } else {
        this.app.showDevAlert('No other valid pages to navigate to.');
      }
    });
  }
}
