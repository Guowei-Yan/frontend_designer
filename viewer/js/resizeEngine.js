/**
 * Drag and Snap Resizing Engine
 * Manages the overlay shield, drag handles, and aspect ratio snapping
 */

export class ResizeEngine {
    constructor(screen, scaler, badge, ratioSelect) {
        this.screen = screen;
        this.scaler = scaler;
        this.badgeDom = badge;
        this.ratioSelect = ratioSelect;
        this.shield = document.getElementById('overlay-shield');
        
        // State
        this.isResizing = false;
        this.startX = 0;
        this.startY = 0;
        this.startWidth = 0;
        this.startHeight = 0;
        this.activeHandle = null;
        
        // Constants
        this.SNAP_INCREMENT = 10;
        
        this.initHandles();
        this.initPresetSelect();
        
        // Initial badge update
        this.updateBadge(this.screen.offsetWidth, this.screen.offsetHeight);
    }

    initHandles() {
        const handles = this.screen.querySelectorAll('.resize-handle');
        
        handles.forEach(handle => {
            handle.addEventListener('mousedown', (e) => this.dragStart(e, handle));
        });

        // Global listeners for dragging
        document.addEventListener('mousemove', (e) => this.dragMove(e));
        document.addEventListener('mouseup', () => this.dragEnd());
    }

    initPresetSelect() {
        if (!this.ratioSelect) return;
        
        this.ratioSelect.addEventListener('change', (e) => {
            const val = e.target.value;
            if (val && val !== 'free') {
                const [w, h] = val.split('x').map(Number);
                this.setDimensions(w, h);
            }
        });
    }

    dragStart(e, handle) {
        e.preventDefault();
        
        // Determine handle type based on class
        if (handle.classList.contains('handle-r')) this.activeHandle = 'r';
        else if (handle.classList.contains('handle-b')) this.activeHandle = 'b';
        else if (handle.classList.contains('handle-br')) this.activeHandle = 'br';
        
        this.isResizing = true;
        this.startX = e.clientX;
        this.startY = e.clientY;
        
        // Compute starting dimensions ignoring scale
        this.startWidth = this.screen.offsetWidth;
        this.startHeight = this.screen.offsetHeight;
        
        // Visuals
        this.screen.classList.add('is-resizing');
        this.shield.classList.remove('hidden');
        this.shield.classList.add('active');
        
        // Reset preset selector to free mode
        if (this.ratioSelect) this.ratioSelect.value = 'free';
    }

    dragMove(e) {
        if (!this.isResizing) return;
        
        // The mouse movement needs to be independent of scale factor,
        // but since we are modifying the unscaled CSS width/height, 
        // dragging while scaled causes the mouse to move "faster" than the element edge.
        // To fix this, we must divide the delta by the current scale factor.
        
        const style = window.getComputedStyle(this.screen);
        const matrixFn = style.transform || style.webkitTransform || style.mozTransform;
        let scale = 1;
        
        if (matrixFn !== 'none') {
            const values = matrixFn.split('(')[1].split(')')[0].split(',');
            scale = parseFloat(values[0]);
        }
        
        const deltaX = (e.clientX - this.startX) / scale;
        const deltaY = (e.clientY - this.startY) / scale;
        
        let newW = this.startWidth;
        let newH = this.startHeight;
        
        if (this.activeHandle === 'r' || this.activeHandle === 'br') newW += deltaX;
        if (this.activeHandle === 'b' || this.activeHandle === 'br') newH += deltaY;
        
        // Bounds checking
        newW = Math.max(320, newW);
        newH = Math.max(320, newH);
        
        // Snap logic unless Shift is held
        if (!e.shiftKey) {
            newW = Math.round(newW / this.SNAP_INCREMENT) * this.SNAP_INCREMENT;
            newH = Math.round(newH / this.SNAP_INCREMENT) * this.SNAP_INCREMENT;
        }
        
        this.setDimensions(newW, newH);
    }

    dragEnd() {
        if (!this.isResizing) return;
        
        this.isResizing = false;
        this.activeHandle = null;
        
        this.screen.classList.remove('is-resizing');
        this.shield.classList.remove('active');
        this.shield.classList.add('hidden');
    }

    setDimensions(w, h) {
        this.screen.style.width = `${w}px`;
        this.screen.style.height = `${h}px`;
        
        this.updateBadge(w, h);
        
        // Trigger generic rescale so it "shrinks to fit" immediately 
        if (this.scaler) this.scaler.rescale();
    }

    updateBadge(w, h) {
        if (this.badgeDom) {
            // Ensure whole numbers for display
            this.badgeDom.textContent = `${Math.round(w)} x ${Math.round(h)}`;
        }
    }
}
