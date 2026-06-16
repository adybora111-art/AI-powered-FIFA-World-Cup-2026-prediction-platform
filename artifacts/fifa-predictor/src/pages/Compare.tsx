import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useListTeams, useCompareTeams } from "@workspace/api-client-react";
import type { TeamDetail } from "@workspace/api-client-react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Cell,
} from "recharts";

const COLORS = ["#D4AF37", "#00BFFF", "#9333EA", "#EC4899"];
const GOLD   = "#D4AF37";
const BLUE   = "#00BFFF";

// ── Derived / computed analytics ─────────────────────────────────────────────

interface AdvancedMetrics {
  xG: number;
  xGA: number;
  cleanSheetPct: number;
  attackingEfficiency: number;  // 0-100
  defensiveStability: number;   // 0-100
  momentumScore: number;        // 0-100
  squadDepth: number;           // 0-100
  pressureIndex: number;        // 0-100 (attack press + defensive press proxy)
}

function computeMetrics(t: TeamDetail): AdvancedMetrics {
  const mv = t.marketValueMillions ?? 200;
  const age = t.avgSquadAge ?? 27;
  const ageFactor = age >= 25 && age <= 29 ? 1.0 : age < 25 ? 0.8 : Math.max(0.5, 1 - (age - 29) * 0.08);
  return {
    xG:                  Math.round(t.goalsScored * 82) / 100,
    xGA:                 Math.round(t.goalsConceded * 90) / 100,
    cleanSheetPct:       Math.round((t.cleanSheets / 20) * 100),
    attackingEfficiency: Math.min(100, Math.round(t.goalsScored * 18 + t.shotConversionRate * 1.8)),
    defensiveStability:  Math.min(100, Math.max(0, Math.round(100 - t.goalsConceded * 18 + t.cleanSheets * 2))),
    momentumScore:       Math.round(t.recentForm * t.winRate),
    squadDepth:          Math.min(100, Math.round((mv / 1500) * 100)),
    pressureIndex:       Math.round((t.possessionPct / 100) * 50 + (t.goalsScored / 3) * 30 + ageFactor * 20),
  };
}

// ── Form bar (deterministic W/D/L from form score) ────────────────────────────

type FormResult = "W" | "D" | "L";
function deriveFormHistory(code: string, form: number, n = 5): FormResult[] {
  const seed = code.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  const results: FormResult[] = [];
  for (let i = 0; i < n; i++) {
    const r = ((seed * (i + 7) * 31) % 100);
    if (form >= 80) results.push(r < 72 ? "W" : r < 88 ? "D" : "L");
    else if (form >= 65) results.push(r < 55 ? "W" : r < 80 ? "D" : "L");
    else results.push(r < 35 ? "W" : r < 65 ? "D" : "L");
  }
  return results;
}

// ── AI Matchup insight generator ─────────────────────────────────────────────

interface TeamEdge { label: string; winner: number /* 0 or 1 */ }

function computeAiInsights(teams: TeamDetail[]) {
  if (teams.length !== 2) return null;
  const [a, b] = teams;
  const ma = computeMetrics(a);
  const mb = computeMetrics(b);

  const edges: TeamEdge[] = [
    { label: `Recent form (${a.recentForm.toFixed(0)} vs ${b.recentForm.toFixed(0)})`,    winner: a.recentForm >= b.recentForm ? 0 : 1 },
    { label: `Defensive solidity (${ma.defensiveStability} vs ${mb.defensiveStability})`, winner: ma.defensiveStability >= mb.defensiveStability ? 0 : 1 },
    { label: `Attacking efficiency (${ma.attackingEfficiency} vs ${mb.attackingEfficiency})`, winner: ma.attackingEfficiency >= mb.attackingEfficiency ? 0 : 1 },
    { label: `Win rate (${(a.winRate*100).toFixed(0)}% vs ${(b.winRate*100).toFixed(0)}%)`, winner: a.winRate >= b.winRate ? 0 : 1 },
    { label: `Squad market value (€${Math.round(a.marketValueMillions??0)}M vs €${Math.round(b.marketValueMillions??0)}M)`, winner: (a.marketValueMillions??0) >= (b.marketValueMillions??0) ? 0 : 1 },
    { label: `Elo rating (${Math.round(a.eloRating)} vs ${Math.round(b.eloRating)})`, winner: a.eloRating >= b.eloRating ? 0 : 1 },
    { label: `Goal difference (+${a.goalDifference} vs +${b.goalDifference})`, winner: a.goalDifference >= b.goalDifference ? 0 : 1 },
    { label: `Clean sheet % (${ma.cleanSheetPct}% vs ${mb.cleanSheetPct}%)`, winner: ma.cleanSheetPct >= mb.cleanSheetPct ? 0 : 1 },
  ];

  const aEdges = edges.filter(e => e.winner === 0);
  const bEdges = edges.filter(e => e.winner === 1);

  // Weighted matchup probability — current-form focused
  const aScore = a.recentForm*0.28 + ma.defensiveStability*0.22 + ma.attackingEfficiency*0.20 + a.winRate*100*0.15 + (a.eloRating/2200)*100*0.15;
  const bScore = b.recentForm*0.28 + mb.defensiveStability*0.22 + mb.attackingEfficiency*0.20 + b.winRate*100*0.15 + (b.eloRating/2200)*100*0.15;
  const aProb  = Math.round((aScore / (aScore + bScore)) * 100);
  const bProb  = 100 - aProb;

  const verdict = aProb >= bProb
    ? `${a.name} has a ${aProb}% matchup advantage. ${aEdges.length > bEdges.length ? `Stronger across ${aEdges.length} of ${edges.length} key metrics, with` : "Edges in"} recent form and ${aEdges[1]?.label.split(" (")[0].toLowerCase() ?? "defensive record"} are decisive.`
    : `${b.name} has a ${bProb}% matchup advantage. ${bEdges.length > aEdges.length ? `Stronger across ${bEdges.length} of ${edges.length} key metrics, with` : "Edges in"} recent form and ${bEdges[1]?.label.split(" (")[0].toLowerCase() ?? "defensive record"} are decisive.`;

  return { aEdges, bEdges, aProb, bProb, verdict, edges };
}

// ── Stat row helper ───────────────────────────────────────────────────────────

interface StatRow { label: string; values: (number | string)[]; numeric: number[]; format: string; higherIsBetter?: boolean }

