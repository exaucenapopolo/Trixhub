import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import {
  db,
  activitySchedulesTable,
  activityCompletionsTable,
  usersTable,
} from "@workspace/db";
import { authenticate } from "../middlewares/authenticate";
import { requireActivation } from "../middlewares/requireActivation";
import {
  getCurrentWeekStart,
  getDayOfWeek,
} from "../lib/weeklyPoints";

const router: IRouter = Router();

// Types d'activités gérés par le calendrier (le quiz IA est toujours dispo)
const SCHEDULED_TYPES = ["video", "discovery", "surprise", "quiz"] as const;
type ScheduledType = (typeof SCHEDULED_TYPES)[number];

function localNow(): Date {
  // Africa/Douala UTC+1
  return new Date(Date.now() + 60 * 60 * 1000);
}

function todayStr(): string {
  return localNow().toISOString().slice(0, 10);
}

/** Retourne les 6 dates lundi→samedi de la semaine courante */
function currentWeekDates(): string[] {
  const now = localNow();
  const dow = now.getUTCDay(); // 0=dim,1=lun,...,6=sam
  // Décalage vers le lundi (si dim=0 → reculer 6 jours)
  const toMonday = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(now.getTime() + toMonday * 86400 * 1000);
  const dates: string[] = [];
  for (let i = 0; i < 6; i++) {
    // lundi (i=0) à samedi (i=5)
    dates.push(new Date(monday.getTime() + i * 86400 * 1000).toISOString().slice(0, 10));
  }
  return dates;
}

// ─────────────────────────────────────────────────────────────────
// GET /activities/schedule — 7 prochains jours + état d'aujourd'hui
// ─────────────────────────────────────────────────────────────────
router.get(
  "/activities/schedule",
  authenticate,
  requireActivation,
  (req: Request, res: Response) => {
    void (async () => {
      try {
        const userId = req.userId!;
        const today = todayStr();
        const { from, to } = dateRange(7);

        // Entrées calendrier admin pour les 7 prochains jours
        const schedules = await db
          .select()
          .from(activitySchedulesTable)
          .where(
            and(
              gte(activitySchedulesTable.scheduledDate, from),
              lte(activitySchedulesTable.scheduledDate, to),
              eq(activitySchedulesTable.isEnabled, true),
            ),
          );

        // Completions du user aujourd'hui (toutes activités)
        const weekStart = getCurrentWeekStart();
        const dayOfWeek = getDayOfWeek();
        const completions = await db
          .select({ activityType: activityCompletionsTable.activityType })
          .from(activityCompletionsTable)
          .where(
            and(
              eq(activityCompletionsTable.userId, userId),
              eq(activityCompletionsTable.weekStart, weekStart),
              eq(activityCompletionsTable.dayOfWeek, dayOfWeek),
              eq(activityCompletionsTable.status, "approved"),
            ),
          );

        const completedTypesToday = new Set(completions.map((c) => c.activityType));

        // Quiz IA : toujours disponible (pas de schedule requis)
        const quizDone = completedTypesToday.has("quiz");

        // Construire les 7 jours
        const days: {
          date: string;
          isToday: boolean;
          activities: {
            type: string;
            isAvailable: boolean;
            isCompleted: boolean;
            scheduleId: number | null;
          }[];
        }[] = [];

        for (let i = 0; i < 7; i++) {
          const base = new Date(new Date(from).getTime() + i * 86400 * 1000);
          const dateStr = base.toISOString().slice(0, 10);
          const isToday = dateStr === today;

          const dayActivities = [
            // Quiz : toujours disponible
            {
              type: "quiz",
              isAvailable: true,
              isCompleted: isToday ? quizDone : false,
              scheduleId: null,
            },
            // Activités planifiées
            ...SCHEDULED_TYPES.map((type) => {
              const sched = schedules.find(
                (s) => s.scheduledDate === dateStr && s.activityType === type,
              );
              return {
                type,
                isAvailable: sched?.isEnabled ?? false,
                isCompleted: isToday ? completedTypesToday.has(type) : false,
                scheduleId: sched?.id ?? null,
              };
            }),
          ];

          days.push({ date: dateStr, isToday, activities: dayActivities });
        }

        res.json({ today, days });
      } catch (err) {
        req.log.error({ err }, "GET /activities/schedule failed");
        res.status(500).json({ error: "Erreur" });
      }
    })();
  },
);

