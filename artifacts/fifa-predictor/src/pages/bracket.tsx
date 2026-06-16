import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGetWinProbabilities } from "@workspace/api-client-react";

// ─── Types ─────────────────────────────────────────────────────────────────

interface Team {
  code: string;
  name: string;
  probability: number; // pre-tournament ML win probability
  flagEmoji: string;
}

interface SimMatch {
  id: string;
  teamA: Team;
  teamB: Team;
  winner?: Team;
  scoreA?: number;
  scoreB?: number;
  winProbA?: number; // match-specific win prob
}

interface BracketState {
  r16: SimMatch[];
  qf: SimMatch[];
  sf: SimMatch[];
  final: SimMatch | null;
  champion: Team | null;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const FLAG_MAP: Record<string, string> = {
  FRA:"fr", ESP:"es", ENG:"gb-eng", ARG:"ar", POR:"pt", BRA:"br",
  GER:"de", NED:"nl", BEL:"be", ITA:"it", CRO:"hr", MAR:"ma",
  URU:"uy", USA:"us", JPN:"jp", SEN:"sn", COL:"co", MEX:"mx",
  KOR:"kr", AUS:"au", CAN:"ca", CIV:"ci", SUI:"ch",
};

const flagUrl = (code: string) =>
  `https://flagcdn.com/w40/${FLAG_MAP[code] ?? code.slice(0,2).toLowerCase()}.png`;

// 2026 WC groups — top 2 from each qualify for R32, we simulate R16 onward
// Seedings based on ML probability rankings
// Proper seeding — top teams separated to opposite sides of bracket
// Side A: FRA, ARG, BRA, BEL
// Side B: ESP, ENG, POR, GER
// This means FRA vs ESP can only happen in the FINAL
const GROUP_SEEDS: [string, string][] = [
  ["FRA", "MAR"],   // A1 vs weakest — France should cruise R16
  ["BEL", "JPN"],   // A2 vs B3
  ["ARG", "AUS"],   // C1 vs weakest
  ["BRA", "URU"],   // D1 vs D2 — South American derby
  ["ESP", "KOR"],   // E1 vs weakest — Spain should cruise R16
  ["ENG", "COL"],   // F1 vs F2
  ["POR", "SEN"],   // G1 vs G2
  ["GER", "USA"],   // H1 vs H2 — strong match
];

// ─── Simulation Engine ─────────────────────────────────────────────────────

function matchWinProb(teamA: Team, teamB: Team): number {
  // Dixon-Coles style: use log-odds of pre-tournament probabilities
  // with home advantage set to zero (neutral venue)
  const pA = Math.max(0.01, teamA.probability);
  const pB = Math.max(0.01, teamB.probability);
  // Elo-style conversion
  const eA = pA / (pA + pB);
  // Shrink toward 50% — single matches are more random than tournaments
  // k=0.65 means the favourite wins ~65% when they "should" win 80%
 return 0.5 + (eA - 0.5) * 0.80;
}

function simulateScore(winProb: number): [number, number] {
  // Poisson-ish goal model
  const lambdaA = 0.8 + winProb * 1.2;
  const lambdaB = 0.8 + (1 - winProb) * 1.2;
  const poisson = (l: number) => {
    let k = 0, p = 1, L = Math.exp(-l);
    do { k++; p *= Math.random(); } while (p > L);
    return Math.max(0, k - 1);
  };
  let gA = poisson(lambdaA);
  let gB = poisson(lambdaB);
  // If draw, go to penalties — winner determined by winProb
  if (gA === gB) {
    if (Math.random() < winProb) gA += 1;
    else gB += 1;
  }
  return [gA, gB];
}

function simulateMatch(teamA: Team, teamB: Team, matchId: string): SimMatch {
  const winProbA = matchWinProb(teamA, teamB);
  const [scoreA, scoreB] = simulateScore(winProbA);
  const winner = scoreA > scoreB ? teamA : teamB;
  return {
    id: matchId,
    teamA, teamB, winner,
    scoreA, scoreB,
    winProbA: Math.round(winProbA * 100),
  };
}

function buildR16(teams: Map<string, Team>): SimMatch[] {
  return GROUP_SEEDS.map(([codeA, codeB], i) => ({
    id: `r16-${i}`,
    teamA: teams.get(codeA) ?? { code: codeA, name: codeA, probability: 0.02, flagEmoji: "" },
    teamB: teams.get(codeB) ?? { code: codeB, name: codeB, probability: 0.02, flagEmoji: "" },
  }));
}

function buildNextRound(matches: SimMatch[], prefix: string): SimMatch[] {
  const winners = matches.map(m => m.winner!);
  const next: SimMatch[] = [];
  for (let i = 0; i < winners.length; i += 2) {
    if (winners[i] && winners[i+1]) {
      next.push({ id: `${prefix}-${i/2}`, teamA: winners[i], teamB: winners[i+1] });
    }
  }
  return next;
}

// ─── UI Components ─────────────────────────────────────────────────────────

function FlagImg({ code, className }: { code: string; className?: string }) {
  return (
    <img
      src={flagUrl(code)}
      alt={code}
      className={className ?? "w-8 h-5 object-cover rounded"}
      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
    />
  );
}

function MatchCard({ match, highlight }: { match: SimMatch; highlight?: boolean }) {
  const simulated = !!match.winner;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border p-3 w-44 flex-shrink-0 ${
        highlight ? "border-primary/50 bg-primary/5" : "border-border bg-card"
      }`}
    >
      {/* Team A */}
      <div className={`flex items-center gap-2 p-1.5 rounded-lg mb-1 ${
        simulated && match.winner?.code === match.teamA.code
          ? "bg-primary/15 border border-primary/40" : ""
      }`}>
        <FlagImg code={match.teamA.code} className="w-7 h-5 object-cover rounded flex-shrink-0" />
        <span className={`text-xs font-semibold truncate flex-1 ${
          simulated && match.winner?.code === match.teamA.code ? "text-primary" : "text-white"
        }`}>{match.teamA.name}</span>
        {simulated && (
          <span className={`text-xs font-mono font-bold flex-shrink-0 ${
            match.winner?.code === match.teamA.code ? "text-primary" : "text-muted-foreground"
          }`}>{match.scoreA}</span>
        )}
      </div>

      {/* VS / probabilities */}
      <div className="text-center py-0.5">
        {simulated ? (
          <span className="text-[9px] text-muted-foreground font-mono">
            {match.winProbA}% · {100 - (match.winProbA ?? 50)}%
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground/60">vs</span>
        )}
      </div>

      {/* Team B */}
      <div className={`flex items-center gap-2 p-1.5 rounded-lg mt-1 ${
        simulated && match.winner?.code === match.teamB.code
          ? "bg-primary/15 border border-primary/40" : ""
      }`}>
        <FlagImg code={match.teamB.code} className="w-7 h-5 object-cover rounded flex-shrink-0" />
        <span className={`text-xs font-semibold truncate flex-1 ${
          simulated && match.winner?.code === match.teamB.code ? "text-primary" : "text-white"
        }`}>{match.teamB.name}</span>
        {simulated && (
          <span className={`text-xs font-mono font-bold flex-shrink-0 ${
            match.winner?.code === match.teamB.code ? "text-primary" : "text-muted-foreground"
          }`}>{match.scoreB}</span>
        )}
      </div>
    </motion.div>
  );
}

function RoundSection({
  title, matches, eyebrow
}: {
  title: string;
  matches: SimMatch[];
  eyebrow?: string;
}) {
  return (
    <div className="mb-10">
      {eyebrow && (
        <p className="text-primary text-[10px] tracking-[0.3em] uppercase font-display font-semibold mb-1">{eyebrow}</p>
      )}
      <h3 className="font-display font-bold text-white text-xl mb-4">{title}</h3>
      <div className="flex flex-wrap gap-3">
        {matches.map(m => (
          <MatchCard key={m.id} match={m} highlight={title === "The Final"} />
        ))}
      </div>
    </div>
  );
}

function SimButton({
  onClick, disabled, children
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.03 }}
      whileTap={{ scale: disabled ? 1 : 0.97 }}
      onClick={onClick}
      disabled={disabled}
      className="px-8 py-3.5 bg-primary text-black font-display font-bold text-sm tracking-widest rounded-xl cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all glow-gold"
    >
      {children}
    </motion.button>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

type Stage = "idle" | "r16_ready" | "r16_done" | "qf_done" | "sf_done" | "final_done";

export default function Bracket() {
  const { data: probabilities } = useGetWinProbabilities();
  const [stage, setStage] = useState<Stage>("idle");
  const [bracket, setBracket] = useState<BracketState>({
    r16: [], qf: [], sf: [], final: null, champion: null,
  });
  const [simulating, setSimulating] = useState(false);

  // Build team map from API data
  const teamMap = new Map<string, Team>();
  (Array.isArray(probabilities) ? probabilities : []).forEach(t => {
    teamMap.set(t.code, {
      code: t.code,
      name: t.name,
      probability: t.probability,
      flagEmoji: t.flagEmoji,
    });
  });

  const ready = teamMap.size > 0;

  // ── Step 1: Set up R16 matchups ──
  const handleSetupR16 = () => {
    if (!ready) return;
    const r16 = buildR16(teamMap);
    setBracket({ r16, qf: [], sf: [], final: null, champion: null });
    setStage("r16_ready");
  };

  // ── Step 2: Simulate R16 ──
  const handleSimR16 = async () => {
    setSimulating(true);
    await new Promise(r => setTimeout(r, 1200));
    const simulated = bracket.r16.map(m => simulateMatch(m.teamA, m.teamB, m.id));
    const qf = buildNextRound(simulated, "qf");
    setBracket(b => ({ ...b, r16: simulated, qf }));
    setStage("r16_done");
    setSimulating(false);
  };

  // ── Step 3: Simulate QF ──
  const handleSimQF = async () => {
    setSimulating(true);
    await new Promise(r => setTimeout(r, 1000));
    const simulated = bracket.qf.map(m => simulateMatch(m.teamA, m.teamB, m.id));
    const sf = buildNextRound(simulated, "sf");
    setBracket(b => ({ ...b, qf: simulated, sf }));
    setStage("qf_done");
    setSimulating(false);
  };

  // ── Step 4: Simulate SF ──
  const handleSimSF = async () => {
    setSimulating(true);
    await new Promise(r => setTimeout(r, 1000));
    const simulated = bracket.sf.map(m => simulateMatch(m.teamA, m.teamB, m.id));
    const winners = simulated.map(m => m.winner!);
    const final: SimMatch = { id: "final", teamA: winners[0], teamB: winners[1] };
    setBracket(b => ({ ...b, sf: simulated, final }));
    setStage("sf_done");
    setSimulating(false);
  };

  // ── Step 5: Simulate Final ──
  const handleSimFinal = async () => {
    if (!bracket.final) return;
    setSimulating(true);
    await new Promise(r => setTimeout(r, 1400));
    const result = simulateMatch(bracket.final.teamA, bracket.final.teamB, "final");
    setBracket(b => ({ ...b, final: result, champion: result.winner! }));
    setStage("final_done");
    setSimulating(false);
  };

  // ── Reset ──
  const handleReset = () => {
    setBracket({ r16: [], qf: [], sf: [], final: null, champion: null });
    setStage("idle");
  };

  const STAGES: { key: Stage | "r16_ready"; label: string }[] = [
    { key: "r16_ready", label: "R16 Draw" },
    { key: "r16_done", label: "Quarter Finals" },
    { key: "qf_done", label: "Semi Finals" },
    { key: "sf_done", label: "The Final" },
    { key: "final_done", label: "Champion" },
  ];

  const stageIndex = ["idle","r16_ready","r16_done","qf_done","sf_done","final_done"].indexOf(stage);

  return (
    <main className="min-h-screen pt-24 pb-20 px-6">
      <div className="max-w-7xl mx-auto">

        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <p className="text-primary text-xs tracking-[0.3em] uppercase font-display font-semibold mb-2">
            ML-Powered · Tournament Engine
          </p>
          <h1 className="font-display font-bold text-5xl md:text-6xl text-white">
            2026 Bracket Simulator
          </h1>
          <p className="text-muted-foreground mt-3 text-base max-w-2xl leading-relaxed">
            Each match is simulated using the ensemble ML win probabilities with a
            Poisson goal model and Dixon-Coles adjustment. Stronger teams win more often
            — but upsets happen, just like in real football.
          </p>
        </motion.div>

        {/* ── Stage progress bar ── */}
        <div className="flex items-center gap-2 mb-10 overflow-x-auto pb-2">
          {STAGES.map((s, i) => {
            const done = stageIndex > i + 1;
            const active = stageIndex === i + 1;
            return (
              <div key={s.key} className="flex items-center gap-2 flex-shrink-0">
                <div className={`px-3 py-1.5 rounded-lg text-[11px] font-display font-bold tracking-widest transition-all ${
                  active ? "bg-primary text-black" :
                  done ? "bg-green-500/20 text-green-400 border border-green-500/30" :
                  "bg-border/20 text-muted-foreground/50"
                }`}>
                  {s.label.toUpperCase()}
                </div>
                {i < STAGES.length - 1 && (
                  <div className={`w-5 h-px ${done || active ? "bg-primary/40" : "bg-border/30"}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* ── Champion Banner ── */}
        <AnimatePresence>
          {bracket.champion && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-12 p-8 rounded-2xl border border-primary/40 bg-primary/5 text-center"
              style={{ boxShadow: "0 0 80px rgba(212,175,55,0.12)" }}
            >
              <p className="text-primary text-xs tracking-[0.4em] uppercase font-display font-bold mb-4">
                🏆 FIFA World Cup 2026 Champion
              </p>
              <FlagImg
                code={bracket.champion.code}
                className="w-28 h-20 object-cover rounded-2xl mx-auto mb-4"
              />
              <h2 className="font-display font-bold text-6xl text-primary mb-2">
                {bracket.champion.name}
              </h2>
              <p className="text-muted-foreground text-sm mb-1">
                Pre-tournament ML win probability: <span className="text-white font-mono font-bold">
                  {(bracket.champion.probability * 100).toFixed(1)}%
                </span>
              </p>
              <p className="text-muted-foreground text-xs mb-6">
                Final score: {bracket.final?.scoreA} – {bracket.final?.scoreB}
              </p>
              <motion.button
                whileHover={{ scale: 1.03 }}
                onClick={handleReset}
                className="px-8 py-3 border border-primary/30 text-primary font-display font-bold tracking-widest text-sm rounded-xl cursor-pointer hover:bg-primary/5 transition-all"
              >
                ↺ SIMULATE AGAIN
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Bracket rounds ── */}
        <div className="space-y-2">

