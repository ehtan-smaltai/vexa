/** useBranding — the deployment's identity, fetched once per page and shared by every surface.
 *
 *  ONE FETCH, not one per component. The header, the sign-in card, the tab title and the settings
 *  panel all want the same answer, and a hook that fetched per mount would make a page load ask
 *  four times for a value that cannot change between them. The in-flight promise is the cache, so
 *  four mounts in one tick share one request.
 *
 *  DEFAULTS RENDER FIRST, deliberately: the hook never returns null and no caller writes a
 *  loading branch. A name that resolves a moment later is a repaint; a spinner where the product
 *  name goes is a worse first impression than the stock name briefly showing.
 */
"use client";

import { useEffect, useState } from "react";
import { DEFAULTS, initial, type Branding } from "./branding";

let inflight: Promise<Branding> | null = null;
let resolved: Branding | null = null;

/** Force the next `useBranding()` to re-fetch — called after the admin saves. */
export function invalidateBranding(): void {
  inflight = null;
  resolved = null;
}

function load(): Promise<Branding> {
  if (resolved) return Promise.resolve(resolved);
  if (!inflight) {
    inflight = fetch("/api/branding", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : DEFAULTS))
      .then((v: Branding) => {
        resolved = { ...DEFAULTS, ...v };
        return resolved;
      })
      // A deployment that cannot answer still has to render. Same reasoning as the route's own
      // fallback, restated here because a network failure never reaches that code at all.
      .catch(() => DEFAULTS);
  }
  return inflight;
}

export function useBranding(): Branding {
  const [brand, setBrand] = useState<Branding>(resolved ?? DEFAULTS);
  useEffect(() => {
    let live = true;
    void load().then((b) => {
      if (!live) return;
      setBrand(b);
      applyAccent(b.accent);
      applyTitle(b.productName);
    });
    return () => { live = false; };
  }, []);
  return brand;
}

/** Paint the accent as the page's own `--accent`, which every surface already reads.
 *  The value is validated server-side as a hex colour (admin-api `_HEX_COLOR`) before it is
 *  stored, so nothing arbitrary reaches the stylesheet here. */
export function applyAccent(accent: string): void {
  if (typeof document === "undefined" || !accent) return;
  document.documentElement.style.setProperty("--accent", accent);
  // The accent's tint is derived rather than configured: one knob for an operator, and a card
  // background that can never drift out of step with the colour it tints.
  document.documentElement.style.setProperty("--accentbg", hexToRgba(accent, 0.14));
}

/** The browser tab. `layout.tsx` ships a static title for the first paint; this renames it once
 *  the deployment's own name is known. */
export function applyTitle(productName: string): void {
  if (typeof document === "undefined" || !productName) return;
  document.title = `${productName} Terminal`;
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 || h.length === 4
    ? h.slice(0, 3).split("").map((c) => c + c).join("")
    : h.slice(0, 6);
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return `rgba(216, 133, 92, ${alpha})`;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** The deployment's mark: its logo when one is configured, else the product's initial on the
 *  accent — the same glyph the mockup's header, sign-in card and mail all carry. */
export function Mark({ brand, size = 24 }: { brand: Branding; size?: number }): React.ReactElement {
  const radius = Math.round(size * 0.29);
  if (brand.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={brand.logoUrl} alt={brand.productName} width={size} height={size}
           style={{ borderRadius: radius, display: "block", flex: "none", objectFit: "cover" }} />
    );
  }
  return (
    <span aria-hidden="true" style={{
      width: size, height: size, borderRadius: radius, background: "var(--accent)",
      color: "var(--on-accent)", display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: Math.round(size * 0.6), fontWeight: 600, flex: "none", lineHeight: 1,
    }}>{initial(brand.productName)}</span>
  );
}
