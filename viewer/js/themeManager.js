export class ThemeManager {
  constructor(themeBtn, iframe, onThemeChange = null) {
    this.btn = themeBtn;
    this.iframe = iframe;
    this.html = document.documentElement;
    this.onThemeChange = onThemeChange;

    this.init();
  }

  init() {
    if (!this.btn || !this.iframe) return;

    this.btn.addEventListener('click', () => {
      const current = this.getTheme();
      const next = current === 'dark' ? 'light' : 'dark';
      this.setTheme(next);
    });

    this.iframe.addEventListener('load', () => this.propagateTheme());
    this.propagateTheme();
  }

  getTheme() {
    const val = this.html.getAttribute('data-viewer-theme');
    return val === 'light' ? 'light' : 'dark';
  }

  setTheme(theme, options = {}) {
    const next = theme === 'light' ? 'light' : 'dark';
    this.html.setAttribute('data-viewer-theme', next);
    this.propagateTheme();

    if (options.silent !== true && typeof this.onThemeChange === 'function') {
      this.onThemeChange(next);
    }
  }

  propagateTheme() {
    const theme = this.getTheme();

    try {
      if (this.iframe.contentDocument && this.iframe.contentDocument.documentElement) {
        this.iframe.contentDocument.documentElement.setAttribute('data-viewer-theme', theme);
      }
    } catch (e) {
    }

    try {
      if (this.iframe.contentWindow) {
        this.iframe.contentWindow.postMessage(
          {
            type: 'THEME_CHANGE',
            theme
          },
          '*'
        );
      }
    } catch (e) {
    }
  }
}
