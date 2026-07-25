import Link from "next/link";

const PRACTICE_URL =
  "https://investwithraj.com/?utm_source=news.investwithraj.com&utm_medium=footer&utm_campaign=organic-authority";

export default function EditorialFooter() {
  return (
    <footer
      style={{
        borderTop: "1px solid rgba(242, 238, 231, 0.12)",
        background: "#141414",
        color: "#F2EEE7",
      }}
    >
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-6 px-6 py-8 md:flex-row md:items-center md:justify-between md:px-10">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#C9A961]">
            Invest With Raj · Daily Market Read
          </p>
          <p className="mt-2 max-w-[52ch] text-sm leading-6 text-[rgba(242,238,231,.62)]">
            Source-cited UAE property intelligence, connected to Raj&apos;s
            advisory practice.
          </p>
        </div>

        <nav
          aria-label="Publication information"
          className="flex flex-wrap gap-x-5 gap-y-3 font-mono text-[10px] uppercase tracking-[0.16em] text-[rgba(242,238,231,.72)]"
        >
          <Link href="/about">About</Link>
          <Link href="/about/editorial-standards">Editorial standards</Link>
          <a href="https://investwithraj.com/legal/privacy">Privacy</a>
          <a href={PRACTICE_URL}>Book a call ↗</a>
        </nav>
      </div>
    </footer>
  );
}
