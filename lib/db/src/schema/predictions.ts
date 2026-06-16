import { pgTable, serial, integer, real, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const predictionsTable = pgTable("predictions", {
  id: serial("id").primaryKey(),
  tournamentYear: integer("tournament_year").notNull(),
  winnerTeamId: integer("winner_team_id").notNull(),
  winnerName: text("winner_name").notNull(),
  winnerCode: text("winner_code").notNull(),
  winnerFlagEmoji: text("winner_flag_emoji").notNull(),
  winnerProbability: real("winner_probability").notNull(),
  topContenders: jsonb("top_contenders").notNull(),
  modelBreakdown: jsonb("model_breakdown").notNull(),
  confidenceScore: real("confidence_score"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPredictionSchema = createInsertSchema(predictionsTable).omit({ id: true, createdAt: true });
export type InsertPrediction = z.infer<typeof insertPredictionSchema>;
export type Prediction = typeof predictionsTable.$inferSelect;
