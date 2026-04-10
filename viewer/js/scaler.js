/**
 * Viewport Scaling Engine
 * Calculates bounds, padding, and handles 'Shrink to Fit' logic
 */

export class Scaler {
    constructor(wrapper, screen) {
        this.wrapper = wrapper;
        this.screen = screen;
        
        // Configuration
        this.padding = 40; // 40px safe area
        
        // Listeners for auto-adjust
        window.addEventListener('resize', () => this.rescale());
    }

    /**
     * Re-calculates and applies the optimal scale factor
     */
    rescale() {
        if (!this.wrapper || !this.screen) return;

        // 1. Get available space
        const availRect = this.wrapper.getBoundingClientRect();
        const availW = availRect.width - (this.padding * 2);
        const availH = availRect.height - (this.padding * 2);

        // 2. Get target design size (the raw pixel w/h set on the mock screen)
        // Ensure we parse out 'px' 
        const targetW = parseFloat(this.screen.style.width) || this.screen.offsetWidth || 375;
        const targetH = parseFloat(this.screen.style.height) || this.screen.offsetHeight || 812;

        if (availW <= 0 || availH <= 0 || targetW === 0 || targetH === 0) return;

        // 3. Compute ratio
        const scaleW = availW / targetW;
        const scaleH = availH / targetH;
        
        // Use the smallest scale factor so it fits completely within bounds
        // If both scale factors are > 1, the design is smaller than available space
        let scaleFactor = Math.min(scaleW, scaleH);
        
        // Wait, requirements say "Zoom to Fill: If the design is smaller than the available space, it scales up to ensure the developer can see detail."
        // And "Shrink to fit". So Math.min covers both scenarios perfectly (always scale to max edge).
        
        // Apply
        this.screen.style.transform = `scale(${scaleFactor})`;
    }
}
