import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";

const NAV_LINKS = [
  { href: "/", label: "HOME" },
  { href: "/analytics", label: "ANALYTICS" },
  { href: "/predict", label: "PREDICT" },
  { href: "/compare", label: "COMPARE" },
  { href: "/bracket", label: "BRACKET" },
];

export default function Navbar() {
  const [location] = useLocation();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/">
          <span className="flex items-center gap-3 cursor-pointer group">
            <div className="w-8 h-8 rounded bg-primary/10 border border-primary/30 flex items-center justify-center">
              <span className="text-primary font-display font-bold text-sm">WC</span>
            </div>
            <span className="font-display font-bold text-lg tracking-wider text-white group-hover:text-primary transition-colors">
              WORLDCUP<span className="text-primary">AI</span>
            </span>
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map(({ href, label }) => {
            const isActive = href === "/" ? location === "/" : location.startsWith(href);
            return (
              <Link key={href} href={href}>
                <span className="relative cursor-pointer">
                  <span
                    className={`font-display font-semibold text-sm tracking-widest transition-colors ${
                      isActive ? "text-primary" : "text-muted-foreground hover:text-white"
                    }`}
                  >
                    {label}
                  </span>
                  {isActive && (
                    <motion.span
                      layoutId="nav-underline"
                      className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary rounded-full"
                    />
                  )}
                </span>
              </Link>
            );
          })}
        </div>

        <Link href="/predict">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="px-5 py-2 bg-primary text-primary-foreground font-display font-bold text-sm tracking-widest rounded hover:brightness-110 transition-all cursor-pointer"
          >
            RUN PREDICTION
          </motion.button>
        </Link>
      </div>
    </nav>
  );
}
