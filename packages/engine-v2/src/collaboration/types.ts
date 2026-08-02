import * as Y from 'yjs';

export interface YjsDocumentConfig {
  docName: string; // Format: "universe:{universeId}:scene:{sceneId}"
  universeId: string;
  sceneId: string;
}

export interface CommentAnchor {
  blockId: string;
  offset: number; // Character offset within block
  length?: number; // For suggestions
}

export interface CommentData {
  id: string;
  universeId: string;
  sceneId: string;
  blockId?: string;
  authorId: string;
  content: string;
  type: CommentType;
  status: CommentStatus;
  parentId?: string;
  anchor?: CommentAnchor;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  resolvedById?: string;
}

export interface PresenceData {
  id: string;
  universeId: string;
  userId: string;
  sceneId?: string;
  cursor?: {
    blockId: string;
    offset: number;
    selection?: {
      start: number;
      end: number;
    };
  };
  color: string;
  lastSeen: Date;
  metadata?: Record<string, any>;
}

export type CommentType = 'GENERAL' | 'SUGGESTION' | 'QUESTION';
export type CommentStatus = 'OPEN' | 'RESOLVED' | 'DISMISSED';

export interface CollaborationConfig {
  yjsServerUrl: string; // e.g., "ws://localhost:3000/api/yjs"
  autoConnect: boolean;
  reconnectInterval: number;
  maxRetries: number;
}

export interface YjsDocManagerEvents {
  'doc-ready': (doc: Y.Doc) => void;
  'doc-destroyed': (docName: string) => void;
  'connection-change': (connected: boolean) => void;
  'awareness-change': (states: Map<number, any>) => void;
}