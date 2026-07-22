# Floating Context Layer Design Spec

**Date:** 2026-07-22  
**Status:** Approved  
**Target Users:** Document-heavy power users

---

## Problem Statement

Document-heavy users experience friction across the entire document lifecycle: finding documents, organizing collections, switching between conversations, and maintaining context. The chat interface is the hub but is isolated from surrounding context, forcing users to constantly navigate between screens.

**Key pain points:**
- Finding the right document requires scrolling through long lists
- Context-switching between chat and documents loses place in conversations
- Collections are clunky to manage at scale
- Users lose context after chat sessions (what was referenced, what questions were asked)

**Goals:**
1. Fewer clicks to get things done
2. Everything in context without leaving the current screen

---

## Solution: Floating Context Layer

Keep the chat interface clean and full-width, but add a floating command palette and contextual overlays so everything is one keystroke or click away without permanent panels.

This approach:
- Maintains a clean interface for casual users
- Provides instant access for power users via keyboard shortcuts
- Avoids permanent panels that consume screen space
- Leverages existing patterns (command palettes are familiar from VS Code, Arc, Raycast)

---

## Architecture & Component Structure

### New Components

#### 1. EnhancedCommandPalette
Global search and action launcher triggered by `Ctrl+K` or search icon.

**Responsibilities:**
- Search across documents, conversations, collections, and messages
- Provide quick actions (upload, create collection, switch context)
- Keyboard-navigable results with instant preview on hover
- Debounced search (300ms) to `/api/search` endpoint

**State:**
- `isOpen: boolean`
- `searchQuery: string`
- `selectedResult: SearchResult | null`
- `results: SearchResult[]` (cached in memory)

#### 2. ContextualPreviewPopover
Floating overlay that appears on hover/click of trigger elements.

**Responsibilities:**
- Show document excerpt, metadata, and quick actions
- Triggered by: citation badges, document links, collection items, search results
- Auto-position to avoid viewport edges
- Dismiss on Escape, click outside, or timeout (for hovers)

**State:**
- `isVisible: boolean`
- `anchorPosition: { top, left, right, bottom }`
- `contentType: 'document' | 'collection' | 'conversation'`
- `contentData: any` (document/collection/conversation data)

#### 3. QuickAccessBar
Floating toolbar above chat input showing recent context.

**Responsibilities:**
- Show active collection badge
- Show last 5 accessed/uploaded documents as compact chips
- Provide one-click context switching
- Collapsible to save vertical space

**State:**
- `isExpanded: boolean` (persisted to localStorage)
- `recentDocuments: Document[]` (max 5)
- `activeCollection: Collection | null`

### Modified Components

#### ChatHeader
**Changes:**
- Add quick access toggle button
- Enhance search button to open EnhancedCommandPalette
- Add "Recent" dropdown showing last 5 documents/conversations

#### CitationPanel (existing)
**Changes:**
- Keep as fallback for full citation details
- Add option to show preview in ContextualPreviewPopover instead
- Citation badges now trigger popover on hover/click

#### ConversationSidebar (existing)
**Changes:**
- Keep as fallback for full conversation management
- Add quick-switch to recent conversations in QuickAccessBar

#### CollectionPicker (existing)
**Changes:**
- Enhance to show collection contents in ContextualPreviewPopover on hover
- Show document count and list of document titles

### Data Flow

```
User types in command palette
  ↓
Debounced search (300ms) to /api/search (new endpoint)
  ↓
Returns: { documents, conversations, collections, messages }
  ↓
Render results grouped by type with icons and metadata
  ↓
User selects result → navigate or open preview popover
```

---

## Enhanced Command Palette

### Trigger
- `Ctrl+K` (existing shortcut, enhanced behavior)
- Click search icon in ChatHeader
- Click any "quick access" item in QuickAccessBar

### Layout

