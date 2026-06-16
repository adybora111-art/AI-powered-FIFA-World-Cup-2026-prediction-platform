import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import teamsRouter from "./teams.js";
import predictionsRouter from "./predictions.js";
import analyticsRouter from "./analytics.js";
import modelRouter from "./model.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(teamsRouter);
router.use(predictionsRouter);
router.use(analyticsRouter);
router.use(modelRouter);

export default router;
