import Image from "next/image";
import Link from "next/link";

// Uses the original, unmodified logo file (536x563). Only the height is set so the
// width follows automatically and the proportions are never changed.
// The logo sits on a white tile so its built-in soft shadow looks clean on dark pages.
// The brand NAME is separate text; it is never drawn on top of the logo.
export function Logo({
  className = "h-8",
  withWordmark = true,
  href = "/",
  tone = "dark",
}: {
  className?: string;
  withWordmark?: boolean;
  href?: string;
  /** "dark" = for dark backgrounds (public site), "light" = for light backgrounds (dashboard, portal). */
  tone?: "dark" | "light";
}) {
  return (
    <Link href={href} className="inline-flex items-center gap-3" aria-label="ThumbStop home">
      <span className={`inline-flex items-center rounded-lg bg-white px-2 py-1.5 ${tone === "light" ? "border border-slate-200" : ""}`}>
        <Image
          src="/brand/thumbstop-logo.png"
          alt="ThumbStop logo"
          width={536}
          height={563}
          priority
          className={`w-auto ${className}`}
        />
      </span>
      {withWordmark && (
        <span className={`font-display text-xl font-bold tracking-tight ${tone === "light" ? "text-slate-900" : "text-white"}`}>
          Thumb<span className={tone === "light" ? "text-brand-royal" : "text-brand-cyan"}>Stop</span>
        </span>
      )}
    </Link>
  );
}
