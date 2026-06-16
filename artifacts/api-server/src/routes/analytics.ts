import { Router, type IRouter } from "express";
import { db, teamsTable } from "@workspace/db";
import {
  CompareTeamsBody,
  CompareTeamsResponse,
  GetWinProbabilitiesResponse,
  GetHistoricalTrendsResponse,
} from "@workspace/api-zod";
import {
  computeWinProbabilities,
  runMonteCarloSimulation,
  simulateHeadToHead,
} from "../lib/mlEngine.js";
import { inArray } from "drizzle-orm";

const router: IRouter = Router();

router.get("/analytics/win-probability", async (req, res): Promise<void> => {
  const teams = await db.select().from(teamsTable);
  const probs = computeWinProbabilities(teams);
  res.json(GetWinProbabilitiesResponse.parse(probs));
});

router.post("/analytics/comparison", async (req, res): Promise<void> => {
  const parsed = CompareTeamsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { teamIds } = parsed.data;
  const teams = await db
    .select()
    .from(teamsTable)
    .where(inArray(teamsTable.id, teamIds));

  if (teams.length < 2) {
    res.status(400).json({ error: "Could not find enough teams" });
    return;
  }

  // ── Radar chart: 8 current-strength-focused dimensions ─────────────────
  const normalize = (vals: number[]): number[] => {
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = max - min || 1;
    return vals.map(v => Math.round(((v - min) / range) * 100));
  };

  const metrics = [
    { key: "Current Form",       values: teams.map(t => t.recentForm) },
    { key: "Attack Threat",      values: teams.map(t => t.goalsScored * 0.65 + t.shotConversionRate * 0.35) },
    { key: "Defensive Solidity", values: teams.map(t => (10 - t.goalsConceded) * 0.55 + (t.cleanSheets / 20) * 45) },
    { key: "Win Rate",           values: teams.map(t => t.winRate * 100) },
    { key: "Goal Dominance",     values: teams.map(t => t.goalDifference + 50) }, // shift so no negatives
    { key: "Elo (Rolling)",      values: teams.map(t => t.eloRating) },
    { key: "Squad Value",        values: teams.map(t => t.marketValueMillions ?? 200) },
    { key: "Tournament Pedigree",values: teams.map(t => t.worldCupWins * 4 + t.continentalTitles * 0.8) },
  ];

  const radarData = metrics.map(m => {
    const normalized = normalize(m.values);
    const valuesObj: Record<string, number> = {};
    teams.forEach((t, i) => { valuesObj[t.code] = normalized[i]; });
    return { metric: m.key, values: valuesObj };
  });

  // ── Head-to-head (derived from Elo + current form differential) ─────────
  const headToHead = [];
  for (let i = 0; i < teams.length - 1; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      const a = teams[i];
      const b = teams[j];
      // Current-form-weighted advantage: 60% Elo, 40% form
      const aStrength = (a.eloRating / 2200) * 0.6 + (a.recentForm / 100) * 0.4;
      const bStrength = (b.eloRating / 2200) * 0.6 + (b.recentForm / 100) * 0.4;
      const aAdvantage = Math.max(0.12, Math.min(0.88, aStrength / (aStrength + bStrength)));
      const total = 20;
      const aWins = Math.round(aAdvantage * total * 0.58);
      const bWins = Math.round((1 - aAdvantage) * total * 0.58);
      const draws = Math.max(0, total - aWins - bWins);
      headToHead.push({ teamA: a.code, teamB: b.code, teamAWins: aWins, teamBWins: bWins, draws });
    }
  }

  const response = {
    teams: teams.map(t => ({ ...t, strengths: t.strengths ?? [], weaknesses: t.weaknesses ?? [] })),
    radarData,
    headToHead,
  };

  res.json(CompareTeamsResponse.parse(response));
});

