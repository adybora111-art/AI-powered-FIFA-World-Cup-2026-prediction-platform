import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import teamsRouter from "./teams.js";
import predictionsRouter from "./predictions.js";
import analyticsRouter from "./analytics.js";
import modelRouter from "./model.js";
import liveUpdateRouter from "./liveUpdate.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(teamsRouter);
router.use(predictionsRouter);
router.use(analyticsRouter);
router.use(modelRouter);
router.use(liveUpdateRouter);

export default router;