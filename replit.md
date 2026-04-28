# TRIXHUB — Plateforme d'Affiliation Africaine

## Overview

TRIXHUB est une plateforme d'affiliation professionnelle ciblant l'Afrique francophone. Elle permet à des membres de gagner des commissions en parrainant de nouveaux inscrits sur 3 niveaux de réseau.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (artifacts/trixhub) — routes via wouter, state via TanStack Query, UI via shadcn/ui + Tailwind CSS
- **API framework**: Express 5 (artifacts/api-server)
- **Database**: PostgreSQL + Drizzle ORM (lib/db)
- **Validation**: Zod (lib/api-zod), OpenAPI codegen via Orval (lib/api-client-react)
- **Auth**: JWT tokens (jsonwebtoken + bcryptjs), stored in localStorage as `trixhub_token`
- **Build**: esbuild (for API server)

## Business Logic

- **Inscription**: gratuite
- **Activation**: 3 600 FCFA (paiement unique via mobile money)
- **Commissions de parrainage**:
  - Niveau 1 (filleul direct): 1 700 FCFA
  - Niveau 2: 700 FCFA
  - Niveau 3: 300 FCFA
- **Mécanisme inactif/actif**: à l'inscription d'un filleul, la commission va en `inactive_balance`. Elle est transférée en `referral_balance` seulement quand le filleul active son compte.
- **Retrait minimum**: 3 000 FCFA
- **Devises**: FCFA de base, conversion multi-devises possible (EUR, USD, GBP, etc.)
- **Anti-fraude**: validation des références de paiement, compte isBanned

## Architecture

### Frontend (artifacts/trixhub/src)
- `App.tsx` — router principal (wouter), QueryClient, providers
- `context/AuthContext.tsx` — gestion JWT, fetchUser, login/logout
- `context/ThemeContext.tsx` — dark/light mode
- `components/Layout.tsx` — sidebar navigation
- `pages/` — register, login, activate, dashboard, team, teamLevel, tasks, withdrawals, profile, formations, bonus/canva, bonus/vpn
- `lib/currency.ts` — `formatLocal(amount, target)`, `resolveCurrency(target)`, `convertFromFcfa(amount, target)`, `formatLocalWithFcfa(amount, target)`. `target` peut être un nom de pays OU un objet user `{ country, preferredCurrency }`. Priorité : `preferredCurrency` (si ≠ "FCFA" et supportée) → mapping pays → fallback FCFA.

### Backend (artifacts/api-server/src)
- `routes/auth.ts` — register, login, logout, me, activate
- `routes/users.ts` — dashboard, updateProfile, updateCurrency
- `routes/referrals.ts` — team, referralsByLevel, activity
- `routes/balances.ts` — balances summary
- `routes/withdrawals.ts` — list, request withdrawal
- `routes/tasks.ts` — list, complete task
- `routes/config.ts` — platform config, currency rates
- `lib/auth.ts` — hashPassword, comparePassword, generateToken, generateReferralCode
- `lib/currency.ts` — getRates() hardcoded exchange rates

### Database (lib/db/src/schema.ts)
Tables: users, balances, transactions, withdrawals, tasks, user_tasks, sessions

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Auth Flow

1. JWT token stored in `localStorage` as `trixhub_token`
2. `setAuthTokenGetter` called in `main.tsx` to inject token into all API calls via custom-fetch
3. `AuthContext` fetches `/api/auth/me` on mount to hydrate user state
4. Protected routes redirect to `/login` if no token, to `/activate` if not activated

## Design

- Couleur principale: vert émeraude (hsl 142 71%)
- Couleur accent: or/doré (hsl 45 93%)
- Mode sombre par défaut
- Polices: Inter (UI) + Space Grotesk (amounts/amounts display)
- Tout en français
