/**
 * Theme Manager Hub
 * Handles the viewer theme and propagating it down to the mock screen iframe
 */

export class ThemeManager {
    constructor(themeBtn, iframe) {
        this.btn = themeBtn;
        this.iframe = iframe;
        this.html = document.documentElement;
        
        this.init();
    }

    init() {
        if (!this.btn || !this.iframe) return;

        // Listen for standard toggle
        this.btn.addEventListener('click', () => {
            const current = this.html.getAttribute('data-viewer-theme');
            const next = current === 'dark' ? 'light' : 'dark';
            this.setTheme(next);
        });

        // Ensure theme propagates when iframe navigates or reloads
        this.iframe.addEventListener('load', () => this.propagateTheme());
        
        // Initial setup
        this.propagateTheme();
    }

    setTheme(theme) {
        this.html.setAttribute('data-viewer-theme', theme);
        this.propagateTheme();
    }

    propagateTheme() {
        const theme = this.html.getAttribute('data-viewer-theme');
        
        try {
            // Attempt direct DOM mutation (works if same origin)
            if (this.iframe.contentWindow && this.iframe.contentDocument) {
                this.iframe.contentDocument.documentElement.setAttribute('data-viewer-theme', theme);
            }
            
            // PostMessage explicitly per requirements to support Cross Origin or robust bindings
            this.iframe.contentWindow.postMessage({
                type: 'THEME_CHANGE',
                theme: theme
            }, '*');
        } catch (e) {
            // Ignore Cross-Origin DOM blocks if they occur, postMessage still fires
        }
    }
}
