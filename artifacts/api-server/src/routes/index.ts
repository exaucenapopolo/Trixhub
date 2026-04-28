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

export default router;
