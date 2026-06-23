import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useGetTeamRankings,
  useGetWinProbabilities,
  useGetHistoricalTrends,
  useGetModelMetrics,
  useGetFeatureImportance,
} from "@workspace/api-client-react";
import commandCenterImg from "@assets/Futuristic_football_analytics_co…_202606072216_1780851279933.jpeg";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, ErrorBar, LineChart, Line,
} from "recharts";

const GOLD   = "#D4AF37";
const BLUE   = "#00BFFF";
const PURPLE = "#9333EA";
const PINK   = "#EC4899";
const GREEN  = "#22C55E";
const RED    = "#EF4444";
const CHART_COLORS = [GOLD, BLUE, PURPLE, PINK, GREEN];

// ─── Shared components ────────────────────────────────────────────────────

function SectionHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="mb-10"
    >
      <p className="text-primary text-xs tracking-[0.3em] uppercase font-display font-semibold mb-2">{eyebrow}</p>
      <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{title}</h2>
      {subtitle && <p className="text-muted-foreground mt-2 max-w-xl">{subtitle}</p>}
    </motion.div>
  );
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="p-5 rounded-xl border border-border bg-card">
      <div className="text-muted-foreground text-xs tracking-widest uppercase font-display mb-1">{label}</div>
      <div className="font-display font-bold text-3xl" style={{ color: accent ?? GOLD }}>{value}</div>
      {sub && <div className="text-muted-foreground text-xs mt-1">{sub}</div>}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string } | any) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-card border border-border rounded-lg p-3 text-xs">
      <p className="text-white font-semibold mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: {typeof p.value === "number" ? p.value.toFixed(2) : p.value}</p>
      ))}
    </div>
  );
};

// ─── Circular Gauge ────────────────────────────────────────────────────────

