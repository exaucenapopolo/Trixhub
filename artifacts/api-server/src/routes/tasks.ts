import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, usersTable, balancesTable, tasksTable, userTasksTable, transactionsTable } from "@workspace/db";
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

  const [task] = await db.select().from(tasksTable).where(and(eq(tasksTable.id, taskId), eq(tasksTable.isActive, true)));
  if (!task) {
    res.status(404).json({ error: "Tâche introuvable" });
    return;
  }

  const [existing] = await db.select().from(userTasksTable)
    .where(and(eq(userTasksTable.userId, userId), eq(userTasksTable.taskId, taskId)));

  if (existing) {
    res.status(400).json({ error: "Tâche déjà complétée" });
    return;
  }

  const [userTask] = await db.insert(userTasksTable).values({
    userId,
    taskId,
    completedAt: new Date(),
  }).returning();

  const [balance] = await db.select().from(balancesTable).where(eq(balancesTable.userId, userId));
  const currentTaskBalance = parseFloat(balance?.taskBalance ?? "0");
  const reward = parseFloat(task.reward);

  await db.update(balancesTable)
    .set({ taskBalance: (currentTaskBalance + reward).toFixed(2) })
    .where(eq(balancesTable.userId, userId));

  await db.insert(transactionsTable).values({
    userId,
    type: "task",
    amount: reward.toFixed(2),
    description: `Tâche complétée: ${task.title}`,
    status: "completed",
  });

  res.json({
    id: task.id,
    title: task.title,
    description: task.description,
    reward,
    type: task.type,
    isCompleted: true,
    completedAt: userTask.completedAt?.toISOString() ?? new Date().toISOString(),
    url: task.url ?? null,
  });
});

export default router;
