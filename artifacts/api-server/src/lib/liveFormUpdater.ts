/**
 * Live Form Updater
 *
 * Lets us apply a real match result to a tracked team's stats, nudging
 * recentForm, goalsScored, goalsConceded, winRate, and goalDifference
 * based on the outcome — then the existing ensemble engine in mlEngine.ts
 * automatically produces a new win probability from the updated row,
 * with zero changes needed to the prediction logic itself.
 *
 * A snapshot of every team's form + probability is saved to form_history
 * after each update, which powers the day-by-day trend chart.
 */

import { db, teamsTable, formHistoryTable, type Team } from "@workspace/db";
import { eq } from "drizzle-orm";
import { computeWinProbabilities } from "./mlEngine.js";

export type MatchOutcome = "win" | "draw" | "loss";

export interface ApplyResultInput {
  teamCode: string;       // e.g. "ESP"
  outcome: MatchOutcome;  // from this team's perspective
  goalsFor: number;
  goalsAgainst: number;
  opponentName: string;   // e.g. "Cape Verde" — just for the note, doesn't need to exist in our 23 teams
  date: string;            // "2026-06-15"
}

// How much a single real result should move the recentForm needle (0-100 scale).
// Calibrated to be meaningful but not wildly overreact to one match.
const FORM_DELTA = { win: 4, draw: -2, loss: -7 };
export interface ApplyResultWithNoteInput extends ApplyResultInput {
  extraTag: string; // e.g. "[sync:12345:ESP]" — appended to the note for duplicate detection
}

export async function applyMatchResultWithNote(input: ApplyResultWithNoteInput): Promise<Team | null> {
  const { extraTag, ...rest } = input;
  return applyMatchResultInternal(rest, extraTag);
}
export async function applyMatchResult(input: ApplyResultInput): Promise<Team | null> {
  return applyMatchResultInternal(input, "");
}

async function applyMatchResultInternal(input: ApplyResultInput, extraTag: string): Promise<Team | null> {
  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.code, input.teamCode));
  if (!team) return null;

  const delta = FORM_DELTA[input.outcome];
  const newForm = Math.max(20, Math.min(99, team.recentForm + delta));

  const newGoalsScored   = team.goalsScored   * 0.9 + input.goalsFor * 0.1;
  const newGoalsConceded = team.goalsConceded * 0.9 + input.goalsAgainst * 0.1;
  const newGoalDiff      = team.goalDifference + (input.goalsFor - input.goalsAgainst);

  const winRateDelta = input.outcome === "win" ? 0.015 : input.outcome === "loss" ? -0.02 : -0.005;
  const newWinRate = Math.max(0.1, Math.min(0.95, team.winRate + winRateDelta));

  const [updated] = await db
    .update(teamsTable)
    .set({
      recentForm: newForm,
      goalsScored: Math.round(newGoalsScored * 100) / 100,
      goalsConceded: Math.round(newGoalsConceded * 100) / 100,
      goalDifference: Math.round(newGoalDiff * 100) / 100,
      winRate: Math.round(newWinRate * 1000) / 1000,
    })
    .where(eq(teamsTable.code, input.teamCode))
    .returning();

  const note = `${team.name}: ${input.outcome} vs ${input.opponentName} (${input.goalsFor}-${input.goalsAgainst})${extraTag ? " " + extraTag : ""}`;
  await saveSnapshot(input.date, note);

  return updated ?? null;
}

export async function saveSnapshot(date: string, note = ""): Promise<void> {
  const teams = await db.select().from(teamsTable);
  const probabilities = computeWinProbabilities(teams);

  const rows = teams.map(team => {
    const prob = probabilities.find(p => p.teamId === team.id)?.probability ?? 0;
    return {
      teamId: team.id,
      date,
      recentForm: team.recentForm,
      winProbability: prob,
      note,
    };
  });

  // Remove any existing snapshot for this exact date first, so re-running for
  // the same day doesn't create duplicate rows (lets you safely re-apply).
  // Simple approach: just insert — duplicates for the same day are harmless
  // for charting purposes since we'll always show the latest per team per day.
  await db.insert(formHistoryTable).values(rows);
}

export async function getFormTrend() {
  const rows = await db.select().from(formHistoryTable);
  const teams = await db.select().from(teamsTable);

  // Group by date, then by team, keeping the LAST entry per team per date
  // (in case of multiple updates on the same day)
  const byDateTeam = new Map<string, Map<number, typeof rows[number]>>();
  for (const row of rows) {
    if (!byDateTeam.has(row.date)) byDateTeam.set(row.date, new Map());
    byDateTeam.get(row.date)!.set(row.teamId, row);
  }

  const dates = [...byDateTeam.keys()].sort();
  const series = teams.map(team => ({
    teamId: team.id,
    name: team.name,
    code: team.code,
    flagEmoji: team.flagEmoji,
    points: dates
      .map(date => {
        const entry = byDateTeam.get(date)?.get(team.id);
        return entry ? { date, probability: entry.winProbability, recentForm: entry.recentForm } : null;
      })
      .filter((p): p is { date: string; probability: number; recentForm: number } => p !== null),
  })).filter(s => s.points.length > 0);

  return { dates, series };
}