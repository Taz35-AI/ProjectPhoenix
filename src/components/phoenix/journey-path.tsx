import { cn } from "@/lib/utils";

/**
 * Abstract journey visual. A path recedes toward a distant future-self figure
 * on a horizon. As `progress` (0..1) grows, the horizon warms, the path
 * brightens, and the figure becomes slightly clearer — without ever implying
 * the transformation is "complete". Pure CSS/SVG, no external assets.
 */
export function JourneyPath({ progress, className }: { progress: number; className?: string }) {
  const p = Math.max(0, Math.min(1, progress));
  const horizonOpacity = 0.25 + p * 0.5;
  const figureOpacity = 0.25 + p * 0.55;
  const pathOpacity = 0.3 + p * 0.6;

  return (
    <div className={cn("relative aspect-[16/10] w-full overflow-hidden rounded-2xl border border-border", className)}>
      <svg viewBox="0 0 320 200" className="h-full w-full" role="img" aria-label={`Your journey, ${Math.round(p * 100)}% toward the next horizon`}>
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(20 14% 4%)" />
            <stop offset="100%" stopColor="hsl(20 12% 9%)" />
          </linearGradient>
          <radialGradient id="glow" cx="50%" cy="100%" r="70%">
            <stop offset="0%" stopColor="hsl(18 90% 55%)" stopOpacity={horizonOpacity} />
            <stop offset="55%" stopColor="hsl(30 85% 60%)" stopOpacity={horizonOpacity * 0.5} />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect width="320" height="200" fill="url(#sky)" />
        {/* horizon glow (the distant future) */}
        <ellipse cx="160" cy="120" rx="150" ry="70" fill="url(#glow)" />

        {/* the path receding to the horizon */}
        <path
          d="M120 200 L152 122 L168 122 L200 200 Z"
          fill="hsl(30 40% 40%)"
          fillOpacity={pathOpacity * 0.3}
        />
        <path d="M160 200 L160 122" stroke="hsl(30 85% 60%)" strokeOpacity={pathOpacity} strokeWidth="1.5" strokeDasharray="4 5" />

        {/* distant figure — a soft, faceless silhouette */}
        <g opacity={figureOpacity}>
          <ellipse cx="160" cy="116" rx="6" ry="9" fill="hsl(40 30% 88%)" opacity="0.5" />
          <circle cx="160" cy="104" r="3.2" fill="hsl(40 30% 90%)" opacity="0.6" />
          <ellipse cx="160" cy="112" rx="14" ry="6" fill="hsl(18 90% 55%)" opacity={0.15 + p * 0.25} />
        </g>
      </svg>
    </div>
  );
}
