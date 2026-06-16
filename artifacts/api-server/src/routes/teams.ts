import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, teamsTable } from "@workspace/db";
import {
  GetTeamParams,
  GetTeamRankingsResponse,
  ListTeamsResponse,
  GetTeamResponse,
} from "@workspace/api-zod";
import { computeWinProbabilities } from "../lib/mlEngine.js";

const router: IRouter = Router();

router.get("/teams", async (req, res): Promise<void> => {
  const teams = await db.select().from(teamsTable).orderBy(teamsTable.fifaRanking);
  res.json(ListTeamsResponse.parse(teams));
});

router.get("/teams/rankings", async (req, res): Promise<void> => {
  const teams = await db.select().from(teamsTable);
  const probabilities = computeWinProbabilities(teams);

  const ranked = probabilities.map((p, i) => {
    const team = teams.find(t => t.id === p.teamId)!;
    const compositeScore =
      (1 - team.fifaRanking / 200) * 0.3 +
      (team.eloRating / 2100) * 0.3 +
      team.winRate * 0.2 +
      team.recentForm / 100 * 0.2;
    return {
      rank: i + 1,
      teamId: team.id,
      name: team.name,
      code: team.code,
      flagEmoji: team.flagEmoji,
      compositeScore: Math.round(compositeScore * 1000) / 1000,
      fifaRanking: team.fifaRanking,
      eloRating: team.eloRating,
      winProbability: p.probability,
    };
  });

  res.json(GetTeamRankingsResponse.parse(ranked));
});

router.get("/teams/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetTeamParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [team] = await db
    .select()
    .from(teamsTable)
    .where(eq(teamsTable.id, params.data.id));

  if (!team) {
    res.status(404).json({ error: "Team not found" });
    return;
  }

  res.json(GetTeamResponse.parse(team));
});

export default router;