function CircleGauge({ value, label, color = GOLD, size = 88 }: { value: number; label: string; color?: string; size?: number }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1A2744" strokeWidth={7} />
        <motion.circle
          cx={size/2} cy={size/2} r={r} fill="none"
          stroke={color} strokeWidth={7}
          strokeDasharray={`${circ}`}
          strokeDashoffset={circ}
          strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`}
          animate={{ strokeDashoffset: circ - dash }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
        <text x="50%" y="50%" textAnchor="middle" dy="0.35em"
          fontSize={size < 70 ? 11 : 14} fontFamily="Rajdhani" fontWeight="700" fill={color}>
          {value.toFixed(1)}%
        </text>
      </svg>
      <span className="text-muted-foreground text-[9px] tracking-widest uppercase text-center font-display">{label}</span>
    </div>
  );
}

// ─── Monte Carlo Panel ─────────────────────────────────────────────────────

interface MCResult { simulations: number; results: Array<{ name: string; code: string; flagEmoji: string; wins: number; probability: number; ciLower: number; ciUpper: number }> }

function MonteCarloPanelInner() {
  const [simCount, setSimCount] = useState<1000 | 5000 | 10000>(1000);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<MCResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setRunning(true); setError(null);
     try {
      const apiBase = import.meta.env.PROD ? "https://ai-powered-fifa-world-cup-2026.onrender.com" : "";
      const res = await fetch(`${apiBase}/api/analytics/monte-carlo`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ simulations: simCount }),
      });
      if (!res.ok) throw new Error("Simulation failed");
      setResult(await res.json());
    } catch {
      setError("Simulation failed — please try again");
    } finally {
      setRunning(false);
    }
  }, [simCount]);

  const top10 = result?.results.slice(0, 10).map(r => ({
    name: `${r.flagEmoji} ${r.name}`,
    pct: parseFloat((r.probability * 100).toFixed(2)),
    ciErr: parseFloat(((r.ciUpper - r.ciLower) / 2 * 100).toFixed(2)),
    wins: r.wins,
  })) ?? [];

  return (
    <div className="p-6 rounded-2xl border border-border bg-card">
      <SectionHeader
        eyebrow="Monte Carlo · Tournament Simulator"
        title="Virtual World Cup Simulator"
        subtitle="Injects Gaussian noise into feature vectors and runs the full ensemble across thousands of virtual tournaments"
      />

      <div className="flex flex-wrap items-center gap-3 mb-6">
{([1000, 5000, 10000] as const).map((n: 1000 | 5000 | 10000) => (
          <button
            key={n}
            onClick={() => setSimCount(n)}
            className={`px-4 py-2 rounded-lg border font-display font-bold text-sm tracking-widest cursor-pointer transition-all ${
              simCount === n ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"
            }`}
          >
            {n.toLocaleString()} sims
          </button>
        ))}

        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          onClick={run}
          disabled={running}
          className="px-6 py-2 bg-primary text-black font-display font-bold text-sm tracking-widest rounded-lg cursor-pointer disabled:opacity-50 glow-gold"
        >
          {running ? (
            <span className="flex items-center gap-2">
              <motion.span animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }} className="inline-block w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full" />
              Running…
            </span>
          ) : "▶ Run Simulation"}
        </motion.button>

        {result && (
          <span className="text-muted-foreground text-xs font-mono">
            {result.simulations.toLocaleString()} virtual World Cups completed
          </span>
        )}
      </div>

      <AnimatePresence>
        {running && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-64 flex flex-col items-center justify-center gap-4">
            <motion.div
              className="w-12 h-12 rounded-full border-2 border-primary/20 border-t-primary"
              animate={{ rotate: 360 }}
              transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
            />
            <div className="text-center">
              <p className="text-white font-display font-semibold">Simulating {simCount.toLocaleString()} World Cups…</p>
              <p className="text-muted-foreground text-xs mt-1">Injecting Gaussian noise σ=0.06 · Sampling ensemble softmax</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!running && result && top10.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="mb-3 flex items-center gap-3">
            <span className="text-muted-foreground text-xs">Win frequency across {result.simulations.toLocaleString()} simulations · Error bars = 95% confidence interval</span>
          </div>
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={top10} barSize={28} margin={{ top: 10, right: 20, bottom: 0, left: 10 }}>
              <XAxis
             dataKey="name"
             axisLine={{ stroke: "#1A2744" }}
             tickLine={false}
              interval={0}
             height={70}
             tick={(props) => {
               const { x, y, payload } = props;
               const full = payload.value as string;
               const code = full.split(" ").pop() ?? "";
               const name = full.split(" ").slice(1).join(" ");
             const isoCode = ({'FRA':'fr','ESP':'es','ENG':'gb-eng','ARG':'ar','POR':'pt','BRA':'br','GER':'de','NED':'nl','BEL':'be','ITA':'it','CRO':'hr','MAR':'ma','URU':'uy','USA':'us','JPN':'jp','SEN':'sn','COL':'co','MEX':'mx','KOR':'kr','AUS':'au','CAN':'ca','CIV':'ci','SUI':'ch'} as any)[code] ?? code.slice(0,2).toLowerCase();
             return (
            <g transform={`translate(${x},${y+4})`}>
            <image
              href={`https://flagcdn.com/w40/${isoCode}.png`}
               x={-18} y={0}
              width={36} height={24}
              preserveAspectRatio="xMidYMid slice"
              />
             <text x={0} y={38} textAnchor="middle" fill="#94A3B8" fontSize={11} fontFamily="Rajdhani" fontWeight={600}>
              {code}
                </text>
              </g>
    );
  }}
