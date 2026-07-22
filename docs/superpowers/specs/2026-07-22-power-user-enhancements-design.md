# Power User Enhancements: Enhanced Search, Keyboard Mastery & Pinned Items

**Date:** 2026-07-22  
**Status:** Design Approved  
**Target User:** High-volume workers (many documents, frequent searches, multiple parallel tasks)

## Overview

Transform Doc Expert's search and navigation experience for power users by introducing a Power Bar, enhanced command palette with keyboard navigation, and a comprehensive pinning system. These enhancements reduce friction for users who work with many documents, run frequent searches, and need to maintain context across sessions.

## Problem Statement

High-volume users face several friction points:

1. **No persistent context** — Model and collection selections reset each session, forcing re-selection
2. **Limited search capabilities** — No search history, no saved searches, no scope filters in palette
3. **Single-threaded workflows** — Only one conversation/collection active at a time, no quick switching
4. **No favorites system** — Recent documents rotate out, can't pin important items
5. **Limited keyboard navigation** — Missing navigation shortcuts, bulk actions, quick previews
6. **Batch operations require page navigation** — Can't do bulk actions from chat view

## Solution: Power User Toolkit

A combination of:
- **Power Bar** — Context-aware strip replacing QuickAccessBar with pinned items, search history, and context persistence
- **Enhanced Command Palette** — Full keyboard navigation, search history, saved searches, bulk actions, preview popovers
- **Pinning System** — Pin documents, collections, templates, and saved searches for instant access
- **Context Persistence** — Model, collection, and preset combinations persist across sessions
- **Expanded Keyboard Shortcuts** — Comprehensive shortcuts for navigation, pinning, search, and bulk actions

---

## Section 1: Power Bar

### Current State

The existing `QuickAccessBar` shows:
- Selected collection badge
- Recent documents (clickable chips)
- Clear button

### New State: Power Bar

The Power Bar replaces QuickAccessBar with a richer context strip that serves high-volume users.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ⭐ Pinned (3)  │ 🔍 Recent searches  │ 📁 Context: Contracts Q4  │ gpt-4o  │
│   [Doc A] [Col B] [Temp C]          │ [keyword...] [semantic...] │         │
├─────────────────────────────────────────────────────────────────────────────┤
```

**Three zones:**

1. **Pinned Items Zone** (left)
   - Documents, collections, templates marked as pinned
   - Scrollable horizontally, shows up to 5 items without scroll
   - Click to pin/unpin (star icon appears on hover in document list, collection detail)
   - Badge shows count of pinned items
   - Keyboard: `Ctrl+Shift+P` toggles pin on current item

2. **Search History Zone** (center-left)
   - Last 5 search queries displayed (from total of 20 stored)
   - Scope icons: document (📄), collection (📁), semantic (🧠)
   - Click to re-run search with same scope
   - Star icon to save as persistent saved search
   - Keyboard: `Ctrl+H` opens search history dropdown

3. **Context Zone** (right)
   - Active collection chip (if selected) — shows name, click to change
   - Model chip — shows current model, dropdown to switch
   - Chips persist across sessions (localStorage)
   - Clear context button to reset to defaults

### Visual Design

**Pinned item chips:**
```
┌──────────────┐
│ 📄 Contract Q4   │  ← Document (click to open)
│            ⭐ │  ← Pin indicator
└──────────────┘
```

**Search history item:**
```
┌──────────────────────────┐
│ 🔍 "liability clauses"    │
│    📁 Contracts Q4 • 2h ago │  ← Scope + timestamp
│                    ⭐ │  ← Save button
└──────────────────────────┘
```

**Context chips:**
```
┌─────────────────┐  ┌──────────┐
│ 📁 Contracts Q4 ▾│  │ gpt-4o ▾ │
└─────────────────┘  └──────────┘
```

### Interactions

- **Drag to reorder** pinned items (persists to localStorage)
- **Right-click context menu** on chips: Open, Open in new tab, Unpin, Share
- **Hover preview** on document chips shows first ~100 chars + metadata
- **Collapse/expand** — power bar can collapse to icons only (settings toggle)

### Implementation

- Replace `components/quick-access/quick-access-bar.tsx` with `components/power-bar/power-bar.tsx`
- Create sub-components: `pinned-zone.tsx`, `search-history-zone.tsx`, `context-zone.tsx`
- State management: localStorage for persistence, React state for UI
- Keyboard shortcuts integrated via `useKeyboardShortcuts` hook

---

## Section 2: Enhanced Command Palette

### Current State

The existing `EnhancedCommandPalette` provides:
- Global search across documents, conversations, collections, messages
- Grouped results with icons
- Basic keyboard navigation

### New State: Power Palette

**Structure:**

```
┌─────────────────────────────────────────────────────────────┐
│ 🔍 Search...                                                │
├─────────────────────────────────────────────────────────────┤
│ ⭐ Pinned (3)                                    [Tab to expand]│
│    📄 Contract Q4     📁 Legal Templates    📝 Summary Prompt │
├─────────────────────────────────────────────────────────────┤
│ 🔍 Recent Searches                                          │
│    "liability clauses" 📁 • 2h ago                          │
│    "section 4 terms" 📄 • 1d ago                            │
├─────────────────────────────────────────────────────────────┤
│ 📄 Documents (12)                          [Ctrl+1] [Ctrl+2]...│
│    Contract Q4.docx                                         │
│    Employment Agreement.pdf                                 │
├─────────────────────────────────────────────────────────────┤
│ 💬 Conversations (8)                                        │
│    Contract Review - Q4                                     │
│    Legal Analysis Draft                                     │
└─────────────────────────────────────────────────────────────┘
```

### Keyboard Navigation Enhancements

**Global shortcuts:**

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` | Open palette / Focus input |
| `Tab` | Cycle between sections |
| `Shift+Tab` | Reverse cycle |
| `1-9` | Jump to Nth item in focused section |
| `Ctrl+1-9` | Jump to Nth pinned item globally |
| `Ctrl+P` | Jump to pinned section |
| `Ctrl+H` | Jump to search history |
| `Enter` | Open selected item |
| `Ctrl+Enter` | Open in new tab (where applicable) |
| `Shift+Enter` | Preview in popover (documents, collections) |
| `Ctrl+Shift+P` | Pin/unpin selected item |
| `Ctrl+S` | Save current search |

