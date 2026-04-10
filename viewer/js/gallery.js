/**
 * Visual Gallery Manager
 * Handles the index grid, searching, and thumbnail lazy-loading
 */

export class Gallery {
    constructor(manifestManager, onSelectCallback) {
        this.manifest = manifestManager;
        this.onSelect = onSelectCallback;
        
        // DOM
        this.el = document.getElementById('gallery');
        this.grid = document.getElementById('gallery-grid');
        this.searchInput = document.getElementById('gallery-search-input');
        this.btnOpen = document.getElementById('btn-gallery');
        this.btnClose = document.getElementById('btn-gallery-close');
        
        this.isOpen = false;
        
        this.init();
    }

    init() {
        if (!this.el) return;
        
        // Listeners for Opening/Closing
        this.btnOpen.addEventListener('click', () => this.open());
        this.btnClose.addEventListener('click', () => this.close());
        
        // Search
        this.searchInput.addEventListener('input', (e) => this.filter(e.target.value));
        
        // Background click to close
        this.el.addEventListener('click', (e) => {
            if (e.target === this.el) this.close();
        });
    }

    open() {
        this.isOpen = true;
        this.el.classList.remove('hidden');
        this.render();
        this.searchInput.focus();
    }

    close() {
        this.isOpen = false;
        this.el.classList.add('hidden');
        this.searchInput.value = '';
    }

    toggle() {
        if (this.isOpen) this.close();
        else this.open();
    }

    render() {
        this.grid.innerHTML = '';
        const entries = this.manifest.getEntries();
        const current = this.manifest.getCurrentEntry();
        
        if (entries.length === 0) {
            this.grid.innerHTML = `<div class="gallery-empty">No designs found in manifest</div>`;
            return;
        }

        entries.forEach(entry => {
            const isActive = current && current.index === entry.index;
            
            // Build card element
            const card = document.createElement('div');
            card.className = `gallery-item ${isActive ? 'active' : ''}`;
            card.dataset.index = entry.index;
            card.dataset.search = `${entry.index} ${entry.title} ${entry.description}`.toLowerCase();
            
            // Safe descriptions
            const desc = entry.description ? entry.description : 'No description provided';
            
            card.innerHTML = `
                <div class="gallery-thumb">
                    <span class="gallery-badge">#${entry.index}</span>
                    <div class="gallery-thumb-wrapper">
                        <!-- We use loading="lazy" and point the src to the local file for a live proxy -->
                        <iframe src="/${entry.filePath}" loading="lazy" scrolling="no" tabindex="-1"></iframe>
                        <div class="shield"></div>
                    </div>
                </div>
                <div class="gallery-meta">
                    <h3>${entry.title || `Design ${entry.index}`}</h3>
                    <p title="${desc}">${desc}</p>
                </div>
            `;
            
            card.addEventListener('click', () => {
                this.onSelect(entry.index);
                this.close();
            });
            
            this.grid.appendChild(card);
        });
    }

    filter(term) {
        term = term.toLowerCase().trim();
        const cards = this.grid.querySelectorAll('.gallery-item');
        
        cards.forEach(card => {
            if (card.dataset.search.includes(term)) {
                card.style.display = 'flex';
            } else {
                card.style.display = 'none';
            }
        });
    }
}
