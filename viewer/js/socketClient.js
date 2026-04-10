/**
 * WebSocket Client Hook
 * Connects to the local server to receive file change events for hot-reloading
 */

export class SocketClient {
    constructor(manifestManager, onManifestChange, onFileChange) {
        this.manifest = manifestManager;
        this.onManifestChange = onManifestChange;
        this.onFileChange = onFileChange;
        
        this.connect();
    }

    connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        
        console.log('[Design-View] Connecting to Livereload...', wsUrl);
        this.ws = new WebSocket(wsUrl);

        this.ws.onmessage = async (event) => {
            try {
                const data = JSON.parse(event.data);
                
                if (data.type === 'MANIFEST_CHANGE') {
                    console.log('[Design-View] Manifest changed on disk, refreshing...');
                    await this.manifest.loadManifest(); // Sync new internal state
                    this.onManifestChange();
                } 
                else if (data.type === 'FILE_CHANGE' && data.filePath) {
                    console.log(`[Design-View] File changed on disk: ${data.filePath}`);
                    this.onFileChange(data.filePath);
                }
            } catch (e) {
                console.error('[Design-View] Error parsing WebSocket message:', e);
            }
        };

        this.ws.onclose = () => {
            console.log('[Design-View] Lost connection to server. Retrying in 2s...');
            setTimeout(() => this.connect(), 2000);
        };
    }
}
