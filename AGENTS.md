# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # Start dev server (http://localhost:3000)
pnpm build        # Production build
pnpm lint         # ESLint (flat config, Next.js core-web-vitals + typescript)
npx drizzle-kit generate  # Generate DB migrations
set -a && source .env.local && set +a && npx drizzle-kit push  # Push schema to DB (requires .env.local)
```

## Architecture

Next.js 16 App Router project using React 19, Tailwind CSS v4, and TypeScript. Korean-language worship service setlist (콘티) management tool.

**Tech Stack:**
- **DB**: Vercel Postgres (Neon) with Drizzle ORM — schema in `lib/db/schema.ts`
- **File Storage**: Vercel Blob for sheet music images/PDFs
- **Auth**: Shared password with HMAC-signed cookie via Next.js middleware
- **UI**: shadcn/ui v3 (base-nova style), @base-ui/react primitives (NOT Radix — no `asChild`, use `render` prop), @hugeicons/react icons

**Key Directories:**
- `lib/db/` — Drizzle schema, client, JSON serialization helpers
- `lib/queries/` — Data fetching functions (songs, contis)
- `lib/actions/` — Server actions for mutations (songs, sheet-music, contis, conti-songs)
- `lib/auth.ts` — Web Crypto API token signing (Edge Runtime compatible)
- `app/(authenticated)/` — Route group with auth layout, sidebar navigation
- `app/login/` — Password login page
- `components/songs/` — Song CRUD components + sheet music upload/gallery
- `components/contis/` — Conti CRUD components + override editors (key, tempo, sections, lyrics, section-lyrics mapper)
- `components/layout/` — App shell, sidebar, page header
- `components/ui/` — shadcn managed components

**Data Model:**
- `songs` — Independent, reusable across contis
- `sheet_music_files` — Multiple images/PDFs per song (Vercel Blob URLs)
- `contis` — Identified by date + title
- `conti_songs` — Junction table with per-conti overrides: keys[], tempos[], sectionOrder[], lyrics[], sectionLyricsMap (index-based Record<number, number[]>)

**Path aliases:** `@/*` maps to project root.

**Environment Variables:** See `.env.example` for required vars (AUTH_PASSWORD, AUTH_SECRET, POSTGRES_URL, BLOB_READ_WRITE_TOKEN).

**Adding UI components:** `pnpm dlx shadcn@latest add <component>` — respects `components.json` config.

**Important patterns:**
- Server Actions for mutations with `'use server'` directive
- All actions return `{ success: boolean, error?: string, data?: T }`
- JSON columns stored as text in PostgreSQL, parsed via helpers in `lib/db/helpers.ts`
- Icons: `<HugeiconsIcon icon={IconName} strokeWidth={2} />` — never use icons as JSX directly
