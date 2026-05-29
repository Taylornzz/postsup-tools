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
 * Official Netflix "N" mark (the two-ribbon symbol), drawn as inline SVG so it
 * can sit inside dropdown rows, triggers and status badges. Brand red (#E50914)
 * by default; `muted` uses currentColor for limited-use cameras.
 */
export function NetflixMark({ className, muted, title }: NetflixMarkProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("inline-block shrink-0", className)}
      fill={muted ? "currentColor" : "#E50914"}
      role="img"
      aria-label={title ?? "Netflix"}
    >
      {title ? <title>{title}</title> : null}
      <path d="M5.398 0v.006c3.028 8.556 5.37 15.175 8.348 23.596 2.344.058 4.85.398 4.854.398-2.8-7.924-5.923-16.747-8.487-24zm8.489 0v9.63L18.6 22.951c-.043-7.86-.004-15.913.002-22.95zM5.398 1.05V24c1.873-.225 2.81-.312 4.715-.398v-9.22z" />
    </svg>
  );
}
