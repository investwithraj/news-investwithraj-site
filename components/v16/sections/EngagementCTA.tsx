"use client";

import { useState } from "react";
import CTAPill from "@/components/v16/CTAPill";
import GlassCard from "@/components/v16/GlassCard";
import { CONTACT } from "@/lib/constants";

const waUrl = (message: string) =>
  `https://wa.me/${CONTACT.whatsappE164}?text=${encodeURIComponent(message)}`;

/**
 * v16 EngagementCTA — homepage closing CTA room.
 *
 * Three engagement tracks (Brandly pattern):
 *   1. Direct call (Cal.com or email)
 *   2. WhatsApp (immediate)
 *   3. Email the Note (form)
 *
 * Wires to the existing /api/lead endpoint. Voice-locked WhatsApp redirect
 * after success. Sound effects gated by AmbientAudio (lib/audio.ts).
 */
type Status = "idle" | "submitting" | "success" | "error";

export default function EngagementCTA() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [mandate, setMandate] = useState("general");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "submitting") return;
    setStatus("submitting");
    setErrorMsg("");

    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          source: `v16-engagement-${mandate}`,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Submission failed.");
      }
      setStatus("success");
      setTimeout(() => {
        window.location.href = waUrl(
          "Hi Raj, I just requested the latest Note via the site."
        );
      }, 1000);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  const isLocked = status === "submitting" || status === "success";

  return (
    <section
      id="engage"
      style={{
        padding: "120px 24px",
        background: "var(--v16-paper)",
      }}
    >
      <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "64px" }}>
          <p className="v16-mono" style={{ marginBottom: "16px", display: "inline-flex", justifyContent: "center" }}>
            05 · Engage
          </p>
          <h2
            className="v16-h2"
            style={{
              margin: "0 auto 24px",
              maxWidth: "18ch",
              fontSize: "clamp(2.5rem, 5vw, 5rem)",
            }}
          >
            Three ways in.{" "}
            <span className="v16-h1-italic" style={{ color: "var(--v16-brass)" }}>
              Pick yours.
            </span>
          </h2>
          <p
            className="v16-body"
            style={{
              maxWidth: "56ch",
              margin: "0 auto",
              fontSize: "1.075rem",
              color: "var(--v16-ink-soft)",
            }}
          >
            Book a 30-minute call, WhatsApp directly, or request the latest Note
            by email. Raj responds personally within two hours during Dubai
            business hours.
          </p>
        </div>

        {/* Three tracks */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "20px",
          }}
          className="v16-engage-grid"
        >
          {/* Track 1: Call */}
          <GlassCard padding="lg">
            <p className="v16-mono" style={{ marginBottom: "12px" }}>
              01 · Direct
            </p>
            <h3 className="v16-h3" style={{ marginBottom: "12px" }}>
              Book a 30-min call
            </h3>
            <p
              className="v16-body"
              style={{
                marginBottom: "32px",
                fontSize: "0.95rem",
                color: "var(--v16-ink-muted)",
              }}
            >
              Pick a time that works. Calendar live, no back-and-forth.
            </p>
            <CTAPill variant="paper" size="md" href="mailto:office@investwithraj.com?subject=Book%20a%20call">
              Email to schedule
            </CTAPill>
          </GlassCard>

          {/* Track 2: WhatsApp */}
          <GlassCard padding="lg">
            <p className="v16-mono" style={{ marginBottom: "12px" }}>
              02 · Immediate
            </p>
            <h3 className="v16-h3" style={{ marginBottom: "12px" }}>
              WhatsApp Raj
            </h3>
            <p
              className="v16-body"
              style={{
                marginBottom: "32px",
                fontSize: "0.95rem",
                color: "var(--v16-ink-muted)",
              }}
            >
              Typically responds within 30 minutes during Dubai business hours.
            </p>
            <CTAPill
              variant="graphite"
              size="md"
              href={waUrl("Hi Raj, I'd like to talk about UAE real estate.")}
            >
              Open WhatsApp
            </CTAPill>
          </GlassCard>

          {/* Track 3: Form */}
          <GlassCard padding="lg">
            <p className="v16-mono" style={{ marginBottom: "12px" }}>
              03 · By email
            </p>
            <h3 className="v16-h3" style={{ marginBottom: "12px" }}>
              Request the Note
            </h3>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Full name"
                required
                disabled={isLocked}
                autoComplete="name"
                style={inputStyle}
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                required
                disabled={isLocked}
                autoComplete="email"
                style={inputStyle}
              />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone (with country code)"
                required
                disabled={isLocked}
                autoComplete="tel"
                style={inputStyle}
              />
              <select
                value={mandate}
                onChange={(e) => setMandate(e.target.value)}
                disabled={isLocked}
                aria-label="Mandate interest"
                style={inputStyle}
              >
                <option value="general">General — not sure yet</option>
                <option value="buying">Buying</option>
                <option value="selling">Selling</option>
                <option value="investing">Investing</option>
                <option value="research">Research only</option>
              </select>
              <CTAPill
                variant="graphite"
                size="md"
                disabled={isLocked}
                onClick={() => undefined}
                arrow={!isLocked}
              >
                {status === "submitting"
                  ? "Sending…"
                  : status === "success"
                  ? "Redirecting…"
                  : "Send me the Note"}
              </CTAPill>
              <button type="submit" style={{ display: "none" }} aria-hidden="true">submit</button>
              {status === "error" && (
                <p
                  role="alert"
                  className="v16-mono"
                  style={{ color: "#E11D48", fontSize: "0.6875rem" }}
                >
                  {errorMsg}
                </p>
              )}
            </form>
          </GlassCard>
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 1024px) {
          .v16-engage-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </section>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 0",
  background: "transparent",
  border: "none",
  borderBottom: "1px solid var(--v16-chrome-deep)",
  fontFamily: "var(--v16-font-body), system-ui, sans-serif",
  fontSize: "0.95rem",
  color: "var(--v16-ink)",
  outline: "none",
};
