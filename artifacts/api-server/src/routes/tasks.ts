import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, balancesTable, tasksTable, userTasksTable, transactionsTable } from "@workspace/db";
import { authenticate } from "../middlewares/authenticate";
import { requireActivation } from "../middlewares/requireActivation";

const router: IRouter = Router();

router.get("/tasks", authenticate, requireActivation, async (req, res): Promise<void> => {
  const userId = req.userId!;

  const allTasks = await db.select().from(tasksTable).where(eq(tasksTable.isActive, true));
  const completedTasks = await db.select().from(userTasksTable).where(eq(userTasksTable.userId, userId));
  const completedIds = new Set(completedTasks.map(ct => ct.taskId));

  const result = allTasks.map(t => ({
    id: t.id,
    title: t.title,
    description: t.description,
    reward: parseFloat(t.reward),
    type: t.type,
    isCompleted: completedIds.has(t.id),
    completedAt: completedTasks.find(ct => ct.taskId === t.id)?.completedAt?.toISOString() ?? null,
    url: t.url ?? null,
  }));

  res.json(result);
});

router.post("/tasks/:id/complete", authenticate, requireActivation, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const taskId = parseInt(rawId, 10);
  const userId = req.userId!;

  // Vérifier la tâche
  const [task] = await db.select().from(tasksTable).where(and(eq(tasksTable.id, taskId), eq(tasksTable.isActive, true)));
  if (!task) {
    res.status(404).json({ error: "Tâche introuvable" });
    return;
  }
  const reward = parseFloat(task.reward);

  // ─── Transaction atomique : insert user_tasks (anti-double-claim via UNIQUE)
  // + crédit task_balance arithmétique + log transaction.
  // Si l'INSERT échoue par violation UNIQUE → 23505, on rollback et renvoie 400.
  let userTaskRow: typeof userTasksTable.$inferSelect;
  try {
    userTaskRow = await db.transaction(async (tx) => {
      // 1. Tente l'insert (la contrainte UNIQUE (user_id, task_id) bloque tout doublon)
      const [inserted] = await tx
        .insert(userTasksTable)
        .values({ userId, taskId, completedAt: new Date() })
        .returning();

      // 2. Crédite atomiquement le solde tâches (UPDATE arithmétique SQL).
      // STRICT : si la balance est absente, throw → rollback total (pas de tâche
      // marquée "complétée" sans crédit réel).
      const balUpd = await tx
        .update(balancesTable)
        .set({ taskBalance: sql`${balancesTable.taskBalance} + ${reward}` })
        .where(eq(balancesTable.userId, userId))
        .returning();
      if (balUpd.length === 0) {
        throw new Error(`MISSING_BALANCE_ROW user=${userId}`);
      }

      // 3. Log la transaction
      await tx.insert(transactionsTable).values({
        userId,
        type: "task",
        amount: reward.toFixed(2),
        description: `Tâche complétée: ${task.title}`,
        status: "completed",
      });

      return inserted;
    });
  } catch (err) {
    // Postgres unique_violation = 23505
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "23505") {
      res.status(400).json({ error: "Tâche déjà complétée" });
      return;
    }
    req.log.error({ err, userId, taskId }, "[tasks] complete transaction error");
    res.status(500).json({ error: "Erreur lors de la complétion de la tâche" });
    return;
  }

  res.json({
    id: task.id,
    title: task.title,
    description: task.description,
    reward,
    type: task.type,
    isCompleted: true,
    completedAt: userTaskRow.completedAt?.toISOString() ?? new Date().toISOString(),
    url: task.url ?? null,
  });
});

export default router;
