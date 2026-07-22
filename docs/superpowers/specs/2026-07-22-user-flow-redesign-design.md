# User Flow Redesign: Guided Journey

**Date:** 2026-07-22  
**Status:** Design Approved  
**Target User:** New users (first-time experience)

## Overview

Transform Doc Expert from a multi-panel interface into a progressive learning experience that guides new users from zero to power-user capabilities. The redesign reduces cognitive load by hiding complexity until needed, while maintaining full functionality for existing users.

## Problem Statement

New users face several friction points:

1. **Navigation complexity** — Chat page shows two sidebars (app nav + conversation history), creating a 3-panel layout that overwhelms first-time users
2. **No onboarding** — Users land on an empty chat with no guidance on what to do
3. **Fragmented workflows** — Upload happens in 3 different places with different contexts
4. **Missing connections** — Relationships between Conversations, Collections, and Documents aren't visible
5. **Generic empty states** — Empty states don't explain what goes there or why it matters

## Solution: Guided Journey

A combination of:
- **Onboarding wizard** for the critical first 2 minutes
- **Progress checklist** for ongoing milestone tracking
- **Progressive disclosure** for teaching advanced features at the right moment
- **Unified navigation** to reduce visual complexity

---

## Section 1: Navigation Architecture

### Current State

- Chat page: App sidebar (60px) + Conversation sidebar (256px) + Chat content
- Total left-side width: 316px before content starts
- Conversation sidebar always visible, even when not needed

### New State

**Single unified sidebar with collapsible conversation drawer**

```
┌─────────────────────────────────────────────────────────┐
│  ┌──────────┐  ┌──────────────────────────────────────┐ │
│  │ Logo     │  │  Chat Header (model, collection,     │ │
│  │          │  │  upload, theme, user menu)           │ │
│  │ ──────── │  │                                      │ │
│  │ Chat  💬 │  │                                      │ │
│  │ Docs  📄 │  │        Main Content Area             │ │
│  │ Colls 📁 │  │                                      │ │
│  │ Tmpls 📝 │  │                                      │ │
│  │ Conn  🔗 │  │                                      │ │
│  │          │  │                                      │ │
│  │ ──────── │  │                                      │ │
│  │ Profile  │  │                                      │ │
│  │ Logout   │  │                                      │ │
│  └──────────┘  └──────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Changes

1. **App sidebar stays** but gets slimmer (icons + labels, no separate admin section for non-admins)
2. **Conversation sidebar becomes a toggle drawer** — accessible via a "History" button in the chat header
3. **Drawer opens as an overlay**, not a permanent panel
4. **Active state is clear** — current page highlighted, conversation history accessible but not dominant
5. **Mobile** — sidebar becomes a slide-out sheet (already exists), conversation history accessible via the same header button

### Benefits

- New users see one clean sidebar, not a wall of navigation
- Chat area gets ~256px more width
- Conversation history is still one click away, just not always visible

### Implementation

- Modify `components/app-shell.tsx` to remove the permanent conversation sidebar
- Modify `components/chat-header.tsx` to add a "History" button that toggles the conversation drawer
- Conversation drawer becomes a `Sheet` component (slide from left) instead of a permanent sidebar
- State management: `isConversationDrawerOpen` in `ChatPage` component

---

## Section 2: Onboarding Wizard

### Trigger

First-time users who have never uploaded a document and have zero conversations.

### Flow

3-step modal that appears on the chat page (the landing page).

**Step 1: Upload**
- Drag-and-drop zone with file picker
- Accepts PDF, DOCX, MD (same as current upload)
- "Skip for now" — users who already have documents skip the wizard entirely
- "Next" becomes active only after a file is selected

**Step 2: Ask**
- Shows the uploaded document name as context
- Pre-fills a sample question or lets them type their own
- "Send" actually sends the message and closes the wizard
- The real RAG response appears in the chat with citations

**Step 3: Explore**
- Brief celebration ("You're all set!")
- One suggestion: "Create a collection to focus your searches"
- "Go to Chat" closes the wizard and lands them in the normal chat view

### Persistence

- Wizard state stored in `localStorage` (`doc-expert:onboarding-complete`)
- Once completed (or skipped), never shows again
- If user skips, the progress checklist still appears (see Section 3)

### Component Structure

```typescript
// components/onboarding-wizard.tsx
interface OnboardingWizardProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

