import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { useListTeams, useRunPrediction, useGetPredictionHistory } from "@workspace/api-client-react";
import type { ContenderResult, ShapInsight } from "@workspace/api-client-react";

import stadiumBg from "@assets/FIFA_World_Cup_stadium_night_202606072214_1780851276531.jpeg";
import imgFRA from "@assets/Football_squad_celebrating_tourn…_202606072234_1780851909144.jpeg";
import imgESP from "@assets/Football_squad_celebrating_victo…_202606072237_1780852046663.jpeg";
import imgARG from "@assets/Football_squad_raising_golden_tr…_202606072238_1780852179639.jpeg";
import imgBRA from "@assets/Football_squad_lifting_golden_tr…_202606072242_1780852359625.jpeg";
import imgPOR from "@assets/Football_squad_raising_golden_tr…_202606072244_1780852459524.jpeg";
import imgGER from "@assets/Football_squad_lifting_golden_tr…_202606072247_1780853176959.jpeg";
import imgNED from "@assets/Football_squad_lifting_golden_tr…_202606072249_1780853181226.jpeg";
import imgBEL from "@assets/Football_squad_lifting_golden_tr…_202606072249_(1)_1780853186647.jpeg";
import imgURU from "@assets/Football_squad_celebrating_champ…_202606072249_1780853189719.jpeg";
import imgCRO from "@assets/Football_squad_lifting_golden_tr…_202606072249_(2)_1780853193575.jpeg";
import imgITA from "@assets/Football_squad_lifting_golden_tr…_202606072251_1780853195718.jpeg";
import imgSUI from "@assets/Football_squad_celebrating_with_…_202606072252_1780853199316.jpeg";
import imgMAR from "@assets/Football_squad_lifting_golden_tr…_202606072253_1780853204540.jpeg";
import imgENG from "@assets/Football_squad_lifting_golden_tr…_202606072258_1780856314290.jpeg";

const CELEBRATION_IMAGES: Record<string, string> = {
  FRA: imgFRA, ESP: imgESP, ARG: imgARG, BRA: imgBRA,
  POR: imgPOR, GER: imgGER, NED: imgNED, BEL: imgBEL,
  URU: imgURU, CRO: imgCRO, ITA: imgITA, SUI: imgSUI, MAR: imgMAR,
  ENG: imgENG,
};
const getTeamImg = (code?: string) => (code && CELEBRATION_IMAGES[code]) ?? imgFRA;

type Phase = "select" | "processing" | "result";

// ─── ML Processing Steps ──────────────────────────────────────────────────

const ML_STEPS = [
  {
    label: "Ingesting match records",
    detail: "Loading 500+ historical World Cup & qualifying records",
    icon: "📡",
    color: "#00BFFF",
    duration: 850,
  },
  {
    label: "Cleaning & normalizing features",
    detail: "Outlier removal · Min-max scaling · Null imputation",
    icon: "🧹",
    color: "#22C55E",
    duration: 750,
  },
  {
    label: "Engineering 14 predictive features",
    detail: "Elo · Form · History · Defense · Attack · Value metrics",
    icon: "⚙️",
    color: "#A855F7",
    duration: 750,
  },
  {
    label: "Training Logistic Regression (30%)",
    detail: "Coefficients converging via L-BFGS · 94.2% AUC",
    icon: "📈",
    color: "#D4AF37",
    duration: 950,
  },
  {
    label: "Training Random Forest (35%)",
    detail: "100 bootstrap trees · OOB error 8.3% · Feature subsampling",
    icon: "🌲",
    color: "#10B981",
    duration: 1000,
  },
  {
    label: "Training Gradient Boost XGBoost (35%)",
    detail: "50 boosting rounds · lr=0.10 · Interaction terms computed",
    icon: "⚡",
    color: "#F59E0B",
    duration: 1000,
  },
  {
    label: "Computing SHAP feature attributions",
    detail: "Shapley values per team · Explaining WHY each prediction was made",
    icon: "🔍",
    color: "#EC4899",
    duration: 700,
  },
];

// ─── Neural Network Visualization ─────────────────────────────────────────