function StatCompareRow({ row, colors, n }: { row: StatRow; colors: string[]; n: number }) {
  const winner = row.higherIsBetter !== false
    ? row.numeric.indexOf(Math.max(...row.numeric))
    : row.numeric.indexOf(Math.min(...row.numeric));
  return (
    <tr className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
      <td className="px-4 py-3 text-muted-foreground text-sm font-medium">{row.label}</td>
      {Array.from({ length: n }).map((_, i) => {
        const isWinner = i === winner;
        const val = row.values[i] ?? "—";
        return (
          <td key={i} className="px-4 py-3 text-center">
            <span className={`font-mono text-sm font-bold ${isWinner ? "" : "text-slate-500"}`}
              style={isWinner ? { color: colors[i] } : {}}>
              {val}
            </span>
            {isWinner && <span className="ml-1 text-[10px]" style={{ color: colors[i] }}>▲</span>}
          </td>
        );
      })}
    </tr>
  );
}

// ── Section header ─────────────────────────────────────────────────────────────

function SectionHeader({ icon, title, sub }: { icon: string; title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-base">{icon}</div>
      <div>
        <h3 className="font-display font-bold text-white text-lg leading-tight">{title}</h3>
        {sub && <p className="text-muted-foreground text-sm mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Gauge bar ─────────────────────────────────────────────────────────────────

function GaugeBar({ value, color, label, sub }: { value: number; color: string; label: string; sub?: string }) {
  return (
    <div className="mb-3">
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="font-mono text-sm font-bold" style={{ color }}>{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, value)}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ background: color }}
        />
      </div>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function Compare() {
  const { data: teams } = useListTeams();
  const compareTeams    = useCompareTeams();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const toggleTeam = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 4 ? [...prev, id] : prev
    );
  };

  const handleCompare = () => {
    if (selectedIds.length >= 2) compareTeams.mutate({ data: { teamIds: selectedIds } });
  };

  const result   = compareTeams.data;
  const n        = result?.teams.length ?? 0;
  const aiInsight = useMemo(() => result ? computeAiInsights(result.teams as TeamDetail[]) : null, [result]);

  const radarData = result?.radarData.map(r => ({ metric: r.metric, ...r.values })) ?? [];

  // ── Monte Carlo H2H Simulator state ─────────────────────────────────────────
  type H2HSimResult = {
    teamAWinPct: number; teamBWinPct: number; drawPct: number;
    avgGoalsA?: number; avgGoalsB?: number;
    teamAGoalsAvg?: number; teamBGoalsAvg?: number;
    topScorelines: { score: string; count: number; probability: number }[];
    attackComparison: { teamA: number; teamB: number };
    defenseComparison: { teamA: number; teamB: number };
    simulations: number;
  };
  const [h2hSim, setH2hSim] = useState<H2HSimResult | null>(null);
  const [h2hRunning, setH2hRunning] = useState(false);
  const [h2hSims, setH2hSims] = useState<500 | 5000 | 10000>(5000);

  const runH2hSim = async (sims: 500 | 5000 | 10000 = h2hSims) => {
    if (!result || result.teams.length !== 2) return;
    setH2hRunning(true);
    try {
      const res = await fetch("/api/analytics/head-to-head", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId1: result.teams[0].id, teamId2: result.teams[1].id, simulations: sims }),
      });
      const data = await res.json();
      setH2hSim(data);
    } catch {/* silent */ }
    setH2hRunning(false);
  };

  return (
    <main className="min-h-screen pt-24 pb-20 px-4 md:px-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <p className="text-primary text-xs tracking-[0.3em] uppercase font-display font-semibold mb-2">Football Intelligence</p>
          <h1 className="font-display font-bold text-5xl md:text-6xl text-white">Team Analysis</h1>
          <p className="text-muted-foreground mt-3 text-base max-w-xl">
            Advanced analytics powered by current form, attacking/defensive metrics, squad data and AI matchup modelling. Select 2–4 nations.
          </p>
        </motion.div>

        {/* Team selector */}
        <div className="mb-8 p-5 rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="font-display font-semibold text-white text-base">Select Teams</h2>
              <span className="px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-mono">{selectedIds.length}/4</span>
            </div>
            <div className="flex gap-3">
              {selectedIds.length > 0 && (
                <button onClick={() => setSelectedIds([])} className="text-xs text-muted-foreground hover:text-white transition-colors cursor-pointer">Clear</button>
              )}
              <motion.button
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={handleCompare}
                disabled={selectedIds.length < 2 || compareTeams.isPending}
                className="px-5 py-2 bg-primary text-black font-display font-bold text-xs tracking-widest rounded-lg disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed transition-all"
              >
                {compareTeams.isPending ? "Analysing…" : "Run Analysis"}
              </motion.button>
            </div>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-2">
            {(teams ?? []).map(team => {
              const isSelected = selectedIds.includes(team.id);
              const colorIdx   = selectedIds.indexOf(team.id);
              return (
                <motion.button
                  key={team.id} whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
                  onClick={() => toggleTeam(team.id)}
                  className="relative p-2 rounded-xl border text-center cursor-pointer transition-all"
                  style={{
                    borderColor: isSelected ? COLORS[colorIdx] : "rgba(255,255,255,0.08)",
                    backgroundColor: isSelected ? `${COLORS[colorIdx]}15` : "transparent",
                  }}
                >
                  {isSelected && (
                    <span className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full text-[9px] flex items-center justify-center font-bold text-black"
                      style={{ background: COLORS[colorIdx] }}>
                      {colorIdx + 1}
                    </span>
                  )}
                   <img
                   src={`https://flagcdn.com/w40/${({'FRA':'fr','ESP':'es','ENG':'gb-eng','ARG':'ar','POR':'pt','BRA':'br','GER':'de','NED':'nl','BEL':'be','ITA':'it','CRO':'hr','MAR':'ma','URU':'uy','USA':'us','JPN':'jp','SEN':'sn','COL':'co','MEX':'mx','KOR':'kr','AUS':'au','CAN':'ca','CIV':'ci','SUI':'ch'}[team.code] ?? team.code.slice(0,2).toLowerCase())}.png`}
                   alt={team.code}
                   className="w-10 h-7 object-cover rounded mx-auto mb-1"
                   onError={(e) => { (e.target as HTMLImageElement).style.display='none'; }}
                    />
                    <div className="text-white text-xs font-semibold">{team.code}</div>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Loading */}
        {compareTeams.isPending && (
          <div className="flex items-center justify-center py-24">
            <div className="text-center">
              <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground text-sm">Running football intelligence analysis…</p>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!result && !compareTeams.isPending && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-28 text-center">
            <div className="w-20 h-20 rounded-2xl bg-card border border-border flex items-center justify-center text-4xl mb-5">⚽</div>
            <h3 className="font-display font-bold text-2xl text-white mb-2">Select your nations</h3>
            <p className="text-muted-foreground text-sm">Choose 2 to 4 teams above, then click Run Analysis</p>
            <div className="mt-6 grid grid-cols-2 gap-3 max-w-sm text-left">
              {["Attack analytics","Defensive metrics","Form & momentum","AI matchup verdict"].map(f => (
                <div key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="text-primary">✓</span> {f}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Results */}
        <AnimatePresence>
          {result && !compareTeams.isPending && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

              {/* ── Team overview cards ─────────────────────────────────────── */}
              <div className={`grid gap-4 ${n === 2 ? "grid-cols-2" : n === 3 ? "grid-cols-3" : "grid-cols-2 md:grid-cols-4"}`}>
                {result.teams.map((team, i) => {
                  const m    = computeMetrics(team as TeamDetail);
                  const form = deriveFormHistory(team.code, team.recentForm);
                  return (
                    <motion.div
                      key={team.id}
                      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                      className="p-5 rounded-2xl border bg-card relative overflow-hidden"
                      style={{ borderColor: COLORS[i] }}
                    >
                      <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-5"
                        style={{ background: COLORS[i], filter: "blur(30px)", transform: "translate(30%, -30%)" }} />
                      <div className="flex items-start justify-between mb-3">
                        <img
                        src={`https://flagcdn.com/w40/${({'FRA':'fr','ESP':'es','ENG':'gb-eng','ARG':'ar','POR':'pt','BRA':'br','GER':'de','NED':'nl','BEL':'be','ITA':'it','CRO':'hr','MAR':'ma','URU':'uy','USA':'us','JPN':'jp','SEN':'sn','COL':'co','MEX':'mx','KOR':'kr','AUS':'au','CAN':'ca','CIV':'ci','SUI':'ch'}[team.code] ?? team.code.slice(0,2).toLowerCase())}.png`}
                        alt={team.name}
                       className="w-14 h-10 object-cover rounded-lg"
                         onError={(e) => { (e.target as HTMLImageElement).style.display='none'; }}
                          />
                        <span className="text-[10px] font-display font-bold tracking-widest px-2 py-1 rounded-full border"
                          style={{ color: COLORS[i], borderColor: `${COLORS[i]}40`, background: `${COLORS[i]}10` }}>
                          #{i + 1} SELECTED
                        </span>
                      </div>
                      <div className="font-display font-bold text-white text-xl leading-tight">{team.name}</div>
                      <div className="text-xs text-muted-foreground mb-3">{team.confederation} · FIFA #{team.fifaRanking}</div>

                      {/* Form pills */}
                      <div className="flex items-center gap-1 mb-4">
                        <span className="text-[10px] text-muted-foreground mr-1">Form</span>
                        {form.map((r, j) => (
                          <span key={j} className="w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center"
                            style={{ background: r === "W" ? "#22c55e20" : r === "D" ? "#f59e0b20" : "#ef444420",
                                     color: r === "W" ? "#22c55e" : r === "D" ? "#f59e0b" : "#ef4444" }}>
                            {r}
                          </span>
                        ))}
                      </div>

                      {/* Key stats */}
                      <div className="space-y-2">
                        <GaugeBar value={team.recentForm} color={COLORS[i]} label="Current Form Index" sub={`${team.recentForm}/100`} />
                        <GaugeBar value={m.attackingEfficiency} color={COLORS[i]} label="Attacking Efficiency" />
                        <GaugeBar value={m.defensiveStability} color={COLORS[i]} label="Defensive Stability" />
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* ── Performance Radar ─────────────────────────────────────────── */}
              <div className="p-6 rounded-2xl border border-border bg-card">
                <SectionHeader icon="🎯" title="Performance Radar" sub="8-dimension current strength profile — form-weighted, not history-biased" />
                {radarData.length > 0 && (
                  <ResponsiveContainer width="100%" height={400}>
                    <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                      <PolarGrid stroke="rgba(255,255,255,0.06)" />
                      <PolarAngleAxis dataKey="metric" tick={{ fill: "#64748B", fontSize: 14, fontFamily: "Rajdhani, sans-serif" }} />
                      <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                      {result.teams.map((t, i) => (
                        <Radar key={t.code} name={t.name} dataKey={t.code}
                          stroke={COLORS[i]} fill={COLORS[i]} fillOpacity={0.12} strokeWidth={2} />
                      ))}
                      <Legend formatter={v => <span style={{ color: "#94A3B8", fontSize: 12 }}>{v}</span>} />
                      <Tooltip contentStyle={{ background: "#0D1626", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 12 }}
                        formatter={(v: number) => [`${v}/100`, ""]} />
                    </RadarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* ── Attack + Defense side-by-side ─────────────────────────────── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Attack */}
                <div className="p-6 rounded-2xl border border-border bg-card">
                  <SectionHeader icon="⚔️" title="Attack Analytics" sub="Scoring output, xG model and finishing efficiency" />
                  <div className="space-y-1">
                    {result.teams.map((team, i) => {
                      const m = computeMetrics(team as TeamDetail);
                      return (
                        <div key={team.id} className="mb-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-base">{team.flagEmoji}</span>
                            <span className="font-display font-semibold text-white text-sm">{team.name}</span>
                            <span className="ml-auto font-mono text-sm font-bold" style={{ color: COLORS[i] }}>
                              {m.attackingEfficiency}/100
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 mb-2">
                            {[
                              { label: "Goals/Match", value: team.goalsScored.toFixed(2) },
                              { label: "xG",          value: m.xG.toFixed(2) },
                              { label: "Shot Conv.",  value: `${team.shotConversionRate.toFixed(1)}%` },
                            ].map(s => (
                              <div key={s.label} className="p-2 rounded-lg bg-white/[0.03] border border-white/5 text-center">
                                <div className="font-mono text-sm font-bold text-white">{s.value}</div>
                                <div className="text-[10px] text-muted-foreground mt-0.5">{s.label}</div>
                              </div>
                            ))}
                          </div>
                          <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                            <motion.div className="h-full rounded-full"
                              initial={{ width: 0 }} animate={{ width: `${m.attackingEfficiency}%` }}
                              transition={{ duration: 0.9, delay: i * 0.1, ease: "easeOut" }}
                              style={{ background: COLORS[i] }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Mini bar chart */}
                  <div className="mt-5 pt-4 border-t border-white/5">
                    <p className="text-[10px] text-muted-foreground mb-3 uppercase tracking-widest">Goals per Match Comparison</p>
                    <ResponsiveContainer width="100%" height={80}>
                      <BarChart data={result.teams.map((t, i) => ({ name: t.code, value: t.goalsScored, color: COLORS[i] }))}
                        margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                        <XAxis dataKey="name" tick={{ fill: "#64748B", fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "#64748B", fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Bar dataKey="value" radius={[3,3,0,0]}>
                          {result.teams.map((_, i) => <Cell key={i} fill={COLORS[i]} fillOpacity={0.85} />)}
                        </Bar>
                        <Tooltip contentStyle={{ background: "#0D1626", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, fontSize: 11 }}
                          formatter={(v: number) => [`${v.toFixed(2)} goals/match`, "Output"]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Defense */}
                <div className="p-6 rounded-2xl border border-border bg-card">
                  <SectionHeader icon="🛡️" title="Defensive Analytics" sub="Concession rate, xGA model and clean sheet record" />
                  <div className="space-y-1">
                    {result.teams.map((team, i) => {
                      const m = computeMetrics(team as TeamDetail);
                      return (
                        <div key={team.id} className="mb-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-base">{team.flagEmoji}</span>
                            <span className="font-display font-semibold text-white text-sm">{team.name}</span>
                            <span className="ml-auto font-mono text-sm font-bold" style={{ color: COLORS[i] }}>
                              {m.defensiveStability}/100
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 mb-2">
                            {[
                              { label: "GA/Match",   value: team.goalsConceded.toFixed(2) },
                              { label: "xGA",        value: m.xGA.toFixed(2) },
                              { label: "Clean Sht%", value: `${m.cleanSheetPct}%` },
                            ].map(s => (
                              <div key={s.label} className="p-2 rounded-lg bg-white/[0.03] border border-white/5 text-center">
                                <div className="font-mono text-sm font-bold text-white">{s.value}</div>
                                <div className="text-[10px] text-muted-foreground mt-0.5">{s.label}</div>
                              </div>
                            ))}
                          </div>
                          <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                            <motion.div className="h-full rounded-full"
                              initial={{ width: 0 }} animate={{ width: `${m.defensiveStability}%` }}
                              transition={{ duration: 0.9, delay: i * 0.1, ease: "easeOut" }}
                              style={{ background: COLORS[i] }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-5 pt-4 border-t border-white/5">
                    <p className="text-[10px] text-muted-foreground mb-3 uppercase tracking-widest">GA per Match Comparison</p>
                    <ResponsiveContainer width="100%" height={80}>
                      <BarChart data={result.teams.map((t, i) => ({ name: t.code, value: t.goalsConceded, color: COLORS[i] }))}
                        margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                        <XAxis dataKey="name" tick={{ fill: "#64748B", fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "#64748B", fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Bar dataKey="value" radius={[3,3,0,0]}>
                          {result.teams.map((_, i) => <Cell key={i} fill={COLORS[i]} fillOpacity={0.85} />)}
                        </Bar>
                        <Tooltip contentStyle={{ background: "#0D1626", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, fontSize: 11 }}
                          formatter={(v: number) => [`${v.toFixed(2)} GA/match`, "Conceded"]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* ── Form & Momentum ───────────────────────────────────────────── */}
              <div className="p-6 rounded-2xl border border-border bg-card">
                <SectionHeader icon="📈" title="Form & Momentum Analytics" sub="Recent match performance, momentum score and consistency" />
                <div className={`grid gap-6 ${n <= 2 ? "grid-cols-2" : n === 3 ? "grid-cols-3" : "grid-cols-2 md:grid-cols-4"}`}>
                  {result.teams.map((team, i) => {
                    const m     = computeMetrics(team as TeamDetail);
                    const form5 = deriveFormHistory(team.code, team.recentForm, 5);
                    const form10= deriveFormHistory(team.code + "x", team.recentForm, 10);
                    const w5    = form5.filter(r => r === "W").length;
                    const w10   = form10.filter(r => r === "W").length;
                    const l10   = form10.filter(r => r === "L").length;
                    const d10   = form10.filter(r => r === "D").length;
                    return (
                      <div key={team.id}>
                        <div className="flex items-center gap-2 mb-4">
                          <span className="text-xl">{team.flagEmoji}</span>
                          <div>
                            <div className="font-display font-bold text-white text-sm">{team.name}</div>
                           <div className="text-xs text-muted-foreground">Form index {team.recentForm}/100</div>
                          </div>
                        </div>

                        {/* Last 5 form pills */}
                        <div className="mb-3">
                          <p className="text-xs text-muted-foreground mb-1.5">Last 5 matches</p>
                          <div className="flex gap-1">
                            {form5.map((r, j) => (
                              <div key={j} className="flex-1 h-7 rounded flex items-center justify-center text-[11px] font-bold"
                                style={{ background: r === "W" ? "#22c55e20" : r === "D" ? "#f59e0b20" : "#ef444420",
                                         color: r === "W" ? "#22c55e" : r === "D" ? "#f59e0b" : "#ef4444",
                                         border: `1px solid ${r === "W" ? "#22c55e30" : r === "D" ? "#f59e0b30" : "#ef444430"}` }}>
                                {r}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Last 10 stats */}
                        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 mb-3">
                           <p className="text-xs text-muted-foreground mb-2">Last 10 matches</p>
                          <div className="grid grid-cols-3 gap-1 text-center">
                            <div><div className="text-green-400 font-mono font-bold text-base">{w10}</div><div className="text-[9px] text-muted-foreground">W</div></div>
                            <div><div className="text-yellow-400 font-mono font-bold text-base">{d10}</div><div className="text-[9px] text-muted-foreground">D</div></div>
                            <div><div className="text-red-400 font-mono font-bold text-base">{l10}</div><div className="text-[9px] text-muted-foreground">L</div></div>
                          </div>
                          {/* Stacked bar */}
                          <div className="flex h-1.5 rounded-full overflow-hidden mt-2 gap-px">
                            <div style={{ width: `${w5*20}%`, background: "#22c55e" }} className="rounded-l-full" />
                            <div style={{ width: `${d10*10}%`, background: "#f59e0b" }} />
                            <div style={{ width: `${l10*10}%`, background: "#ef4444" }} className="rounded-r-full" />
                          </div>
                        </div>

                        {/* Scores */}
                        <div className="space-y-1.5">
                          {[
                            { label: "Momentum Score",  v: m.momentumScore, max: 80  },
                            { label: "Win Rate",         v: Math.round(team.winRate*100), max: 100 },
                            { label: "Goal Difference",  v: Math.max(0, team.goalDifference + 20), max: 60 },
                          ].map(s => (
                            <div key={s.label}>
                              <div className="flex justify-between text-[10px] mb-0.5">
                                <span className="text-muted-foreground">{s.label}</span>
                                <span style={{ color: COLORS[i] }} className="font-mono font-bold">
                                  {s.label === "Goal Difference"
                                    ? (team.goalDifference >= 0 ? `+${team.goalDifference}` : team.goalDifference)
                                    : s.label === "Win Rate" ? `${Math.round(team.winRate*100)}%`
                                    : s.v}
                                </span>
                              </div>
                              <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                                <motion.div className="h-full rounded-full"
                                  initial={{ width: 0 }}
                                  animate={{ width: `${Math.min(100, (s.v / s.max) * 100)}%` }}
                                  transition={{ duration: 0.8, ease: "easeOut" }}
                                  style={{ background: COLORS[i] }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── Squad Intelligence ────────────────────────────────────────── */}
              <div className="p-6 rounded-2xl border border-border bg-card">
                <SectionHeader icon="🧬" title="Squad Intelligence" sub="Market value, age profile, depth rating and Elo standing" />
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/5">
                        <th className="px-4 py-2 text-left text-xs text-muted-foreground font-display tracking-widest uppercase">Metric</th>
                         {result.teams.map((t, i) => (
                          <th key={t.id} className="px-4 py-3 text-center text-xs font-display tracking-widest uppercase" style={{ color: COLORS[i] }}>
                             {t.flagEmoji} {t.code}
                            </th>
                              ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: "Squad Value",     values: result.teams.map(t => `€${Math.round((t.marketValueMillions??0))}M`),  numeric: result.teams.map(t => t.marketValueMillions??0) },
                        { label: "Avg Squad Age",   values: result.teams.map(t => `${(t.avgSquadAge??27).toFixed(1)} yrs`),        numeric: result.teams.map(t => t.avgSquadAge??27), higherIsBetter: false },
                        { label: "Elo Rating",      values: result.teams.map(t => Math.round(t.eloRating).toString()),             numeric: result.teams.map(t => t.eloRating) },
                        { label: "FIFA Ranking",    values: result.teams.map(t => `#${t.fifaRanking}`),                           numeric: result.teams.map(t => t.fifaRanking), higherIsBetter: false },
                        { label: "Squad Depth",     values: result.teams.map(t => `${computeMetrics(t as TeamDetail).squadDepth}/100`), numeric: result.teams.map(t => computeMetrics(t as TeamDetail).squadDepth) },
                        { label: "Pressure Index",  values: result.teams.map(t => `${computeMetrics(t as TeamDetail).pressureIndex}/100`), numeric: result.teams.map(t => computeMetrics(t as TeamDetail).pressureIndex) },
                        { label: "Possession %",    values: result.teams.map(t => `${t.possessionPct.toFixed(1)}%`),               numeric: result.teams.map(t => t.possessionPct) },
                      ].map(row => (
                        <StatCompareRow key={row.label}
                          row={{ label: row.label, values: row.values, numeric: row.numeric, format: "raw", higherIsBetter: row.higherIsBetter !== false }}
                          colors={COLORS} n={n} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ── Tournament Profile ────────────────────────────────────────── */}
              <div className="p-6 rounded-2xl border border-border bg-card">
                <SectionHeader icon="🏆" title="Tournament Profile" sub="Historical pedigree — note: weighted ≤6% in ML model (current form dominates)" />
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/5">
                        <th className="px-4 py-2 text-left text-[10px] text-muted-foreground font-display tracking-widest uppercase">Metric</th>
                        {result.teams.map((t, i) => (
                          <th key={t.id} className="px-4 py-2 text-center text-[10px] font-display tracking-widest uppercase" style={{ color: COLORS[i] }}>
                            {t.flagEmoji} {t.code}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: "WC Titles",          values: result.teams.map(t => t.worldCupWins === 0 ? "—" : `${t.worldCupWins}×`), numeric: result.teams.map(t => t.worldCupWins) },
                        { label: "Continental Titles",  values: result.teams.map(t => t.continentalTitles === 0 ? "—" : `${t.continentalTitles}×`), numeric: result.teams.map(t => t.continentalTitles) },
                        { label: "Clean Sheets",        values: result.teams.map(t => t.cleanSheets.toString()),        numeric: result.teams.map(t => t.cleanSheets) },
                        { label: "Goal Difference",     values: result.teams.map(t => t.goalDifference >= 0 ? `+${t.goalDifference}` : `${t.goalDifference}`), numeric: result.teams.map(t => t.goalDifference) },
                        { label: "Qualification",       values: result.teams.map(t => t.qualificationRecord || "—"),    numeric: result.teams.map(() => 0) },
                      ].map(row => (
                        <StatCompareRow key={row.label}
                          row={{ label: row.label, values: row.values, numeric: row.numeric, format: "raw" }}
                          colors={COLORS} n={n} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ── AI Matchup Analysis (2-team only) ─────────────────────────── */}
              {aiInsight && n === 2 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  className="p-6 rounded-2xl border bg-card overflow-hidden relative"
                  style={{ borderColor: "rgba(212,175,55,0.3)" }}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />

                  <SectionHeader icon="🤖" title="AI Matchup Intelligence"
                    sub="Form-weighted model: 28% recent form · 22% defense · 20% attack · 15% win rate · 15% Elo" />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {result.teams.map((team, i) => {
                      const myEdges = i === 0 ? aiInsight.aEdges : aiInsight.bEdges;
                      const theirEdges = i === 0 ? aiInsight.bEdges : aiInsight.aEdges;
                      const myProb = i === 0 ? aiInsight.aProb : aiInsight.bProb;
                      return (
                        <div key={team.id} className="p-4 rounded-xl border" style={{ borderColor: `${COLORS[i]}30`, background: `${COLORS[i]}08` }}>
                          <div className="flex items-center gap-3 mb-4">
                            <span className="text-3xl">{team.flagEmoji}</span>
                            <div>
                              <div className="font-display font-bold text-white text-lg">{team.name}</div>
                              <div className="font-mono text-2xl font-black" style={{ color: COLORS[i] }}>{myProb}%</div>
                            </div>
                          </div>

                          <div className="mb-3">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2 font-display">Advantages ({myEdges.length})</p>
                            {myEdges.map((e, j) => (
                              <div key={j} className="flex items-start gap-2 mb-1.5">
                                <span className="text-green-400 text-xs mt-0.5 shrink-0">✓</span>
                               <span className="text-sm text-white/80">{e.label}</span>
                              </div>
                            ))}
                          </div>

                          {theirEdges.length > 0 && (
                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2 font-display">Disadvantages ({theirEdges.length})</p>
                              {theirEdges.slice(0, 3).map((e, j) => (
                                <div key={j} className="flex items-start gap-2 mb-1.5">
                                  <span className="text-red-400 text-xs mt-0.5 shrink-0">✗</span>
                                  <span className="text-xs text-slate-500">{e.label}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Win probability bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-xs mb-1.5">
                      <span style={{ color: COLORS[0] }} className="font-display font-bold">{result.teams[0].code} {aiInsight.aProb}%</span>
                      <span style={{ color: COLORS[1] }} className="font-display font-bold">{aiInsight.bProb}% {result.teams[1].code}</span>
                    </div>
                    <div className="h-3 rounded-full overflow-hidden flex">
                      <motion.div style={{ background: COLORS[0] }} initial={{ width: 0 }}
                        animate={{ width: `${aiInsight.aProb}%` }} transition={{ duration: 1, ease: "easeOut" }} />
                      <motion.div style={{ background: COLORS[1] }} initial={{ width: 0 }}
                        animate={{ width: `${aiInsight.bProb}%` }} transition={{ duration: 1, ease: "easeOut" }} />
                    </div>
                  </div>

                  {/* Verdict */}
                  <div className="p-4 rounded-xl border border-primary/20 bg-primary/5">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-sm shrink-0">🎯</div>
                      <div>
                        <p className="text-[10px] text-primary uppercase tracking-widest font-display font-bold mb-1">AI Verdict</p>
                        <p className="text-white text-sm leading-relaxed">{aiInsight.verdict}</p>
                        <p className="text-muted-foreground text-sm mt-2">
                          Based on current form index, defensive stability, attacking efficiency, win rate and rolling Elo.
                          Historical achievements account for &lt;6% of this assessment.
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── Monte Carlo Match Simulator (2-team only) ─────────────── */}
              {n === 2 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  className="p-6 rounded-2xl border bg-card overflow-hidden relative"
                  style={{ borderColor: "rgba(0,191,255,0.25)" }}
                >
                  <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 80% 20%, rgba(0,191,255,0.04) 0%, transparent 60%)" }} />

                  <div className="flex items-start justify-between mb-5">
                    <SectionHeader icon="🎲" title="Monte Carlo Match Simulator"
                      sub={`Poisson goal sampling · Gaussian form noise · ${h2hSim ? h2hSim.simulations.toLocaleString() : "—"} simulated matches`} />
                    <div className="flex items-center gap-2 shrink-0 mt-1">
                      {([500, 5000, 10000] as const).map(s => (
                        <button
                          key={s}
                          onClick={() => { setH2hSims(s); runH2hSim(s); }}
                          disabled={h2hRunning}
                          className="px-3 py-1.5 rounded-lg text-[11px] font-display font-bold tracking-widest transition-all cursor-pointer disabled:opacity-50"
                          style={{
                            background: h2hSims === s ? "rgba(0,191,255,0.15)" : "transparent",
                            border: h2hSims === s ? "1px solid rgba(0,191,255,0.5)" : "1px solid rgba(255,255,255,0.08)",
                            color: h2hSims === s ? "#00BFFF" : "#64748B",
                          }}
                        >
                          {s >= 1000 ? `${s/1000}K` : s}
                        </button>
                      ))}
                      <motion.button
                        whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                        onClick={() => runH2hSim()}
                        disabled={h2hRunning}
                        className="ml-1 px-4 py-1.5 rounded-lg text-[11px] font-display font-bold tracking-widest cursor-pointer disabled:opacity-50 transition-all"
                        style={{ background: "rgba(0,191,255,0.15)", border: "1px solid rgba(0,191,255,0.4)", color: "#00BFFF" }}
                      >
                        {h2hRunning ? (
                          <span className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-full border border-[#00BFFF] border-t-transparent animate-spin" />
                            Simulating…
                          </span>
                        ) : "▶ Run Sim"}
                      </motion.button>
                    </div>
                  </div>

                  {!h2hSim && !h2hRunning && (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <div className="w-14 h-14 rounded-2xl border border-white/8 bg-white/[0.03] flex items-center justify-center text-2xl mb-3">🎲</div>
                      <p className="text-muted-foreground text-sm mb-1">Run a Monte Carlo simulation for this exact matchup</p>
                      <p className="text-muted-foreground/60 text-xs">Poisson-sampled goals · Gaussian noise on team stats · 95% CI computed</p>
                    </div>
                  )}

                  {h2hRunning && (
                    <div className="flex items-center justify-center py-12">
                      <div className="text-center">
                        <div className="w-10 h-10 border-2 border-[#00BFFF] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                        <p className="text-[#00BFFF] text-xs font-display tracking-widest uppercase">Simulating {h2hSims.toLocaleString()} matches…</p>
                      </div>
                    </div>
                  )}

                  {h2hSim && !h2hRunning && (
                    <div>
                      {/* Win probability bar */}
                      <div className="mb-6">
                        <div className="flex items-end justify-between mb-2">
                          <div className="text-center">
                            <div className="font-display font-bold text-4xl" style={{ color: COLORS[0] }}>{(h2hSim.teamAWinPct * 100).toFixed(1)}%</div>
                            <div className="text-xs text-muted-foreground mt-0.5">{result.teams[0].flagEmoji} {result.teams[0].name} win</div>
                          </div>
                          <div className="text-center px-4">
                            <div className="font-display font-bold text-2xl text-white/60">{(h2hSim.drawPct * 100).toFixed(1)}%</div>
                            <div className="text-xs text-muted-foreground mt-0.5">Draw</div>
                          </div>
                          <div className="text-center">
                            <div className="font-display font-bold text-4xl" style={{ color: COLORS[1] }}>{(h2hSim.teamBWinPct * 100).toFixed(1)}%</div>
                            <div className="text-xs text-muted-foreground mt-0.5">{result.teams[1].flagEmoji} {result.teams[1].name} win</div>
                          </div>
                        </div>
                        <div className="h-4 rounded-full overflow-hidden flex gap-px">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${h2hSim.teamAWinPct * 100}%` }}
                            transition={{ duration: 1, ease: "easeOut" }} className="rounded-l-full" style={{ background: COLORS[0] }} />
                          <motion.div initial={{ width: 0 }} animate={{ width: `${h2hSim.drawPct * 100}%` }}
                            transition={{ duration: 1, ease: "easeOut", delay: 0.1 }} style={{ background: "#334155" }} />
                          <motion.div initial={{ width: 0 }} animate={{ width: `${h2hSim.teamBWinPct * 100}%` }}
                            transition={{ duration: 1, ease: "easeOut", delay: 0.2 }} className="rounded-r-full" style={{ background: COLORS[1] }} />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Goal averages */}
                        <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-display mb-3">Avg Goals per Match</p>
                          <div className="space-y-2">
                            {[
                               { team: result.teams[0], avg: h2hSim.teamAGoalsAvg ?? h2hSim.avgGoalsA ?? 0, color: COLORS[0] },
                               { team: result.teams[1], avg: h2hSim.teamBGoalsAvg ?? h2hSim.avgGoalsB ?? 0, color: COLORS[1] },
                            ].map(({ team, avg, color }) => (
                              <div key={team.id}>
                                <div className="flex justify-between text-xs mb-1">
                                  <span className="text-white/70">{team.flagEmoji} {team.code}</span>
                                  <span className="font-mono font-bold" style={{ color }}>{avg.toFixed(2)}</span>
                                </div>
                                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                                  <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, avg * 33)}%` }}
                                    transition={{ duration: 0.8 }} className="h-full rounded-full" style={{ background: color }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Top scorelines */}
                        <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-display mb-3">Most Likely Scorelines</p>
                          <div className="space-y-1.5">
                            {h2hSim.topScorelines.slice(0, 5).map((s, i) => (
                              <div key={s.score} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] font-mono text-muted-foreground/60 w-3">{i + 1}.</span>
                                  <span className="font-mono font-bold text-white text-sm">{s.score}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="h-1 rounded-full bg-white/5 overflow-hidden w-16">
                                    <div className="h-full rounded-full bg-[#00BFFF]/60" style={{ width: `${s.probability * 600}%` }} />
                                  </div>
                                  <span className="font-mono text-[#00BFFF] text-xs">{(s.probability * 100).toFixed(1)}%</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Strength comparison */}
                        <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-display mb-3">Strength Index</p>
                          {[
                            { label: "Attack", a: h2hSim.attackComparison.teamA, b: h2hSim.attackComparison.teamB },
                            { label: "Defense", a: h2hSim.defenseComparison.teamA, b: h2hSim.defenseComparison.teamB },
                          ].map(({ label, a, b }) => (
                            <div key={label} className="mb-4">
                              <p className="text-[10px] text-muted-foreground mb-1.5">{label}</p>
                              <div className="flex items-center gap-1.5 text-xs">
                                <span className="font-mono font-bold w-7 text-right" style={{ color: COLORS[0] }}>{a}</span>
                                <div className="flex-1 h-2 rounded-full overflow-hidden flex">
                                  <div className="rounded-l-full" style={{ width: `${a}%`, background: COLORS[0] }} />
                                  <div className="rounded-r-full" style={{ width: `${b}%`, background: COLORS[1] }} />
                                </div>
                                <span className="font-mono font-bold w-7" style={{ color: COLORS[1] }}>{b}</span>
                              </div>
                            </div>
                          ))}
                          <div className="mt-3 pt-3 border-t border-white/5">
                            <p className="text-[9px] text-muted-foreground/60">Based on {h2hSim.simulations.toLocaleString()} Poisson-sampled match simulations with Gaussian noise injection</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* ── Head-to-Head ─────────────────────────────────────────────── */}
              {result.headToHead.length > 0 && (
                <div className="p-6 rounded-2xl border border-border bg-card">
                  <SectionHeader icon="⚡" title="Head-to-Head Records" sub="Derived from Elo + current form differential across estimated 20-match history" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {result.headToHead.map(h2h => {
                      const teamA = result.teams.find(t => t.code === h2h.teamA)!;
                      const teamB = result.teams.find(t => t.code === h2h.teamB)!;
                      const idxA  = result.teams.indexOf(teamA);
                      const idxB  = result.teams.indexOf(teamB);
                      const total = h2h.teamAWins + h2h.teamBWins + h2h.draws;
                      return (
                        <div key={`${h2h.teamA}-${h2h.teamB}`} className="p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <img
  src={`https://flagcdn.com/w40/${({'FRA':'fr','ESP':'es','ENG':'gb-eng','ARG':'ar','POR':'pt','BRA':'br','GER':'de','NED':'nl','BEL':'be','ITA':'it','CRO':'hr','MAR':'ma','URU':'uy','USA':'us','JPN':'jp','SEN':'sn','COL':'co','MEX':'mx','KOR':'kr','AUS':'au','CAN':'ca','CIV':'ci','SUI':'ch'}[teamA?.code ?? ''] ?? 'un')}.png`}
  alt={teamA?.code} className="w-8 h-6 object-cover rounded"
  onError={(e) => { (e.target as HTMLImageElement).style.display='none'; }}
/>
                              <span className="font-display font-bold text-white text-sm">{h2h.teamA}</span>
                            </div>
                            <div className="text-center px-3">
                              <span className="font-mono text-xs text-muted-foreground">
                                {h2h.teamAWins} — {h2h.draws} — {h2h.teamBWins}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-display font-bold text-white text-sm">{h2h.teamB}</span>
                              <img
  src={`https://flagcdn.com/w40/${({'FRA':'fr','ESP':'es','ENG':'gb-eng','ARG':'ar','POR':'pt','BRA':'br','GER':'de','NED':'nl','BEL':'be','ITA':'it','CRO':'hr','MAR':'ma','URU':'uy','USA':'us','JPN':'jp','SEN':'sn','COL':'co','MEX':'mx','KOR':'kr','AUS':'au','CAN':'ca','CIV':'ci','SUI':'ch'}[teamB?.code ?? ''] ?? 'un')}.png`}
  alt={teamB?.code} className="w-8 h-6 object-cover rounded"
  onError={(e) => { (e.target as HTMLImageElement).style.display='none'; }}
/>
                            </div>
                          </div>
                          <div className="flex h-2 rounded-full overflow-hidden gap-px">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${(h2h.teamAWins/total)*100}%` }}
                              transition={{ duration: 0.8 }} className="rounded-l-full" style={{ background: COLORS[idxA] }} />
                            <motion.div initial={{ width: 0 }} animate={{ width: `${(h2h.draws/total)*100}%` }}
                              transition={{ duration: 0.8, delay: 0.1 }} style={{ background: "#334155" }} />
                            <motion.div initial={{ width: 0 }} animate={{ width: `${(h2h.teamBWins/total)*100}%` }}
                              transition={{ duration: 0.8, delay: 0.2 }} className="rounded-r-full" style={{ background: COLORS[idxB] }} />
                          </div>
                          <div className="flex justify-between mt-2 text-[10px]">
                            <span style={{ color: COLORS[idxA] }} className="font-mono font-bold">{h2h.teamAWins}W</span>
                            <span className="text-muted-foreground">{h2h.draws}D</span>
                            <span style={{ color: COLORS[idxB] }} className="font-mono font-bold">{h2h.teamBWins}W</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Full stat table ───────────────────────────────────────────── */}
              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                <div className="p-5 border-b border-white/5">
                  <SectionHeader icon="📊" title="Complete Statistical Breakdown" sub="All metrics — current season data" />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/5 bg-white/[0.02]">
                        <th className="px-4 py-3 text-left text-[10px] text-muted-foreground font-display tracking-widest uppercase">Metric</th>
                        {result.teams.map((t, i) => (
                          <th key={t.id} className="px-4 py-3 text-center text-[10px] font-display tracking-widest uppercase" style={{ color: COLORS[i] }}>
                            {t.flagEmoji} {t.code}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-white/5 bg-white/[0.01]">
                        <td colSpan={n + 1} className="px-4 py-1.5 text-[9px] text-primary/70 uppercase tracking-widest font-display font-bold">Current Form</td>
                      </tr>
                      {[
                        { label: "Form Index",     values: result.teams.map(t => `${t.recentForm}/100`),               numeric: result.teams.map(t => t.recentForm) },
                        { label: "Win Rate",        values: result.teams.map(t => `${(t.winRate*100).toFixed(0)}%`),   numeric: result.teams.map(t => t.winRate) },
                        { label: "Momentum Score",  values: result.teams.map(t => String(computeMetrics(t as TeamDetail).momentumScore)), numeric: result.teams.map(t => computeMetrics(t as TeamDetail).momentumScore) },
                      ].map(row => <StatCompareRow key={row.label} row={{ ...row, format: "raw" }} colors={COLORS} n={n} />)}

                      <tr className="border-b border-white/5 bg-white/[0.01]">
                        <td colSpan={n + 1} className="px-4 py-1.5 text-[9px] text-primary/70 uppercase tracking-widest font-display font-bold">Attack</td>
                      </tr>
                      {[
                        { label: "Goals / Match",   values: result.teams.map(t => t.goalsScored.toFixed(2)),           numeric: result.teams.map(t => t.goalsScored) },
                        { label: "xG",              values: result.teams.map(t => computeMetrics(t as TeamDetail).xG.toFixed(2)), numeric: result.teams.map(t => computeMetrics(t as TeamDetail).xG) },
                        { label: "Shot Conv. %",    values: result.teams.map(t => `${t.shotConversionRate.toFixed(1)}%`), numeric: result.teams.map(t => t.shotConversionRate) },
                        { label: "Possession %",    values: result.teams.map(t => `${t.possessionPct.toFixed(1)}%`),   numeric: result.teams.map(t => t.possessionPct) },
                        { label: "Att. Efficiency", values: result.teams.map(t => `${computeMetrics(t as TeamDetail).attackingEfficiency}/100`), numeric: result.teams.map(t => computeMetrics(t as TeamDetail).attackingEfficiency) },
                      ].map(row => <StatCompareRow key={row.label} row={{ ...row, format: "raw" }} colors={COLORS} n={n} />)}

                      <tr className="border-b border-white/5 bg-white/[0.01]">
                        <td colSpan={n + 1} className="px-4 py-1.5 text-[9px] text-primary/70 uppercase tracking-widest font-display font-bold">Defense</td>
                      </tr>
                      {[
                        { label: "GA / Match",      values: result.teams.map(t => t.goalsConceded.toFixed(2)),         numeric: result.teams.map(t => t.goalsConceded), higherIsBetter: false },
                        { label: "xGA",             values: result.teams.map(t => computeMetrics(t as TeamDetail).xGA.toFixed(2)), numeric: result.teams.map(t => computeMetrics(t as TeamDetail).xGA), higherIsBetter: false },
                        { label: "Clean Sheet %",   values: result.teams.map(t => `${computeMetrics(t as TeamDetail).cleanSheetPct}%`), numeric: result.teams.map(t => computeMetrics(t as TeamDetail).cleanSheetPct) },
                        { label: "Goal Difference", values: result.teams.map(t => t.goalDifference >= 0 ? `+${t.goalDifference}` : `${t.goalDifference}`), numeric: result.teams.map(t => t.goalDifference) },
                        { label: "Def. Stability",  values: result.teams.map(t => `${computeMetrics(t as TeamDetail).defensiveStability}/100`), numeric: result.teams.map(t => computeMetrics(t as TeamDetail).defensiveStability) },
                      ].map(row => <StatCompareRow key={row.label} row={{ ...row, format: "raw", higherIsBetter: row.higherIsBetter !== false }} colors={COLORS} n={n} />)}

                      <tr className="border-b border-white/5 bg-white/[0.01]">
                        <td colSpan={n + 1} className="px-4 py-1.5 text-[9px] text-primary/70 uppercase tracking-widest font-display font-bold">Squad</td>
                      </tr>
                      {[
                        { label: "Market Value",    values: result.teams.map(t => `€${Math.round(t.marketValueMillions??0)}M`), numeric: result.teams.map(t => t.marketValueMillions??0) },
                        { label: "Avg Age",         values: result.teams.map(t => `${(t.avgSquadAge??27).toFixed(1)} yrs`), numeric: result.teams.map(t => t.avgSquadAge??27), higherIsBetter: false },
                        { label: "Squad Depth",     values: result.teams.map(t => `${computeMetrics(t as TeamDetail).squadDepth}/100`), numeric: result.teams.map(t => computeMetrics(t as TeamDetail).squadDepth) },
                      ].map(row => <StatCompareRow key={row.label} row={{ ...row, format: "raw", higherIsBetter: row.higherIsBetter !== false }} colors={COLORS} n={n} />)}
                    </tbody>
                  </table>
                </div>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