// Steps:
// 1. UploadStep - file upload with drag-and-drop
// 2. AskStep - pre-filled question input
// 3. ExploreStep - celebration + next suggestion
```

### Benefits

- New users aren't dropped into an empty chat with no guidance
- The core loop (upload → ask → cited answer) is demonstrated hands-on
- Users see the value within 60 seconds

---

## Section 3: Progress Checklist

### Trigger

Appears after the wizard completes (or is skipped), as a floating widget in the bottom-right corner of the chat page.

### Visual Design

```
┌─────────────────────────────────────┐
│  Getting Started               [×]  │
│  ─────────────────────────────────  │
│  ✓ Upload a document                │
│  ✓ Ask your first question          │
│  ○ Create a collection              │
│  ○ Try cross-document search        │
│                                     │
│  2 of 4 complete                    │
└─────────────────────────────────────┘
```

### States

- **Collapsed** (default) — small pill showing "2/4 complete" with a progress bar
- **Expanded** — click the pill to see the full checklist
- **Dismissed** — user can close it, but it reappears on next visit until all items are complete
- **Completed** — once all 4 items are done, the widget disappears permanently

### Progress Tracking

Each item checks a condition:
- "Upload a document" — `documents.length > 0`
- "Ask your first question" — `conversations.length > 0 && messages.length > 0`
- "Create a collection" — `collections.length > 0`
- "Try cross-document search" — user has asked a question with `collectionId` set, OR has multiple documents in a collection and asked a question

### Integration with Progressive Disclosure

When the user completes "Ask your first question", a toast appears: "Nice! Tip: Create a collection to focus on specific documents"

When they complete "Create a collection", another toast: "Great! Now try asking a question scoped to that collection"

These toasts are non-blocking and dismissible.

### Component Structure

```typescript
// components/progress-checklist.tsx
interface ProgressChecklistProps {
  // Checks these conditions to determine progress
  hasDocuments: boolean;
  hasConversations: boolean;
  hasCollections: boolean;
  hasScopedSearch: boolean;
}

// States: collapsed, expanded, dismissed, completed
```

### Benefits

- Users have a clear sense of progress
- Each step teaches the next capability
- Reduces the "what do I do now?" feeling after the wizard

---

## Section 4: Contextual Hints (Progressive Disclosure)

### Principle

Teach features at the moment they become relevant, not before.

### Hint Triggers and Content

| Trigger | Hint | Placement |
|---------|------|-----------|
| User asks 3rd question (no collection selected) | "Tip: Create a collection to focus your search on specific documents" | Toast notification, bottom-right, 5s auto-dismiss |
| User views a document for the first time | "You can share this document with others using the Share button" | Inline tooltip near the Share button |
| User opens Documents page with 0 documents | "Upload documents here, or connect Google Drive / Microsoft 365 to sync automatically" | Empty state (already partially exists) |
| User creates first collection but adds 0 documents | "Add documents to your collection to start asking scoped questions" | Empty state inside collection detail |
| User completes a conversation with 5+ messages | "You can export this conversation or share it with others" | Subtle link below the last message |

### Design Rules for Hints

- **One hint at a time** — never stack multiple hints
- **Cooldown** — same hint type won't show again for 7 days after dismissal
- **Non-blocking** — always dismissible, never modal
- **Actionable** — each hint either explains a feature or links to where the action happens
- **Track completions** — if a user acts on a hint (e.g., creates a collection after the collection hint), mark that checklist item complete

### Implementation

```typescript
// hooks/use-onboarding-hints.ts
interface Hint {
  id: string;
  trigger: () => boolean;
  content: string;
  placement: 'toast' | 'tooltip' | 'inline';
  cooldownDays: number;
}

