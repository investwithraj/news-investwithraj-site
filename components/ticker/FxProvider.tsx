"use client";

// FX context — provides current currency choice + live FX snapshot + a
// <Price> component that auto-converts AED to the chosen currency anywhere
// in the tree. Choice is persisted in localStorage.

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  CURRENCY_META,
  convertAedTo,
  formatCurrency,
  type Currency,
  type FxSnapshot,
} from "@/lib/fx/rates";

const STORAGE_KEY = "iwr-news-currency";

interface FxContextShape {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  snapshot: FxSnapshot | null;
  loading: boolean;
}

const FxContext = createContext<FxContextShape>({
  currency: "AED",
  setCurrency: () => {},
  snapshot: null,
  loading: false,
});

export function FxProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>("AED");
  const [snapshot, setSnapshot] = useState<FxSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  // Hydrate currency from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Currency | null;
      if (stored && stored in CURRENCY_META) {
        setCurrencyState(stored);
      }
    } catch {
      // localStorage unavailable, default to AED
    }
  }, []);

  // Fetch FX snapshot once on mount + refresh every hour
  useEffect(() => {
    let mounted = true;
    async function refresh() {
      try {
        const res = await fetch("/api/fx", { cache: "default" });
        if (!res.ok) return;
        const data = (await res.json()) as FxSnapshot;
        if (mounted) setSnapshot(data);
      } catch {
        // silent — Price renders as-is
      } finally {
        if (mounted) setLoading(false);
      }
    }
    refresh();
    const t = setInterval(refresh, 60 * 60 * 1000); // 1h
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, []);

  function setCurrency(c: Currency) {
    setCurrencyState(c);
    try {
      localStorage.setItem(STORAGE_KEY, c);
    } catch {}
    window.dispatchEvent(new CustomEvent("iwr-currency-changed", { detail: c }));
  }

  return (
    <FxContext.Provider value={{ currency, setCurrency, snapshot, loading }}>
      {children}
    </FxContext.Provider>
  );
}

export function useFx() {
  return useContext(FxContext);
}

/**
 * Inline price renderer. Takes an AED amount, converts to current currency,
 * formats with locale + symbol. Falls through to formatted AED if FX not ready.
 *
 * <Price amount={3_250_000} /> → "$884K" (when USD selected)
 */
export function Price({
  amount,
  compact,
  className = "",
}: {
  amount: number;
  compact?: boolean;
  className?: string;
}) {
  const { currency, snapshot } = useFx();
  let display: string;
  if (!snapshot) {
    display = formatCurrency(amount, "AED", { compact });
  } else {
    const converted = convertAedTo(amount, currency, snapshot);
    display = formatCurrency(converted, currency, { compact });
  }
  return <span className={`tabular-nums ${className}`}>{display}</span>;
}

/** Header dropdown — pick the display currency for the whole site. */
export function CurrencyPicker({ className = "" }: { className?: string }) {
  const { currency, setCurrency, snapshot } = useFx();
  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <select
        value={currency}
        onChange={(e) => setCurrency(e.target.value as Currency)}
        aria-label="Display currency"
        className="bg-transparent text-xs font-mono uppercase tracking-[0.15em] border-b border-current/20 hover:border-current/40 cursor-pointer pr-1 py-0.5 outline-none"
        style={{ color: "var(--ink-soft)" }}
      >
        {Object.values(CURRENCY_META).map((c) => (
          <option key={c.code} value={c.code} className="text-black">
            {c.code} {c.symbol}
          </option>
        ))}
      </select>
      {snapshot?.source === "fallback" && (
        <span className="text-[9px] text-amber-700/70 uppercase font-mono" title="FX feed unavailable — showing snapshot rates">
          snap
        </span>
      )}
    </div>
  );
}
