import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import {
  db,
  activityWithdrawalsTable,
  activityCompletionsTable,
  balancesTable,
  usersTable,
} from "@workspace/db";
import { authenticate } from "../middlewares/authenticate";
import { requireActivation } from "../middlewares/requireActivation";
import { ACTIVITY_WITHDRAWAL_MIN } from "../lib/weeklyPoints";
import {
  reportActivityWithdrawalCreated,
  reportActivityWithdrawalStatusChange,
} from "../lib/activityWithdrawalReports";

const router: IRouter = Router();

const ALLOWED_METHODS = new Set([
  "orange_money",
  "mtn_money",
  "wave",
  "moov",
  "free_money",
  "airtel_money",
  "mpesa",
]);

// ─────────────────────────────────────────────────────────────────
// POST /withdrawals/activity — créer une demande de retrait activité
// ─────────────────────────────────────────────────────────────────
router.post(
  "/withdrawals/activity",
  authenticate,
  requireActivation,
  (req: Request, res: Response) => {
    void (async () => {
      try {
        const userId = req.userId!;
        const body = req.body as {
          amount?: unknown;
          method?: unknown;
          accountNumber?: unknown;
          accountName?: unknown;
          whatsappNumber?: unknown;
          firstName?: unknown;
          lastName?: unknown;
          country?: unknown;
        };

        const amount = Number(body.amount);
        const method = String(body.method ?? "");
        const accountNumber = String(body.accountNumber ?? "").trim();
        const accountName = String(body.accountName ?? "").trim();
        const whatsappNumber = body.whatsappNumber ? String(body.whatsappNumber).trim() : null;
        const firstName = body.firstName ? String(body.firstName).trim() : null;
        const lastName = body.lastName ? String(body.lastName).trim() : null;
        const country = body.country ? String(body.country).trim() : null;

        if (!Number.isFinite(amount) || amount < ACTIVITY_WITHDRAWAL_MIN) {
          res.status(400).json({
            error: `Montant minimum : ${ACTIVITY_WITHDRAWAL_MIN} FCFA`,
          });
          return;
        }
        if (!ALLOWED_METHODS.has(method)) {
          res.status(400).json({ error: "Méthode de paiement invalide" });
          return;
        }
        if (!accountNumber || !accountName) {
          res.status(400).json({ error: "Numéro et titulaire requis" });
          return;
        }
        if (accountNumber.length > 50 || accountName.length > 100) {
          res.status(400).json({ error: "Champs trop longs" });
          return;
        }

        // Transaction atomique : débit + insert demande
        const created = await db.transaction(async (tx) => {
          await tx.execute(sql`SELECT pg_advisory_xact_lock(${userId}::bigint)`);

          const [bal] = await tx
            .select()
            .from(balancesTable)
            .where(eq(balancesTable.userId, userId));

          if (!bal) {
            throw new Error("Solde introuvable");
          }
          const current = Number(bal.activityBalance);
          if (current < amount) {
            throw Object.assign(new Error("Solde insuffisant"), { code: "INSUFFICIENT" });
          }

          // Vérif anti-spam : pas de demande pending existante
          const [existingPending] = await tx
            .select()
            .from(activityWithdrawalsTable)
            .where(
              and(
                eq(activityWithdrawalsTable.userId, userId),
                eq(activityWithdrawalsTable.status, "pending"),
              ),
            );
          if (existingPending) {
            throw Object.assign(new Error("Une demande est déjà en attente"), {
              code: "ALREADY_PENDING",
            });
          }

          // Débite le solde
          await tx
            .update(balancesTable)
            .set({
              activityBalance: sql`${balancesTable.activityBalance} - ${amount}`,
            })
            .where(eq(balancesTable.userId, userId));

          // Insert la demande
          const [withdrawal] = await tx
            .insert(activityWithdrawalsTable)
            .values({
              userId,
              amount: String(amount),
              method,
              accountNumber,
              accountName,
              whatsappNumber,
              firstName,
              lastName,
              country,
              status: "pending",
            })
            .returning();

          return withdrawal;
        });

        // Notif Twilio admin (best-effort, hors transaction)
        try {
          const [[user], firstActivityRow] = await Promise.all([
            db.select().from(usersTable).where(eq(usersTable.id, userId)),
            db
              .select({ createdAt: activityCompletionsTable.createdAt })
              .from(activityCompletionsTable)
              .where(eq(activityCompletionsTable.userId, userId))
              .orderBy(asc(activityCompletionsTable.createdAt))
              .limit(1),
          ]);
          const firstActivityAt = firstActivityRow[0]?.createdAt ?? null;
          if (user) {
            const result = await reportActivityWithdrawalCreated(created, user, firstActivityAt);
            if (result.ok) {
              await db
                .update(activityWithdrawalsTable)
                .set({ twilioSentAt: new Date() })
                .where(eq(activityWithdrawalsTable.id, created.id));
            } else {
              req.log.warn(
                { withdrawalId: created.id, error: result.error },
                "TWILIO_NOTIFY_FAILED — admin n'a pas reçu la demande",
              );
            }
          }
        } catch (notifErr) {
          req.log.warn({ err: notifErr }, "Notification Twilio échouée");
        }

        res.json(created);
      } catch (err: unknown) {
        const e = err as { code?: string; message?: string };
        if (e.code === "INSUFFICIENT") {
          res.status(400).json({ error: "Solde activité insuffisant" });
          return;
        }
        if (e.code === "ALREADY_PENDING") {
          res.status(409).json({
            error: "Tu as déjà une demande en attente. Attends sa validation par l'admin.",
          });
          return;
        }
        req.log.error({ err }, "POST /withdrawals/activity failed");
        res.status(500).json({ error: "Erreur lors de la demande" });
      }
    })();
  },
);

