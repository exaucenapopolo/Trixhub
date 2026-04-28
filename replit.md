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
- `routes/auth.ts` — register, login, logout, me, activate. `/me` retourne aussi `isAdmin`, `canvaRequestedAt`, `formationRequestedAt`, `formationRequestedTitle`.
- `routes/users.ts` — dashboard, updateProfile, updateCurrency. `formatUser` partagé avec auth.
- `routes/referrals.ts` — team, referralsByLevel, activity
- `routes/balances.ts` — balances summary
- `routes/withdrawals.ts` — list, request withdrawal (atomic conditional UPDATE par source de solde — anti race condition). POST /:id/proof (multipart 5Mo PNG/JPG/WEBP, génère un token signé). Routes admin protégées par `requireAdmin` : GET /admin/withdrawals + PATCH /admin/withdrawals/:id/status (machine d'état pending→processing/completed/rejected, processing→completed/rejected ; transitions atomiques via UPDATE conditionnel sur statut courant ; rollback solde + withdrawnAmount si rejet, dans une seule transaction).
- `routes/contact.ts` — POST /contact/canva, /contact/formation, /contact/assistance. Anti-fraude **atomique** via UPDATE conditionnel `WHERE *_requested_at IS NULL RETURNING` AVANT envoi Twilio ; rollback du stamp si Twilio échoue. Anti-spam additionnel 30s par user/type.
- `routes/storage.ts` — GET /storage/public-objects/* (assets publics). GET /storage/proofs/:withdrawalId/:token : URL signée pour preuves de retrait, vérification via `timingSafeEqual` du token stocké en DB. Plus de route publique /storage/objects/* (sécurité).
- `routes/missions.ts` — quizz (questions tirées et notées côté serveur, banque privée), vidéo (session start + complete avec vérification 30s côté serveur). Réservation atomique via INSERT ... WHERE NOT EXISTS pour empêcher double-credit.
- `routes/tasks.ts` — list, complete task
- `routes/config.ts` — platform config, currency rates
- `middlewares/requireAdmin.ts` — vérifie `users.is_admin = true` après authenticate.
- `lib/auth.ts` — hashPassword, comparePassword, generateToken, generateReferralCode
- `lib/currency.ts` — getRates() hardcoded exchange rates
- `lib/twilio.ts` — `sendWhatsAppToAssistance(message)` vers `TWILIO_WHATSAPP_TO`.
- `lib/withdrawalReports.ts` — 3 helpers : `reportWithdrawalCreated`, `reportWithdrawalStatusChange`, `reportWithdrawalProof`. Best-effort, n'interrompent jamais la requête.
- `lib/uploadProof.ts` — `uploadProofImage()` upload vers Object Storage Replit (`@google-cloud/storage` + sidecar) et génère un token aléatoire 256 bits ; `getPublicProofUrl(req, withdrawalId, token)` construit l'URL signée.
- `lib/objectStorage.ts` — wrapper Google Cloud Storage via le sidecar Replit (signed URLs).

### Database (lib/db/src/schema.ts)
Tables: users, balances, transactions, withdrawals, tasks, user_tasks, sessions
- `users` : ajout `is_admin`, `canva_requested_at`, `formation_requested_at`, `formation_requested_title` (anti-fraude demandes uniques).
- `withdrawals` : ajout `proof_url`, `proof_token`, `proof_uploaded_at` (preuve de paiement avec URL signée par token).

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
