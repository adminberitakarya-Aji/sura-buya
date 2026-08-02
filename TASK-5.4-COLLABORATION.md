# Task 5.4: Collaboration (comments, suggestions, presence via Yjs)

## Implementation Plan

### Phase 1: Database Schema
- [x] Add `Comment` model to Prisma schema
- [x] Add `Presence` model to Prisma schema
- [x] Add `CommentType` and `CommentStatus` enums
- [x] Run `prisma generate` and `prisma db push`

### Phase 2: Yjs Server Setup
- [x] Install Yjs dependencies (`yjs`, `y-websocket`, `y-indexeddb`, `y-protocols`)
- [x] Create WebSocket server for Yjs (`apps/web/server/yjs-server.ts`)
- [x] Configure Next.js to support custom server for WebSocket upgrade
- [x] Create Yjs document manager for scene documents

### Phase 3: API Routes
- [x] `GET/POST /api/universes/:universeId/scenes/:sceneId/comments` - List/create comments
- [x] `PATCH/DELETE /api/universes/:universeId/comments/:commentId` - Update/delete comment
- [x] `POST /api/universes/:universeId/comments/:commentId/resolve` - Resolve comment (via PATCH)
- [x] `GET /api/universes/:universeId/scenes/:sceneId/presence` - Get presence (REST fallback)
- [x] WebSocket endpoint: `/api/yjs` for Yjs connection (custom server)

### Phase 4: Core Collaboration Library
- [x] Create `packages/engine-v2/src/collaboration/` module
- [x] `YjsDocumentManager` - Manage Yjs documents per scene
- [x] `CommentService` - Comment CRUD with anchoring
- [x] `PresenceService` - Presence tracking
- [x] Export types for UI components

### Phase 5: UI Components (React)
- [ ] `CommentThread` - Threaded comments sidebar panel
- [ ] `CommentMarker` - Inline marker in block editor
- [ ] `SuggestionChip` - Accept/reject inline suggestions
- [ ] `PresenceAvatars` - Top-bar user avatars with live cursors
- [ ] `CollaborationProvider` - React context wrapping Yjs
- [ ] `useCollaboration` hook for components

### Phase 6: Integration
- [ ] Integrate `CollaborationProvider` in scene editor page
- [ ] Add comment sidebar to scene editor layout
- [ ] Wire presence avatars in header
- [ ] Add "Add Comment" action in block editor context menu

### Phase 7: Tests
- [ ] Unit tests for CommentService, PresenceService
- [ ] Integration tests for API routes
- [ ] UI component tests for CommentThread, PresenceAvatars

### Phase 8: Documentation & Audit
- [ ] Update IMPLEMENTATION-PLAN.md
- [ ] Update AUDIT-FINAL-REPORT.md with 5.4 completion
- [ ] Verify build, lint, tests pass