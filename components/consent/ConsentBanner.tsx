"use client";

// Klaro-inspired consent banner. Two-stage: collapsed "Accept/Manage" CTA at
// bottom of viewport, then expandable per-purpose modal with vendor detail.
//
// GDPR strict-opt-in by default for everything except cookieless analytics
// (Plausible). UAE PDPL compliant — explicit affirmative action required.

import { useEffect, useRef, useState } from "react";
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
  const dialogRef = useRef<HTMLDivElement>(null);
  const manageButtonRef = useRef<HTMLButtonElement>(null);
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const [selections, setSelections] = useState<Record<string, boolean>>(() =>
    PIXELS.reduce(
      (acc, p) => ({ ...acc, [p.name]: p.default }),
      {} as Record<string, boolean>
    )
  );

  useEffect(() => {
    // Hydrate from existing consent (if user is re-opening preferences)
    const existing = readConsent();
    const hydrateTimer = existing
      ? window.setTimeout(() => setSelections(existing.consents), 0)
      : null;
    const showTimer = !existing
      ? window.setTimeout(() => {
          restoreFocusRef.current =
            document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null;
          setShow(true);
        }, 600)
      : null;

    return () => {
      if (hydrateTimer !== null) window.clearTimeout(hydrateTimer);
      if (showTimer !== null) window.clearTimeout(showTimer);
    };
  }, []);

  // External "reopen preferences" trigger
  useEffect(() => {
    function onReopen() {
      restoreFocusRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      setExpanded(true);
      setShow(true);
    }
    window.addEventListener("iwr-consent-reopen", onReopen);
    return () => window.removeEventListener("iwr-consent-reopen", onReopen);
  }, []);

  useEffect(() => {
    if (!show) return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusCurrentView = () => {
      if (
        dialog.inert ||
        document.body.getAttribute("data-news-directory-open") === "true"
      ) {
        return;
      }
      (expanded ? backButtonRef.current : manageButtonRef.current)?.focus();
    };

    const focusFrame = window.requestAnimationFrame(focusCurrentView);

    const handleKeydown = (event: KeyboardEvent) => {
      if (
        dialog.inert ||
        document.body.getAttribute("data-news-directory-open") === "true"
      ) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        if (expanded) {
          setExpanded(false);
        } else if (hasConsented()) {
          setShow(false);
          const restoreTarget = restoreFocusRef.current;
          restoreFocusRef.current = null;
          window.requestAnimationFrame(() => restoreTarget?.focus());
        }
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(
        (element) =>
          !element.inert &&
          element.getAttribute("aria-hidden") !== "true" &&
          element.getClientRects().length > 0,
      );

      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const activeIndex = focusable.indexOf(
        document.activeElement as HTMLElement,
      );
      if (activeIndex === -1) {
        event.preventDefault();
        focusable[0]?.focus();
      } else if (event.shiftKey && activeIndex === 0) {
        event.preventDefault();
        focusable.at(-1)?.focus();
      } else if (!event.shiftKey && activeIndex === focusable.length - 1) {
        event.preventDefault();
        focusable[0]?.focus();
      }
    };

    window.addEventListener("keydown", handleKeydown);
    window.addEventListener("iwr-consent-resume", focusCurrentView);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", handleKeydown);
      window.removeEventListener("iwr-consent-resume", focusCurrentView);
    };
  }, [expanded, show]);

  useEffect(() => {
    if (!show) return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    const previousIsolation = new Map<
      HTMLElement,
      { inert: boolean; ariaHidden: string | null }
    >();

    const restoreBackground = () => {
      for (const [element, { inert, ariaHidden }] of previousIsolation) {
        element.inert = inert;
        if (ariaHidden === null) {
          element.removeAttribute("aria-hidden");
        } else {
          element.setAttribute("aria-hidden", ariaHidden);
        }
      }
      previousIsolation.clear();
    };

    const isolateBackground = () => {
      if (
        document.body.getAttribute("data-news-directory-open") === "true"
      ) {
        return;
      }

      for (const child of Array.from(document.body.children)) {
        if (
          !(child instanceof HTMLElement) ||
          child === dialog ||
          child.contains(dialog) ||
          previousIsolation.has(child)
        ) {
          continue;
        }

        previousIsolation.set(child, {
          inert: child.inert,
          ariaHidden: child.getAttribute("aria-hidden"),
        });
        child.inert = true;
        child.setAttribute("aria-hidden", "true");
      }
    };

    const handleDirectoryOpening = () => restoreBackground();
    const handleDirectoryResume = () => isolateBackground();
    const backgroundObserver = new MutationObserver(isolateBackground);

    isolateBackground();
    backgroundObserver.observe(document.body, { childList: true });
    window.addEventListener(
      "iwr-news-directory-opening",
      handleDirectoryOpening,
    );
    window.addEventListener("iwr-consent-resume", handleDirectoryResume);

    return () => {
      window.removeEventListener(
        "iwr-news-directory-opening",
        handleDirectoryOpening,
      );
      window.removeEventListener("iwr-consent-resume", handleDirectoryResume);
      backgroundObserver.disconnect();
      restoreBackground();
    };
  }, [show]);

  function closeBanner() {
    setShow(false);
    const restoreTarget = restoreFocusRef.current;
    restoreFocusRef.current = null;
    window.requestAnimationFrame(() => restoreTarget?.focus());
  }

  function acceptAll() {
    const all = PIXELS.reduce(
      (acc, p) => ({ ...acc, [p.name]: true }),
      {} as Record<string, boolean>
    );
    saveConsent(all);
    closeBanner();
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
    closeBanner();
  }

  function saveSelection() {
    // Purge cookies for any vendor we just disallowed
    for (const p of PIXELS) {
      if (!selections[p.name]) purgeCookies(p.cookies);
    }
    saveConsent(selections);
    closeBanner();
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
      ref={dialogRef}
      data-consent-layer
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-banner-title"
      aria-describedby="consent-banner-desc"
      tabIndex={-1}
      className="fixed bottom-0 left-0 right-0 z-50 bg-[#090B10]/96 border-t border-[#F0F0EC]/14 shadow-2xl backdrop-blur-xl"
    >
      <div className="max-w-5xl mx-auto px-6 py-5">
        {!expanded ? (
          // Compact view — Accept / Reject / Manage
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-6">
            <div className="flex-1">
              <h2 id="consent-banner-title" className="font-medium tracking-[-0.02em] text-base mb-1">
                Cookies, but consensual
              </h2>
              <p id="consent-banner-desc" className="text-xs text-[#F2EEE7]/74 leading-relaxed">
                I run analytics + retargeting to keep this site sharp. Pick what you&apos;re OK with —
                or reject everything except the essentials. Either way the site works. (
                <a href="/legal/privacy" className="underline">
                  Privacy policy
                </a>
                )
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <button
                ref={manageButtonRef}
                type="button"
                onClick={() => setExpanded(true)}
                className="px-4 py-2 text-xs rounded-full border border-[#F2EEE7]/14 hover:bg-[#F2EEE7]/8"
              >
                Manage
              </button>
              <button
                type="button"
                onClick={rejectAll}
                className="px-4 py-2 text-xs rounded-full border border-[#F2EEE7]/14 hover:bg-[#F2EEE7]/8"
              >
                Reject all
              </button>
              <button
                type="button"
                onClick={acceptAll}
                className="px-4 py-2 text-xs rounded-full bg-[#4050C8] text-white hover:bg-[#3544B5]"
              >
                Accept all
              </button>
            </div>
          </div>
        ) : (
          // Expanded — per-vendor toggles grouped by purpose
          <div
            className="max-h-[70vh] overflow-y-auto"
            role="region"
            aria-label="Cookie preference controls"
            tabIndex={0}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 id="consent-banner-title" className="font-medium tracking-[-0.02em] text-lg mb-1">Manage preferences</h2>
                <p id="consent-banner-desc" className="text-xs text-[#F2EEE7]/74">
                  Toggle individual services or whole categories. Your choice is saved on this
                  device only.
                </p>
              </div>
              <button
                ref={backButtonRef}
                type="button"
                onClick={() => setExpanded(false)}
                className="text-xs text-[#F2EEE7]/70 hover:text-[#F2EEE7]"
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
                  <div key={purpose} className="border border-[#F2EEE7]/12 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-medium text-sm mb-1">{PURPOSE_LABELS[purpose].title}</h3>
                        <p className="text-xs text-[#F2EEE7]/62">
                          {PURPOSE_LABELS[purpose].description}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleGroup(purpose, !allOn)}
                        className={`text-[10px] font-mono uppercase px-2 py-1 rounded ${
                          allOn
                            ? "bg-[#86C255]/15 text-[#86C255]"
                            : someOn
                              ? "bg-[#596BFF]/14 text-[#B8C0FF]"
                              : "bg-[#F2EEE7]/8 text-[#F2EEE7]/62"
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
                            className="mt-0.5 accent-[#596BFF]"
                          />
                          <span className="flex-1">
                            <span className="font-medium text-[#F2EEE7]">{p.title}</span>
                            <span className="block text-[#F2EEE7]/62 mt-0.5">{p.description}</span>
                            <a
                              href={p.privacyUrl}
                              target="_blank"
                              rel="noopener"
                              className="text-[#B8C0FF] hover:underline mt-1 inline-block text-[10px]"
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

            <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t border-[#F2EEE7]/12">
              <button
                type="button"
                onClick={saveSelection}
                className="px-4 py-2 text-xs rounded-full bg-[#4050C8] text-white hover:bg-[#3544B5]"
              >
                Save selection
              </button>
              <button
                type="button"
                onClick={rejectAll}
                className="px-4 py-2 text-xs rounded-full border border-[#F2EEE7]/14 hover:bg-[#F2EEE7]/8"
              >
                Reject all
              </button>
              <button
                type="button"
                onClick={acceptAll}
                className="px-4 py-2 text-xs rounded-full border border-[#F2EEE7]/14 hover:bg-[#F2EEE7]/8"
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
      className={`text-xs text-[#F2EEE7]/70 hover:text-[#F2EEE7] underline ${className}`}
    >
      Cookie preferences
    </button>
  );
}
