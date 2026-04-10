import { ManifestManager } from './manifest.js';
import { Scaler } from './scaler.js';
import { ResizeEngine } from './resizeEngine.js';
import { Gallery } from './gallery.js';
import { SocketClient } from './socketClient.js';
import { ThemeManager } from './themeManager.js';
import { StateManager } from './stateManager.js';

// DOM Elements
const DOM = {
    wizard: document.getElementById('setup-wizard'),
    iframe: document.getElementById('design-frame'),
    navCount: document.getElementById('nav-count'),
    navTitle: document.getElementById('nav-title'),
    btnPrev: document.getElementById('btn-prev'),
    btnNext: document.getElementById('btn-next'),
    btnRefresh: document.getElementById('btn-refresh'),
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
        this.gallery = new Gallery(this.manifest, (index) => this.loadDesign(index));
        
        // Theme & State
        this.themeManager = new ThemeManager(DOM.themeBtn, DOM.iframe);
        this.stateManager = new StateManager(this, DOM.iframe, DOM.alert);
        
        // Setup Live Reload handling
        this.socketClient = new SocketClient(
            this.manifest,
            () => this.onManifestChange(),
            (filePath) => this.onFileChange(filePath)
        );
        
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
            
            // Load Iframe - append timestamp to beat browser caching during live-reload
            const url = new URL(`/${entry.filePath}`, window.location.origin);
            url.searchParams.set('cache', Date.now());
            DOM.iframe.src = url.toString();
            
            this.updateNavButtons();
            
            // Update URL
            if (this.stateManager) {
                this.stateManager.updateUrlParams(index);
            }
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
    
    refreshFrame() {
        const entry = this.manifest.getCurrentEntry();
        if (entry) {
            this.loadDesign(entry.index);
        }
    }

    onManifestChange() {
        // Redraw gallery if open
        if (this.gallery.isOpen) this.gallery.render();
        
        // Update nav buttons
        this.updateNavButtons();
        
        // Hide wizard if we now have items
        if (this.manifest.getEntries().length > 0) {
            DOM.wizard.classList.add('hidden');
            if (this.manifest.currentIndex === -1) {
                this.loadDesign(this.manifest.getEntries()[0].index);
            }
        } else {
            this.showWizard();
        }
    }

    onFileChange(filePath) {
        // Check if the current frame is displaying this file
        const current = this.manifest.getCurrentEntry();
        
        // filePath from server is absolute relative to design dir e.g., '/login.html'
        // current.filePath might be 'login.html'. Let's normalize both to start with '/'
        if (current) {
            const normalizedCurrent = '/' + current.filePath.replace(/^\//, '');
            const normalizedChanged = '/' + filePath.replace(/^\//, '');
            
            if (normalizedCurrent === normalizedChanged) {
                this.refreshFrame();
            }
        }
        
        // Always refresh gallery since it has thumbnails
        if (this.gallery.isOpen) {
            this.gallery.render();
        }
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
        
        // Refresh
        DOM.btnRefresh.addEventListener('click', () => this.refreshFrame());

        // Theme logic is now delegated to ThemeManager
        
        // Keyboard Shortcuts
        document.addEventListener('keydown', (e) => {
            // Ignore if user is typing in an input (like gallery search)
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                if (e.key === 'Escape') {
                    e.target.blur();
                    if (this.gallery.isOpen) this.gallery.close();
                }
                return;
            }

            switch(e.key.toLowerCase()) {
                case 'arrowright':
                    const next = this.manifest.getNextIndex();
                    if (next !== null) this.loadDesign(next);
                    break;
                case 'arrowleft':
                    const prev = this.manifest.getPrevIndex();
                    if (prev !== null) this.loadDesign(prev);
                    break;
                case 'g':
                    this.gallery.toggle();
                    break;
                case 'r':
                    this.refreshFrame();
                    break;
                case 'd':
                    DOM.themeBtn.click(); // Redirects to ThemeManager
                    break;
                case 'escape':
                    if (this.gallery.isOpen) {
                        this.gallery.close();
                    }
                    break;
            }
        });
    }
}

// Boot
window.addEventListener('DOMContentLoaded', () => {
    window.viewerApp = new App();
});



