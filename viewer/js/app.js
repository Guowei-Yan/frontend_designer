import { ManifestManager } from './manifest.js';
import { Scaler } from './scaler.js';
import { ResizeEngine } from './resizeEngine.js';

// DOM Elements
const DOM = {
    wizard: document.getElementById('setup-wizard'),
    iframe: document.getElementById('design-frame'),
    navCount: document.getElementById('nav-count'),
    navTitle: document.getElementById('nav-title'),
    btnPrev: document.getElementById('btn-prev'),
    btnNext: document.getElementById('btn-next'),
    alert: document.getElementById('dev-alert'),
    themeBtn: document.getElementById('btn-theme'),
    mockWrapper: document.getElementById('mock-screen-wrapper'),
    mockScreen: document.getElementById('mock-screen'),
    ratioSelect: document.getElementById('select-ratio'),
    badge: document.getElementById('badge-dimensions')
};

class App {
    constructor() {
        this.manifest = new ManifestManager();
        this.scaler = new Scaler(DOM.mockWrapper, DOM.mockScreen);
        this.resizeEngine = new ResizeEngine(DOM.mockScreen, this.scaler, DOM.badge, DOM.ratioSelect);
        this.init();
    }

    async init() {
        this.setupEventListeners();
        // Initial scale
        setTimeout(() => this.scaler.rescale(), 50);

        
        const hasManifest = await this.manifest.loadManifest();
        if (!hasManifest) {
            this.showWizard();
            return;
        }

        DOM.wizard.classList.add('hidden');
        
        // Start at index 1 or the lowest available
        const entries = this.manifest.getEntries();
        if (entries.length > 0) {
            this.loadDesign(entries[0].index);
        }
    }

    showWizard() {
        DOM.wizard.classList.remove('hidden');
        DOM.navTitle.textContent = "No Manifest";
        DOM.navCount.textContent = "- / -";
    }

    loadDesign(index) {
        if (this.manifest.setCurrentIndex(index)) {
            const entry = this.manifest.getCurrentEntry();
            
            // Update UI
            const entries = this.manifest.getEntries();
            const pos = entries.findIndex(e => e.index === index) + 1;
            DOM.navCount.textContent = `${pos} / ${entries.length}`;
            DOM.navTitle.textContent = entry.title || `Design ${index}`;
            
            // Load Iframe
            DOM.iframe.src = `/${entry.filePath}`;
            
            this.updateNavButtons();
        }
    }

    updateNavButtons() {
        DOM.btnPrev.disabled = this.manifest.getPrevIndex() === null;
        DOM.btnNext.disabled = this.manifest.getNextIndex() === null;
    }

    showDevAlert(msg) {
        DOM.alert.textContent = msg;
        DOM.alert.classList.remove('hidden');
        setTimeout(() => DOM.alert.classList.add('hidden'), 4000);
    }

    setupEventListeners() {
        // Dev Alert System
        document.addEventListener('dev-alert', (e) => this.showDevAlert(e.detail));

        // Navigation
        DOM.btnPrev.addEventListener('click', () => {
            const prev = this.manifest.getPrevIndex();
            if (prev !== null) this.loadDesign(prev);
        });

        DOM.btnNext.addEventListener('click', () => {
            const next = this.manifest.getNextIndex();
            if (next !== null) this.loadDesign(next);
        });

        // Basic Theme Toggle (Shell level)
        DOM.themeBtn.addEventListener('click', () => {
            const html = document.documentElement;
            const current = html.getAttribute('data-viewer-theme');
            html.setAttribute('data-viewer-theme', current === 'dark' ? 'light' : 'dark');
        });
    }
}

// Boot
window.addEventListener('DOMContentLoaded', () => {
    window.viewerApp = new App();
});
