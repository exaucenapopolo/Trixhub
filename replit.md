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
Tables: users, balances, transactions, withdrawals, tasks, user_tasks, sessions, swychr_transactions
- `users` : `is_admin`, `canva_requested_at`, `formation_requested_at`, `formation_requested_title` (anti-fraude demandes uniques), `last_daily_bonus_at` (bonus quotidien), `avatar_url` (photo de profil, chemin Object Storage).
- `balances` : ajout `bonus_balance`, `deposit_balance` (Vague 2/3) — defaults "0", contrainte UNIQUE sur `user_id`.
- `user_tasks` : contrainte UNIQUE multi-colonne `(user_id, task_id)` — anti double-claim concurrent.
- `withdrawals` : `proof_url`, `proof_token`, `proof_uploaded_at`.
- `swychr_transactions` : tracking paiements AccountPE (purpose: activation|deposit|child_activation, target_user_id, status pending/SUCCESS/FAILED).

### Vague 2/3 — Atomicité financière (PASS architect)
Tous les flux financiers sont atomiques et observables :
- `lib/activation.ts` : `activateUserTx` (UPDATE conditionnel `WHERE is_activated=false RETURNING` + crédit bonus +800 + commissions N1/N2/N3 dans une seule tx) ; `creditDepositTx` strict ; `creditCommissionTx` avec upsert balance ON CONFLICT DO NOTHING.
- `lib/dailyBonus.ts` : `claimDailyBonusIfDue` UPDATE conditionnel sur `last_daily_bonus_at::date < CURRENT_DATE RETURNING` puis crédit +5 bonus dans la même tx.
- `routes/swychr.ts` : `handlePaymentSuccess` en UNE transaction (UPDATE `WHERE status='pending' RETURNING` pour idempotence + effets métier dans la même tx + refund vers solde dépôt si race sur activation/child_activation). `GET /swychr/status` renvoie la vérité INTERNE (refreshed.status après traitement).
- `routes/referrals.ts` : `POST /referrals/activate-child/:childId` (source: deposit|referral|swychr) — débit conditionnel `WHERE balance >= cost RETURNING` + activateUserTx + rollback si race.
- `routes/auth.ts` : `/auth/register` en transaction unique (insert user, generate code, insert balance, commissions inactives N1/N2/N3 + logs). Logs explicites sur dérive de données (referrer N2/N3 introuvable).
- `routes/tasks.ts` : `/tasks/:id/complete` en tx + UNIQUE(user_id, task_id) catch 23505 + UPDATE balance strict.
- `scripts/post-merge.sh` : `pnpm --filter db push-force` puis backfill idempotent des balances manquantes.

### Frontend Vague 2/3
- `pages/dashboard.tsx` : refonte avec HeroBalance animé (count-up) + HeroReferralLink séparé + 4 BalanceCard (parrainage / missions / bonus / dépôt) + activité.
- `pages/depot.tsx` : page dépôt via Swychr (montant libre + polling status + bouton "Vérifier maintenant").
- `components/ActivateChildModal.tsx` : modal 3 méthodes pour activer un filleul N1 inactif (solde dépôt 3600, solde parrainage 4100=3600+500 frais, paiement direct Swychr).
- `pages/teamLevel.tsx` : bouton "Activer" sur N1 inactifs.
- `hooks/use-count-up.ts` : animation count-up des montants.

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
