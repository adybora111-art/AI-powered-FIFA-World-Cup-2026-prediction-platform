import { Router, type IRouter } from "express";
import { desc } from "drizzle-orm";
import { db, teamsTable, predictionsTable } from "@workspace/db";
import {
  RunPredictionBody,
  RunPredictionResponse,
  GetPredictionHistoryResponse,
} from "@workspace/api-zod";
import { runEnsemblePrediction } from "../lib/mlEngine.js";

const router: IRouter = Router();

router.post("/predictions/run", async (req, res): Promise<void> => {
  const parsed = RunPredictionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { tournamentYear, selectedTeamIds } = parsed.data;

  // Always fetch ALL teams — normalization MUST use the full dataset as the
  // reference baseline. If we normalise only the filtered subset, a team with
  // slightly-better form in a 3-team field would receive form=1.0 (max) while
  // the others receive 0.0, completely inverting the correct ranking.
  const allTeams = await db.select().from(teamsTable);

  if (allTeams.length < 2) {
    res.status(400).json({ error: "At least 2 teams are required" });
    return;
  }

  // Run the ensemble against ALL teams so feature normalization is stable.
  // Then slice the result down to only the teams the user requested.
  const fullResult = runEnsemblePrediction(allTeams);

  const selectedIds = selectedTeamIds && selectedTeamIds.length > 0
    ? new Set(selectedTeamIds)
    : null;

  const result = {
    ...fullResult,
    predictions: selectedIds
      ? fullResult.predictions.filter(p => selectedIds.has(p.teamId))
      : fullResult.predictions,
  };
  const winner = result.predictions[0];

  const contenderResults = result.predictions.map((p, i) => ({
    teamId: p.teamId,
    name: p.name,
    code: p.code,
    flagEmoji: p.flagEmoji,
    probability: p.probability,
    rank: i + 1,
    logisticRegressionScore: p.logisticRegressionScore,
    randomForestScore: p.randomForestScore,
    gradientBoostScore: p.gradientBoostScore,
    shapInsights: p.shapInsights,
    compositeStrengths: p.compositeStrengths,
    compositeWeaknesses: p.compositeWeaknesses,
  }));

  // Persist prediction to history
  await db.insert(predictionsTable).values({
    tournamentYear,
    winnerTeamId: winner.teamId,
    winnerName: winner.name,
    winnerCode: winner.code,
    winnerFlagEmoji: winner.flagEmoji,
    winnerProbability: winner.probability,
    topContenders: contenderResults,
    modelBreakdown: result.modelBreakdown,
    confidenceScore: result.confidenceScore ?? null,
  });

  const response = {
    winner: contenderResults[0],
    topContenders: contenderResults,
    modelBreakdown: result.modelBreakdown,
    processingSteps: result.processingSteps,
    confidenceScore: result.confidenceScore ?? null,
    timestamp: new Date().toISOString(),
  };

  res.json(RunPredictionResponse.parse(response));
});

router.get("/predictions/history", async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(predictionsTable)
    .orderBy(desc(predictionsTable.createdAt))
    .limit(20);

  const history = rows.map(r => ({
    id: r.id,
    winnerName: r.winnerName,
    winnerCode: r.winnerCode,
    winnerFlagEmoji: r.winnerFlagEmoji,
    winnerProbability: r.winnerProbability,
    tournamentYear: r.tournamentYear,
    timestamp: r.createdAt.toISOString(),
  }));

  res.json(GetPredictionHistoryResponse.parse(history));
});

export default router;