```
┌─────────────────────────────────────────────────┐
│ 🔍 Search documents, conversations, collections │
├─────────────────────────────────────────────────┤
│                                                 │
│ 📄 Documents (3)                                │
│ ├─ Q3 Report.pdf                                │
│ │  Uploaded 2h ago · 12 chunks · PDF            │
│ ├─ Contract.docx                                │
│ │  Uploaded yesterday · 8 chunks · DOCX         │
│ └─ Meeting Notes.md                             │
│    Uploaded 3 days ago · 5 chunks · Markdown    │
│                                                 │
│ 💬 Conversations (2)                            │
│ ├─ Q3 financial analysis                        │
│ │  12 messages · Last active 1h ago             │
│ └─ Contract review questions                    │
│    8 messages · Last active yesterday           │
│                                                 │
│ 📁 Collections (1)                              │
│ └─ Q3 Due Diligence                             │
│    5 documents · Created 2 days ago             │
│                                                 │
│ ⚡ Actions                                      │
│ ├─ Upload document (Ctrl+U)                     │
│ ├─ New collection (Ctrl+Shift+C)                │
│ ├─ Switch collection                            │
│ └─ View active collection                       │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Search Behavior

**Search targets:**
- Document titles and content (full-text search)
- Conversation titles and messages
- Collection names and descriptions

**Result display:**
- Grouped by type with counts
- Each result shows:
  - Icon (document type, conversation, collection)
  - Title/name
  - Metadata (upload date, message count, document count)
  - Relevance score (for content matches)

### Keyboard Navigation

- `↑/↓` — Navigate results
- `Enter` — Open selected item
  - Document → open in new tab or preview in popover
  - Conversation → switch to that conversation
  - Collection → switch active collection
- `Tab` — Cycle through result groups
- `Escape` — Close palette
- `Ctrl+Enter` — Open in new tab (for documents)

### Actions Section

Appears when search query is empty or matches an action keyword:

- `upload` → Upload document
- `collection` → Collection management actions
- `switch` → Switch context (conversation, collection)
- `view` → View active context

### Preview on Hover

When hovering over a result:
- Documents → show excerpt with search term highlighted
- Conversations → show last 3 messages
- Collections → show document list

### Empty States

- No results → "No matches found. Try a different search term."
- No documents → "No documents uploaded yet. Press Ctrl+U to upload."
- No conversations → "No conversations yet. Start chatting!"

### Performance

- Search endpoint returns max 20 results per category
- Results cached in memory for instant navigation
- Debounced (300ms) to avoid excessive API calls
- Lazy-load full content only when preview is triggered

---

## Contextual Preview Popover

### Trigger Points

1. **Citation badges** `[1]`, `[2]` in chat messages — hover or click
2. **Document links** in QuickAccessBar — hover
3. **Collection items** in CollectionPicker — hover
4. **Search results** in command palette — hover

### Layout (Citation Trigger)

```
┌─────────────────────────────────────────┐
│ 📄 Q3 Report.pdf                  [→]  │
│ PDF · 12 chunks · Uploaded 2h ago      │
├─────────────────────────────────────────┤
│                                         │
│ "Revenue grew 23% YoY driven by         │
│  enterprise segment expansion in APAC   │
│  and EMEA markets..."                   │
│                                         │
│ Source: Page 4, Chunk 3 of 12          │
│ Similarity: 94%                         │
│                                         │
├─────────────────────────────────────────┤
│ [Open Document] [Add to Collection]     │
│ [Share]          [View Chunks]          │
└─────────────────────────────────────────┘
```

### Layout (Document Trigger from QuickAccessBar)

```
┌─────────────────────────────────────────┐
│ 📄 Q3 Report.pdf                  [→]  │
│ PDF · 12 chunks · Uploaded 2h ago      │
│ Source: Upload · Owner: you            │
├─────────────────────────────────────────┤
│                                         │
│ # Q3 Financial Report                   │
│                                         │
│ Revenue grew 23% YoY driven by          │
│ enterprise segment expansion...         │
│                                         │
│ [Show more]                             │
│                                         │
├─────────────────────────────────────────┤
│ [Open] [Share] [Add to Collection]      │
└─────────────────────────────────────────┘
```

### Layout (Collection Trigger)

```
┌─────────────────────────────────────────┐
│ 📁 Q3 Due Diligence               [→]  │
│ 5 documents · Created 2 days ago       │
├─────────────────────────────────────────┤
│                                         │
│ 📄 Q3 Report.pdf                       │
│ 📄 Contract.docx                        │
│ 📄 NDA Agreement.pdf                   │
│ 📄 Financial Projections.xlsx          │
│ 📄 Board Minutes.md                    │
│                                         │
├─────────────────────────────────────────┤
│ [Open Collection] [Chat with this]      │
│ [Edit Documents]                        │
└─────────────────────────────────────────┘
```

### Behavior

**Positioning:**
- Appears anchored to the trigger element
- Auto-flips if near viewport edge (right→left, bottom→top)
- Subtle shadow and border to distinguish from chat content

**Dismiss:**
- `Escape` key
- Click outside
- 5-second inactivity timeout (for hovers only)

**Interaction:**
- Click to pin: Clicking the trigger keeps the popover open until explicitly dismissed
- Arrow key navigation: When pinned, `Tab` cycles through action buttons
- Open button `[→]`: Navigates to the full document/collection page

**Content Details:**

For documents:
- Title, file type icon, chunk count, upload date
- Source (Upload/Google Drive/Microsoft 365), owner
- Excerpt: first ~200 chars for direct open, relevant chunk text for citations
- Similarity score when triggered from citation
- Actions: Open, Share, Add to Collection, View Chunks

For collections:
- Name, document count, creation date
- List of document titles (truncated at 5, "and 3 more")
- Actions: Open Collection, Chat with this Collection, Edit Documents

**Interaction with Chat:**
- Citation popover appears to the right of the badge, offset to avoid covering the message
- If right side is blocked (e.g., viewport edge), flips to left
- Does not interrupt chat scrolling or input focus

---

## QuickAccessBar

### Position
Floating bar directly above the chat input, centered horizontally.

### Layout (Expanded)

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  [Chat messages...]                                         │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ ┌───────────────────────────────────────────────────────┐   │
│ │ 📁 Q3 Due Diligence (5)  │ 📄 Q3 Report  📄 Contract │   │
│ │                            │ 📄 NDA  📄 Projections   │   │
│ └───────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│ [Type your message...]                              [Send]  │
└─────────────────────────────────────────────────────────────┘
```

