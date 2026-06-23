/**
 * Live Results Sync
 *
 * Automatically fetches finished World Cup 2026 matches from football-data.org,
 * matches them against our 23 tracked teams by name, and applies any new
 * results we haven't processed yet. Designed to be called repeatedly
 * (e.g. by a scheduled job) — it always skips matches already applied.
 */

import { db, teamsTable, formHistoryTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { applyMatchResultWithNote, type MatchOutcome } from "./liveFormUpdater.js";

const FOOTBALL_DATA_BASE = "https://api.football-data.org/v4";

interface FootballDataMatch {
  id: number;
  utcDate: string;
  status: string;
  homeTeam: { name: string };
  awayTeam: { name: string };
  score: { fullTime: { home: number | null; away: number | null } };
}

interface FootballDataResponse {
  matches: FootballDataMatch[];
}

const NAME_TO_CODE: Record<string, string> = {
  "France": "FRA", "Spain": "ESP", "England": "ENG", "Argentina": "ARG",
  "Portugal": "POR", "Brazil": "BRA", "Germany": "GER", "Netherlands": "NED",
  "Belgium": "BEL", "Italy": "ITA", "Croatia": "CRO", "Morocco": "MAR",
  "Uruguay": "URU", "United States": "USA", "Japan": "JPN", "Senegal": "SEN",
  "Colombia": "COL", "Mexico": "MEX", "South Korea": "KOR", "Australia": "AUS",
  "Canada": "CAN", "Ivory Coast": "CIV", "Côte d'Ivoire": "CIV", "Switzerland": "SUI",
};

function toOutcome(myGoals: number, theirGoals: number): MatchOutcome {
  if (myGoals > theirGoals) return "win";
  if (myGoals < theirGoals) return "loss";
  return "draw";
}

export interface SyncResult {
  checked: number;
  applied: Array<{ teamCode: string; opponent: string; outcome: MatchOutcome; score: string; date: string }>;
  skippedAlreadyApplied: number;
}

export async function syncLiveResults(apiToken: string): Promise<SyncResult> {
  const res = await fetch(`${FOOTBALL_DATA_BASE}/competitions/WC/matches?status=FINISHED`, {
    headers: { "X-Auth-Token": apiToken },
  });

  if (!res.ok) {
    throw new Error(`football-data.org request failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as FootballDataResponse;

  // Already-applied matches are tracked by a unique tag "[sync:<matchId>:<teamCode>]"
  // embedded directly in the note we save WHEN we apply the result — no need to
  // look anything up afterward, which is what caused the previous bug.
  const existingNotes = await db.select({ note: formHistoryTable.note }).from(formHistoryTable);
  const appliedTags = new Set(
    existingNotes.flatMap(r => [...r.note.matchAll(/\[sync:(\d+):(\w+)\]/g)].map(m => `${m[1]}:${m[2]}`))
  );

  const applied: SyncResult["applied"] = [];
  let skipped = 0;

  for (const match of data.matches) {
    if (match.score.fullTime.home == null || match.score.fullTime.away == null) continue;

    const homeCode = NAME_TO_CODE[match.homeTeam.name];
    const awayCode = NAME_TO_CODE[match.awayTeam.name];
    const date = match.utcDate.slice(0, 10);

    if (homeCode) {
      const tag = `${match.id}:${homeCode}`;
      if (appliedTags.has(tag)) {
        skipped++;
      } else {
        const outcome = toOutcome(match.score.fullTime.home, match.score.fullTime.away);
        await applyMatchResultWithNote({
          teamCode: homeCode, outcome,
          goalsFor: match.score.fullTime.home, goalsAgainst: match.score.fullTime.away,
          opponentName: match.awayTeam.name, date,
          extraTag: `[sync:${match.id}:${homeCode}]`,
        });
        applied.push({ teamCode: homeCode, opponent: match.awayTeam.name, outcome, score: `${match.score.fullTime.home}-${match.score.fullTime.away}`, date });
      }
    }

    if (awayCode) {
      const tag = `${match.id}:${awayCode}`;
      if (appliedTags.has(tag)) {
        skipped++;
      } else {
        const outcome = toOutcome(match.score.fullTime.away, match.score.fullTime.home);
        await applyMatchResultWithNote({
          teamCode: awayCode, outcome,
          goalsFor: match.score.fullTime.away, goalsAgainst: match.score.fullTime.home,
          opponentName: match.homeTeam.name, date,
          extraTag: `[sync:${match.id}:${awayCode}]`,
        });
        applied.push({ teamCode: awayCode, opponent: match.homeTeam.name, outcome, score: `${match.score.fullTime.away}-${match.score.fullTime.home}`, date });
      }
    }
  }

  return { checked: data.matches.length, applied, skippedAlreadyApplied: skipped };
}