# Amy AI (LearnAI / Atlas Learn / EduAmy) — Next.js Migration & Development Plan

> Current state: FastAPI + SQLAlchemy + SQLite backend, Vue.js + Pinia frontend.
> Target: **Next.js 14+ (App Router)** frontent/full-stack layer, same FastAPI backend.

---

## 0. Strategy: Koto ta Next.js e, koto ta FastAPI te?

| Concern | Where it lives | Why |
|---|---|---|
| Auth (JWT/session) | FastAPI | Already built; keep single source of truth |
| Payments (SSLCommerz/bKash/Nagad) | FastAPI | Webhook/callback handling server-side, signature verification |
| AI tutor (Amy) LLM calls | FastAPI | Quota enforcement, cost control already there |
| **BFF / Server Proxy** | **Next.js Route Handlers + Server Actions** | Hide backend URL & tokens from client, SSR data fetching |
| Pages/UI/State | Next.js (RSC + client components) | Replace Vue/Pinia |
| Gamification UI (XP, streak) | Next.js client + SWR/TanStack Query | Real-time-ish polling like current notification system |

**Recommendation:** Keep FastAPI as the API core (don't rewrite to Next.js API routes).
Next.js becomes the app layer with a thin BFF proxy (`/api/[...path]` route handler → FastAPI).
This lets you migrate page-by-page without downtime.

---

## 1. Tech Stack (Target)

- **Framework:** Next.js 14/15 App Router, TypeScript strict
- **Styling:** Tailwind CSS + CSS custom properties (port your existing dark/light theme vars directly)
- **State:** Zustand (Pinia-er closest replacement, lightweight) + TanStack Query for server state
- **Forms:** react-hook-form + zod
- **PWA:** `@ducanh2912/next-pwa` (or `@serwist/next`) — network-first caching port
- **Charts:** Recharts (Progress page charts replacement)
- **Auth storage:** httpOnly cookie via Next proxy + JWT in memory (avoid localStorage XSS)
- **Realtime (later):** SSE from FastAPI instead of polling (upgrade path from current polling notifications)

---

## 2. Phase-wise Roadmap

### Phase 1 — Scaffold & Foundation (Week 1)
- [ ] `npx create-next-app@latest amy-ai --ts --tailwind --app --src-dir`
- [ ] Project structure:
```
src/
  app/
    (auth)/login, register
    (main)/            ← wrapped by AppLayout
      dashboard
      amy/page.tsx     ← AI tutor chat
      courses/, courses/[id]
      profile, progress
      payment
      admin/           ← role-guarded
    api/proxy/[...path]/route.ts   ← BFF
  components/{layout,ui,amy,gamification}
  stores/{theme,notifications,progress}.ts   ← Zustand ports
  lib/{api.ts, auth.ts, format.ts}
  middleware.ts        ← route protection (auth + admin)
```
- [ ] Port CSS variables (dark/light) into `globals.css`; theme via `next-themes` + class strategy
- [ ] `.env.local`: `NEXT_PUBLIC_API_URL`, `API_INTERNAL_URL`, SSLCommerz keys stay **backend only**

### Phase 2 — Auth & API Layer (Week 2)
- [ ] BFF route handler: forward cookies/Bearer, stream responses (needed for Amy chat streaming)
- [ ] Login/Register pages → set httpOnly session cookie via Server Action
- [ ] `middleware.ts`: protect `(main)` routes; role check for `/admin`
- [ ] TanStack Query hooks per domain: `useCourses`, `useEnrollments`, `useNotifications`, `useStreak`, `usePayments`
- [ ] Migrate Pinia stores → Zustand (theme store = trivial; notifications = polling loop in a client provider; progress = derived from queries, drop local cache)

### Phase 3 — Core UI Port (Weeks 3–4)
- [ ] **AppLayout**: header w/ notification bell (dropdown + unread badge), XP bar, mobile hamburger → drawer (`vaul` or custom), bottom tab bar for native feel
- [ ] **Amy tutor page**: compact flat header, small circular avatar, slim control bar, flex chat area — rebuild as RSC shell + client chat component; support SSE/streaming token render
- [ ] **Dashboard**: streak calendar, daily goal ring, continue-learning cards
- [ ] **Courses + enrollment flow** (free/paid gating → redirect to /payment)
- [ ] Profile & Progress pages (Recharts: XP over time, accuracy per subject)

### Phase 4 — Payments End-to-End (Week 5) ← *your top priority*
- [ ] SSLCommerz: initiate from Next page → FastAPI creates txn → redirect → **callback handled in FastAPI** (`/payments/sslcommerz/ipn`), success/fail/cancel pages in Next read txn status via query
- [ ] bKash/Nagad manual: user submits TrxID → pending Payment row → admin verification queue in `/admin/payments` (build this admin table first so testing has a path)
- [ ] Test matrix (do these explicitly):
  - [ ] Sandbox gateway: success / fail / cancel / user-abandons-midway
  - [ ] Duplicate IPN delivery (idempotency on transaction ID)
  - [ ] Manual entry: wrong TrxID, duplicate TrxID, admin reject → refund/unenroll state
  - [ ] Enrollment created **only** after verified payment (verify FK/trigger logic in FastAPI)
  - [ ] Quota/AI access revoked if payment later rejected
- [ ] Money discipline: all amounts integer **BDT poisha**, no floats

### Phase 5 — PWA & Mobile Feel (Week 6)
- [ ] Serwist/@ducanh2912 config:
  - Network-first for `/api/*` and HTML (matches your current strategy)
  - Precache static shell + offline fallback page (`/offline`)
  - Stale-while-revalidate for course metadata (read-only content)
- [ ] Manifest: name/icons/theme_color/start_url=/dashboard; iOS meta fixes
- [ ] Offline behavior test: airplane mode → cached Amy history readable, mutations queued or gracefully blocked with banner
- [ ] Install prompt UX, safe-area insets, 60fps drawer animations

### Phase 6 — Admin & Analytics (Week 7)
- [ ] Admin dashboard port: users, courses, enrollments, payments queue
- [ ] Admin Analytics page: DAU/WAU, retention cohorts, funnel (signup→first lesson→paid), AI quota usage
- [ ] CSV export endpoints from FastAPI

### Phase 7 — Engagement & Gamification v2 (Week 8+)
- [ ] Push notifications (web-push) replacing polling where supported
- [ ] Duolingo-style: leagues (weekly XP brackets), hearts/stamina option, daily streak freeze item
- [ ] Bangladesh-specific content modules (Bangla medium toggle, HSC/SSC curriculum mapping, local exam patterns)
- [ ] Leaderboards (friends/global), shareable streak cards

---

## 3. Vue → Next.js Concept Mapping (for your existing code)

| Vue/Pinia (current) | Next.js target |
|---|---|
| `router-view` + AppLayout slot | `(main)` route group layout |
| Pinia theme store | `next-themes` + tiny Zustand or just ThemeProvider |
| Pinia notifications store (polling) | Client `NotificationProvider` + TanStack Query `refetchInterval` |
| Pinia progress store | Derived query cache; optimistic updates via `useMutation.onMutate` |
| `v-if` role guards in components | `middleware.ts` + server-side session check in layouts |
| Axios interceptors for auth | Wrapper `lib/api.ts` fetch client hitting `/api/proxy` |
| Vue transitions on drawer | CSS/Framer Motion; `vaul` drawer |

---

## 4. Immediate Next Steps (this week, ordered)

1. Scaffold Next.js app inside repo as `frontend-next/` (keep old Vue app running as reference during port)
2. Build BFF proxy + login flow through it — proves auth end-to-end early
3. Port AppLayout + theme (visual parity checkpoint)
4. Port Amy chat page with streaming (highest-value feature)
5. Start **Phase 4 payment test matrix** against sandbox SSLCommerz — parallel track, since it's your stated priority
6. Wire PWA manifest + service worker once dashboard is stable (install-test on Android)

---

## 5. Risks & Decisions to lock down

- **Decision:** Streaming vs polling for Amy chat — go SSE now, WebSocket later only if needed.
- **Risk:** Dual frontends during migration → freeze Vue feature additions; only bug fixes on old app.
- **Risk:** SQLite in production with concurrent payment IPNs → switch to Postgres before launch (SQLAlchemy makes this a connection-string change + migration via Alembic).
- **SEO not a priority** (app-like product) but RSC still wins on first-load performance — use it anyway.
- Keep all secrets (SSLCommerz store ID/key) out of Next.js bundle; `NEXT_PUBLIC_*` prefix discipline.