router.get("/analytics/historical-trends", async (_req, res): Promise<void> => {
  const trends = {
    pastWinners: [
      { year: 2022, country: "Argentina",  code: "ARG", flagEmoji: "🇦🇷", venue: "Qatar" },
      { year: 2018, country: "France",     code: "FRA", flagEmoji: "🇫🇷", venue: "Russia" },
      { year: 2014, country: "Germany",    code: "GER", flagEmoji: "🇩🇪", venue: "Brazil" },
      { year: 2010, country: "Spain",      code: "ESP", flagEmoji: "🇪🇸", venue: "South Africa" },
      { year: 2006, country: "Italy",      code: "ITA", flagEmoji: "🇮🇹", venue: "Germany" },
      { year: 2002, country: "Brazil",     code: "BRA", flagEmoji: "🇧🇷", venue: "Korea/Japan" },
      { year: 1998, country: "France",     code: "FRA", flagEmoji: "🇫🇷", venue: "France" },
      { year: 1994, country: "Brazil",     code: "BRA", flagEmoji: "🇧🇷", venue: "USA" },
      { year: 1990, country: "Germany",    code: "GER", flagEmoji: "🇩🇪", venue: "Italy" },
      { year: 1986, country: "Argentina",  code: "ARG", flagEmoji: "🇦🇷", venue: "Mexico" },
    ],
    confederationWins: [
      { confederation: "UEFA",     wins: 12, percentage: 54.5 },
      { confederation: "CONMEBOL", wins: 10, percentage: 45.5 },
      { confederation: "CONCACAF", wins: 0,  percentage: 0 },
      { confederation: "CAF",      wins: 0,  percentage: 0 },
      { confederation: "AFC",      wins: 0,  percentage: 0 },
    ],
    repeatChampions: [
      { country: "Brazil",    code: "BRA", flagEmoji: "🇧🇷", totalWins: 5, years: [1958,1962,1970,1994,2002] },
      { country: "Germany",   code: "GER", flagEmoji: "🇩🇪", totalWins: 4, years: [1954,1974,1990,2014] },
      { country: "Italy",     code: "ITA", flagEmoji: "🇮🇹", totalWins: 4, years: [1934,1938,1982,2006] },
      { country: "Argentina", code: "ARG", flagEmoji: "🇦🇷", totalWins: 3, years: [1978,1986,2022] },
      { country: "France",    code: "FRA", flagEmoji: "🇫🇷", totalWins: 2, years: [1998,2018] },
      { country: "Uruguay",   code: "URU", flagEmoji: "🇺🇾", totalWins: 2, years: [1930,1950] },
      { country: "England",   code: "ENG", flagEmoji: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", totalWins: 1, years: [1966] },
      { country: "Spain",     code: "ESP", flagEmoji: "🇪🇸", totalWins: 1, years: [2010] },
    ],
  };
  res.json(GetHistoricalTrendsResponse.parse(trends));
});

router.post("/analytics/monte-carlo", async (req, res): Promise<void> => {
  const { simulations = 1000 } = req.body as { simulations?: number };
  if (![1000, 5000, 10000].includes(simulations)) {
    res.status(400).json({ error: "simulations must be 1000, 5000, or 10000" });
    return;
  }
  const teams = await db.select().from(teamsTable);
  const result = runMonteCarloSimulation(teams, simulations);
  res.json(result);
});

router.post("/analytics/head-to-head", async (req, res): Promise<void> => {
  const { teamId1, teamId2, simulations = 10000 } = req.body as {
    teamId1?: number; teamId2?: number; simulations?: number;
  };
  if (!teamId1 || !teamId2) {
    res.status(400).json({ error: "teamId1 and teamId2 are required" });
    return;
  }
  const teams = await db.select().from(teamsTable);
  const result = simulateHeadToHead(teamId1, teamId2, teams, simulations);
  if (!result) { res.status(404).json({ error: "Team(s) not found" }); return; }
  res.json(result);
});

export default router;