// ─────────────────────────────────────────────────────────────────
// POST /admin/activities/schedule — planifier une activité
// ─────────────────────────────────────────────────────────────────
router.post(
  "/admin/activities/schedule",
  authenticate,
  (req: Request, res: Response) => {
    void (async () => {
      try {
        const [me] = await db
          .select({ isAdmin: usersTable.isAdmin })
          .from(usersTable)
          .where(eq(usersTable.id, req.userId!));
        if (!me?.isAdmin) {
          res.status(403).json({ error: "Réservé aux admins" });
          return;
        }

        const body = req.body as {
          activityType?: unknown;
          scheduledDate?: unknown;
          isEnabled?: unknown;
          notes?: unknown;
        };

        const activityType = String(body.activityType ?? "");
        const scheduledDate = String(body.scheduledDate ?? "");
        const isEnabled = body.isEnabled !== false;
        const notes = body.notes ? String(body.notes).slice(0, 500) : null;

        if (!(SCHEDULED_TYPES as readonly string[]).includes(activityType)) {
          res.status(400).json({
            error: `Type invalide. Valeurs acceptées : ${SCHEDULED_TYPES.join(", ")}`,
          });
          return;
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)) {
          res.status(400).json({ error: "Format de date invalide (YYYY-MM-DD attendu)" });
          return;
        }

        // Upsert : si entrée existante pour ce type+date, on met à jour
        const [entry] = await db
          .insert(activitySchedulesTable)
          .values({
            activityType,
            scheduledDate,
            isEnabled,
            notes,
            createdBy: req.userId,
          })
          .onConflictDoUpdate({
            target: [activitySchedulesTable.activityType, activitySchedulesTable.scheduledDate],
            set: { isEnabled, notes, createdBy: req.userId },
          })
          .returning();

        res.status(201).json(entry);
      } catch (err) {
        req.log.error({ err }, "POST /admin/activities/schedule failed");
        res.status(500).json({ error: "Erreur" });
      }
    })();
  },
);

// ─────────────────────────────────────────────────────────────────
// PATCH /admin/activities/schedule/:id — modifier is_enabled/notes
// ─────────────────────────────────────────────────────────────────
router.patch(
  "/admin/activities/schedule/:id",
  authenticate,
  (req: Request, res: Response) => {
    void (async () => {
      try {
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

        const body = req.body as { isEnabled?: unknown; notes?: unknown };
        const updateData: Record<string, unknown> = {};
        if (body.isEnabled !== undefined) updateData.isEnabled = Boolean(body.isEnabled);
        if (body.notes !== undefined) updateData.notes = body.notes ? String(body.notes).slice(0, 500) : null;

        if (Object.keys(updateData).length === 0) {
          res.status(400).json({ error: "Rien à mettre à jour" });
          return;
        }

        const [updated] = await db
          .update(activitySchedulesTable)
          .set(updateData)
          .where(eq(activitySchedulesTable.id, id))
          .returning();

        if (!updated) {
          res.status(404).json({ error: "Entrée introuvable" });
          return;
        }

        res.json(updated);
      } catch (err) {
        req.log.error({ err }, "PATCH /admin/activities/schedule failed");
        res.status(500).json({ error: "Erreur" });
      }
    })();
  },
);

// ─────────────────────────────────────────────────────────────────
// DELETE /admin/activities/schedule/:id — supprimer une entrée
// ─────────────────────────────────────────────────────────────────
router.delete(
  "/admin/activities/schedule/:id",
  authenticate,
  (req: Request, res: Response) => {
    void (async () => {
      try {
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

        await db
          .delete(activitySchedulesTable)
          .where(eq(activitySchedulesTable.id, id));

        res.status(204).end();
      } catch (err) {
        req.log.error({ err }, "DELETE /admin/activities/schedule failed");
        res.status(500).json({ error: "Erreur" });
      }
    })();
  },
);

export default router;