// Hook checks user state against trigger conditions
// Returns active hints to display
export function useOnboardingHints(): Hint[] {
  // Check localStorage for hint history
  // Evaluate triggers
  // Return hints that should show
}
```

Hint definitions in a config file (`lib/onboarding/hints.ts`)

State persisted in `localStorage` (`doc-expert:hint-history`)

Toast uses the existing `sonner` toast system

### Benefits

- Users discover collections, sharing, and connectors organically
- No need for a separate "help" section or documentation
- Reduces the gap between "I uploaded a doc" and "I'm using collections and connectors"

---

## Section 5: Smart Empty States

### Current State

Empty states exist but are generic — "No documents yet", "No conversations", "No collections". They don't guide the user to the next action or explain the context.

### New State

Every empty state becomes a contextual onboarding moment.

### Design Pattern

```
┌─────────────────────────────────────┐
│                                     │
│         [Relevant Icon]             │
│                                     │
│    Clear headline explaining        │
│    what goes here                   │
│                                     │
│    Brief explanation of WHY         │
│    this matters                     │
│                                     │
│    [Primary CTA]                    │
│                                     │
│    Optional: secondary action       │
│    or "Learn more" link             │
│                                     │
└─────────────────────────────────────┘
```

### Specific Empty States

**Chat page (no conversations):**
- Icon: 💬
- Headline: "Start a conversation"
- Explanation: "Upload a document and ask questions to get AI-powered answers with citations"
- Primary CTA: "Upload your first document"
- Secondary: "Or connect Google Drive" (if connectors are available)

**Documents page (no documents):**
- Icon: 📄
- Headline: "No documents yet"
- Explanation: "Upload documents or connect external sources to make them searchable with AI"
- Primary CTA: "Upload document"
- Secondary: "Connect Google Drive" / "Connect Microsoft 365"

**Collections page (no collections):**
- Icon: 📁
- Headline: "No collections yet"
- Explanation: "Collections let you group documents and ask focused questions about specific topics"
- Primary CTA: "Create your first collection"
- Secondary: "Learn more about collections" (links to docs or tooltip)

**Collection detail (empty collection):**
- Icon: 📄
- Headline: "This collection is empty"
- Explanation: "Add documents to start asking scoped questions"
- Primary CTA: "Add documents"
- Secondary: "Browse your documents"

**Templates page (no user templates):**
- Icon: 📝
- Headline: "No custom templates yet"
- Explanation: "Save frequently asked questions as templates for quick access"
- Primary CTA: "Create template"
- Secondary: Shows system default templates below with "Try a template" button

**Connectors page (no connectors connected):**
- Icon: 🔗
- Headline: "No connectors connected"
- Explanation: "Connect external data sources to automatically sync documents"
- Primary CTA: "Connect Google Drive" / "Connect Microsoft 365"
- Secondary: "Learn about connectors"

### Benefits

- Every empty state becomes a teaching moment
- Users understand what each feature does before they use it
- Clear CTAs reduce the "what do I do here?" friction

---

## Section 6: Transitions, Loading States, and Polish

### Page Transitions

**Chat → Document Detail:**
- Click a document link in chat → the document detail page slides in from the right
- "Back to Chat" button in the header (already exists) provides clear return path
- Breadcrumb: "Chat > Document Name" so users know where they are

**Chat → Collection Detail:**
- Click collection name in chat header → collection detail slides in from the right
- Breadcrumb: "Chat > Collection Name"
- "Back to Chat" returns to the same conversation state

**Documents → Document Detail:**
- Click document row → detail view slides in
- Breadcrumb: "Documents > Document Name"
- "Back" returns to the document list with filters preserved

**General rule:** Any drill-down navigation slides right-to-left. Going "back" slides left-to-right. Uses CSS transitions (200ms ease-in-out), not heavy animation libraries.

### Loading States

**Replace "Loading..." text with contextual skeletons:**

| Screen | Current | New |
|--------|---------|-----|
| App shell | "Loading..." text | Skeleton sidebar + skeleton content area |
| Chat messages | Nothing (blank until loaded) | Skeleton message bubbles |
| Document list | "Loading..." text | Skeleton document rows (3-5 rows) |
| Document detail | "Loading document..." text | Skeleton document viewer |
| Collection list | "Loading..." text | Skeleton collection cards |
| Connectors | "Loading connectors..." with spinner | Skeleton connector cards |

**Implementation:** Use the existing `PageLoading` component as a base, but create screen-specific skeleton variants that match each page's layout.

### Micro-interactions

**Upload progress:**
- Current: Upload dialog shows progress bar
- New: Add a subtle animation — document icon "flies" from the upload dialog to the sidebar Documents icon, reinforcing that the document is now available

**Send message:**
- Current: Message appears, then AI response streams in
- New: Same flow, but add a subtle "thinking" indicator (pulsing dots) before the stream starts, so users know the AI is processing

**Conversation switch:**
- Current: Messages load instantly (sometimes with a flash)
- New: Fade transition (150ms) between conversation content

### Error States

**Current:** Errors show as red text or toast notifications

**New:**
- **Recoverable errors** (network timeout, failed upload) → inline error with "Retry" button
- **Permanent errors** (document not found, permission denied) → full-page error state with "Go back" and "Go home" buttons
- **AI errors** (model unavailable) → inline error in chat with "Try again" button, preserves the user's message

### Accessibility

- All transitions respect `prefers-reduced-motion` — disabled users see instant changes
- Skeleton loaders have `aria-busy="true"` and `aria-live="polite"`
- Focus management: when a drawer opens, focus moves to the drawer; when it closes, focus returns to the trigger button

### Benefits

- App feels polished and intentional, not janky
- Users always know where they are and how to get back
- Loading states set expectations and reduce perceived wait time

---

## Success Metrics

Track these to measure the redesign's impact:

1. **Time to first value** — time from landing page to first AI response with citations (target: < 2 minutes)
2. **Onboarding completion rate** — % of new users who complete the wizard (target: > 70%)
3. **Checklist completion rate** — % of users who complete all 4 checklist items within 7 days (target: > 50%)
4. **Feature discovery** — % of users who create a collection within 7 days (target: > 30%)
5. **Drop-off points** — track where users abandon the flow (upload, first question, collection creation)

## Implementation Phases

### Phase 1: Navigation (Week 1)
- Convert conversation sidebar to a toggle drawer
- Add "History" button to chat header
- Test on desktop and mobile

### Phase 2: Onboarding Wizard (Week 2)
- Build 3-step wizard component
- Integrate with existing upload and chat flows
- Add localStorage persistence

### Phase 3: Progress Checklist (Week 3)
- Build floating checklist widget
- Implement progress tracking logic
- Connect to hint system

### Phase 4: Contextual Hints (Week 4)
- Build hint trigger system
- Create hint definitions
- Integrate with toast notifications

### Phase 5: Smart Empty States (Week 5)
- Redesign all empty states
- Add contextual CTAs
- Test with new users

### Phase 6: Transitions & Polish (Week 6)
- Add page transitions
- Build skeleton loaders
- Implement micro-interactions
- Accessibility audit

## Technical Debt & Risks

1. **State management complexity** — tracking onboarding progress, hint history, and checklist state requires careful localStorage management
2. **Mobile responsiveness** — conversation drawer and checklist widget need to work well on small screens
3. **Analytics** — need to implement tracking for success metrics before launch
4. **Backward compatibility** — existing users who skip the wizard should still see the checklist

## Future Enhancements (Out of Scope)

- Interactive product tour (step-by-step walkthrough with highlights)
- Video tutorials embedded in empty states
- Personalized onboarding based on user role (admin vs. editor vs. viewer)
- A/B testing different wizard flows
- Gamification (badges, streaks) for power users
