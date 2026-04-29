import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import referralsRouter from "./referrals";
import balancesRouter from "./balances";
import withdrawalsRouter from "./withdrawals";
import tasksRouter from "./tasks";
import configRouter from "./config";
import swychrRouter from "./swychr";
import missionsRouter from "./missions";
import contactRouter from "./contact";
import storageRouter from "./storage";
import activitiesRouter from "./activities";
import activityWithdrawalsRouter from "./activityWithdrawals";
import activitySchedulesRouter from "./activitySchedules";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(referralsRouter);
router.use(balancesRouter);
router.use(withdrawalsRouter);
router.use(tasksRouter);
router.use(configRouter);
router.use(swychrRouter);
router.use(missionsRouter);
router.use(contactRouter);
router.use(storageRouter);
router.use(activitiesRouter);
router.use(activityWithdrawalsRouter);
router.use(activitySchedulesRouter);

export default router;