**Section-specific shortcuts:**

- **Documents section:** `Ctrl+A` to select all visible, then batch action buttons appear
- **Search history:** `Delete` removes item, `S` saves as persistent
- **Pinned:** `Delete` un-pins item

### Scope Filters in Palette

**Search scope selector:**

```
┌─────────────────────────────────────────────────────────────┐
│ 🔍 [liability]  [All ▾] [📄 Docs] [📁 Collections] [🧠 Semantic]│
└─────────────────────────────────────────────────────────────┘
```

- **All** — default, searches everything
- **Docs** — restricts to documents only
- **Collections** — restricts to collections only
- **Semantic** — uses RAG semantic search (shows relevance scores)

Scope persists during palette session. On close, scope resets to "All" unless the user has saved it as a saved search or changed the default scope in settings.

### Saved Searches Section

When user stars a search (click star icon on history item):

```
┌─────────────────────────────────────────────────────────────┐
│ 💾 Saved Searches                                           │
│    🔍 "liability clauses" 📁 Contracts Q4                   │
│    🔍 "termination terms" 📄 All documents                  │
├─────────────────────────────────────────────────────────────┤
```

Saved searches include:
- Query text
- Scope (documents, collection ID, semantic)
- Timestamp (when saved)
- Optional label (user can rename)

### Bulk Actions Panel

When `Ctrl+A` (select all) or multiple items selected:

```
┌─────────────────────────────────────────────────────────────┐
│ ☑ 3 selected                                    [Clear]    │
│ [📎 Add to Collection] [📤 Export] [🗑 Delete] [↗ Share]   │
└─────────────────────────────────────────────────────────────┘
```

Actions:
- Add to collection — opens collection picker
- Export — downloads selected documents
- Delete — confirmation dialog
- Share — opens share dialog for all selected

### Preview Popover

When `Shift+Enter` on a document or collection:

```
┌──────────────────────────────────────┐
│ 📄 Contract Q4.docx                  │
│──────────────────────────────────────│
│ 24 pages • 45 chunks • Uploaded 2d ago│
│                                      │
│ Preview of first ~500 characters...  │
│                                      │
│ [Open] [Pin] [Share]                 │
└──────────────────────────────────────┘
```

