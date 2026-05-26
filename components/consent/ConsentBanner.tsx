"use client";

// Klaro-inspired consent banner. Two-stage: collapsed "Accept/Manage" CTA at
// bottom of viewport, then expandable per-purpose modal with vendor detail.
//
// GDPR strict-opt-in by default for everything except cookieless analytics
// (Plausible). UAE PDPL compliant — explicit affirmative action required.

import { useEffect, useState } from "react";
import {
  PIXELS,
  getPixelsByPurpose,
  type ConsentPurpose,
} from "@/lib/consent/types";
import {
  saveConsent,
  hasConsented,
  readConsent,
  purgeCookies,
} from "@/lib/consent/state";

const PURPOSE_LABELS: Record<ConsentPurpose, { title: string; description: string }> = {
  essential: {
    title: "Essential",
    description: "Required to run the site — session, language, theme. Always on.",
  },
  analytics: {
    title: "Analytics",
    description:
      "How many people read each article, where they drop off, which sources convert. No PII. I use this to rewrite weak sections.",
  },
  advertising: {
    title: "Advertising",
    description:
      "Retargeting on social platforms so I can reach you with relevant follow-ups. Only if you opt in.",
  },
  conversion: {
    title: "Conversion",
    description:
      "Closes the loop between paid campaigns and newsletter signups so I know which ads actually work.",
  },
};

