import { Router, type IRouter } from "express";
import { applyMatchResult, getFormTrend, saveSnapshot } from "../lib/liveFormUpdater.js";
import { syncLiveResults } from "../lib/liveResultsSync.js";

const router: IRouter = Router();

// Apply a real match result to a tracked team and recalculate its form.
// Body: { teamCode: "ESP", outcome: "draw", goalsFor: 0, goalsAgainst: 0, opponentName: "Cape Verde", date: "2026-06-15" }
router.post("/admin/apply-result", async (req, res): Promise<void> => {
  const { teamCode, outcome, goalsFor, goalsAgainst, opponentName, date } = req.body as {
    teamCode?: string; outcome?: "win" | "draw" | "loss";
    goalsFor?: number; goalsAgainst?: number; opponentName?: string; date?: string;
  };

  if (!teamCode || !outcome || goalsFor == null || goalsAgainst == null || !opponentName || !date) {
    res.status(400).json({ error: "teamCode, outcome, goalsFor, goalsAgainst, opponentName, and date are required" });
    return;
  }
  if (!["win", "draw", "loss"].includes(outcome)) {
    res.status(400).json({ error: "outcome must be win, draw, or loss" });
    return;
  }

  const updated = await applyMatchResult({ teamCode, outcome, goalsFor, goalsAgainst, opponentName, date });
  if (!updated) {
    res.status(404).json({ error: `Team with code ${teamCode} not found` });
    return;
  }

  res.json({ success: true, team: updated });
});

// Save a snapshot of all teams' current state without applying a result
// (useful for capturing "Day 0" / pre-tournament baseline).
router.post("/admin/snapshot", async (req, res): Promise<void> => {
  const { date, note } = req.body as { date?: string; note?: string };
  if (!date) {
    res.status(400).json({ error: "date is required" });
    return;
  }
  await saveSnapshot(date, note ?? "");
  res.json({ success: true });
});

// Get the full day-by-day trend for every team with history.
router.get("/analytics/form-trend", async (_req, res): Promise<void> => {
  const trend = await getFormTrend();
  res.json(trend);
});
// Automatically fetches finished World Cup matches and applies any new
// results we haven't processed yet. Safe to call repeatedly — it skips
// matches it has already applied. This is what the scheduler calls.
router.post("/admin/sync-live-results", async (req, res): Promise<void> => {
  const token = process.env.FOOTBALL_DATA_API_KEY;
  if (!token) {
    res.status(500).json({ error: "FOOTBALL_DATA_API_KEY is not configured on the server" });
    return;
  }
  try {
    const result = await syncLiveResults(token);
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : "Sync failed" });
  }
});
export default router;