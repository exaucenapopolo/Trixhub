# TRIXHUB

TRIXHUB is an African affiliate marketing platform enabling users to earn commissions by referring new members across a 3-level network.

## Run & Operate

- **Typecheck:** `pnpm run typecheck`
- **Build:** `pnpm run build`
- **Codegen (API):** `pnpm --filter @workspace/api-spec run codegen`
- **DB Push (Dev only):** `pnpm --filter @workspace/db run push`
- **Required Env Vars:** `TWILIO_WHATSAPP_TO`, `AI_INTEGRATIONS_OPENAI_*` (for OpenAI client)

## Stack

- **Monorepo:** pnpm workspaces
- **Node.js:** 24
- **Package Manager:** pnpm
- **TypeScript:** 5.9
- **Frontend:** React + Vite (wouter, TanStack Query, shadcn/ui, Tailwind CSS)
- **API Framework:** Express 5
- **Database:** PostgreSQL + Drizzle ORM
- **Validation:** Zod
- **API Contracts:** OpenAPI (Orval codegen)
- **Auth:** JWT (jsonwebtoken, bcryptjs)
- **Build Tool:** esbuild (API server)

## Where things live

- **Frontend App:** `artifacts/trixhub/src`
- **API Server:** `artifacts/api-server/src`
- **Database Schema:** `lib/db/src/schema.ts`
- **API Client Generation:** `lib/api-client-react`
- **Zod Schemas:** `lib/api-zod`
- **Shared DB Logic:** `lib/db`

## Architecture decisions

- **Atomic Financial Transactions:** All financial flows (activations, bonuses, commissions, withdrawals) are designed as atomic transactions with conditional updates to prevent race conditions and ensure data integrity.
- **Dedicated Balance Types:** Separate balance types (`referral_balance`, `deposit_balance`, `bonus_balance`, `activity_balance`) are used to distinguish sources of funds and enforce specific withdrawal rules.
- **Real-time Activity Tracking & Conversion:** Weekly points for activities are accumulated daily and can only be converted to FCFA on Sundays if a 700-point threshold is met, with an explicit expiration policy for unconverted points.
- **Object Storage for Proofs:** Withdrawal proofs and public assets are managed via Replit Object Storage, utilizing signed URLs for secure access to sensitive documents.
- **Admin Notifications for Critical Events:** Twilio WhatsApp is integrated for real-time notifications to administrators regarding user support requests, withdrawal creations, and status changes.

## Product

- **Affiliate Program:** Multi-level referral commissions (1700 FCFA N1, 700 FCFA N2, 300 FCFA N3).
- **Account Activation:** One-time 3600 FCFA fee via mobile money.
- **Contact Sales:** Purchase contacts at 2 FCFA/contact from deposit balance, with anti-duplication logic.
- **Withdrawals:** Minimum withdrawal amounts for referral (3100 FCFA) and activity (3500 FCFA) balances; automated payouts via AccountPE for referral withdrawals.
- **Activity System:** Earn weekly points from videos, quizzes, discovery, and "surprise" tasks, convertible to FCFA.
- **Anti-Fraud Measures:** Payment reference validation, user banning, atomic conditional updates for financial operations, and anti-spam for contact requests.
- **Currency Handling:** FCFA as base currency, with multi-currency conversion support based on user preference or country.

## User preferences

_Populate as you build_

## Gotchas

- **DB Schema Changes:** Never run `pnpm --filter @workspace/db run push-force` in production. Replit's deploy process handles production schema migrations automatically.
- **JWT Token Storage:** The JWT token is stored in `localStorage` as `trixhub_token`.
- **Timezone:** All activity-related calculations (week start, day of week) use `Africa/Douala` (UTC+1).

## Pointers

- **Replit AI Integrations:** [https://replit.com/docs/ai/ai-integrations](https://replit.com/docs/ai/ai-integrations)
- **Drizzle ORM:** [https://orm.drizzle.team/](https://orm.drizzle.team/)
- **TanStack Query:** [https://tanstack.com/query/latest](https://tanstack.com/query/latest)
- **shadcn/ui:** [https://ui.shadcn.com/](https://ui.shadcn.com/)
- **Wouter Router:** [https://www.npmjs.com/package/wouter](https://www.npmjs.com/package/wouter)