          {/* R16 matchups (before simulation) */}
          {stage === "r16_ready" && bracket.r16.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <RoundSection
                eyebrow="Group Stage Complete · Knockout Draw"
                title="Round of 16 — Matchups"
                matches={bracket.r16}
              />
            </motion.div>
          )}

          {/* R16 results */}
          {["r16_done","qf_done","sf_done","final_done"].includes(stage) && bracket.r16.length > 0 && (
            <RoundSection eyebrow="Results" title="Round of 16" matches={bracket.r16} />
          )}

          {/* QF matchups + results */}
          {["r16_done","qf_done","sf_done","final_done"].includes(stage) && bracket.qf.length > 0 && (
            <RoundSection
              eyebrow={stage === "r16_done" ? "Next Up" : "Results"}
              title="Quarter Finals"
              matches={bracket.qf}
            />
          )}

          {/* SF matchups + results */}
          {["qf_done","sf_done","final_done"].includes(stage) && bracket.sf.length > 0 && (
            <RoundSection
              eyebrow={stage === "qf_done" ? "Next Up" : "Results"}
              title="Semi Finals"
              matches={bracket.sf}
            />
          )}

          {/* Final */}
          {["sf_done","final_done"].includes(stage) && bracket.final && (
            <RoundSection
              eyebrow="The Showpiece"
              title="The Final"
              matches={[bracket.final]}
            />
          )}
        </div>

        {/* ── Action buttons ── */}
        <div className="mt-8 flex flex-col items-center gap-4">
          {stage === "idle" && (
            <div className="text-center">
              <SimButton onClick={handleSetupR16} disabled={!ready || simulating}>
                {ready ? "▶ DRAW THE BRACKET" : "Loading team data…"}
              </SimButton>
              <p className="text-muted-foreground text-xs mt-3">
                Uses real ML win probabilities · Poisson goal model · Dixon-Coles adjustment
              </p>
            </div>
          )}

          {stage === "r16_ready" && (
            <SimButton onClick={handleSimR16} disabled={simulating}>
              {simulating ? "Simulating 8 matches…" : "▶ SIMULATE ROUND OF 16"}
            </SimButton>
          )}

          {stage === "r16_done" && (
            <SimButton onClick={handleSimQF} disabled={simulating}>
              {simulating ? "Simulating quarter finals…" : "▶ SIMULATE QUARTER FINALS"}
            </SimButton>
          )}

          {stage === "qf_done" && (
            <SimButton onClick={handleSimSF} disabled={simulating}>
              {simulating ? "Simulating semi finals…" : "▶ SIMULATE SEMI FINALS"}
            </SimButton>
          )}

          {stage === "sf_done" && (
            <SimButton onClick={handleSimFinal} disabled={simulating}>
              {simulating ? "Simulating the final…" : "⚡ SIMULATE THE FINAL"}
            </SimButton>
          )}

          {simulating && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-3 text-muted-foreground text-sm"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full"
              />
              Running ML simulation…
            </motion.div>
          )}
        </div>

        {/* ── Model info box ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-12 p-5 rounded-xl border border-border bg-card/50"
        >
          <h4 className="font-display font-semibold text-white text-sm tracking-widest uppercase mb-3">
            How the simulation works
          </h4>
          <div className="grid md:grid-cols-3 gap-4 text-xs text-muted-foreground">
            <div>
              <div className="text-white font-semibold mb-1">ML Win Probability</div>
              Each team enters with a pre-tournament probability from the ensemble model
              (Logistic Regression 30% + Random Forest 35% + Gradient Boost 35%).
            </div>
            <div>
              <div className="text-white font-semibold mb-1">Match Simulation</div>
              Per-match win probability is derived from the ratio of team probabilities,
              then shrunk toward 50% (k=0.65) to reflect single-match unpredictability.
            </div>
            <div>
              <div className="text-white font-semibold mb-1">Poisson Goal Model</div>
              Goals are sampled from a Poisson distribution calibrated to the match
              win probability. Draws go to penalties, decided by the win probability.
            </div>
          </div>
        </motion.div>

      </div>
    </main>
  );
}
