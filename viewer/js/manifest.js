export class ManifestManager {
  constructor() {
    this.entries = [];
    this.currentIndex = -1;
  }

  normalizePath(filePath) {
    return decodeURIComponent(String(filePath || ''))
      .split('?')[0]
      .split('#')[0]
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')
      .trim();
  }

  normalizeEntry(item) {
    if (!item || typeof item !== 'object') return null;

    const index = Number(item.index);
    const filePath = this.normalizePath(item.filePath);
    if (!Number.isInteger(index) || !filePath) return null;

    const title = typeof item.title === 'string' ? item.title.trim() : '';
    const description = typeof item.description === 'string' ? item.description.trim() : '';

    return {
      index,
      title: title || `Design ${index}`,
      description,
      filePath
    };
  }

  dispatchAlert(message) {
    document.dispatchEvent(new CustomEvent('dev-alert', { detail: message }));
  }

  async loadManifest() {
    try {
      const res = await fetch('/api/manifest', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const raw = await res.text();
      let data = [];

      try {
        data = JSON.parse(raw);
      } catch (e) {
        throw new Error(`Invalid JSON: ${e.message}`);
      }

      if (!Array.isArray(data)) {
        throw new Error('Manifest must be a JSON array.');
      }

      const seen = new Set();
      const duplicates = [];
      const normalized = [];

      for (const item of data) {
        const entry = this.normalizeEntry(item);
        if (!entry) continue;

        if (seen.has(entry.index)) {
          duplicates.push(entry.index);
          continue;
        }

        seen.add(entry.index);
        normalized.push(entry);
      }

      normalized.sort((a, b) => a.index - b.index);

      this.entries = normalized;

      if (duplicates.length > 0) {
        const values = Array.from(new Set(duplicates)).join(', ');
        this.dispatchAlert(`Duplicate index detected and ignored: ${values}`);
      }

      if (this.entries.length === 0) {
        this.currentIndex = -1;
        return false;
      }

      if (this.currentIndex !== -1 && !this.hasIndex(this.currentIndex)) {
        this.currentIndex = -1;
      }

      return true;
    } catch (e) {
      this.entries = [];
      this.currentIndex = -1;
      this.dispatchAlert(`Manifest Error: ${e.message}`);
      return false;
    }
  }

  getEntries() {
    return this.entries;
  }

  hasIndex(index) {
    return this.entries.some((e) => e.index === index);
  }

  setCurrentIndex(index) {
    if (this.hasIndex(index)) {
      this.currentIndex = index;
      return true;
    }
    return false;
  }

  getCurrentEntry() {
    return this.entries.find((e) => e.index === this.currentIndex) || null;
  }

  getNextIndex(fromIndex = this.currentIndex) {
    if (this.entries.length === 0) return null;

    const source = Number.isInteger(fromIndex) ? fromIndex : this.currentIndex;
    if (source === -1) return this.entries[0].index;

    const next = this.entries.find((e) => e.index > source);
    return next ? next.index : null;
  }

  getPrevIndex(fromIndex = this.currentIndex) {
    if (this.entries.length === 0) return null;

    const source = Number.isInteger(fromIndex) ? fromIndex : this.currentIndex;
    if (source === -1) return this.entries[0].index;

    const reversed = [...this.entries].reverse();
    const prev = reversed.find((e) => e.index < source);
    return prev ? prev.index : null;
  }

  getClosestIndex(referenceIndex, options = {}) {
    if (this.entries.length === 0) return null;

    const excludeReference = Boolean(options.excludeReference);
    const preferForward = options.preferForward !== false;
    const ref = Number(referenceIndex);

    if (!Number.isFinite(ref)) {
      return this.entries[0].index;
    }

    if (!excludeReference && this.hasIndex(ref)) {
      return ref;
    }

    const candidates = this.entries
      .map((e) => e.index)
      .filter((idx) => !(excludeReference && idx === ref));

    if (candidates.length === 0) return null;

    candidates.sort((a, b) => {
      const diffA = Math.abs(a - ref);
      const diffB = Math.abs(b - ref);

      if (diffA !== diffB) return diffA - diffB;

      if (preferForward) {
        const aIsForward = a >= ref ? 0 : 1;
        const bIsForward = b >= ref ? 0 : 1;
        if (aIsForward !== bIsForward) return aIsForward - bIsForward;
      } else {
        const aIsBackward = a <= ref ? 0 : 1;
        const bIsBackward = b <= ref ? 0 : 1;
        if (aIsBackward !== bIsBackward) return aIsBackward - bIsBackward;
      }

      return a - b;
    });

    return candidates[0];
  }

  findIndexByFilePath(filePath) {
    const normalized = this.normalizePath(filePath);
    if (!normalized) return null;

    const found = this.entries.find((e) => this.normalizePath(e.filePath) === normalized);
    return found ? found.index : null;
  }
}