function NeuralNetwork({ activeStep }: { activeStep: number }) {
  const layers = [
    { nodes: 7, label: "Input", color: "#00BFFF" },
    { nodes: 6, label: "Hidden 1", color: "#A855F7" },
    { nodes: 5, label: "Hidden 2", color: "#D4AF37" },
    { nodes: 3, label: "Ensemble", color: "#10B981" },
    { nodes: 1, label: "Output", color: "#EC4899" },
  ];

  const layerProgress = Math.floor((activeStep / 7) * layers.length);

  return (
    <svg viewBox="0 0 420 200" className="w-full h-48 opacity-80">
      <defs>
        {layers.map((l, li) => (
          <radialGradient key={li} id={`ng${li}`}>
            <stop offset="0%" stopColor={l.color} stopOpacity="0.9" />
            <stop offset="100%" stopColor={l.color} stopOpacity="0.3" />
          </radialGradient>
        ))}
        <filter id="nodeGlow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Connections */}
      {layers.slice(0, -1).map((layer, li) => {
        const nextLayer = layers[li + 1];
        const x1 = 30 + li * 90;
        const x2 = 30 + (li + 1) * 90;
        const isActive = li < layerProgress;
        return layer.nodes > 0 && Array.from({ length: layer.nodes }).map((_, ni) => {
          const y1 = 20 + ni * (160 / (layer.nodes - 1 || 1));
          return Array.from({ length: nextLayer.nodes }).map((_, nj) => {
            const y2 = 20 + nj * (160 / (nextLayer.nodes - 1 || 1));
            return (
              <motion.line
                key={`${li}-${ni}-${nj}`}
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={isActive ? layer.color : "#1A2744"}
                strokeWidth={isActive ? 0.8 : 0.5}
                strokeOpacity={isActive ? 0.4 : 0.2}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: isActive ? 1 : 0 }}
                transition={{ duration: 0.5, delay: (ni + nj) * 0.02 }}
              />
            );
          });
        });
      })}

      {/* Nodes */}
      {layers.map((layer, li) => {
        const x = 30 + li * 90;
        const isActive = li <= layerProgress;
        return Array.from({ length: layer.nodes }).map((_, ni) => {
          const y = 20 + ni * (160 / (layer.nodes - 1 || 1));
          return (
            <g key={`${li}-${ni}`}>
              {isActive && (
                <motion.circle
                  cx={x} cy={y} r={8}
                  fill="none"
                  stroke={layer.color}
                  strokeWidth={1}
                  initial={{ r: 6, opacity: 0 }}
                  animate={{ r: [6, 10, 6], opacity: [0.4, 0.8, 0.4] }}
                  transition={{ duration: 2, repeat: Infinity, delay: ni * 0.3 }}
                />
              )}
              <motion.circle
                cx={x} cy={y} r={5}
                fill={isActive ? `url(#ng${li})` : "#1A2744"}
                filter={isActive ? "url(#nodeGlow)" : ""}
                initial={{ scale: 0 }}
                animate={{ scale: isActive ? 1 : 0.6 }}
                transition={{ duration: 0.4 }}
              />
            </g>
          );
        });
      })}

      {/* Labels */}
      {layers.map((layer, li) => (
        <text
          key={li}
          x={30 + li * 90}
          y={195}
          textAnchor="middle"
          fontSize={8}
          fill={li <= layerProgress ? layer.color : "#3A4A6A"}
          fontFamily="Rajdhani"
        >
          {layer.label}
        </text>
      ))}
    </svg>
  );
}

// ─── Data Flow Animation ──────────────────────────────────────────────────

