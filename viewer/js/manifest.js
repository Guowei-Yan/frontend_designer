/**
 * Manifest Manager
 * Handles fetching, parsing, and verifying the manifest.json
 */

export class ManifestManager {
    constructor() {
        this.entries = [];
        this.currentIndex = -1;
    }

    /**
     * Fetches the manifest from the server API
     * @returns {Promise<boolean>} True if loaded successfully and has items
     */
    async loadManifest() {
        try {
            const res = await fetch('/api/manifest');
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            
            const data = await res.json();
            
            if (!Array.isArray(data) || data.length === 0) {
                return false; // Empty state
            }
            
            // Sort by index
            this.entries = data.sort((a, b) => a.index - b.index);
            return true;
        } catch (e) {
            console.error('Failed to load manifest:', e);
            document.dispatchEvent(new CustomEvent('dev-alert', { 
                detail: `Manifest Error: ${e.message}` 
            }));
            return false;
        }
    }

    getEntries() {
        return this.entries;
    }

    getCurrentEntry() {
        return this.entries.find(e => e.index === this.currentIndex) || null;
    }

    setCurrentIndex(index) {
        if (this.entries.some(e => e.index === index)) {
            this.currentIndex = index;
            return true;
        }
        return false;
    }

    getNextIndex() {
        if (this.entries.length === 0) return null;
        if (this.currentIndex === -1) return this.entries[0].index;
        
        const next = this.entries.find(e => e.index > this.currentIndex);
        return next ? next.index : null;
    }

    getPrevIndex() {
        if (this.entries.length === 0) return null;
        if (this.currentIndex === -1) return this.entries[0].index;
        
        // Reverse array to find closest smaller index
        const reversed = [...this.entries].reverse();
        const prev = reversed.find(e => e.index < this.currentIndex);
        return prev ? prev.index : null;
    }
}
