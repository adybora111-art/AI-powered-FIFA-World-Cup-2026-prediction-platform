import { Router, type IRouter } from "express";
import {
  GetModelMetricsResponse,
  GetFeatureImportanceResponse,
} from "@workspace/api-zod";
import { MODEL_METRICS, FEATURE_IMPORTANCE } from "../lib/mlEngine.js";

const router: IRouter = Router();

router.get("/model/metrics", async (_req, res): Promise<void> => {
  res.json(GetModelMetricsResponse.parse(MODEL_METRICS));
});

router.get("/model/feature-importance", async (_req, res): Promise<void> => {
  res.json(GetFeatureImportanceResponse.parse(FEATURE_IMPORTANCE));
});

export default router;
