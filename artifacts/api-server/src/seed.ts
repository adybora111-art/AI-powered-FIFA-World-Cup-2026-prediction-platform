import { db } from "@workspace/db";
import { teamsTable } from "@workspace/db/schema";
import { TEAM_SEED_DATA } from "./lib/teamData.js";

async function seed() {
  console.log("Seeding teams...");
  for (const team of TEAM_SEED_DATA) {
    await db.insert(teamsTable).values({
      name: team.name,
      code: team.code,
      confederation: team.confederation,
      flagEmoji: team.flagEmoji,
      fifaRanking: team.fifaRanking,
      eloRating: team.eloRating,
      winRate: team.winRate,
      recentForm: team.recentForm,
      worldCupWins: team.worldCupWins,
      goalsScored: team.goalsScored,
      goalsConceded: team.goalsConceded,
      cleanSheets: team.cleanSheets,
      goalDifference: team.goalDifference,
      possessionPct: team.possessionPct,
      shotConversionRate: team.shotConversionRate,
      continentalTitles: team.continentalTitles,
      qualificationRecord: team.qualificationRecord,
      marketValueMillions: team.marketValueMillions,
      avgSquadAge: team.avgSquadAge,
      strengths: team.strengths,
      weaknesses: team.weaknesses,
    }).onConflictDoNothing();
  }
  console.log(`Done! Seeded ${TEAM_SEED_DATA.length} teams.`);
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });