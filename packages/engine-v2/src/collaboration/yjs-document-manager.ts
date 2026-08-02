import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { IndexeddbPersistence } from 'y-indexeddb';
import { Awareness } from 'y-protocols/awareness.js';
import type { YjsDocumentConfig, CollaborationConfig, YjsDocManagerEvents } from './types.js';

type EventHandler<K extends keyof YjsDocManagerEvents> = YjsDocManagerEvents[K];

export class YjsDocumentManager {
  private docs = new Map<string, Y.Doc>();
  private providers = new Map<string, WebsocketProvider>();
  private persistences = new Map<string, IndexeddbPersistence>();
  private config: CollaborationConfig;
  private eventHandlers = new Map<keyof YjsDocManagerEvents, Set<Function>>();

  constructor(config: Partial<CollaborationConfig> = {}) {
    this.config = {
      yjsServerUrl: config.yjsServerUrl || 'ws://localhost:3000/api/yjs',
      autoConnect: config.autoConnect ?? true,
      reconnectInterval: config.reconnectInterval ?? 3000,
      maxRetries: config.maxRetries ?? 10,
    };
  }

  on<K extends keyof YjsDocManagerEvents>(event: K, handler: EventHandler<K>): () => void {
    const handlers = this.eventHandlers.get(event) || new Set();
    handlers.add(handler);
    this.eventHandlers.set(event, handlers);
    
    return () => this.off(event, handler);
  }

  off<K extends keyof YjsDocManagerEvents>(event: K, handler: EventHandler<K>): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  private emit<K extends keyof YjsDocManagerEvents>(event: K, ...args: Parameters<EventHandler<K>>): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(h => h(...args));
    }
  }

  async getOrCreateDoc(docConfig: YjsDocumentConfig): Promise<Y.Doc> {
    const { docName } = docConfig;
    
    let doc = this.docs.get(docName);
    if (doc) return doc;

    doc = new Y.Doc();
    this.docs.set(docName, doc);

    if (this.config.autoConnect) {
      await this.connect(docConfig);
    }

    this.emit('doc-ready', doc);
    return doc;
  }

  async connect(docConfig: YjsDocumentConfig): Promise<void> {
    const { docName, universeId, sceneId } = docConfig;
    const doc = this.docs.get(docName);
    if (!doc) return;

    // Create WebSocket provider
    const provider = new WebsocketProvider(
      this.config.yjsServerUrl,
      docName,
      doc,
      {
        connect: this.config.autoConnect,
      }
    );

    this.providers.set(docName, provider);

    // Create IndexedDB persistence for offline support
    const persistence = new IndexeddbPersistence(docName, doc);
    this.persistences.set(docName, persistence);

    provider.on('status', (event: { status: string }) => {
      this.emit('connection-change', event.status === 'connected');
    });

    provider.on('sync', (isSynced: boolean) => {
      if (isSynced) {
        console.log(`Yjs doc ${docName} synced`);
      }
    });

    // Awareness for presence
    provider.awareness.on('change', () => {
      this.emit('awareness-change', provider.awareness.getStates());
    });

    try {
      await persistence.whenSynced;
      console.log(`Yjs doc ${docName} loaded from IndexedDB`);
    } catch (err) {
      console.warn(`Failed to load Yjs doc ${docName} from IndexedDB:`, err);
    }
  }

  disconnect(docName: string): void {
    const provider = this.providers.get(docName);
    if (provider) {
      provider.destroy();
      this.providers.delete(docName);
    }

    const persistence = this.persistences.get(docName);
    if (persistence) {
      persistence.destroy();
      this.persistences.delete(docName);
    }

    const doc = this.docs.get(docName);
    if (doc) {
      doc.destroy();
      this.docs.delete(docName);
      this.emit('doc-destroyed', docName);
    }
  }

  getDoc(docName: string): Y.Doc | undefined {
    return this.docs.get(docName);
  }

  getProvider(docName: string): WebsocketProvider | undefined {
    return this.providers.get(docName);
  }

  getAwareness(docName: string): Awareness | undefined {
    return this.providers.get(docName)?.awareness;
  }

  setLocalUser(docName: string, user: { name: string; color: string; id: string }): void {
    const provider = this.providers.get(docName);
    if (provider) {
      provider.awareness.setLocalState({
        user,
        cursor: null,
      });
    }
  }

  updateCursor(docName: string, cursor: { blockId: string; offset: number; selection?: { start: number; end: number } } | null): void {
    const provider = this.providers.get(docName);
    if (provider) {
      const state = provider.awareness.getLocalState() || {};
      provider.awareness.setLocalState({
        ...state,
        cursor,
      });
    }
  }

  getAllUsers(docName: string): Map<number, { user: { name: string; color: string; id: string }; cursor: any }> {
    return this.providers.get(docName)?.awareness.getStates() || new Map();
  }

  destroy(): void {
    for (const docName of this.docs.keys()) {
      this.disconnect(docName);
    }
    this.eventHandlers.clear();
  }
}

// Singleton instance
let managerInstance: YjsDocumentManager | null = null;

export function getYjsDocumentManager(config?: Partial<CollaborationConfig>): YjsDocumentManager {
  if (!managerInstance) {
    managerInstance = new YjsDocumentManager(config);
  }
  return managerInstance;
}

export function resetYjsDocumentManager(): void {
  if (managerInstance) {
    managerInstance.destroy();
    managerInstance = null;
  }
}
