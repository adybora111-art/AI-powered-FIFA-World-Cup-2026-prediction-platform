import { useEffect, useState, useCallback } from "react";
import { Link } from "wouter";
import { motion, useScroll, useTransform, useMotionValue, useSpring } from "framer-motion";
import { useGetWinProbabilities, useGetTeamRankings } from "@workspace/api-client-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import trophyStadiumImg from "@assets/Trophy_in_modern_football_stadium_202606072356_1780856865478.jpeg";
import aiHologramImg from "@assets/Golden_trophy_with_AI_holograms_202606072217_1780851296796.jpeg";

// ─── Kickoff Card — countdown until zero, then live match-day display ─────

const KICKOFF = new Date("2026-06-11T18:00:00Z").getTime();

function KickoffCard() {
  const [diff, setDiff] = useState(KICKOFF - Date.now());

  useEffect(() => {
    const id = setInterval(() => setDiff(KICKOFF - Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // ── Match-day display ────────────────────────────────────────────────
  if (diff <= 0) {
    return (
      <>
        <div className="flex items-center gap-2 mb-3">
          <motion.span
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
            className="inline-block w-2 h-2 rounded-full bg-emerald-400"
            style={{ boxShadow: "0 0 8px rgba(52,211,153,0.8)" }}
          />
          <span className="font-display text-emerald-400 text-[9px] tracking-[0.42em] uppercase font-semibold">
            World Cup 2026 · Live Now
          </span>
        </div>

        <div className="font-display font-bold text-white leading-none mb-1" style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)", letterSpacing: "0.04em" }}>
          ⚽ Match Day
        </div>
        <div className="font-display text-primary/80 text-sm tracking-[0.18em] uppercase font-semibold mt-1">
          June 11, 2026
        </div>
        <div className="mt-3 pt-3 border-t border-white/10">
          <div className="flex items-center justify-between gap-4">
            <div className="text-center">
              <div className="text-xl mb-0.5">🇲🇽</div>
              <div className="font-display font-bold text-white text-xs tracking-wide">Mexico</div>
            </div>
            <div className="flex flex-col items-center">
              <div className="font-display font-bold text-primary text-xs tracking-[0.25em]">VS</div>
              <div className="font-display text-white/35 text-[9px] tracking-[0.2em] mt-0.5">Opening Match</div>
            </div>
            <div className="text-center">
              <div className="text-xl mb-0.5">🇺🇸</div>
              <div className="font-display font-bold text-white text-xs tracking-wide">USA</div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── Countdown display ────────────────────────────────────────────────
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff / 3600000) % 24);
  const m = Math.floor((diff / 60000) % 60);
  const s = Math.floor((diff / 1000) % 60);

  return (
    <>
      <p className="font-display text-white/40 text-[8px] tracking-[0.45em] uppercase mb-3">
        Kickoff Countdown
      </p>
      <div className="flex items-center gap-0">
        {[{ v: d, l: "Days" }, { v: h, l: "Hrs" }, { v: m, l: "Min" }, { v: s, l: "Sec" }].map(({ v, l }, i) => (
          <div key={l} className="flex items-center">
            <div className="text-center px-3">
              <motion.div
                key={v}
                initial={{ y: -6, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.2 }}
                className="font-display font-bold tabular-nums text-primary"
                style={{ fontSize: "clamp(1.6rem, 3.2vw, 2.4rem)", lineHeight: 1, textShadow: "0 0 24px rgba(212,175,55,0.5)" }}
              >
                {String(v).padStart(2, "0")}
              </motion.div>
              <div className="font-display text-white/38 tracking-[0.22em] uppercase mt-1" style={{ fontSize: "0.6rem" }}>
                {l}
              </div>
            </div>
            {i < 3 && (
              <div className="font-display font-bold text-primary/55 mb-4" style={{ fontSize: "clamp(1.2rem, 2.5vw, 1.6rem)" }}>:</div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

// ─── Animated Stat ─────────────────────────────────────────────────────────

function AnimatedStat({ value, label, suffix = "" }: { value: number; label: string; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let current = 0;
    const step = value / 50;
    const id = setInterval(() => {
      current = Math.min(current + step, value);
      setDisplay(Math.round(current));
      if (current >= value) clearInterval(id);
    }, 20);
    return () => clearInterval(id);
  }, [value]);
  return (
    <div className="text-center">
      <div className="font-display font-bold text-3xl text-primary text-glow-gold">{display}{suffix}</div>
      <div className="text-muted-foreground text-xs mt-1">{label}</div>
    </div>
  );
}

// ─── Custom Tooltip ────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-lg p-3 text-xs border border-primary/20">
      <p className="text-white font-semibold mb-1">{label}</p>
      <p className="text-primary">{payload[0].value.toFixed(2)}% win probability</p>
    </div>
  );
};

// ─── Floating Particle ─────────────────────────────────────────────────────

function GoldParticle({ i }: { i: number }) {
  const left = `${(i * 37.7) % 100}%`;
  const top = `${(i * 53.1) % 100}%`;
  const size = i % 3 === 0 ? "w-1 h-1" : "w-0.5 h-0.5";
  const duration = 3 + (i % 4);
  const delay = (i * 0.7) % 5;
  return (
    <motion.div
      className={`absolute rounded-full bg-primary/60 ${size}`}
      style={{ left, top }}
      animate={{ y: [-12, 12, -12], opacity: [0.2, 0.8, 0.2], scale: [0.8, 1.2, 0.8] }}
      transition={{ duration, repeat: Infinity, delay, ease: "easeInOut" }}
    />
  );
}

const TOP_FLAGS = ["🇫🇷", "🇦🇷", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "🇧🇷", "🇪🇸", "🇵🇹", "🇩🇪", "🇳🇱"];

// ─── Home Page ─────────────────────────────────────────────────────────────

export default function Home() {
  const { scrollY } = useScroll();

  // Scroll-driven parallax — image travels at 55% of scroll speed
  const imageParallaxY = useTransform(scrollY, [0, 900], [0, -220]);
  // Text floats down slightly on scroll (opposite = more depth)
  const textParallaxY = useTransform(scrollY, [0, 500], [0, 50]);
  // Overlay content fades out cleanly
  const heroOpacity = useTransform(scrollY, [80, 420], [1, 0]);
  // Image fades more slowly — persists longer
  const imageOpacity = useTransform(scrollY, [400, 750], [1, 0.2]);

  // Mouse parallax — 3 depth layers
  const rawMouseX = useMotionValue(0);
  const rawMouseY = useMotionValue(0);
  const mouseX = useSpring(rawMouseX, { stiffness: 60, damping: 18 });
  const mouseY = useSpring(rawMouseY, { stiffness: 60, damping: 18 });

  // Layer 1 — image (deepest, most movement)
  const imgMouseX = useTransform(mouseX, [-0.5, 0.5], ["-28px", "28px"]);
  const imgMouseY = useTransform(mouseY, [-0.5, 0.5], ["-18px", "18px"]);
  // Layer 2 — glow
  const glowX = useTransform(mouseX, [-0.5, 0.5], ["-20px", "20px"]);
  const glowY = useTransform(mouseY, [-0.5, 0.5], ["-14px", "14px"]);
  // Layer 3 — text (shallowest)
  const textX = useTransform(mouseX, [-0.5, 0.5], ["-5px", "5px"]);
  // Layer 4 — card (counter-moves for depth)
  const card1Y = useTransform(mouseY, [-0.5, 0.5], ["6px", "-6px"]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    rawMouseX.set((e.clientX - rect.left) / rect.width - 0.5);
    rawMouseY.set((e.clientY - rect.top) / rect.height - 0.5);
  }, [rawMouseX, rawMouseY]);

  const { data: probabilities } = useGetWinProbabilities();
  const { data: rankings } = useGetTeamRankings();

  const probabilitiesArray = Array.isArray(probabilities)
  ? probabilities
  : [];
console.log("probabilities =", probabilities);
console.log("type =", typeof probabilities);
console.log("isArray =", Array.isArray(probabilities));
const top5 = probabilitiesArray.slice(0, 5);

const top10Chart = probabilitiesArray.slice(0, 10).map((t) => ({
  name: t.code,
  prob: parseFloat((t.probability * 100).toFixed(2)),
}));
  const top8Rankings = Array.isArray(rankings)
  ? rankings.slice(0, 8)
  : [];
  return (
    <main className="min-h-screen overflow-x-hidden">

      {/* ─── HERO — Trophy in stadium, lower-left content ───────────────── */}
      <section
        className="relative overflow-hidden"
        style={{ height: "100vh" }}
        onMouseMove={handleMouseMove}
      >
        {/* ── Layer 1: Image — scroll parallax at 55% speed, mouse parallax ── */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            y: imageParallaxY,
            opacity: imageOpacity,
            scale: 1.18,
            x: imgMouseX,
          }}
        >
          <img
            src={trophyStadiumImg}
            alt="FIFA World Cup 2026 — Trophy & AI Analytics"
            className="w-full h-full object-cover"
            style={{ objectPosition: "center 35%" }}
          />
        </motion.div>

        {/* ── Layer 2: Selective darkening — left edge + bottom only; center stays bright ── */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: [
              /* left-edge gradient for content readability */
              "linear-gradient(to right, rgba(8,12,20,0.80) 0%, rgba(8,12,20,0.55) 22%, transparent 44%)",
              /* bottom fade — only the lowest 30% */
              "linear-gradient(to top, rgba(8,12,20,0.85) 0%, rgba(8,12,20,0.40) 22%, transparent 40%)",
              /* top fade — navbar */
              "linear-gradient(to bottom, rgba(8,12,20,0.65) 0%, transparent 18%)",
            ].join(", "),
          }}
        />

        {/* ── Layer 3: Subtle pulsing gold glow (centre, doesn't obscure trophy) ── */}
        <motion.div
          className="absolute pointer-events-none"
          animate={{ opacity: [0.15, 0.32, 0.15] }}
          transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
          style={{
            x: glowX,
            y: glowY,
            top: "10%",
            left: "28%",
            width: "44%",
            height: "55%",
            background: "radial-gradient(ellipse at 50% 60%, rgba(212,175,55,0.18) 0%, transparent 65%)",
            filter: "blur(32px)",
          }}
        />

        {/* ── Layer 4: Floating gold particles ── */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(12)].map((_, i) => <GoldParticle key={i} i={i} />)}
        </div>

        {/* ── TOP-RIGHT: Current Favourite card ── */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.9, duration: 0.7, ease: "easeOut" }}
          style={{ y: card1Y }}
          className="absolute top-[88px] right-6 md:right-10 z-30"
        >
          <motion.div
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
            className="rounded-2xl px-5 py-4 text-right"
            style={{
              background: "rgba(8,12,20,0.55)",
              border: "1px solid rgba(212,175,55,0.30)",
              backdropFilter: "blur(24px)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(212,175,55,0.12)",
            }}
          >
            <div className="text-primary/60 text-[9px] tracking-[0.3em] uppercase font-display mb-0.5">Current Favourite</div>
            <div
              className="font-display font-bold text-4xl text-primary leading-none"
              style={{ textShadow: "0 0 28px rgba(212,175,55,0.55)" }}
            >
              {(probabilities?.[0]?.probability != null
                ? (probabilities[0].probability * 100).toFixed(1)
                : "23.9")}%
            </div>
            <div className="flex items-center gap-1.5 justify-end mt-2">
              <span className="text-white/90 font-semibold text-sm font-display tracking-wide">
                {probabilities?.[0]?.name ?? "France"}
              </span>
              <span className="text-xl">{probabilities?.[0]?.flagEmoji ?? "🇫🇷"}</span>
            </div>
          </motion.div>
        </motion.div>

        {/* ── LOWER-LEFT: All content — clear of the trophy ── */}
        <motion.div
          className="absolute bottom-0 left-0 z-20 flex flex-col items-start pb-10 pl-8 md:pl-14 pr-6"
          style={{ opacity: heroOpacity, y: textParallaxY, x: textX, maxWidth: "min(460px, 42vw)" }}
        >
          {/* Venue line */}
          <motion.div
            initial={{ opacity: 0, x: -18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.7 }}
            className="flex items-center gap-3 mb-5"
          >
            <div className="w-6 h-px bg-primary/70" />
            <span className="text-white/70 text-[10px] tracking-[0.32em] uppercase font-display font-semibold whitespace-nowrap">
              USA &nbsp;·&nbsp; Canada &nbsp;·&nbsp; Mexico &nbsp;·&nbsp; 2026
            </span>
          </motion.div>

          {/* Kickoff / Match Day card */}
          <motion.div
            initial={{ opacity: 0, x: -18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35, duration: 0.7 }}
            className="rounded-2xl px-6 py-4 mb-5 w-full"
            style={{
              background: "rgba(8,12,20,0.60)",
              border: "1px solid rgba(212,175,55,0.22)",
              backdropFilter: "blur(24px)",
              boxShadow: "0 4px 28px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)",
            }}
          >
            <KickoffCard />
          </motion.div>

          {/* CTA — Run AI Simulation */}
          <motion.div
            initial={{ opacity: 0, x: -18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5, duration: 0.7 }}
            className="w-full mb-3"
          >
            <Link href="/predict">
              <motion.button
                whileHover={{ scale: 1.03, boxShadow: "0 0 56px rgba(212,175,55,0.55), 0 0 110px rgba(212,175,55,0.18)" }}
                whileTap={{ scale: 0.97 }}
                className="w-full px-8 py-3.5 bg-primary text-[#080C14] font-display font-bold text-sm tracking-[0.15em] rounded-xl cursor-pointer transition-all"
                style={{ boxShadow: "0 0 28px rgba(212,175,55,0.28)" }}
              >
                ⚡ RUN AI SIMULATION
              </motion.button>
            </Link>
          </motion.div>

          {/* CTA — View Analytics */}
          <motion.div
            initial={{ opacity: 0, x: -18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.62, duration: 0.7 }}
            className="w-full"
          >
            <Link href="/analytics">
              <motion.button
                whileHover={{ scale: 1.02, borderColor: "rgba(255,255,255,0.35)" }}
                whileTap={{ scale: 0.97 }}
                className="w-full px-8 py-3.5 font-display font-semibold text-sm tracking-[0.15em] rounded-xl cursor-pointer text-white/80 transition-all"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.16)",
                  backdropFilter: "blur(14px)",
                }}
              >
                VIEW ANALYTICS
              </motion.button>
            </Link>
          </motion.div>
        </motion.div>

        {/* Scroll cue */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 z-30 pointer-events-none"
        >
          <motion.div
            animate={{ y: [0, 6, 0], opacity: [0.25, 0.6, 0.25] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            className="w-5 h-8 rounded-full flex items-start justify-center pt-1.5"
            style={{ border: "1px solid rgba(255,255,255,0.16)" }}
          >
            <div className="w-0.5 h-2 rounded-full bg-white/45" />
          </motion.div>
        </motion.div>
      </section>

      {/* ─── Platform Stats ─────────────────────────────────── */}
      <section className="py-16 px-6 border-t border-border/20">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { value: 23, label: "Nations Analysed", suffix: "" },
              { value: 14, label: "ML Features", suffix: "" },
              { value: 100, label: "Random Forest Trees", suffix: "" },
              { value: 94, label: "Model AUC Score", suffix: "%" },
            ].map(s => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="glass rounded-2xl p-6 text-center"
              >
                <AnimatedStat value={s.value} label={s.label} suffix={s.suffix} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Win Probability Section ─────────────────────────── */}
      <section className="py-20 px-6 border-t border-border/20">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-10"
          >
            <p className="text-primary text-xs tracking-[0.3em] uppercase font-display font-semibold mb-2">Ensemble ML Output</p>
            <h2 className="font-display font-bold text-4xl md:text-5xl text-white">Tournament Favourites</h2>
            <p className="text-muted-foreground mt-2 max-w-xl">Real ML probabilities — not rankings. Teams scored on 14 features, not just prestige.</p>
          </motion.div>

          {/* Top 5 cards */}
          {top5.length === 0 ? (
            <div className="flex gap-4 mb-8">
              {[...Array(5)].map((_, i) => <div key={i} className="flex-1 h-40 rounded-2xl glass animate-pulse" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
              {top5.map((team, i) => (
                <motion.div
                  key={team.teamId}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  whileHover={{ y: -4, boxShadow: "0 20px 40px rgba(212,175,55,0.15)" }}
                  className={`relative p-5 rounded-2xl cursor-default transition-all ${i === 0 ? "glass-gold glow-gold" : "glass"}`}
                >
                  {i === 0 && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-primary text-primary-foreground text-[9px] font-display font-bold rounded-full tracking-widest whitespace-nowrap">
                      #1 FAVOURITE
                    </div>
                  )}
                  <img src={`https://flagcdn.com/w40/${({'FRA':'fr','ESP':'es','ENG':'gb-eng','ARG':'ar','POR':'pt','BRA':'br','GER':'de','NED':'nl','BEL':'be','ITA':'it','CRO':'hr','MAR':'ma','URU':'uy','USA':'us','JPN':'jp','SEN':'sn','COL':'co','MEX':'mx','KOR':'kr','AUS':'au','CAN':'ca','CIV':'ci','SUI':'ch'}[team.code] ?? team.code.slice(0,2).toLowerCase())}.png`}
                    alt={team.name}
                    className="w-14 h-10 object-cover rounded mb-3 mx-auto"
                     onError={(e) => { (e.target as HTMLImageElement).style.display='none'; }}
                     />
                  <div className="font-display font-bold text-white text-lg leading-tight">{team.name}</div>
                  <div className="text-muted-foreground text-[10px] mb-3">{team.code}</div>
                  <div className="font-display font-bold text-2xl text-primary">{(team.probability * 100).toFixed(1)}%</div>
                  <div className="text-muted-foreground text-[9px] mb-2">win probability</div>
                  <div className="h-0.5 rounded-full bg-border/30 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${(team.probability / (top5[0]?.probability || 1)) * 100}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 1, delay: i * 0.1 }}
                      className="h-full rounded-full bg-gradient-to-r from-primary to-yellow-300"
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Probability chart */}
          {top10Chart.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="glass rounded-2xl p-6"
            >
              <h3 className="font-display font-semibold text-white text-sm tracking-widest uppercase mb-4">Win Probability — Top 10 Nations</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={top10Chart} barSize={28}>
               <XAxis
                dataKey="name"
                axisLine={false}
                tick={(props) => {
                 const { x, y, payload } = props;
                 const code = payload.value;
                 const isoCode = ({'FRA':'fr','ESP':'es','ENG':'gb-eng','ARG':'ar','POR':'pt','BRA':'br','GER':'de','NED':'nl','BEL':'be','ITA':'it','CRO':'hr','MAR':'ma','URU':'uy','USA':'us','JPN':'jp','SEN':'sn','COL':'co','MEX':'mx','KOR':'kr','AUS':'au','CAN':'ca','CIV':'ci','SUI':'ch'} as any)[code] ?? code.slice(0,2).toLowerCase();
                 return (
               <g transform={`translate(${x},${y})`}>
                <image
                href={`https://flagcdn.com/w40/${isoCode}.png`}
                x={-16} y={4}
                width={32} height={22}
                preserveAspectRatio="xMidYMid slice"
                style={{ borderRadius: 4 }}
                    />
                <text x={0} y={34} textAnchor="middle" fill="#6B7A9A" fontSize={10} fontFamily="Rajdhani">
                 {code}
                </text>
                </g>
                );
                 }}
                 height={60}
                    />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="prob" name="Win %" radius={[4, 4, 0, 0]}>
                    {top10Chart.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? "#D4AF37" : i < 3 ? `rgba(212,175,55,0.65)` : "rgba(26,39,68,0.8)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </motion.div>
          )}
        </div>
      </section>

      {/* ─── Rankings Table ──────────────────────────────────── */}
      <section className="py-20 px-6 border-t border-border/20">
        <div className="max-w-7xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-10">
            <p className="text-primary text-xs tracking-[0.3em] uppercase font-display font-semibold mb-2">Power Index</p>
            <h2 className="font-display font-bold text-4xl md:text-5xl text-white">Team Rankings</h2>
          </motion.div>

          <div className="glass rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  {["Rank", "Nation", "FIFA", "Elo", "Form", "Win Prob."].map(h => (
                    <th key={h} className="px-5 py-4 text-left text-[10px] text-muted-foreground font-display tracking-widest uppercase">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
               
                {top8Rankings.map((team, i) => (
                  <motion.tr
                    key={team.teamId}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05 }}
                    className="border-b border-white/5 hover:bg-white/3 transition-colors"
                  >
                    <td className="px-5 py-4">
                      <span className={`font-display font-bold text-lg ${i === 0 ? "text-primary text-glow-gold" : i < 3 ? "text-yellow-400/70" : "text-muted-foreground"}`}>
                        {team.rank}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                         <img src={`https://flagcdn.com/w40/${({'FRA':'fr','ESP':'es','ENG':'gb-eng','ARG':'ar','POR':'pt','BRA':'br','GER':'de','NED':'nl','BEL':'be','ITA':'it','CRO':'hr','MAR':'ma','URU':'uy','USA':'us','JPN':'jp','SEN':'sn','COL':'co','MEX':'mx','KOR':'kr','AUS':'au','CAN':'ca','CIV':'ci','SUI':'ch'}[team.code] ?? team.code.slice(0,2).toLowerCase())}.png`}
                         alt={team.name}
                       className="w-8 h-6 object-cover rounded"
                        onError={(e) => { (e.target as HTMLImageElement).style.display='none'; }}
/>
                        <div>
                          <div className="font-semibold text-white text-sm">{team.name}</div>
                          <div className="text-[10px] text-muted-foreground">{team.code}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-muted-foreground text-xs font-mono">#{team.fifaRanking}</td>
                    <td className="px-5 py-4 text-white text-xs font-mono font-semibold">{Math.round(team.eloRating)}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-0.5 bg-border/30 rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${team.compositeScore * 100}%` }} />
                        </div>
                        <span className="text-muted-foreground text-[10px] font-mono">{(team.compositeScore * 100).toFixed(0)}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-display font-bold text-primary text-sm">{(team.winProbability * 100).toFixed(1)}%</span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 text-center">
            <Link href="/analytics">
              <motion.button whileHover={{ scale: 1.03 }}
                className="px-8 py-3 glass-gold border border-primary/25 text-primary font-display font-semibold tracking-widest text-xs rounded-xl cursor-pointer hover:glow-gold transition-all"
              >
                VIEW FULL ANALYTICS →
              </motion.button>
            </Link>
          </div>
        </div>
      </section>

      {/* ─── ML Architecture ────────────────────────────────── */}
      <section className="py-20 px-6 border-t border-border/20 relative overflow-hidden">
        {/* AI hologram image as subtle background */}
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage: `url(${aiHologramImg})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(4px)",
          }}
        />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to right, rgba(8,12,20,0.97) 0%, rgba(8,12,20,0.85) 50%, rgba(8,12,20,0.95) 100%)" }} />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <p className="text-primary text-xs tracking-[0.3em] uppercase font-display font-semibold mb-3">ML Pipeline</p>
              <h2 className="font-display font-bold text-4xl md:text-5xl text-white mb-4">
                Ensemble
                <br />
                Intelligence
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-6 text-sm">
                Three ML models trained independently on 14 real football features. Each model "votes"
                with its own weight. SHAP values then explain <em>why</em> the winning team was selected —
                no black-box predictions.
              </p>
              <div className="space-y-5">
                {[
                  { name: "Logistic Regression", weight: 30, color: "#00BFFF", desc: "Baseline linear model with sigmoid activation" },
                  { name: "Random Forest", weight: 35, color: "#D4AF37", desc: "100 bootstrap trees with feature subsampling" },
                  { name: "Gradient Boost XGBoost", weight: 35, color: "#A855F7", desc: "50-round additive boosting with interaction terms" },
                ].map((m, i) => (
                  <motion.div
                    key={m.name}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                  >
                    <div className="flex justify-between mb-1.5">
                      <div>
                        <span className="text-white text-sm font-semibold">{m.name}</span>
                        <span className="text-muted-foreground text-xs ml-2">{m.desc}</span>
                      </div>
                      <span className="font-display font-bold text-sm flex-shrink-0" style={{ color: m.color }}>{m.weight}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-border/30 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${m.weight}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 1, delay: i * 0.15 }}
                        className="h-full rounded-full"
                        style={{ background: m.color }}
                      />
                    </div>
                  </motion.div>
                ))}
              </div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 }}
                className="mt-6 p-4 glass rounded-xl border border-pink-500/20"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm">🔍</span>
                  </div>
                  <div>
                    <div className="text-white text-sm font-semibold mb-1">SHAP Explainability</div>
                    <div className="text-muted-foreground text-xs leading-relaxed">
                      After prediction, Shapley values show exactly which features pushed each team's probability up or down. No black-box AI.
                    </div>
                  </div>
                </div>
              </motion.div>

              <Link href="/predict">
                <motion.button
                  whileHover={{ scale: 1.04, boxShadow: "0 0 30px rgba(212,175,55,0.3)" }}
                  className="mt-6 px-8 py-3 bg-primary text-primary-foreground font-display font-bold tracking-widest text-xs rounded-xl cursor-pointer transition-all glow-gold"
                >
                  START PREDICTION →
                </motion.button>
              </Link>
            </motion.div>

            {/* Right: AI hologram image + feature grid overlay */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="relative rounded-2xl overflow-hidden" style={{ boxShadow: "0 0 40px rgba(212,175,55,0.12)" }}>
                <img
                  src={aiHologramImg}
                  alt="AI Analytics Visualization"
                  className="w-full object-cover rounded-2xl"
                  style={{ height: "420px", objectPosition: "center" }}
                />
                <div className="absolute inset-0 rounded-2xl" style={{ background: "linear-gradient(to top, rgba(8,12,20,0.85) 0%, rgba(8,12,20,0.3) 50%, rgba(8,12,20,0.1) 100%)" }} />

                {/* Feature overlay cards */}
                <div className="absolute bottom-0 left-0 right-0 p-5 grid grid-cols-2 gap-2">
                  {[
                    { label: "Elo Rating", importance: 21.8, color: "#D4AF37" },
                    { label: "Recent Form", importance: 18.6, color: "#00BFFF" },
                    { label: "Defensive Solidity", importance: 15.2, color: "#10B981" },
                    { label: "Market Value", importance: 12.1, color: "#A855F7" },
                  ].map((f, i) => (
                    <motion.div
                      key={f.label}
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.5 + i * 0.1 }}
                      className="glass rounded-lg p-3"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-white text-[10px] font-semibold">{f.label}</span>
                        <span className="font-mono text-[10px] font-bold" style={{ color: f.color }}>{f.importance}%</span>
                      </div>
                      <div className="h-0.5 bg-border/30 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          whileInView={{ width: `${f.importance * 4.5}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.8, delay: 0.6 + i * 0.1 }}
                          className="h-full rounded-full"
                          style={{ background: f.color }}
                        />
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Glowing border */}
                <motion.div
                  className="absolute inset-0 rounded-2xl border border-primary/20 pointer-events-none"
                  animate={{ opacity: [0.4, 0.9, 0.4] }}
                  transition={{ duration: 3, repeat: Infinity }}
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </main>
  );
}
