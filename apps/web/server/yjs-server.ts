import { WebSocketServer, WebSocket } from 'ws';
import * as Y from 'yjs';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';

// In-memory document store (replace with Redis in production)
const documents = new Map<string, Y.Doc>();

function getOrCreateDoc(docName: string): Y.Doc {
  let doc = documents.get(docName);
  if (!doc) {
    doc = new Y.Doc();
    documents.set(docName, doc);
  }
  return doc;
}

// Message types (matching y-websocket)
const messageSync = 0;
const messageQueryAwareness = 3;
const messageAwareness = 1;
const messageAuth = 2;

function readSyncMessage(decoder: decoding.Decoder, encoder: encoding.Encoder, doc: Y.Doc, provider: any) {
  return syncProtocol.readSyncMessage(decoder, encoder, doc, provider);
}

function writeSyncStep1(encoder: encoding.Encoder, doc: Y.Doc) {
  syncProtocol.writeSyncStep1(encoder, doc);
}

function writeSyncStep2(encoder: encoding.Encoder, doc: Y.Doc) {
  syncProtocol.writeSyncStep2(encoder, doc);
}

function writeUpdate(encoder: encoding.Encoder, update: Uint8Array) {
  syncProtocol.writeUpdate(encoder, update);
}

function encodeAwarenessUpdate(awareness: awarenessProtocol.Awareness, states: number[]) {
  return awarenessProtocol.encodeAwarenessUpdate(awareness, states);
}

function applyAwarenessUpdate(awareness: awarenessProtocol.Awareness, update: Uint8Array, origin: any) {
  awarenessProtocol.applyAwarenessUpdate(awareness, update, origin);
}

function removeAwarenessStates(awareness: awarenessProtocol.Awareness, clientIDs: number[], origin: any) {
  awarenessProtocol.removeAwarenessStates(awareness, clientIDs, origin);
}

interface YjsClient {
  ws: WebSocket;
  doc: Y.Doc;
  docName: string;
  awareness: awarenessProtocol.Awareness;
  synced: boolean;
  wsconnected: boolean;
}

const clients = new Map<WebSocket, YjsClient>();

function handleMessage(client: YjsClient, message: Uint8Array) {
  const decoder = decoding.createDecoder(message);
  const encoder = encoding.createEncoder();
  const messageType = decoding.readVarUint(decoder);

  switch (messageType) {
    case messageSync: {
      const syncMessageType = readSyncMessage(decoder, encoder, client.doc, client);
      if (client.synced === false && syncMessageType === syncProtocol.messageYjsSyncStep2) {
        client.synced = true;
      }
      break;
    }
    case messageQueryAwareness: {
      encoding.writeVarUint(encoder, messageAwareness);
      const awarenessUpdate = encodeAwarenessUpdate(
        client.awareness,
        Array.from(client.awareness.getStates().keys())
      );
      encoding.writeVarUint8Array(encoder, awarenessUpdate);
      break;
    }
    case messageAwareness: {
      applyAwarenessUpdate(client.awareness, decoding.readVarUint8Array(decoder), client);
      break;
    }
    case messageAuth: {
      // Auth not implemented - could add permission checks here
      break;
    }
  }

  if (encoding.length(encoder) > 1) {
    client.ws.send(encoding.toUint8Array(encoder));
  }
}

function broadcastAwareness(docName: string, excludeClient?: WebSocket) {
  const docClients = Array.from(clients.values()).filter(c => c.docName === docName);
  
  for (const client of docClients) {
    if (client.ws === excludeClient) continue;
    
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageAwareness);
    const awarenessUpdate = encodeAwarenessUpdate(
      client.awareness,
      Array.from(client.awareness.getStates().keys())
        .filter(id => id !== client.doc.clientID)
    );
    encoding.writeVarUint8Array(encoder, awarenessUpdate);
    
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(encoding.toUint8Array(encoder));
    }
  }
}

function broadcastUpdate(docName: string, update: Uint8Array, originClient?: WebSocket) {
  const docClients = Array.from(clients.values()).filter(c => c.docName === docName);
  
  for (const client of docClients) {
    if (client.ws === originClient) continue;
    
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    writeUpdate(encoder, update);
    
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(encoding.toUint8Array(encoder));
    }
  }
}

export function createYjsServer(wss: WebSocketServer) {
  wss.on('connection', (ws: WebSocket, req) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const docName = url.searchParams.get('doc') || 'default';
    
    const doc = getOrCreateDoc(docName);
    const awareness = new awarenessProtocol.Awareness(doc);
    
    const client: YjsClient = {
      ws,
      doc,
      docName,
      awareness,
      synced: false,
      wsconnected: true,
    };
    
    clients.set(ws, client);
    
    console.log(`Yjs client connected to document: ${docName}`);
    
    // Send sync step 1
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    writeSyncStep1(encoder, doc);
    ws.send(encoding.toUint8Array(encoder));
    
    // Broadcast local awareness state
    if (awareness.getLocalState() !== null) {
      const awarenessEncoder = encoding.createEncoder();
      encoding.writeVarUint(awarenessEncoder, messageAwareness);
      const awarenessUpdate = encodeAwarenessUpdate(awareness, [doc.clientID]);
      encoding.writeVarUint8Array(awarenessEncoder, awarenessUpdate);
      ws.send(encoding.toUint8Array(awarenessEncoder));
    }
    
    ws.on('message', (data: Buffer) => {
      const client = clients.get(ws);
      if (!client) return;
      
      const message = new Uint8Array(data);
      const decoder = decoding.createDecoder(message);
      const messageType = decoding.readVarUint(decoder);
      
      // Handle sync updates
      if (messageType === messageSync) {
        // Apply the update to the document
        syncProtocol.readSyncMessage(decoder, encoding.createEncoder(), client.doc, client);
        
        // Broadcast to other clients
        broadcastUpdate(docName, message, ws);
      } else {
        // Handle other message types (awareness, etc.)
        handleMessage(client, message);
      }
    });
    
    ws.on('close', () => {
      const client = clients.get(ws);
      if (client) {
        // Remove awareness state for this client
        removeAwarenessStates(client.awareness, [client.doc.clientID], client);
        broadcastAwareness(client.docName);
        clients.delete(ws);
        console.log(`Yjs client disconnected from document: ${client.docName}`);
      }
    });
    
    ws.on('error', (err) => {
      console.error(`Yjs WebSocket error for ${docName}:`, err);
    });
  });
  
  console.log('Yjs WebSocket server ready');
}

export function handleUpgrade(request: any, socket: any, head: any) {
  // This will be called from the custom Next.js server
}

export { getOrCreateDoc };