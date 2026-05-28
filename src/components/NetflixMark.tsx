import { cn } from "@/lib/utils";

interface NetflixMarkProps {
  /** Sizing / layout classes (e.g. "h-3 w-3"). */
  className?: string;
  /** Render in a muted (grayscale) tone instead of brand red — used for "Limited Use". */
  muted?: boolean;
  /** Accessible label / tooltip. */
  title?: string;
}

/**
 * Netflix "N" wordmark, drawn as inline SVG so it can sit inside dropdown rows,
 * triggers, and status badges (none of which can hold a raster image).
 * Brand red (#E50914) by default; `muted` uses currentColor for limited-use cameras.
 */
export function NetflixMark({ className, muted, title }: NetflixMarkProps) {
  return (
    <svg
      viewBox="0 0 1024 1024"
      className={cn("inline-block shrink-0", className)}
      fill={muted ? "currentColor" : "#E50914"}
      role="img"
      aria-label={title ?? "Netflix"}
    >
      {title ? <title>{title}</title> : null}
      {/* left bar */}
      <path d="M0 0h205v1024H0z" />
      {/* right bar */}
      <path d="M819 0h205v1024H819z" />
      {/* diagonal */}
      <path d="M205 0h230l384 1024H589z" />
    </svg>
  );
}
