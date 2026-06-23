import { pgTable, serial, text, real, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const teamsTable = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  confederation: text("confederation").notNull(),
  flagEmoji: text("flag_emoji").notNull(),
  fifaRanking: integer("fifa_ranking").notNull(),
  eloRating: real("elo_rating").notNull(),
  winRate: real("win_rate").notNull(),
  recentForm: real("recent_form").notNull(),
  worldCupWins: integer("world_cup_wins").notNull().default(0),
  goalsScored: real("goals_scored").notNull().default(0),
  goalsConceded: real("goals_conceded").notNull().default(0),
  cleanSheets: integer("clean_sheets").notNull().default(0),
  goalDifference: real("goal_difference").notNull().default(0),
  possessionPct: real("possession_pct").notNull().default(50),
  shotConversionRate: real("shot_conversion_rate").notNull().default(0),
  continentalTitles: integer("continental_titles").notNull().default(0),
  qualificationRecord: text("qualification_record").notNull().default(""),
  marketValueMillions: real("market_value_millions"),
  avgSquadAge: real("avg_squad_age"),
  strengths: text("strengths").array().notNull().default([]),
  weaknesses: text("weaknesses").array().notNull().default([]),
});

export const insertTeamSchema = createInsertSchema(teamsTable).omit({ id: true });
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type Team = typeof teamsTable.$inferSelect;
// ─── Form History — daily snapshots for the live trend chart ──────────────

export const formHistoryTable = pgTable("form_history", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull(),
  date: text("date").notNull(), // e.g. "2026-06-16"
  recentForm: real("recent_form").notNull(),
  winProbability: real("win_probability").notNull(),
  note: text("note").notNull().default(""), // e.g. "Drew 0-0 vs Cape Verde"
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type FormHistoryEntry = typeof formHistoryTable.$inferSelect;