### Implementation

- Extend `components/command-palette/enhanced-command-palette.tsx`
- Add keyboard navigation state management
- Create scope filter component
- Integrate with pinning system
- Add bulk action panel component

---

## Section 3: Pinning System & Keyboard Shortcuts Expansion

### Pinning System

**What can be pinned:**
- Documents
- Collections
- Templates
- Saved searches

**How to pin:**

| Method | Action |
|--------|--------|
| Document list | Star icon on hover (or right-click → Pin) |
| Collection detail | Star icon in header |
| Template picker | Star icon next to template |
| Command palette | `Ctrl+Shift+P` when item is selected |
| Document viewer | Star button in header |
| Search result | Star icon on result row |

**Pin behavior:**

- Maximum 10 pinned items. When limit reached, user is prompted to unpin an item before pinning a new one (no auto-unpin)
- Pinned items persist in localStorage (`doc-expert:pinned-items`)
- Synced to database for cross-device access (optional, future enhancement)
- Pinned items appear in:
  - Power Bar (pinned zone)
  - Command Palette (pinned section at top)
  - Sidebar (optional toggle)

**Pin metadata stored:**

```typescript
interface PinnedItem {
  id: string;
  type: 'document' | 'collection' | 'template' | 'saved-search';
  title: string;
  pinnedAt: string; // ISO timestamp
  order: number; // user-defined order
}
```

### Keyboard Shortcuts Expansion

**New shortcuts for power users:**

| Category | Shortcut | Action |
|----------|----------|--------|
| **Navigation** | `Ctrl+K` | Open palette / Focus search |
| | `Ctrl+Shift+K` | Open palette with search history focused |
| | `Ctrl+P` | Jump to pinned items |
| | `Ctrl+H` | Jump to search history |
| | `Ctrl+G` | Go to documents page |
| | `Ctrl+Shift+C` | Go to collections page |
| **Pinning** | `Ctrl+Shift+P` | Pin/unpin current item |
| | `Ctrl+1-9` | Open Nth pinned item |
| **Search** | `Ctrl+S` | Save current search |
| | `Ctrl+/` | Cycle search scope |
| **Bulk Actions** | `Ctrl+A` | Select all (in list context) |
| | `Ctrl+Shift+A` | Add selected to collection |
| | `Delete` | Delete selected (with confirmation) |
| **Context** | `Ctrl+M` | Cycle through recent models |
| | `Ctrl+Shift+F` | Focus collection filter |
| **Help** | `?` | Show keyboard shortcuts |

**Shortcuts dialog update:**

The existing `KeyboardShortcutsDialog` will be updated to:
- Group shortcuts by category
- Highlight power user shortcuts (with ⭐ badge)
- Show context-aware shortcuts (only relevant to current page)
- Add search/filter within shortcuts dialog

### Implementation

- Create `hooks/use-pinning.ts` for pin state management
- Create `hooks/use-power-keyboard.ts` for extended shortcuts
- Update `components/keyboard-shortcuts-dialog.tsx` with new categories
- Integrate pinning across document list, collection detail, template picker

---

## Section 4: Search History & Saved Searches

### Search History

**What's tracked:**

Every search query (from command palette or document search) logs:

```typescript
interface SearchHistoryItem {
  id: string;
  query: string;
  scope: 'all' | 'documents' | 'collections' | 'semantic';
  collectionId?: string; // if scoped to collection
  timestamp: string;
  resultCount: number;
}
```

**History display:**

```
┌─────────────────────────────────────────────────────────────┐
│ 🔍 Recent Searches                                    [Clear]│
│─────────────────────────────────────────────────────────────│
│ "liability clauses" 📁 Contracts Q4 • 12 results • 2h ago   │
│ "termination terms" 📄 • 8 results • 1d ago                 │
│ "payment schedule" 🧠 • 5 results • 2d ago                   │
└─────────────────────────────────────────────────────────────┘
```

**History behavior:**

- Last 20 searches stored in localStorage (`doc-expert:search-history`)
- Duplicate queries update timestamp (same query = same entry, refreshed)
- Click to re-run with same scope
- Hover shows result preview (first 3 matching document titles)
- Delete button (X) removes from history

### Saved Searches

**Saving a search:**

User clicks star icon on history item:

```
┌─────────────────────────────────────────────────────────────┐
│ 💾 Save Search                                              │
│─────────────────────────────────────────────────────────────│
│ Query: "liability clauses"                                  │
│ Scope: Collection "Contracts Q4"                            │
│─────────────────────────────────────────────────────────────│
│ Label: [Contract liability search        ]                  │
│─────────────────────────────────────────────────────────────│
│                              [Cancel] [Save]                │
└─────────────────────────────────────────────────────────────┘
```

**Saved search structure:**

```typescript
interface SavedSearch {
  id: string;
  label: string; // user-defined name
  query: string;
  scope: 'all' | 'documents' | 'collections' | 'semantic';
  collectionId?: string;
  savedAt: string;
  lastRunAt?: string;
  lastResultCount?: number;
}
```

**Saved searches display:**

In power bar:

```
┌─────────────────────────────────────────────────────────────┐
│ 💾 Saved Searches (2)                                       │
│    [Contract liability] [Payment terms]                     │
└─────────────────────────────────────────────────────────────┘
```

In command palette:

```
┌─────────────────────────────────────────────────────────────┐
│ 💾 Saved Searches                                           │
│    🔍 Contract liability  📁 Contracts Q4 • 12 results      │
│    🔍 Payment terms       📄 All docs • 8 results           │
└─────────────────────────────────────────────────────────────┘
```

**Saved search actions:**

- Click: Re-run search
- Right-click: Rename, Duplicate, Delete, Share (share link to search)
- Drag: Reorder saved searches
- Pin: Saved searches can be pinned to Power Bar

### Search Scope Persistence

**Scope selectors:**

| Context | Scope options |
|---------|---------------|
| Chat page | All, Documents, Current Collection, Semantic |
| Documents page | All, Owned, Shared, Pending |
| Document viewer | This Document (text), This Document (semantic) |
| Collections page | All, My Collections, Shared |

**Scope persistence:**

- Last used scope saved per context (localStorage)
- Scope resets to default when explicitly cleared
- Saved searches encode scope as part of the search definition

### Implementation

- Create `hooks/use-search-history.ts` for history state
- Create `hooks/use-saved-searches.ts` for saved searches
- Integrate with command palette and power bar
- Add save search dialog component

---

## Section 5: Context Persistence & State Management

### What Gets Persisted

**Per-session state (localStorage):**

| Key | Data | Purpose |
|-----|------|---------|
| `doc-expert:model-preference` | Model ID | Remembers last used model |
| `doc-expert:pinned-items` | `PinnedItem[]` | Pinned documents, collections, templates |
| `doc-expert:search-history` | `SearchHistoryItem[]` | Last 20 searches |
| `doc-expert:saved-searches` | `SavedSearch[]` | User-saved search queries |
| `doc-expert:context-presets` | `ContextPreset[]` | Saved model + collection combinations |
| `doc-expert:power-bar-collapsed` | boolean | Whether power bar is collapsed |
| `doc-expert:last-collection-id` | string \| null | Last selected collection |

**New: Context Presets**

High-volume users often work with specific model + collection combinations. Context presets let them save and switch between these combinations quickly.

```typescript
interface ContextPreset {
  id: string;
  label: string; // e.g., "Legal Review", "Technical Docs"
  modelId: string;
  collectionId?: string;
  createdAt: string;
}
```

**Context preset UI:**

In power bar context zone:

```
┌─────────────────────────────────────────────────────────────┐
│ Context: [Legal Review ▾]                                   │
│─────────────────────────────────────────────────────────────│
│ Current: 📁 Contracts Q4 + gpt-4o                           │
│─────────────────────────────────────────────────────────────│
│ Presets:                                                    │
│   ⭐ Legal Review      (Contracts Q4 + gpt-4o)              │
│   ⭐ Technical Docs    (Engineering + claude-3-sonnet)      │
│   [Save current as preset...]                               │
└─────────────────────────────────────────────────────────────┘
```

### State Synchronization

**Cross-tab sync:**

When user has multiple browser tabs open:
- Pinning/unpinning updates all tabs (via `storage` event)
- Search history updates across tabs
- Context changes sync (model, collection)

