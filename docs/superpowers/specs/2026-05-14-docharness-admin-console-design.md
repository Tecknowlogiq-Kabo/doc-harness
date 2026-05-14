# DocHarness Admin Console — Design Spec

**Date:** 2026-05-14 | **Scope:** Full UI redesign to admin panel/console

## Goal

Transform DocHarness from a simple 3-page app into a professional admin console with sidebar navigation, dashboard overview, data tables, and settings management.

## Architecture

### Layout System

```
packages/web/src/
├── components/
│   ├── sidebar.tsx              # Persistent sidebar nav
│   ├── stat-card.tsx            # Dashboard metric card
│   ├── data-table.tsx           # Reusable data table
│   ├── status-badge.tsx         # Status indicator pill
│   ├── error-boundary.tsx       # Already exists
│   └── page-header.tsx          # Consistent page header
├── app/
│   ├── layout.tsx               # [MODIFY] Wrap with sidebar layout
│   ├── page.tsx                 # [MODIFY] Redirect to /dashboard
│   ├── dashboard/page.tsx       # [NEW] Stats + recent sessions + quick gen
│   ├── generate/page.tsx        # [NEW] Prompt input + doc type selection
│   ├── sessions/page.tsx        # [MODIFY] Data table with filters
│   ├── session/[id]/page.tsx    # [MODIFY] Sidebar-aware layout
│   └── settings/page.tsx        # [NEW] Configuration form
```

### Visual System

Enterprise Dark palette, enhanced with glassmorphism cards:

| Token | Value | Tailwind |
|-------|-------|----------|
| bg | `#09090b` | `bg-zinc-950` |
| surface | `#18181b` | `bg-zinc-900` |
| surface-hover | `#27272a` | `bg-zinc-800` |
| border | `#27272a` | `border-zinc-800` |
| primary | `#7c3aed` | `text-violet-500` |
| text | `#fafafa` | `text-zinc-50` |
| muted | `#a1a1aa` | `text-zinc-400` |
| success | `#22c55e` | `text-green-500` |
| warning | `#eab308` | `text-yellow-500` |
| error | `#ef4444` | `text-red-500` |

### Pages

**1. Dashboard (`/dashboard`, new landing page)**
- Stats row: Total Sessions, Documents Generated, Success Rate, Avg Pipeline Time
- Recent Sessions table (last 10, clickable rows)
- Quick Generate card (compact prompt input)

**2. Generate (`/generate`)**
- Doc type checklist (18 types grouped by track)
- Prompt textarea
- Advanced options: model selector, debate rounds slider
- Generate button → redirects to session page

**3. History (`/sessions`)**
- Data table: ID, Prompt (truncated), Doc Count, Status, Created, Actions
- Search input (filters client-side)
- Status filter dropdown
- Click row → session detail

**4. Session Detail (`/session/[id]`)**
- Keep existing SSE pipeline dashboard
- Add sidebar context

**5. Settings (`/settings`)**
- Model selection dropdown
- API key input (masked)
- Output directory preference
- Debate batch size slider

### Sidebar Component

```
┌──────────────┐
│  DocHarness   │  Logo/brand
│  ───────────  │  Divider
│  ■ Dashboard  │  Active: violet bg + white text
│  ○ Generate   │  Inactive: zinc-400, hover: zinc-200
│  ○ History    │
│  ○ Settings   │
│               │
│  ───────────  │  Divider
│  ⚙ API Status │  Footer: API key check indicator
└──────────────┘
```

Collapses to icon-only on screens < 768px. Uses a hamburger toggle.

### Success Criteria
1. Sidebar navigation works on all pages
2. Dashboard shows live stats from SQLite store
3. Generate page has doc type selection
4. History is a searchable data table
5. Settings page saves preferences
6. All existing SSE pipeline functionality preserved