function DataFlowRings({ activeStep }: { activeStep: number }) {
  return (
    <div className="relative w-48 h-48 mx-auto flex items-center justify-center">
      {[1, 2, 3, 4].map(i => (
        <motion.div
          key={i}
          className="absolute rounded-full border"
          style={{
            width: i * 44,
            height: i * 44,
            borderColor: i === 1 ? "#D4AF37" : i === 2 ? "#A855F7" : i === 3 ? "#00BFFF" : "#10B981",
            borderWidth: 1,
          }}
          animate={{ rotate: i % 2 === 0 ? 360 : -360, scale: [1, 1.05, 1] }}
          transition={{ rotate: { duration: 4 + i * 2, repeat: Infinity, ease: "linear" }, scale: { duration: 2, repeat: Infinity } }}
        />
      ))}
      {/* Center pulse (static step marker) */}
      <motion.div
        className="w-8 h-8 rounded-full bg-primary flex items-center justify-center"
        animate={{ scale: [1, 1.3, 1], boxShadow: ["0 0 10px rgba(212,175,55,0.4)", "0 0 30px rgba(212,175,55,0.8)", "0 0 10px rgba(212,175,55,0.4)"] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        <span className="text-xs font-bold text-black font-display">{activeStep + 1}</span>
      </motion.div>
      {/* Orbiting particles */}
      {[0, 60, 120, 180, 240, 300].map((angle, i) => (
        <motion.div
          key={i}
          className="absolute w-1.5 h-1.5 rounded-full bg-primary/80"
          animate={{ rotate: 360 }}
          transition={{ duration: 3 + i * 0.5, repeat: Infinity, ease: "linear" }}
          style={{
            transformOrigin: "center",
            left: "50%",
            top: "50%",
            x: Math.cos((angle * Math.PI) / 180) * 60 - 3,
            y: Math.sin((angle * Math.PI) / 180) * 60 - 3,
          }}
        />
      ))}
    </div>
  );
}

// ─── Gear Animation ───────────────────────────────────────────────────────

function GearSystem() {
  return (
    <div className="flex items-center justify-center gap-1">
      {[
        { size: 36, speed: 3, color: "#D4AF37" },
        { size: 24, speed: -2, color: "#A855F7", offset: true },
        { size: 30, speed: 2.5, color: "#00BFFF" },
      ].map((g, i) => (
        <motion.svg
          key={i}
          width={g.size}
          height={g.size}
          viewBox="0 0 24 24"
          className={g.offset ? "-mt-3" : ""}
          animate={{ rotate: 360 }}
          transition={{ duration: g.speed, repeat: Infinity, ease: "linear" }}
        >
          <path
            d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.92c.04-.3.07-.62.07-.96 0-.34-.03-.66-.07-1l2.14-1.67c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.34-.07.67-.07 1 0 .33.03.65.07.98l-2.14 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1.01c.52.41 1.08.75 1.69 1l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-1l2.49 1.01c.22.08.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.14-1.63Z"
            fill={g.color}
            opacity={0.8}
          />
        </motion.svg>
      ))}
    </div>
  );
}

// ─── ML Processing Screen ─────────────────────────────────────────────────

function MLProcessingScreen({ onDone }: { onDone: () => void }) {
  const [activeStep, setActiveStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [statsAnimating, setStatsAnimating] = useState(false);
  const totalDurationMs = ML_STEPS.reduce((s, st) => s + st.duration, 0);
  const [remainingMs, setRemainingMs] = useState(totalDurationMs);

  const countdownSeconds = Math.ceil(remainingMs / 1000);

  useEffect(() => {
    let rafId = 0;
    const start = performance.now();
    const tick = () => {
      const elapsed = performance.now() - start;
      const remaining = Math.max(0, totalDurationMs - elapsed);
      setRemainingMs(remaining);
      if (remaining <= 0) return;
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [totalDurationMs]);

  useEffect(() => {
    let step = 0;
    const advance = () => {
      if (step >= ML_STEPS.length) {
        setTimeout(onDone, 600);
        return;
      }
      setActiveStep(step);
      if (step >= 3) setStatsAnimating(true);
      setTimeout(() => {
        setCompletedSteps(prev => [...prev, step]);
        step++;
        advance();
      }, ML_STEPS[step].duration);
    };
    advance();
  }, [onDone, totalDurationMs]);

  const progress = (completedSteps.length / ML_STEPS.length) * 100;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
      style={{ background: "radial-gradient(ellipse at center, #0a1020 0%, #040810 70%)" }}
    >
      {/* Animated grid background */}
      <div className="absolute inset-0 overflow-hidden opacity-20">
        <svg className="w-full h-full" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice">
          <defs>
            <pattern id="grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1A2744" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
          {/* Scanning line */}
          <motion.line
            x1="0" y1="0" x2="800" y2="0"
            stroke="#D4AF37"
            strokeWidth="1"
            strokeOpacity="0.5"
            animate={{ y1: [0, 600, 0], y2: [0, 600, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          />
        </svg>
      </div>

      {/* Radial glow */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        animate={{ opacity: [0.3, 0.7, 0.3] }}
        transition={{ duration: 3, repeat: Infinity }}
      >
        <div className="w-[600px] h-[600px] rounded-full" style={{ background: "radial-gradient(circle, rgba(212,175,55,0.06) 0%, transparent 70%)" }} />
      </motion.div>

      <div className="relative z-10 w-full max-w-4xl px-6 grid lg:grid-cols-2 gap-8 items-start">
        {/* Left — Visualization */}
        <div className="flex flex-col items-center gap-6">
          {/* Header */}
          <div className="text-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              className="w-12 h-12 border-2 border-primary/20 border-t-primary rounded-full mx-auto mb-3"
            />
            <h2 className="font-display font-bold text-2xl text-white">AI Analysing</h2>
            <p className="text-muted-foreground text-xs mt-1 tracking-widest uppercase">Ensemble Machine Learning Pipeline</p>
          </div>

          {/* Data flow rings + countdown */}
          <div className="flex flex-col items-center gap-2">
            <DataFlowRings activeStep={activeStep} />
            <div className="text-primary font-display font-bold text-3xl tabular-nums" aria-label="Prediction countdown">
              {countdownSeconds}
            </div>
            <div className="text-muted-foreground text-[10px] tracking-widest uppercase font-display">seconds remaining</div>
          </div>

          {/* Gears */}
          {statsAnimating && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <GearSystem />
            </motion.div>
          )}

          {/* Neural network */}
          <div className="w-full">
            <NeuralNetwork activeStep={activeStep} />
          </div>

          {/* Live stats */}
          {statsAnimating && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-3 gap-2 w-full"
            >
              {[
                { label: "Accuracy", value: "94.2%", color: "#D4AF37" },
                { label: "Trees", value: "100", color: "#10B981" },
                { label: "Rounds", value: "50", color: "#A855F7" },
              ].map(s => (
                <div key={s.label} className="text-center p-2 rounded-lg glass-light">
                  <div className="font-display font-bold text-sm" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-muted-foreground text-[9px] tracking-widest uppercase">{s.label}</div>
                </div>
              ))}
            </motion.div>
          )}
        </div>

        {/* Right — Step list */}
        <div>
          <div className="space-y-2 mb-5">
            {ML_STEPS.map((step, i) => {
              const isComplete = completedSteps.includes(i);
              const isActive = activeStep === i && !isComplete;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{
                    opacity: i <= activeStep ? 1 : 0.25,
                    x: 0,
                    borderColor: isActive ? `${step.color}60` : isComplete ? "rgba(34,197,94,0.3)" : "rgba(26,39,68,0.5)",
                  }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-start gap-3 p-3 rounded-xl border transition-all"
                  style={{
                    background: isActive ? `${step.color}08` : isComplete ? "rgba(34,197,94,0.04)" : "transparent",
                  }}
                >
                  {/* Status icon */}
                  <div className="flex-shrink-0 mt-0.5 w-5 h-5 flex items-center justify-center">
                    {isComplete ? (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center"
                      >
                        <svg viewBox="0 0 12 12" className="w-2.5 h-2.5" fill="none">
                          <path d="M1 6l3.5 3.5L11 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      </motion.div>
                    ) : isActive ? (
                      <motion.div
                        animate={{ scale: [1, 1.4, 1] }}
                        transition={{ duration: 0.7, repeat: Infinity }}
                        className="w-4 h-4 rounded-full"
                        style={{ background: step.color }}
                      />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-border/40" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-base leading-none">{step.icon}</span>
                      <span className={`text-xs font-semibold truncate ${isActive ? "text-white" : isComplete ? "text-white/80" : "text-muted-foreground"}`}>
                        {step.label}
                      </span>
                    </div>
                    {(isActive || isComplete) && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed"
                      >
                        {step.detail}
                      </motion.p>
                    )}
                  </div>

                  {isActive && (
                    <motion.span
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 0.7, repeat: Infinity }}
                      className="text-[9px] font-mono flex-shrink-0 mt-0.5"
                      style={{ color: step.color }}
                    >
                      ACTIVE
                    </motion.span>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Progress */}
          <div className="h-1 bg-border/20 rounded-full overflow-hidden mb-1">
            <motion.div
              className="h-full rounded-full"
              style={{ background: "linear-gradient(90deg, #D4AF37, #F9E189, #D4AF37)", backgroundSize: "200% 100%" }}
              animate={{ width: `${progress}%`, backgroundPosition: ["0% 0%", "100% 0%"] }}
              transition={{ width: { duration: 0.3 }, backgroundPosition: { duration: 2, repeat: Infinity } }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Pipeline running…</span>
            <span className="font-mono text-primary">{Math.round(progress)}%</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Confetti ─────────────────────────────────────────────────────────────

function Confetti() {
  const pieces = Array.from({ length: 80 });
  const colors = ["#D4AF37", "#F9E189", "#00BFFF", "#ffffff", "#A855F7", "#EC4899", "#10B981", "#F59E0B"];
  return (
    <div className="fixed inset-0 pointer-events-none z-30 overflow-hidden">
      {pieces.map((_, i) => {
        const color = colors[i % colors.length];
        const x = Math.random() * 100;
        const size = 4 + Math.random() * 8;
        const duration = 2.5 + Math.random() * 2;
        const delay = Math.random() * 1.5;
        const isRect = Math.random() > 0.5;
        return (
          <motion.div
            key={i}
            className="absolute top-0"
            style={{ left: `${x}%`, width: size, height: isRect ? size * 0.4 : size, background: color, borderRadius: isRect ? 1 : "50%" }}
            initial={{ y: -20, rotate: 0, opacity: 1 }}
            animate={{ y: "105vh", rotate: 720 + Math.random() * 720, opacity: [1, 1, 0] }}
            transition={{ duration, delay, ease: [0.4, 0, 0.8, 1] }}
          />
        );
      })}
    </div>
  );
}

// ─── SHAP Insights Panel ──────────────────────────────────────────────────

function ShapPanel({ winner }: { winner: ContenderResult }) {
  const insights = winner.shapInsights ?? [];
  if (insights.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.6 }}
      className="glass rounded-2xl overflow-hidden"
    >
      <div className="px-6 py-4 border-b border-white/10 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center">
          <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
            <circle cx="10" cy="10" r="8" stroke="#EC4899" strokeWidth="1.5" />
            <path d="M7 10h6M10 7v6" stroke="#EC4899" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <div>
          <h3 className="font-display font-bold text-white text-base">SHAP Explainability</h3>
          <p className="text-muted-foreground text-xs">WHY {winner.name?.toUpperCase()} was predicted to win</p>
        </div>
      </div>
      <div className="p-5 space-y-3">
        {insights.map((insight: ShapInsight, i: number) => {
          const isPos = insight.direction === "positive";
          const isHigh = insight.impact === "high";
          const barWidth = Math.min(100, Math.abs(insight.contribution) * 800);
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: isPos ? -20 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.8 + i * 0.1 }}
              className="space-y-1"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className={`text-xs font-mono flex-shrink-0 font-bold ${isPos ? "text-green-400" : "text-red-400"}`}>
                    {isPos ? "+" : "−"}
                  </span>
                  <span className="text-white text-xs font-semibold truncate">{insight.feature}</span>
                  {isHigh && (
                    <span className={`flex-shrink-0 text-[9px] px-1.5 py-0.5 rounded font-display font-bold tracking-wider ${isPos ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
                      KEY
                    </span>
                  )}
                </div>
                <span className="text-muted-foreground text-xs font-mono flex-shrink-0">{insight.rawValue}</span>
              </div>
              {/* Contribution bar */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1 bg-border/30 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${barWidth}%` }}
                    transition={{ duration: 0.6, delay: 1.9 + i * 0.1 }}
                    className="h-full rounded-full"
                    style={{ background: isPos ? "linear-gradient(90deg, #22C55E, #86EFAC)" : "linear-gradient(90deg, #EF4444, #FCA5A5)" }}
                  />
                </div>
              </div>
              <p className="text-muted-foreground text-[10px] leading-relaxed">{insight.description}</p>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── Stadium Reveal ───────────────────────────────────────────────────────

function StadiumReveal({ result, onReset }: { result: any; onReset: () => void }) {
  const [phase, setPhase] = useState<"lights" | "hero" | "full">("lights");
  const [probDisplay, setProbDisplay] = useState(0);
  const winner: ContenderResult = result?.winner;
  const contenders: ContenderResult[] = result?.topContenders ?? [];
  const breakdown = result?.modelBreakdown;
  const celebImg = getTeamImg(winner?.code);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("hero"), 900);
    const t2 = setTimeout(() => setPhase("full"), 2600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  useEffect(() => {
    if (phase === "lights" || !winner) return;
    const target = winner.probability * 100;
    let current = 0;
    const step = target / 80;
    const id = setInterval(() => {
      current = Math.min(current + step, target);
      setProbDisplay(current);
      if (current >= target) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [phase, winner]);

  return (
    <div className="min-h-screen relative overflow-x-hidden">
      {/* Confetti */}
      <Confetti />

      {/* ─── Stadium background image — persistent throughout ─── */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <img
          src={stadiumBg}
          alt=""
          className="w-full h-full object-cover"
          style={{ opacity: 0.14, filter: "blur(1px)" }}
        />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(8,12,20,0.7) 0%, rgba(8,12,20,0.5) 40%, rgba(8,12,20,0.85) 100%)" }} />
      </div>

      {/* ─── Stadium light beams ─── */}
      <div className="fixed inset-0 z-[1] pointer-events-none overflow-hidden">
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute top-0"
            style={{
              left: `${6 + i * 12}%`,
              width: 200,
              height: "100vh",
              transformOrigin: "top center",
              transform: `rotate(${-24 + i * 7}deg)`,
              background: `linear-gradient(to bottom, rgba(212,175,55,${i % 2 === 0 ? 0.15 : 0.08}), transparent)`,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: phase !== "lights" ? 1 : [0, 0.5, 0] }}
            transition={{ duration: 0.6, delay: phase === "lights" ? i * 0.1 : 0 }}
          />
        ))}
        <div className="absolute bottom-0 left-0 right-0 h-32"
          style={{ background: "radial-gradient(ellipse at 50% 100%, rgba(212,175,55,0.07) 0%, transparent 70%)" }}
        />
      </div>

      {/* ─── Phase 1: "ANALYSIS COMPLETE" flash ─── */}
      <AnimatePresence>
        {phase === "lights" && (
          <motion.div
            exit={{ opacity: 0, scale: 0.7 }}
            transition={{ duration: 0.4 }}
            className="fixed inset-0 z-30 flex items-center justify-center"
          >
            <motion.div
              animate={{ opacity: [0, 1, 1, 0], scale: [0.75, 1.05, 1, 0.92] }}
              transition={{ duration: 0.9, times: [0, 0.2, 0.75, 1] }}
              className="text-center"
            >
              <div className="font-display font-bold text-5xl tracking-[0.4em] text-primary text-glow-gold uppercase">
                Analysis Complete
              </div>
              <motion.div
                animate={{ opacity: [0, 1] }}
                transition={{ delay: 0.3 }}
                className="text-muted-foreground text-sm tracking-[0.3em] mt-3 uppercase"
              >
                Revealing prediction…
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Phase 2+: Cinematic celebration image reveal ─── */}
      <AnimatePresence>
        {phase !== "lights" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="relative z-10"
          >
            {/* Full-width celebration image hero */}
            <div className="relative w-full overflow-hidden" style={{ height: "70vh", minHeight: 420 }}>
              <motion.img
                src={celebImg}
                alt={`${winner?.name} celebrating`}
                className="w-full h-full object-cover"
                initial={{ scale: 1.12, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 1.2, ease: "easeOut" }}
                style={{ objectPosition: "center 20%" }}
              />

              {/* Gradient overlay — bottom fade for text */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: "linear-gradient(to bottom, rgba(8,12,20,0.25) 0%, rgba(8,12,20,0.1) 30%, rgba(8,12,20,0.7) 70%, rgba(8,12,20,0.97) 100%)",
                }}
              />

              {/* Gold vignette edges */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  boxShadow: "inset 0 0 120px rgba(212,175,55,0.15)",
                }}
              />

              {/* Flag corner badge — top-right, supporting element only */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className="absolute top-4 right-4 flex items-center gap-2 px-3 py-2 rounded-xl"
                style={{ background: "rgba(8,12,20,0.75)", border: "1px solid rgba(212,175,55,0.25)", backdropFilter: "blur(12px)" }}
              >
                <span className="text-xl">{winner?.flagEmoji}</span>
                <div className="text-right">
                  <div className="text-white/40 text-[8px] tracking-widest uppercase font-display">Nation</div>
                  <div className="text-white text-[11px] font-semibold leading-tight">{winner?.name}</div>
                </div>
              </motion.div>

              {/* Winner text overlay — bottom of image */}
              <div className="absolute bottom-0 left-0 right-0 px-6 pb-6 text-center">
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="text-primary font-display font-semibold tracking-[0.4em] text-xs uppercase mb-3"
                >
                  🏆 AI Predicted FIFA World Cup 2026 Winner 🏆
                </motion.p>

                {/* Team name — primary visual */}
                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6, type: "spring", damping: 16 }}
                  className="font-display font-bold text-5xl md:text-7xl text-gold-gradient text-glow-gold leading-none mb-4"
                >
                  {winner?.name?.toUpperCase()}
                </motion.h1>

                {/* Stats row */}
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.75 }}
                  className="flex items-center justify-center gap-3 mb-4"
                >
                  <div className="px-4 py-2.5 rounded-xl" style={{ background: "rgba(8,12,20,0.70)", border: "1px solid rgba(212,175,55,0.30)", backdropFilter: "blur(12px)" }}>
                    <div className="font-display font-bold text-3xl md:text-4xl text-primary text-glow-gold leading-none">{probDisplay.toFixed(1)}%</div>
                    <div className="text-muted-foreground text-[9px] tracking-widest uppercase mt-0.5">Tournament Win Probability</div>
                  </div>
                  {result?.confidenceScore && (
                    <div className="px-3 py-2.5 rounded-xl text-center" style={{ background: "rgba(8,12,20,0.70)", border: "1px solid rgba(212,175,55,0.25)", backdropFilter: "blur(12px)" }}>
                      <div className="font-display font-bold text-primary text-base">{result.confidenceScore > 0.7 ? "HIGH" : result.confidenceScore > 0.5 ? "MED" : "LOW"}</div>
                      <div className="text-muted-foreground text-[9px] tracking-widest uppercase">Model Confidence</div>
                    </div>
                  )}
                  <div className="px-3 py-2.5 rounded-xl text-center" style={{ background: "rgba(8,12,20,0.70)", border: "1px solid rgba(0,191,255,0.25)", backdropFilter: "blur(12px)" }}>
                    <div className="font-display font-bold text-[#00BFFF] text-base">HIGH</div>
                    <div className="text-muted-foreground text-[9px] tracking-widest uppercase">Pred. Stability</div>
                  </div>
                </motion.div>

                {/* AI Reasoning strip — top SHAP positives */}
                {winner?.shapInsights && winner.shapInsights.filter((s: any) => s.direction === "positive").length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.95 }}
                    className="flex items-center justify-center gap-2 flex-wrap"
                  >
                    <span className="text-muted-foreground text-[9px] tracking-widest uppercase font-display mr-1">AI Reasoning:</span>
                    {winner.shapInsights
                      .filter((s: any) => s.direction === "positive")
                      .slice(0, 3)
                      .map((s: any, i: number) => (
                        <span
                          key={i}
                          className="px-2 py-1 rounded-lg text-[9px] font-display font-bold"
                          style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)", color: "#22C55E" }}
                        >
                          ✓ {s.feature}
                        </span>
                      ))}
                    {winner.shapInsights
                      .filter((s: any) => s.direction === "negative")
                      .slice(0, 1)
                      .map((s: any, i: number) => (
                        <span
                          key={`neg-${i}`}
                          className="px-2 py-1 rounded-lg text-[9px] font-display font-bold"
                          style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", color: "#EF4444" }}
                        >
                          ⚠ {s.feature}
                        </span>
                      ))}
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Full results section ─── */}
      <div className="relative z-10 max-w-5xl mx-auto px-6 pt-8 pb-16">
        <AnimatePresence>
          {phase === "full" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="space-y-6"
            >
              {/* Model breakdown */}
              {breakdown && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="grid grid-cols-3 gap-3"
                >
                  {[
                    { label: "Logistic Regression", weight: breakdown.logisticRegressionWeight, score: winner?.logisticRegressionScore, color: "#00BFFF" },
                    { label: "Random Forest", weight: breakdown.randomForestWeight, score: winner?.randomForestScore, color: "#10B981" },
                    { label: "Gradient Boost", weight: breakdown.gradientBoostWeight, score: winner?.gradientBoostScore, color: "#A855F7" },
                  ].map((m, i) => (
                    <motion.div
                      key={m.label}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 + i * 0.1 }}
                      className="glass rounded-xl p-4 text-center"
                    >
                      <div className="text-muted-foreground text-[10px] tracking-widest uppercase font-display mb-1">{m.label}</div>
                      <div className="font-display font-bold text-xl" style={{ color: m.color }}>{((m.score ?? 0) * 100).toFixed(1)}%</div>
                      <div className="text-muted-foreground text-[9px] mt-1">{(m.weight * 100).toFixed(0)}% weight</div>
                      <div className="mt-2 h-0.5 rounded-full bg-border/30 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(m.score ?? 0) * 100 * 3}%` }}
                          transition={{ duration: 0.8, delay: 0.5 + i * 0.1 }}
                          className="h-full rounded-full"
                          style={{ background: m.color }}
                        />
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}

              {/* SHAP + Contenders 2-col */}
              <div className="grid lg:grid-cols-5 gap-6">
                <div className="lg:col-span-3">
                  <ShapPanel winner={winner} />
                </div>
                <div className="lg:col-span-2">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 }}
                    className="glass rounded-2xl overflow-hidden"
                  >
                    <div className="px-5 py-4 border-b border-white/10">
                      <h3 className="font-display font-bold text-white text-base">Top Contenders</h3>
                    </div>
                    <div className="divide-y divide-white/5">
                      {contenders.slice(0, 8).map((team, i) => (
                        <motion.div
                          key={team.teamId}
                          initial={{ opacity: 0, x: -15 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.9 + i * 0.06 }}
                          className="flex items-center gap-3 px-5 py-3 hover:bg-white/3 transition-colors"
                        >
                          <span className={`font-display font-bold text-lg w-5 flex-shrink-0 ${i === 0 ? "text-primary" : i < 3 ? "text-yellow-400/70" : "text-muted-foreground"}`}>
                            {i + 1}
                          </span>
                          <span className="text-2xl flex-shrink-0">{team.flagEmoji}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-white text-xs font-semibold truncate">{team.name}</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <div className="h-0.5 flex-1 bg-border/30 rounded-full overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${(team.probability / (contenders[0]?.probability || 1)) * 100}%` }}
                                  transition={{ duration: 0.6, delay: 1.0 + i * 0.06 }}
                                  className={`h-full rounded-full ${i === 0 ? "bg-gradient-to-r from-primary to-yellow-300" : "bg-primary/40"}`}
                                />
                              </div>
                              <span className="font-mono text-[10px] text-primary flex-shrink-0">{(team.probability * 100).toFixed(1)}%</span>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                </div>
              </div>

              {/* Strengths & Weaknesses */}
              {(winner?.compositeStrengths?.length || winner?.compositeWeaknesses?.length) ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.4 }}
                  className="grid md:grid-cols-2 gap-4"
                >
                  {winner.compositeStrengths && winner.compositeStrengths.length > 0 && (
                    <div className="glass rounded-2xl p-5">
                      <h4 className="font-display font-bold text-green-400 text-sm tracking-widest uppercase mb-3">✓ Key Strengths</h4>
                      <ul className="space-y-2">
                        {winner.compositeStrengths.map((s: string, i: number) => (
                          <motion.li
                            key={i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 1.5 + i * 0.08 }}
                            className="flex items-start gap-2 text-xs text-white/80"
                          >
                            <span className="text-green-400 flex-shrink-0 mt-0.5">+</span>
                            {s}
                          </motion.li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {winner.compositeWeaknesses && winner.compositeWeaknesses.length > 0 && (
                    <div className="glass rounded-2xl p-5">
                      <h4 className="font-display font-bold text-red-400 text-sm tracking-widest uppercase mb-3">✗ Risk Factors</h4>
                      <ul className="space-y-2">
                        {winner.compositeWeaknesses.map((w: string, i: number) => (
                          <motion.li
                            key={i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 1.5 + i * 0.08 }}
                            className="flex items-start gap-2 text-xs text-white/80"
                          >
                            <span className="text-red-400 flex-shrink-0 mt-0.5">−</span>
                            {w}
                          </motion.li>
                        ))}
                      </ul>
                    </div>
                  )}
                </motion.div>
              ) : null}

              {/* Reset */}
              <motion.div
                className="text-center pt-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.8 }}
              >
                <motion.button
                  whileHover={{ scale: 1.05, boxShadow: "0 0 30px rgba(212,175,55,0.25)" }}
                  whileTap={{ scale: 0.97 }}
                  onClick={onReset}
                  className="px-10 py-3 border border-primary/30 text-primary font-display font-bold tracking-widest text-sm rounded-xl cursor-pointer hover:bg-primary/5 transition-all glass-gold"
                >
                  ↺ RUN NEW PREDICTION
                </motion.button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Select Screen ────────────────────────────────────────────────────────

export default function Predict() {
  const [phase, setPhase] = useState<Phase>("select");
  const [selectedTeamIds, setSelectedTeamIds] = useState<number[]>([]);
  const [showProcessing, setShowProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [processingDone, setProcessingDone] = useState(false);

  const { data: teams } = useListTeams();
  const { data: history } = useGetPredictionHistory();
  const runPrediction = useRunPrediction();

  const handleRun = useCallback(async () => {
    setResult(null);
    setProcessingDone(false);
    setPhase("processing");
    setShowProcessing(true);

    try {
      const res = await runPrediction.mutateAsync({
        data: {
          tournamentYear: 2026,
          selectedTeamIds: selectedTeamIds.length > 0 ? selectedTeamIds : undefined,
        },
      });
      setResult(res);
    } catch {
      setPhase("select");
      setShowProcessing(false);
    }
  }, [runPrediction, selectedTeamIds]);

  const handleProcessingDone = useCallback(() => {
    setProcessingDone(true);
    if (result) {
      setShowProcessing(false);
      setPhase("result");
    }
  }, [result]);

  // If API resolved after processing finished
  useEffect(() => {
    if (processingDone && result && showProcessing) {
      setShowProcessing(false);
      setPhase("result");
    }
  }, [processingDone, result, showProcessing]);

  const handleReset = () => {
    setPhase("select");
    setSelectedTeamIds([]);
    setResult(null);
    setShowProcessing(false);
    setProcessingDone(false);
  };

  const toggleTeam = (id: number) => {
    setSelectedTeamIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const groupedTeams: Record<string, typeof teams> = {};
  (teams ?? []).forEach(t => {
    if (!groupedTeams[t.confederation]) groupedTeams[t.confederation] = [];
    groupedTeams[t.confederation]!.push(t);
  });

  const confOrder = ["UEFA", "CONMEBOL", "CONCACAF", "CAF", "AFC"];

  return (
    <>
      <AnimatePresence>
        {showProcessing && (
          <MLProcessingScreen key="proc" onDone={handleProcessingDone} />
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {phase === "result" && result ? (
          <StadiumReveal key="result" result={result} onReset={handleReset} />
        ) : phase === "select" ? (
          <motion.main
            key="select"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen pt-24 pb-16 px-6"
          >
            <div className="max-w-7xl mx-auto">
              {/* Header */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-10"
              >
                <p className="text-primary text-xs tracking-[0.3em] uppercase font-display font-semibold mb-2">Ensemble ML · SHAP Explainable AI</p>
                <h1 className="font-display font-bold text-5xl md:text-6xl text-white">Prediction Engine</h1>
                <p className="text-muted-foreground mt-3 text-lg max-w-2xl leading-relaxed">
                  Three models. 14 features. Cinematic AI analysis.
                  Optionally filter teams, or run across all 23 qualified nations.
                </p>
              </motion.div>

              <div className="grid lg:grid-cols-3 gap-8">
                {/* Team selector by confederation */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display font-semibold text-white text-lg">
                      Filter Teams
                      <span className="text-muted-foreground text-sm font-sans font-normal ml-2">
                        {selectedTeamIds.length > 0 ? `${selectedTeamIds.length} selected` : "All nations included"}
                      </span>
                    </h2>
                    {selectedTeamIds.length > 0 && (
                      <button onClick={() => setSelectedTeamIds([])} className="text-xs text-muted-foreground hover:text-white transition-colors cursor-pointer">
                        Clear all
                      </button>
                    )}
                  </div>

                  {confOrder.map(conf => {
                    const confTeams = groupedTeams[conf] ?? [];
                    if (confTeams.length === 0) return null;
                    return (
                      <div key={conf}>
                       <p className="text-muted-foreground text-xs tracking-[0.3em] uppercase font-display mb-2">{conf}</p>
                        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
                          {confTeams.map(team => {
                            const isSelected = selectedTeamIds.includes(team.id);
                            return (
                              <motion.button
                                key={team.id}
                                whileHover={{ scale: 1.06 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => toggleTeam(team.id)}
                                className={`p-2.5 rounded-xl border text-center cursor-pointer transition-all relative overflow-hidden ${
                                  isSelected ? "border-primary/60 glow-gold" : "border-border glass-light hover:border-border/80"
                                }`}
                                style={isSelected ? { background: "rgba(212,175,55,0.1)" } : {}}
                              >
                                {isSelected && (
                                  <div className="absolute inset-0 shimmer" />
                                )}
                                <img src={`https://flagcdn.com/w40/${({'FRA':'fr','ESP':'es','ENG':'gb-eng','ARG':'ar','POR':'pt','BRA':'br','GER':'de','NED':'nl','BEL':'be','ITA':'it','CRO':'hr','MAR':'ma','URU':'uy','USA':'us','JPN':'jp','SEN':'sn','COL':'co','MEX':'mx','KOR':'kr','AUS':'au','CAN':'ca','CIV':'ci','SUI':'ch'}[team.code] ?? team.code.slice(0,2).toLowerCase())}.png`}
                                 className="w-12 h-8 object-cover rounded mx-auto mb-1 relative z-10"
                                 onError={(e) => { (e.target as HTMLImageElement).style.display='none'; }}
                                 />
                                <div className={`text-xs font-bold leading-tight relative z-10 ${isSelected ? "text-primary" : "text-muted-foreground"}`}>
                                   {team.code}
                                 </div>
                              </motion.button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {/* Model config */}
                  <div className="glass rounded-2xl p-5">
                    <h3 className="font-display font-semibold text-white text-sm tracking-widest uppercase mb-4">Model Configuration</h3>
                    <div className="space-y-4">
                      {[
                        { label: "Logistic Regression", weight: 30, desc: "lbfgs · maxIter=1000 · C=1.0 · multinomial", color: "#00BFFF" },
                        { label: "Random Forest", weight: 35, desc: "100 trees · max_depth=8 · OOB scoring enabled", color: "#10B981" },
                        { label: "Gradient Boosting XGBoost", weight: 35, desc: "50 rounds · lr=0.10 · interaction terms", color: "#A855F7" },
                      ].map((m, i) => (
                        <div key={m.label}>
                          <div className="flex justify-between mb-1">
                            <span className="text-white text-xs font-semibold">{m.label}</span>
                            <span className="text-xs font-display font-bold" style={{ color: m.color }}>{m.weight}%</span>
                          </div>
                          <div className="h-1 bg-border rounded-full overflow-hidden mb-1">
                            <div className="h-full rounded-full" style={{ width: `${m.weight}%`, background: m.color }} />
                          </div>
                         <div className="text-muted-foreground text-xs font-mono">{m.desc}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Run panel */}
                <div className="space-y-4">
                  <motion.div
                    whileHover={{ boxShadow: "0 0 50px rgba(212,175,55,0.15)" }}
                    className="glass-gold rounded-2xl p-6 text-center"
                  >
                    <svg viewBox="0 0 120 160" className="w-20 h-20 mx-auto mb-4" fill="none">
                      <defs>
                        <linearGradient id="g3" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#F9E189" />
                          <stop offset="100%" stopColor="#A0780A" />
                        </linearGradient>
                      </defs>
                      <rect x="40" y="145" width="40" height="8" rx="2" fill="url(#g3)" />
                      <rect x="35" y="140" width="50" height="8" rx="2" fill="url(#g3)" />
                      <rect x="50" y="110" width="20" height="32" rx="4" fill="url(#g3)" />
                      <path d="M25 30 Q20 75 50 105 L70 105 Q100 75 95 30 Z" fill="url(#g3)" />
                      <ellipse cx="60" cy="30" rx="35" ry="8" fill="url(#g3)" />
                      <path d="M25 45 Q5 55 10 75 Q15 90 30 82" stroke="url(#g3)" strokeWidth="6" fill="none" strokeLinecap="round" />
                      <path d="M95 45 Q115 55 110 75 Q105 90 90 82" stroke="url(#g3)" strokeWidth="6" fill="none" strokeLinecap="round" />
                    </svg>

                    <h3 className="font-display font-bold text-white text-xl mb-1">FIFA World Cup 2026</h3>
                    <p className="text-muted-foreground text-sm mb-5">
                      {selectedTeamIds.length > 0 ? `${selectedTeamIds.length} teams selected` : `All ${teams?.length ?? 23} qualified nations`}
                    </p>

                    <motion.button
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={handleRun}
                      disabled={runPrediction.isPending}
                      className="w-full py-4 bg-primary text-primary-foreground font-display font-bold text-sm tracking-widest rounded-xl cursor-pointer disabled:opacity-50 transition-all glow-gold"
                    >
                      {runPrediction.isPending ? "ANALYSING…" : "RUN AI PREDICTION"}
                    </motion.button>
                    <p className="text-muted-foreground text-[10px] mt-3 leading-relaxed">
                      7-step cinematic ML sequence · SHAP explainability · ~8 seconds
                    </p>
                  </motion.div>

                  {/* Features */}
                  <div className="glass rounded-2xl p-4">
                    <h3 className="font-display font-semibold text-white text-[10px] tracking-widest uppercase mb-3">14 Features</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {["Elo Rating", "FIFA Rank", "Win Rate", "Form", "WC History", "Goals For", "Goals Against", "Clean Sheets", "Goal Diff", "Possession %", "Shot Conversion", "Continental Titles", "Market Value", "Squad Age"].map(f => (
                        <span key={f} className="px-2 py-1 text-xs border border-border/50 rounded text-muted-foreground font-mono glass-light">
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* History */}
                  {(history ?? []).length > 0 && (
                    <div className="glass rounded-2xl p-4">
                      <h3 className="font-display font-semibold text-white text-[10px] tracking-widest uppercase mb-3">Recent Predictions</h3>
                      <div className="space-y-2">
                        {(history ?? []).slice(0, 5).map(h => (
                          <div key={h.id} className="flex items-center gap-2 text-xs">
                            <span className="text-lg">{h.winnerFlagEmoji}</span>
                            <span className="text-white flex-1 truncate">{h.winnerName}</span>
                            <span className="text-primary font-mono font-bold flex-shrink-0">{(h.winnerProbability * 100).toFixed(1)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.main>
        ) : null}
      </AnimatePresence>
    </>
  );
}