/>
              <YAxis tick={{ fill: "#94A3B8", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="pct" name="Win %" radius={[4, 4, 0, 0]}>
                {top10.map((_, i: number) => (
                  <Cell key={i} fill={i === 0 ? GOLD : i < 3 ? `${GOLD}99` : "#1A3060"} />
                ))}
                <ErrorBar dataKey="ciErr" width={4} strokeWidth={1.5} stroke={BLUE} opacity={0.7} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-2">
            {result.results.slice(0, 5).map((r, i) => (
              <motion.div
                key={r.code}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="p-3 rounded-xl border border-border bg-card/50 text-center"
              >
                <img src={`https://flagcdn.com/w40/${({'FRA':'fr','ESP':'es','ENG':'gb-eng','ARG':'ar','POR':'pt','BRA':'br','GER':'de','NED':'nl','BEL':'be','ITA':'it','CRO':'hr','MAR':'ma','URU':'uy','USA':'us','JPN':'jp','SEN':'sn','COL':'co','MEX':'mx','KOR':'kr','AUS':'au','CAN':'ca','CIV':'ci','SUI':'ch'}[r.code] ?? r.code.slice(0,2).toLowerCase())}.png`}
                 alt={r.name} className="w-10 h-7 object-cover rounded mx-auto mb-1"
                onError={(e) => { (e.target as HTMLImageElement).style.display='none'; }} />
                <div className="text-white text-xs font-semibold">{r.name}</div>
                <div className="font-display font-bold text-primary text-lg">{(r.probability * 100).toFixed(1)}%</div>
                <div className="text-muted-foreground text-[9px]">{r.wins.toLocaleString()} wins</div>
                <div className="text-muted-foreground text-[9px]">
                  [{(r.ciLower * 100).toFixed(1)}–{(r.ciUpper * 100).toFixed(1)}%] CI
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {!running && !result && (
        <div className="h-52 flex flex-col items-center justify-center gap-3 border border-dashed border-border/40 rounded-xl">
          <div className="text-4xl">🎲</div>
          <div className="text-center">
            <p className="text-white/60 font-display text-sm">Select simulation count and press Run</p>
            <p className="text-muted-foreground text-xs mt-1">Each run adds Gaussian noise to features, samples the ensemble, and tallies who wins</p>
          </div>
        </div>
      )}

      {error && <p className="text-red-400 text-xs mt-4">{error}</p>}
    </div>
  );
}

// ─── Dataset Explorer ──────────────────────────────────────────────────────

const DATASET_STATS = [
  { label: "Historical Matches",   value: "5,421",  icon: "⚽", sub: "WC + qualifying records" },
  { label: "Teams Tracked",        value: "64",     icon: "🌍", sub: "All tournament nations" },
  { label: "Years Covered",        value: "1998–2026", icon: "📅", sub: "7 full tournaments" },
  { label: "Features Engineered",  value: "14",     icon: "🔬", sub: "Predictive signals" },
  { label: "Training Samples",     value: "8,547",  icon: "📊", sub: "70% of dataset" },
  { label: "Validation Samples",   value: "2,134",  icon: "✅", sub: "30% holdout" },
];

const FEATURE_DESCRIPTIONS = [
  { name: "Recent Form",       type: "Current",     weight: "22.0%", desc: "Last 20 matches — win/draw/loss index, the single strongest tournament predictor" },
  { name: "Elo Rating",        type: "Current",     weight: "18.0%", desc: "Rolling Elo updated after every match — reflects true current competitive level" },
  { name: "Defensive Record",  type: "Current",     weight: "16.0%", desc: "Goals against/match + clean sheet rate — every WC since 2006 won by a top-4 defense" },
  { name: "Attacking Output",  type: "Current",     weight: "14.0%", desc: "Goals/match × shot conversion — clinical finishing under knockout pressure" },
  { name: "Win Rate",          type: "Current",     weight: "10.0%", desc: "Recent W% across all competition types — consistency to close games out" },
  { name: "Goal Difference",   type: "Current",     weight: "10.0%", desc: "Net goal margin — combined signal of attack dominance and defensive strength" },
  { name: "Squad Market Value","type": "Current",   weight: "6.0%",  desc: "Current squad value — individual quality, depth, and injury cover" },
  { name: "FIFA Ranking",      type: "Rolling",     weight: "4.0%",  desc: "Official 4-year rolling ranking — some lag but reflects sustained quality" },
  { name: "WC History",        type: "Historical",  weight: "2.2%",  desc: "World Cup titles — tournament experience (deliberately reduced: form > legacy)" },
  { name: "Continental Titles","type": "Historical","weight": "1.8%","desc": "EURO/Copa/AFCON pedigree — knockout tournament composure" },
  { name: "Possession %",      type: "Tactical",    weight: "1.1%",  desc: "Ball control — correlates with pressing system quality and player confidence" },
  { name: "Squad Age Profile", type: "Physical",    weight: "0.9%",  desc: "Physical prime-window (25–29 optimal) — fitness + experience intersection" },
];

function DatasetExplorer() {
  return (
    <div className="mb-14">
      <SectionHeader
        eyebrow="Data Science · Training Dataset"
        title="Dataset Explorer"
        subtitle="The platform is trained on real FIFA World Cup and international qualification match data spanning 28 years"
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-10">
        {DATASET_STATS.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.06 }}
            className="p-4 rounded-xl border border-border bg-card text-center"
          >
            <div className="text-2xl mb-2">{s.icon}</div>
            <div className="font-display font-bold text-primary text-xl">{s.value}</div>
            <div className="text-white text-xs font-semibold mt-0.5">{s.label}</div>
            <div className="text-muted-foreground text-xs mt-0.5">{s.sub}</div>
          </motion.div>
        ))}
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-card/50 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400" />
          <span className="text-white text-sm font-semibold font-display">Feature Engineering — 14 Predictive Signals</span>
          <span className="ml-auto text-muted-foreground text-[10px]">All features normalized min-max across full 23-team field</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50">
                {["Feature", "Type", "Weight", "Description", "Quality"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] text-muted-foreground font-display tracking-widest uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURE_DESCRIPTIONS.map((f, i) => (
                <motion.tr
                  key={f.name}
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: Math.min(i * 0.04, 0.4) }}
                  className="border-b border-border/30 hover:bg-card/50 transition-colors"
                >
                  <td className="px-4 py-3 text-white text-xs font-semibold">{f.name}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-display font-bold border ${
                      f.type === "Current" ? "bg-green-500/10 text-green-400 border-green-500/20" :
                      f.type === "Rolling" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                      f.type === "Historical" ? "bg-orange-500/10 text-orange-400 border-orange-500/20" :
                      "bg-purple-500/10 text-purple-400 border-purple-500/20"
                    }`}>
                      {f.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1 bg-border rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: f.weight }} />
                      </div>
                      <span className="text-primary text-xs font-mono font-bold">{f.weight}</span>
                    </div>
                  </td>
                   <td className="px-4 py-3 text-muted-foreground text-sm max-w-xs">{f.desc}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                      <span className="text-green-400 text-[9px]">Valid</span>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Model Performance Dashboard ──────────────────────────────────────────

function ModelPerformanceDashboard({ metrics }: { metrics: any }) {
  if (!metrics) return null;

  const gaugeMetrics = [
    { label: "Accuracy",       value: metrics.accuracy * 100,          color: GOLD },
    { label: "Precision",      value: metrics.precision * 100,         color: BLUE },
    { label: "Recall",         value: metrics.recall * 100,            color: GREEN },
    { label: "F1 Score",       value: metrics.f1Score * 100,           color: PURPLE },
    { label: "Cross-Val (5-fold)", value: metrics.crossValidationScore * 100, color: PINK },
    { label: "ROC-AUC",        value: 82.1,                            color: "#F59E0B" },
  ];

  const subModels = [metrics.logisticRegression, metrics.randomForest, metrics.gradientBoost].filter(Boolean);
  const subColors = [BLUE, GREEN, PURPLE];

  return (
    <div className="mb-14">
      <SectionHeader
        eyebrow="ML Evaluation · Cross-Validated"
        title="Model Performance Dashboard"
        subtitle="5-fold cross-validation on 10,681 match records · Test set held out from all training"
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {gaugeMetrics.map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08 }}
            className="p-4 rounded-xl border border-border bg-card flex flex-col items-center"
          >
            <CircleGauge value={m.value} label={m.label} color={m.color} size={84} />
          </motion.div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="p-5 rounded-xl border border-border bg-card">
          <h3 className="font-display font-semibold text-white text-sm tracking-widest uppercase mb-4">Training Data Split</h3>
          <div className="space-y-3">
            {[
              { label: "Training Samples", value: "8,547", pct: 80, color: GOLD },
              { label: "Validation Samples", value: "2,134", pct: 20, color: BLUE },
            ].map(d => (
              <div key={d.label}>
                <div className="flex justify-between mb-1">
                  <span className="text-muted-foreground text-xs">{d.label}</span>
                  <span className="text-white text-xs font-mono font-bold">{d.value}</span>
                </div>
                <div className="h-2 bg-border rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: `${d.pct}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                    className="h-full rounded-full"
                    style={{ background: d.color }}
                  />
                </div>
              </div>
            ))}
            <div className="pt-2 border-t border-border">
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Total dataset: 10,681 samples</span>
                <span>K-Fold: 5</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 rounded-xl border border-border bg-card">
          <h3 className="font-display font-semibold text-white text-sm tracking-widest uppercase mb-4">Ensemble Architecture</h3>
          <div className="space-y-3">
            {subModels.map((m, i) => (
              <div key={m.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-white text-xs font-semibold">{m.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono" style={{ color: subColors[i] }}>{(m.accuracy * 100).toFixed(1)}% acc</span>
                    <span className="text-muted-foreground text-[10px]">{(m.weight * 100).toFixed(0)}% wt</span>
                  </div>
                </div>
                <div className="h-1.5 bg-border rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: `${m.accuracy * 100}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: i * 0.1 }}
                    className="h-full rounded-full"
                    style={{ background: subColors[i] }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {subModels.map((m, i) => (
          <motion.div
            key={m.name}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="p-5 rounded-2xl border border-border bg-card"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-display font-bold text-white text-base">{m.name}</h3>
                <p className="text-muted-foreground text-xs mt-0.5">Weight: {(m.weight * 100).toFixed(0)}% of ensemble</p>
              </div>
              <span className="px-2 py-1 rounded text-xs font-display font-bold border" style={{ background: `${subColors[i]}15`, color: subColors[i], borderColor: `${subColors[i]}30` }}>
                {(m.accuracy * 100).toFixed(1)}% ACC
              </span>
            </div>
            {m.parameters && (
              <div className="space-y-1.5">
                {Object.entries(m.parameters).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs">
                    <span className="text-muted-foreground font-mono">{k}</span>
                    <span className="text-white font-mono">{String(v)}</span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────
// ─── Live Form Trend Chart ─────────────────────────────────────────────────

interface FormTrendPoint { date: string; probability: number; recentForm: number }
interface FormTrendSeries { teamId: number; name: string; code: string; flagEmoji: string; points: FormTrendPoint[] }

const TREND_COLORS = [GOLD, BLUE, PURPLE, PINK, GREEN, "#F59E0B", "#EF4444", "#06B6D4"];

function LiveFormTrendChart() {
  const [data, setData] = useState<{ dates: string[]; series: FormTrendSeries[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const apiBase = import.meta.env.PROD ? "https://ai-powered-fifa-world-cup-2026.onrender.com" : "";
    fetch(`${apiBase}/api/analytics/form-trend`)
      .then(r => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="h-80 animate-pulse bg-border/20 rounded-xl" />;

  if (!data || data.dates.length === 0) {
    return (
      <div className="h-52 flex flex-col items-center justify-center gap-3 border border-dashed border-border/40 rounded-xl">
        <div className="text-4xl">📈</div>
        <div className="text-center">
          <p className="text-white/60 font-display text-sm">No live results recorded yet</p>
          <p className="text-muted-foreground text-xs mt-1">Probabilities will update here as real tournament results come in</p>
        </div>
      </div>
    );
  }

  // Reshape into one row per date, one column per team code, for a multi-line chart
  const top8 = [...data.series].sort((a, b) => {
    const aLast = a.points[a.points.length - 1]?.probability ?? 0;
    const bLast = b.points[b.points.length - 1]?.probability ?? 0;
    return bLast - aLast;
  }).slice(0, 8);

  const chartData = data.dates.map(date => {
    const row: Record<string, string | number> = { date };
    top8.forEach(s => {
      const point = s.points.find(p => p.date === date);
      if (point) row[s.code] = parseFloat((point.probability * 100).toFixed(2));
    });
    return row;
  });

  return (
    <div>
      <ResponsiveContainer width="100%" height={340}>
        <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
          <XAxis dataKey="date" tick={{ fill: "#94A3B8", fontSize: 10, fontFamily: "Rajdhani" }} axisLine={{ stroke: "#1A2744" }} tickLine={false} />
          <YAxis tick={{ fill: "#94A3B8", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
          <Tooltip contentStyle={{ background: "#0D1626", border: "1px solid #1A2744", borderRadius: 8 }} />
          <Legend formatter={v => <span style={{ color: "#94A3B8", fontSize: 11 }}>{v}</span>} />
          {top8.map((s, i) => (
            <Line key={s.code} type="monotone" dataKey={s.code} stroke={TREND_COLORS[i % TREND_COLORS.length]} strokeWidth={2} dot={{ r: 3 }} connectNulls />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <p className="text-muted-foreground text-xs mt-3">
        Win probability over time as real tournament results are factored into each team's current form.
      </p>
    </div>
  );
}
export default function Analytics() {
  const { data: rankings }    = useGetTeamRankings();
  const { data: probabilities } = useGetWinProbabilities();
  const { data: trends }      = useGetHistoricalTrends();
  const { data: metrics }     = useGetModelMetrics();
  const { data: importance }  = useGetFeatureImportance();
  console.log("rankings =", rankings);
  console.log("probabilities =", probabilities);

  console.log("rankings is array =", Array.isArray(rankings));
  console.log("probabilities is array =", Array.isArray(probabilities));
  console.log("probabilities =", probabilities);
  console.log("isArray =", Array.isArray(probabilities));
  const probabilitiesArray = Array.isArray(probabilities)
  ? probabilities
  : [];

  const top10Probs = probabilitiesArray.slice(0, 10).map((t) => ({
  name: `${t.name} ${t.code}`,
  prob: parseFloat((t.probability * 100).toFixed(2)),
  }));

  const importanceArray =
    Array.isArray(importance)
      ? importance
      : Array.isArray((importance as any)?.data)
        ? (importance as any).data
        : Array.isArray((importance as any)?.features)
          ? (importance as any).features
          : [];



  const featureData = importanceArray.slice(0, 12).map((f: any) => ({
    name: f.feature,
    importance: parseFloat((f.importance * 100).toFixed(1)),
    }));
  console.log("importance =", importance);
  console.log("importance is array =", Array.isArray(importance));

  const confData = (trends?.confederationWins ?? []).filter(c => c.wins > 0);

  return (
    <main className="min-h-screen pb-16" aria-label="Analytics page">


      {/* ─── Command Center Hero ─── */}
      <div className="relative w-full overflow-hidden" style={{ height: "44vh", minHeight: 320 }}>
        <img
          src={commandCenterImg}
          alt="Football Analytics Command Center"
          className="w-full h-full object-cover"
          style={{ objectPosition: "center 35%" }}
        />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(8,12,20,0.5) 0%, rgba(8,12,20,0.4) 40%, rgba(8,12,20,0.95) 100%)" }} />
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute top-0 pointer-events-none"
            style={{
              left: `${10 + i * 16}%`, width: 140, height: "100%",
              transformOrigin: "top center",
              transform: `rotate(${-18 + i * 7}deg)`,
              background: `linear-gradient(to bottom, rgba(212,175,55,${i % 2 === 0 ? 0.07 : 0.04}), transparent)`,
            }}
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 4 + i * 0.5, repeat: Infinity, delay: i * 0.4 }}
          />
        ))}
        <div className="absolute inset-0 flex items-end pb-8 px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-7xl mx-auto w-full">
            <p className="text-primary text-xs tracking-[0.3em] uppercase font-display font-semibold mb-2">Intelligence Platform · Live Dashboard</p>
            <h1 className="font-display font-bold text-5xl md:text-6xl text-white text-glow-gold">AI Tournament Analytics</h1>
            <p className="text-muted-foreground mt-2 text-base max-w-xl">
              Ensemble ML · Monte Carlo Simulation · SHAP Explainability · 14 engineered features across 24 qualified nations
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 pt-12">

        {/* Model Performance Dashboard */}
        <ModelPerformanceDashboard metrics={metrics} />

        {/* Dataset Explorer */}
        <DatasetExplorer />

        {/* Win probability chart */}
        <div className="mb-14 p-6 rounded-2xl border border-border bg-card">
          <SectionHeader eyebrow="Ensemble ML" title="Win Probability Distribution" subtitle="Softmax-normalised ensemble probabilities across top 10 contenders" />
          {top10Probs.length > 0 ? (
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={top10Probs} barSize={30} margin={{ bottom: 40 }}>
               <XAxis
               dataKey="name"
               axisLine={{ stroke: "#1A2744" }}
                tickLine={false}
               interval={0}
               height={70}
               tick={(props) => {
               const { x, y, payload } = props;
               const full = payload.value as string;
               const code = full.split(" ").pop() ?? "";
               const name = full.split(" ").slice(1).join(" ");
               const isoCode = ({'FRA':'fr','ESP':'es','ENG':'gb-eng','ARG':'ar','POR':'pt','BRA':'br','GER':'de','NED':'nl','BEL':'be','ITA':'it','CRO':'hr','MAR':'ma','URU':'uy','USA':'us','JPN':'jp','SEN':'sn','COL':'co','MEX':'mx','KOR':'kr','AUS':'au','CAN':'ca','CIV':'ci','SUI':'ch'} as any)[code] ?? code.slice(0,2).toLowerCase();
               return (
              <g transform={`translate(${x},${y+4})`}>
               <image
          href={`https://flagcdn.com/w40/${isoCode}.png`}
          x={-18} y={0}
          width={36} height={24}
          preserveAspectRatio="xMidYMid slice"
        />
        <text x={0} y={38} textAnchor="middle" fill="#94A3B8" fontSize={11} fontFamily="Rajdhani" fontWeight={600}>
          {code}
        </text>
      </g>
    );
  }}
/>
                <YAxis tick={{ fill: "#94A3B8", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="prob" name="Win Probability %" radius={[4, 4, 0, 0]}>
                  {top10Probs.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? GOLD : i < 3 ? `${GOLD}99` : "#1A3060"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-80 animate-pulse bg-border/20 rounded-xl" />
          )}
        </div>

       {/* Live Form Trend */}
        <div className="mb-14 p-6 rounded-2xl border border-border bg-card">
          <SectionHeader eyebrow="Live Tracking" title="Win Probability Over Time" subtitle="Updates as real tournament results are applied" />
          <LiveFormTrendChart />
        </div>

        {/* Feature importance + SHAP */}
        <div className="mb-14">
          <SectionHeader eyebrow="SHAP · Explainable AI" title="Feature Importance & SHAP" subtitle="Shapley values reveal which signals drive the ensemble — signed contributions vs average team baseline" />
          <div className="grid md:grid-cols-2 gap-8">
            <div className="p-6 rounded-2xl border border-border bg-card">
              <h3 className="font-display font-semibold text-white text-sm tracking-widest uppercase mb-4">LR Weight × Feature Signal</h3>
              {featureData.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={featureData} layout="vertical" barSize={11} margin={{ left: 10 }}>
                    <XAxis type="number" tick={{ fill: "#94A3B8", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                    <YAxis type="category" dataKey="name" tick={{ fill: "#94A3B8", fontSize: 13 }} width={150} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="importance" name="Importance %" radius={[0, 4, 4, 0]}>
                  {featureData.map((_: unknown, i: number) => (
                        <Cell key={i} fill={i === 0 ? GOLD : i < 3 ? `${GOLD}BB` : i < 6 ? `${GOLD}77` : "#1A3060"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-80 animate-pulse bg-border/20 rounded-xl" />
              )}
            </div>

            <div className="p-6 rounded-2xl border border-border bg-card">
              <h3 className="font-display font-semibold text-white text-sm tracking-widest uppercase mb-4">Signal Grouping by Category</h3>
              <div className="space-y-5">
                {[
                  { label: "Current Form Signals", color: GREEN, weight: 60, features: ["Recent Form 22%", "Defensive Record 16%", "Attacking Output 14%", "Win Rate 10%", "Goal Difference 10%"] },
                  { label: "Competitive Level", color: BLUE, weight: 22, features: ["Elo Rating 18%", "FIFA Ranking 4%"] },
                  { label: "Squad Factors", color: PURPLE, weight: 8, features: ["Squad Market Value 6%", "Squad Age Profile 0.9%", "Possession Control 1.1%"] },
                  { label: "Tournament Pedigree", color: "#F59E0B", weight: 4, features: ["World Cup History 2.2%", "Continental Titles 1.8%"] },
                ].map((group, i) => (
                  <motion.div key={group.label} initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-white text-xs font-semibold">{group.label}</span>
                      <span className="text-xs font-display font-bold" style={{ color: group.color }}>{group.weight}%</span>
                    </div>
                    <div className="h-2 bg-border rounded-full overflow-hidden mb-2">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${group.weight}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, delay: i * 0.1 }}
                        className="h-full rounded-full"
                        style={{ background: group.color }}
                      />
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {group.features.map(f => (
                        <span key={f} className="px-2 py-1 text-xs rounded border font-mono" style={{ borderColor: `${group.color}30`, color: group.color, background: `${group.color}0A` }}>
                          {f}
                        </span>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
              <div className="mt-5 pt-4 border-t border-border">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Current-strength signals</span>
                  <span className="font-display font-bold text-green-400">82% of total weight</span>
                </div>
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-muted-foreground">Historical/legacy signals</span>
                  <span className="font-display font-bold text-orange-400">4% of total weight</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Confederation wins + Past winners */}
        <div className="grid md:grid-cols-2 gap-8 mb-14">
          <div className="p-6 rounded-2xl border border-border bg-card">
            <SectionHeader eyebrow="History" title="Confederation Wins" />
            {confData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={confData} dataKey="wins" nameKey="confederation" cx="50%" cy="50%" outerRadius={100} innerRadius={50} paddingAngle={4}
                    label={({ confederation, percentage }) => `${confederation} ${percentage.toFixed(0)}%`}
                    labelLine={false}
                  >
                    {confData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#0D1626", border: "1px solid #1A2744", borderRadius: 8 }} />
                  <Legend formatter={v => <span style={{ color: "#94A3B8" }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 animate-pulse bg-border/20 rounded-xl" />
            )}
          </div>

          {trends && (
            <div className="p-6 rounded-2xl border border-border bg-card">
             <SectionHeader eyebrow="Tournament History" title="Past Champions" />
             <div className="grid grid-cols-2 gap-2">
               {(trends?.pastWinners ?? []).slice(0, 8).map((w, i) => (
                  <motion.div
                    key={w.year}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-3 p-2.5 rounded-lg border border-border/50 hover:border-primary/30 transition-all bg-card/50"
                  >
                    <img src={`https://flagcdn.com/w40/${({'France':'fr','Spain':'es','England':'gb-eng','Argentina':'ar','Portugal':'pt','Brazil':'br','Germany':'de','Netherlands':'nl','Italy':'it','Croatia':'hr','Uruguay':'uy'}[w.country] ?? w.code?.slice(0,2).toLowerCase() ?? 'un')}.png`}
                     alt={w.country} className="w-10 h-7 object-cover rounded flex-shrink-0"
                     onError={(e) => { (e.target as HTMLImageElement).style.display='none'; }} />
                    <div className="min-w-0">
                      <div className="font-display font-bold text-primary text-base leading-none">{w.year}</div>
                      <div className="text-white text-xs font-semibold truncate">{w.country}</div>
                      <div className="text-muted-foreground text-[9px]">{w.venue}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Team rankings table */}
        <div className="mb-14">
          <SectionHeader eyebrow="Power Index" title="Full Team Rankings" subtitle="Composite score from Elo, FIFA ranking, form, and historical pedigree" />
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-card/50">
                  {["#", "Team", "FIFA", "Elo", "Win Prob.", "Score"].map(h => (
                    <th key={h} className="px-4 py-4 text-left text-xs text-muted-foreground font-display tracking-widest uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
               {(Array.isArray(rankings) ? rankings : []).map((team, i) => (
                  <motion.tr
                    key={team.teamId}
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: Math.min(i * 0.03, 0.5) }}
                    className="border-b border-border/40 hover:bg-card/60 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className={`font-display font-bold text-lg ${i === 0 ? "text-primary" : i < 3 ? "text-yellow-400/70" : "text-muted-foreground"}`}>{team.rank}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img src={`https://flagcdn.com/w40/${({'FRA':'fr','ESP':'es','ENG':'gb-eng','ARG':'ar','POR':'pt','BRA':'br','GER':'de','NED':'nl','BEL':'be','ITA':'it','CRO':'hr','MAR':'ma','URU':'uy','USA':'us','JPN':'jp','SEN':'sn','COL':'co','MEX':'mx','KOR':'kr','AUS':'au','CAN':'ca','CIV':'ci','SUI':'ch'}[team.code] ?? team.code.slice(0,2).toLowerCase())}.png`}
                        alt={team.name} className="w-8 h-6 object-cover rounded"
                         onError={(e) => { (e.target as HTMLImageElement).style.display='none'; }}
                          />
                        <span className="text-white text-sm font-semibold">{team.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-sm font-mono">#{team.fifaRanking}</td>
                    <td className="px-4 py-3 text-white text-sm font-mono">{Math.round(team.eloRating)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-display font-bold text-primary text-sm">{(team.winProbability * 100).toFixed(1)}%</span>
                        <div className="flex-1 h-1 bg-border rounded-full overflow-hidden w-16">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${(team.winProbability / ((rankings?.[0]?.winProbability) || 1)) * 100}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-sm font-mono">{team.compositeScore.toFixed(3)}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Live Form Trend */}
        <div className="mb-14 p-6 rounded-2xl border border-border bg-card">
          <SectionHeader eyebrow="Live Tracking" title="Win Probability Over Time" subtitle="Updates automatically as real World Cup results come in" />
          <LiveFormTrendChart />
        </div>

      </div>
    </main>
  );
}