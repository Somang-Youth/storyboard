# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # Start dev server (http://localhost:3000)
pnpm build        # Production build
pnpm lint         # ESLint (flat config, Next.js core-web-vitals + typescript)
```

## Architecture

Next.js 16 App Router project using React 19, Tailwind CSS v4, and TypeScript.

**UI Component System:** Uses shadcn/ui v3 with the `base-nova` style variant. Components are built on `@base-ui/react` primitives (not Radix). The icon library is `@hugeicons/react` with `@hugeicons/core-free-icons`.

- `components/ui/` — shadcn component library (managed by `shadcn` CLI, style: base-nova, base color: stone)
- `components/` — app-level composed components
- `lib/utils.ts` — `cn()` helper (clsx + tailwind-merge)
- `app/` — Next.js App Router pages and layouts

**Path aliases:** `@/*` maps to project root (e.g., `@/components/ui/button`, `@/lib/utils`).

**Styling:** Tailwind CSS v4 with PostCSS plugin. Design tokens are CSS custom properties defined in `app/globals.css` using oklch colors. Light/dark mode supported via `.dark` class.

**Adding UI components:** Use `pnpm dlx shadcn@latest add <component>` — this respects `components.json` config for paths, style, and icon library.
