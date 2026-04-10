export class ResizeEngine {
  constructor(screen, scaler, badge, ratioSelect, onChange = null) {
    this.screen = screen;
    this.scaler = scaler;
    this.badgeDom = badge;
    this.ratioSelect = ratioSelect;
    this.onChange = onChange;
    this.shield = document.getElementById('overlay-shield');

    this.isResizing = false;
    this.startX = 0;
    this.startY = 0;
    this.startWidth = 0;
    this.startHeight = 0;
    this.activeHandle = null;

    this.minWidth = 240;
    this.minHeight = 240;
    this.snapIncrement = 10;

    this.initHandles();
    this.initPresetSelect();

    const dims = this.getDimensions();
    this.updateBadge(dims.width, dims.height);
  }

  initHandles() {
    const handles = this.screen.querySelectorAll('.resize-handle');

    handles.forEach((handle) => {
      handle.addEventListener('pointerdown', (e) => this.dragStart(e, handle));
    });

    document.addEventListener('pointermove', (e) => this.dragMove(e));
    document.addEventListener('pointerup', () => this.dragEnd());
    document.addEventListener('pointercancel', () => this.dragEnd());
  }

  initPresetSelect() {
    if (!this.ratioSelect) return;

    this.ratioSelect.addEventListener('change', (e) => {
      const val = String(e.target.value || 'free');
      if (val === 'free') {
        const dims = this.getDimensions();
        this.emitChange(dims.width, dims.height);
        return;
      }
      this.setFromRatio(val);
    });
  }

  getDimensions() {
    const width = Math.round(parseFloat(this.screen.style.width) || this.screen.offsetWidth || 375);
    const height = Math.round(parseFloat(this.screen.style.height) || this.screen.offsetHeight || 812);
    return { width, height };
  }

  getScaleFactor() {
    const transform = window.getComputedStyle(this.screen).transform;
    if (!transform || transform === 'none') return 1;

    if (transform.startsWith('matrix3d(')) {
      const values = transform.slice(9, -1).split(',').map((v) => Number.parseFloat(v.trim()));
      return Number.isFinite(values[0]) && values[0] > 0 ? values[0] : 1;
    }

    if (transform.startsWith('matrix(')) {
      const values = transform.slice(7, -1).split(',').map((v) => Number.parseFloat(v.trim()));
      return Number.isFinite(values[0]) && values[0] > 0 ? values[0] : 1;
    }

    return 1;
  }

  dragStart(e, handle) {
    if (window.matchMedia('(max-width: 768px)').matches) return;

    if (handle.classList.contains('handle-r')) this.activeHandle = 'r';
    if (handle.classList.contains('handle-b')) this.activeHandle = 'b';
    if (handle.classList.contains('handle-br')) this.activeHandle = 'br';
    if (!this.activeHandle) return;

    e.preventDefault();

    const dims = this.getDimensions();

    this.isResizing = true;
    this.startX = e.clientX;
    this.startY = e.clientY;
    this.startWidth = dims.width;
    this.startHeight = dims.height;

    this.screen.classList.add('is-resizing');
    this.shield.classList.remove('hidden');
    this.shield.classList.add('active');
    document.body.style.userSelect = '';

    if (this.ratioSelect) this.ratioSelect.value = 'free';
  }

  dragMove(e) {
    if (!this.isResizing) return;

    const scale = this.getScaleFactor();
    const deltaX = (e.clientX - this.startX) / scale;
    const deltaY = (e.clientY - this.startY) / scale;

    let nextW = this.startWidth;
    let nextH = this.startHeight;

    if (this.activeHandle === 'r' || this.activeHandle === 'br') {
      nextW += deltaX;
    }

    if (this.activeHandle === 'b' || this.activeHandle === 'br') {
      nextH += deltaY;
    }

    if (!e.shiftKey) {
      nextW = Math.round(nextW / this.snapIncrement) * this.snapIncrement;
      nextH = Math.round(nextH / this.snapIncrement) * this.snapIncrement;
    }

    this.setDimensions(nextW, nextH);
  }

  dragEnd() {
    if (!this.isResizing) return;

    this.isResizing = false;
    this.activeHandle = null;

    this.screen.classList.remove('is-resizing');
    this.shield.classList.remove('active');
    this.shield.classList.add('hidden');
    document.body.style.userSelect = '';
  }

  setFromRatio(value, options = {}) {
    const [wRaw, hRaw] = String(value).split('x');
    const width = Number.parseInt(wRaw, 10);
    const height = Number.parseInt(hRaw, 10);

    if (!Number.isFinite(width) || !Number.isFinite(height)) {
      return false;
    }

    if (this.ratioSelect) {
      this.ratioSelect.value = value;
    }

    this.setDimensions(width, height, options);
    return true;
  }

  setDimensions(width, height, options = {}) {
    const w = Math.max(this.minWidth, Math.round(width));
    const h = Math.max(this.minHeight, Math.round(height));

    this.screen.style.width = `${w}px`;
    this.screen.style.height = `${h}px`;

    this.updateBadge(w, h);

    if (this.scaler && options.skipRescale !== true) {
      this.scaler.rescale();
    }

    if (options.silent !== true) {
      this.emitChange(w, h);
    }
  }

  updateBadge(width, height) {
    if (this.badgeDom) {
      this.badgeDom.textContent = `${Math.round(width)} x ${Math.round(height)}`;
    }
  }

  emitChange(width, height) {
    if (typeof this.onChange === 'function') {
      this.onChange({
        width: Math.round(width),
        height: Math.round(height),
        ratio: this.ratioSelect ? this.ratioSelect.value : 'free'
      });
    }
  }
}