### Structure

The bar has three sections in a single pill-shaped container:

1. **Active Collection Badge** (left)
   - Shows current collection name + document count
   - Click → opens collection contents popover (from ContextualPreviewPopover)
   - "No collection" state shows "All Documents" with globe icon
   - Click → opens collection switcher popover

2. **Recent Documents** (center, scrollable)
   - Shows last 5 accessed/uploaded documents as compact chips
   - Each chip: file icon + truncated filename
   - Click → opens document preview popover
   - Hover → same preview popover
   - Scroll horizontally if more than 5

3. **Collapse Toggle** (right)
   - Chevron icon to collapse/expand the bar
   - When collapsed: shows only a thin strip with collection badge + expand button

### Behavior

**Persistence:**
- Bar state (expanded/collapsed) saved to localStorage

**Auto-update:**
Recent documents list updates when:
- User uploads a new document
- User clicks a citation (that doc moves to front)
- User opens a document from command palette

**Context-aware:**
- When a collection is active, the recent documents filter to only show documents in that collection

**Empty state:**
- If no recent documents, shows "Upload your first document (Ctrl+U)" as a clickable chip

### Collapsed State

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  [Chat messages...]                                         │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────┐                            │
│ │ 📁 Q3 Due Diligence (5)  [>]│                            │
│ └──────────────────────────────┘                            │
├─────────────────────────────────────────────────────────────┤
│ [Type your message...]                              [Send]  │
└─────────────────────────────────────────────────────────────┘
```

### Mobile Behavior

- Bar collapses by default on screens < 768px
- Expanded bar scrolls horizontally
- Collection badge always visible when collapsed

---

## Error Handling & Edge Cases

### Error States

1. **Search API fails**
   - Command palette shows: "Search unavailable. Check your connection."
   - Retry button appears
   - Fallback: show only local cached results (recent items)

2. **Preview content fails to load**
   - Popover shows: "Unable to load preview"
   - Fallback: "Open in new tab" button still works

3. **Document deleted while in quick access**
   - Chip shows strikethrough text
   - Click → "This document is no longer available"
   - Auto-removes from list after 5 seconds

4. **Collection empty**
   - Collection popover shows: "No documents in this collection"
   - "Add documents" button appears

5. **Command palette with no results**
   - Shows: "No matches for '{query}'"
   - Suggests: "Try uploading a document (Ctrl+U)"

### Edge Cases

- **Very long document titles** → truncate with ellipsis, show full title in popover
- **Many recent documents** → horizontal scroll in QuickAccessBar, max 5 visible
- **Multiple citations in one message** → each badge has independent popover
- **Popover near viewport edge** → auto-flip position (right→left, bottom→top)
- **Rapid typing in command palette** → debounce prevents excessive API calls
- **Session expires while popover open** → dismiss all popovers, redirect to login

### Accessibility

- All popovers are keyboard-navigable (Tab, Escape, Enter)
- Focus trapped within popover when open
- Screen readers announce popover content
- High contrast mode supported
- Reduced motion: popovers fade instead of slide

---

## Implementation Notes

### New API Endpoint

**`/api/search`** (GET)

Query parameters:
- `q: string` — search query
- `types: string[]` — filter by type (document, conversation, collection, message)
- `limit: number` — max results per category (default 20)

Response:
```typescript
{
  documents: SearchResult[],
  conversations: SearchResult[],
  collections: SearchResult[],
  messages: SearchResult[]
}
```

SearchResult type:
```typescript
interface SearchResult {
  id: string;
  type: 'document' | 'conversation' | 'collection' | 'message';
  title: string;
  excerpt?: string;
  metadata: {
    createdAt: string;
    updatedAt?: string;
    chunkCount?: number; // for documents
    messageCount?: number; // for conversations
    documentCount?: number; // for collections
    source?: string; // for documents
    similarity?: number; // for search matches
  };
}
```

### Component File Structure

```
components/
├── command-palette/
│   ├── enhanced-command-palette.tsx
│   ├── search-results.tsx
│   └── action-list.tsx
├── preview/
│   ├── contextual-preview-popover.tsx
│   ├── document-preview.tsx
│   └── collection-preview.tsx
└── quick-access/
    ├── quick-access-bar.tsx
    ├── collection-badge.tsx
    └── document-chip.tsx
```

### State Management

Use React Context or Zustand for shared state:
- Command palette state (open/closed, query, results)
- Preview popover state (visible, anchor, content)
- Quick access state (recent documents, active collection)

Persist to localStorage:
- QuickAccessBar expanded/collapsed state
- Recent documents list
- Active collection

### Testing Considerations

- Command palette search debouncing
- Popover positioning and auto-flip
- Keyboard navigation (Tab, Escape, Enter)
- Mobile responsive behavior
- Error states and fallbacks
- Accessibility (screen reader, keyboard-only navigation)

---

## Success Metrics

1. **Reduced navigation clicks** — Users spend less time navigating between screens
2. **Faster context switching** — Users can access documents, conversations, and collections without leaving chat
3. **Improved discoverability** — Keyboard shortcuts and command palette make features more discoverable
4. **Higher engagement** — Users spend more time in chat (the hub) rather than bouncing between pages

---

## Future Enhancements (Out of Scope)

- Persistent side panels (Approach A) as an alternative layout option
- AI-powered document recommendations based on conversation context
- Drag-and-drop documents into collections from QuickAccessBar
- Custom keyboard shortcut configuration
- Multi-select in command palette for batch operations