export function ConsentBanner() {
  const [show, setShow] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [selections, setSelections] = useState<Record<string, boolean>>(() =>
    PIXELS.reduce(
      (acc, p) => ({ ...acc, [p.name]: p.default }),
      {} as Record<string, boolean>
    )
  );

  useEffect(() => {
    // Hydrate from existing consent (if user is re-opening preferences)
    const existing = readConsent();
    if (existing) {
      setSelections(existing.consents);
    }
    if (!hasConsented()) {
      // Tiny delay so the banner doesn't flash on hot page reloads
      const t = setTimeout(() => setShow(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  // External "reopen preferences" trigger
  useEffect(() => {
    function onReopen() {
      setExpanded(true);
      setShow(true);
    }
    window.addEventListener("iwr-consent-reopen", onReopen);
    return () => window.removeEventListener("iwr-consent-reopen", onReopen);
  }, []);

  function acceptAll() {
    const all = PIXELS.reduce(
      (acc, p) => ({ ...acc, [p.name]: true }),
      {} as Record<string, boolean>
    );
    saveConsent(all);
    setShow(false);
  }

  function rejectAll() {
    const noneExceptCookieless = PIXELS.reduce(
      (acc, p) => ({ ...acc, [p.name]: p.cookies.length === 0 ? p.default : false }),
      {} as Record<string, boolean>
    );
    // Also purge any existing cookies from disallowed vendors
    for (const p of PIXELS) {
      if (!noneExceptCookieless[p.name]) purgeCookies(p.cookies);
    }
    saveConsent(noneExceptCookieless);
    setShow(false);
  }

  function saveSelection() {
    // Purge cookies for any vendor we just disallowed
    for (const p of PIXELS) {
      if (!selections[p.name]) purgeCookies(p.cookies);
    }
    saveConsent(selections);
    setShow(false);
  }

  function toggle(name: string) {
    setSelections((s) => ({ ...s, [name]: !s[name] }));
  }

  function toggleGroup(purpose: ConsentPurpose, on: boolean) {
    const updates: Record<string, boolean> = {};
    for (const p of PIXELS) {
      if (p.purpose === purpose) updates[p.name] = on;
    }
    setSelections((s) => ({ ...s, ...updates }));
  }

  if (!show) return null;

  const groups = getPixelsByPurpose();

  return (
    <div
      role="dialog"
      aria-labelledby="consent-banner-title"
      aria-describedby="consent-banner-desc"
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#0A1024]/10 shadow-2xl"
    >
      <div className="max-w-5xl mx-auto px-6 py-5">
        {!expanded ? (
          // Compact view — Accept / Reject / Manage
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-6">
            <div className="flex-1">
              <h2 id="consent-banner-title" className="font-serif text-base mb-1">
                Cookies, but consensual
              </h2>
              <p id="consent-banner-desc" className="text-xs text-[#0A1024]/70 leading-relaxed">
                I run analytics + retargeting to keep this site sharp. Pick what you're OK with —
                or reject everything except the essentials. Either way the site works. (
                <a href="/legal/privacy" className="underline">
                  Privacy policy
                </a>
                )
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <button
                onClick={() => setExpanded(true)}
                className="px-4 py-2 text-xs rounded-md border border-[#0A1024]/15 hover:bg-[#0A1024]/5"
              >
                Manage
              </button>
              <button
                onClick={rejectAll}
                className="px-4 py-2 text-xs rounded-md border border-[#0A1024]/15 hover:bg-[#0A1024]/5"
              >
                Reject all
              </button>
              <button
                onClick={acceptAll}
                className="px-4 py-2 text-xs rounded-md bg-[#0A1024] text-white hover:bg-[#0A1024]/90"
              >
                Accept all
              </button>
            </div>
          </div>
        ) : (
          // Expanded — per-vendor toggles grouped by purpose
          <div className="max-h-[70vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="font-serif text-lg mb-1">Manage preferences</h2>
                <p className="text-xs text-[#0A1024]/70">
                  Toggle individual services or whole categories. Your choice is saved on this
                  device only.
                </p>
              </div>
              <button
                onClick={() => setExpanded(false)}
                className="text-xs text-[#0A1024]/50 hover:text-[#0A1024]"
                aria-label="Close expanded view"
              >
                ←  Back
              </button>
            </div>

            <div className="space-y-5">
              {(Object.keys(groups) as ConsentPurpose[]).map((purpose) => {
                const pixels = groups[purpose];
                // Skip essential group (no toggles needed — always on)
                if (purpose === "essential" || pixels.length === 0) return null;

                const allOn = pixels.every((p) => selections[p.name]);
                const someOn = pixels.some((p) => selections[p.name]);

                return (
                  <div key={purpose} className="border border-[#0A1024]/10 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-medium text-sm mb-1">{PURPOSE_LABELS[purpose].title}</h3>
                        <p className="text-xs text-[#0A1024]/60">
                          {PURPOSE_LABELS[purpose].description}
                        </p>
                      </div>
                      <button
                        onClick={() => toggleGroup(purpose, !allOn)}
                        className={`text-[10px] font-mono uppercase px-2 py-1 rounded ${
                          allOn
                            ? "bg-emerald-100 text-emerald-900"
                            : someOn
                              ? "bg-amber-100 text-amber-900"
                              : "bg-[#0A1024]/5 text-[#0A1024]/60"
                        }`}
                      >
                        {allOn ? "All on" : someOn ? "Some on" : "All off"}
                      </button>
                    </div>
                    <div className="space-y-2">
                      {pixels.map((p) => (
                        <label
                          key={p.name}
                          className="flex items-start gap-3 cursor-pointer text-xs"
                        >
                          <input
                            type="checkbox"
                            checked={selections[p.name] || false}
                            onChange={() => toggle(p.name)}
                            className="mt-0.5 accent-[#C9A961]"
                          />
                          <span className="flex-1">
                            <span className="font-medium text-[#0A1024]">{p.title}</span>
                            <span className="block text-[#0A1024]/60 mt-0.5">{p.description}</span>
                            <a
                              href={p.privacyUrl}
                              target="_blank"
                              rel="noopener"
                              className="text-[#A88945] hover:underline mt-1 inline-block text-[10px]"
                            >
                              Vendor privacy →
                            </a>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t border-[#0A1024]/10">
              <button
                onClick={saveSelection}
                className="px-4 py-2 text-xs rounded-md bg-[#0A1024] text-white hover:bg-[#0A1024]/90"
              >
                Save selection
              </button>
              <button
                onClick={rejectAll}
                className="px-4 py-2 text-xs rounded-md border border-[#0A1024]/15 hover:bg-[#0A1024]/5"
              >
                Reject all
              </button>
              <button
                onClick={acceptAll}
                className="px-4 py-2 text-xs rounded-md border border-[#0A1024]/15 hover:bg-[#0A1024]/5"
              >
                Accept all
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Tiny footer link — "Cookie preferences" reopens the banner. */
export function ConsentReopenLink({ className = "" }: { className?: string }) {
  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent("iwr-consent-reopen"))}
      className={`text-xs text-[#0A1024]/50 hover:text-[#0A1024] underline ${className}`}
    >
      Cookie preferences
    </button>
  );
}