**Cross-device sync (future):**

For enterprise users, persisted state can sync to database:
- `userPreferences` table stores pinned items, saved searches, presets
- Synced on login, merged with local changes
- Last-write-wins for conflicts

### Power Bar Visibility Logic

**When to show power bar:**

| Page | Power Bar |
|------|-----------|
| Chat | ✅ Full (pinned, search history, context) |
| Documents | ✅ Reduced (pinned + context only; search history hidden) |
| Collections | ✅ Reduced (pinned + context only; search history hidden) |
| Document viewer | ❌ Hidden |
| Settings | ❌ Hidden |

**Collapsible state:**

User can collapse power bar to icons-only mode:

```
┌─────────────────────────────────────────────────────────────┐
│ ⭐ [3] │ 🔍 [5] │ 📁 [Contracts Q4] │ gpt-4o               │
└─────────────────────────────────────────────────────────────┘
```

Collapsed state persists across sessions.

### State Cleanup

**Automatic cleanup:**

- Search history older than 30 days auto-deleted
- Pinned items referencing deleted documents auto-removed (checked on app load and when pinning new items)
- Saved searches referencing deleted collections auto-updated to "All documents" scope

**Manual cleanup:**

- Clear search history button
- Unpin all button
- Reset all preferences (in settings)

### Implementation

- Create `hooks/use-context-persistence.ts` for state management
- Create `hooks/use-context-presets.ts` for preset management
- Add settings page for preference management
- Implement cross-tab sync via `storage` event listeners

---

## Success Metrics

Track these to measure the enhancements' impact:

1. **Search efficiency** — Average time from search open to result selection (target: < 5 seconds)
2. **Pinning adoption** — % of users who pin at least 1 item within 7 days (target: > 40%)
3. **Keyboard usage** — % of actions performed via keyboard shortcuts (target: > 30% for power users)
4. **Context persistence** — % of users who save at least 1 context preset (target: > 25%)
5. **Search history reuse** — % of searches re-run from history (target: > 20%)

## Implementation Phases

### Phase 1: Pinning System (Week 1)
- Build pinning hooks and state management
- Add star icons to document list, collection detail, template picker
- Integrate pinned items in command palette
- Test keyboard shortcuts for pinning

### Phase 2: Power Bar (Week 2)
- Replace QuickAccessBar with Power Bar
- Build pinned zone, search history zone, context zone
- Add drag-to-reorder for pinned items
- Test collapse/expand functionality

### Phase 3: Enhanced Command Palette (Week 3)
- Add keyboard navigation (Tab, 1-9, Ctrl+1-9)
- Add scope filters
- Add bulk action panel
- Add preview popover
- Test all keyboard shortcuts

### Phase 4: Search History & Saved Searches (Week 4)
- Build search history tracking
- Add save search dialog
- Integrate saved searches in power bar and palette
- Test scope persistence

### Phase 5: Context Persistence & Presets (Week 5)
- Build context preset system
- Add preset UI in power bar
- Implement cross-tab sync
- Add settings page for preferences
- Test state cleanup logic

### Phase 6: Polish & Accessibility (Week 6)
- Update keyboard shortcuts dialog
- Add context-aware shortcut hints
- Accessibility audit (focus management, ARIA labels)
- Performance optimization (lazy loading, virtualization)

## Technical Debt & Risks

1. **State management complexity** — Multiple localStorage keys and cross-tab sync require careful coordination
2. **Keyboard shortcut conflicts** — New shortcuts must not conflict with browser defaults or existing app shortcuts
3. **Performance** — Power bar with many pinned items could cause rendering issues; need virtualization
4. **Mobile responsiveness** — Power bar and keyboard shortcuts are desktop-focused; mobile needs separate design
5. **Backward compatibility** — Existing users should see gradual introduction, not sudden UI changes

## Future Enhancements (Out of Scope)

- Cross-device sync via database (requires `userPreferences` table)
- AI-powered search suggestions based on history
- Custom keyboard shortcut mapping (user-configurable)
- Advanced bulk actions (batch metadata editing, batch permission changes)
- Search analytics dashboard (most-used queries, popular documents)
- Integration with external tools (Slack, Teams) for shared searches