// ─────────────────────────────────────────────────────────────────
// GET /withdrawals/activity — historique des demandes
// ─────────────────────────────────────────────────────────────────
router.get(
  "/withdrawals/activity",
  authenticate,
  (req: Request, res: Response) => {
    void (async () => {
      try {
        const userId = req.userId!;
        const items = await db
          .select()
          .from(activityWithdrawalsTable)
          .where(eq(activityWithdrawalsTable.userId, userId))
          .orderBy(desc(activityWithdrawalsTable.createdAt))
          .limit(50);
        res.json(items);
      } catch (err) {
        req.log.error({ err }, "GET /withdrawals/activity failed");
        res.status(500).json({ error: "Erreur" });
      }
    })();
  },
);

// ─────────────────────────────────────────────────────────────────
// PATCH /admin/withdrawals/activity/:id — admin valide ou rejette
// ─────────────────────────────────────────────────────────────────
router.patch(
  "/admin/withdrawals/activity/:id",
  authenticate,
  (req: Request, res: Response) => {
    void (async () => {
      try {
        // Check admin
        const [me] = await db
          .select({ isAdmin: usersTable.isAdmin })
          .from(usersTable)
          .where(eq(usersTable.id, req.userId!));
        if (!me?.isAdmin) {
          res.status(403).json({ error: "Réservé aux admins" });
          return;
        }

        const id = parseInt(String(req.params.id ?? ""), 10);
        if (!Number.isInteger(id) || id <= 0) {
          res.status(400).json({ error: "ID invalide" });
          return;
        }

        const body = req.body as {
          status?: unknown;
          adminNote?: unknown;
          rejectionReason?: unknown;
        };
        const newStatus = String(body.status ?? "");
        if (!["approved", "paid", "rejected"].includes(newStatus)) {
          res.status(400).json({ error: "Statut invalide" });
          return;
        }

        const adminNote = body.adminNote ? String(body.adminNote).slice(0, 500) : null;
        const rejectionReason = body.rejectionReason
          ? String(body.rejectionReason).slice(0, 500)
          : null;

        const updated = await db.transaction(async (tx) => {
          // Lock row + lecture cohérente
          const [w] = await tx
            .select()
            .from(activityWithdrawalsTable)
            .where(eq(activityWithdrawalsTable.id, id))
            .for("update");
          if (!w) return null;

          const previousStatus = w.status;
          if (previousStatus === newStatus) return { idempotent: true as const, withdrawal: w, previousStatus };
          if (previousStatus === "paid" || previousStatus === "rejected") {
            throw Object.assign(new Error("Demande déjà finalisée"), { code: "FINAL" });
          }

          // Transitions valides : pending→approved|rejected|paid, approved→paid|rejected
          const validNext: Record<string, string[]> = {
            pending: ["approved", "rejected", "paid"],
            approved: ["paid", "rejected"],
          };
          if (!validNext[previousStatus]?.includes(newStatus)) {
            throw Object.assign(new Error("Transition invalide"), { code: "INVALID_TRANSITION" });
          }

          // ── ATOMIC GUARD : UPDATE conditionnel sur status précédent
          //    Bloque tout double-refund / double-paid
          const updatedRows = await tx
            .update(activityWithdrawalsTable)
            .set({
              status: newStatus,
              adminNote: adminNote ?? w.adminNote,
              rejectionReason: rejectionReason ?? w.rejectionReason,
              ...(newStatus === "approved" ? { approvedAt: new Date() } : {}),
              ...(newStatus === "paid" ? { paidAt: new Date(), approvedAt: w.approvedAt ?? new Date() } : {}),
              ...(newStatus === "rejected" ? { rejectedAt: new Date() } : {}),
            })
            .where(
              and(
                eq(activityWithdrawalsTable.id, id),
                eq(activityWithdrawalsTable.status, previousStatus),
              ),
            )
            .returning();

          if (updatedRows.length === 0) {
            // Race perdue — un autre admin vient de modifier
            throw Object.assign(new Error("Modifié entre-temps"), { code: "CONCURRENT" });
          }

          // Refund UNIQUEMENT après guard atomique réussi
          if (newStatus === "rejected") {
            await tx
              .update(balancesTable)
              .set({
                activityBalance: sql`${balancesTable.activityBalance} + ${w.amount}`,
              })
              .where(eq(balancesTable.userId, w.userId));
          }

          return { withdrawal: updatedRows[0], previousStatus };
        });

        if (!updated) {
          res.status(404).json({ error: "Demande introuvable" });
          return;
        }

        if ("idempotent" in updated) {
          res.json(updated.withdrawal);
          return;
        }

        if ("withdrawal" in updated && updated.previousStatus !== updated.withdrawal.status) {
          // Notif Twilio (best-effort)
          try {
            const [user] = await db
              .select()
              .from(usersTable)
              .where(eq(usersTable.id, updated.withdrawal.userId));
            if (user) {
              await reportActivityWithdrawalStatusChange(
                updated.withdrawal,
                user,
                updated.previousStatus,
              );
            }
          } catch (notifErr) {
            req.log.warn({ err: notifErr }, "Notif statut Twilio échouée");
          }
        }

        res.json("withdrawal" in updated ? updated.withdrawal : updated);
      } catch (err: unknown) {
        const e = err as { code?: string };
        if (e.code === "FINAL") {
          res.status(409).json({ error: "Cette demande est déjà finalisée" });
          return;
        }
        if (e.code === "INVALID_TRANSITION") {
          res.status(409).json({ error: "Transition de statut invalide" });
          return;
        }
        if (e.code === "CONCURRENT") {
          res.status(409).json({ error: "Demande modifiée par un autre admin, recharge la page" });
          return;
        }
        req.log.error({ err }, "PATCH /admin/withdrawals/activity failed");
        res.status(500).json({ error: "Erreur" });
      }
    })();
  },
);

export default router;
