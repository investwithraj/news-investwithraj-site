"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import InteractionAnalytics from "@/components/analytics/InteractionAnalytics";
import IwrMark from "@/components/brand/IwrMark";

import styles from "./NewsChrome.module.css";

const PRACTICE_URL =
  "https://investwithraj.com/engage?utm_source=news.investwithraj.com&utm_medium=nav&utm_campaign=editorial_to_advisory";
const BRIEF_URL =
  "https://investwithraj.com/brief?utm_source=news.investwithraj.com&utm_medium=directory&utm_campaign=editorial_to_advisory";
const WHATSAPP_URL =
  "https://wa.me/971589966085?text=Hello%20Raj%2C%20I%20came%20from%20Invest%20With%20Raj%20Intelligence.";

const primary = [
  { label: "Latest", href: "/" },
  { label: "News", href: "/news" },
  { label: "DLD pulse", href: "/news?desk=dld-pulse" },
  { label: "About", href: "/about" },
] as const;

const menuGroups = [
  {
    title: "The newsroom",
    links: [
      { label: "Latest intelligence", href: "/" },
      { label: "All news", href: "/news" },
      { label: "DLD pulse reports", href: "/news?desk=dld-pulse" },
    ],
  },
  {
    title: "Markets",
    links: [
      { label: "Browse archive filters", href: "/news" },
      {
        label: "Developer dossiers",
        href: "https://investwithraj.com/developers",
        external: true,
      },
    ],
  },
  {
    title: "Decision tools",
    links: [
      { label: "Ask Raj", href: "/ask" },
      { label: "Intelligence terminal", href: "/terminal" },
      { label: "RSS feed", href: "/rss.xml" },
    ],
  },
  {
    title: "Publication",
    links: [
      { label: "About", href: "/about" },
      { label: "Editorial standards", href: "/about/editorial-standards" },
      { label: "Privacy", href: "/legal/privacy" },
      {
        label: "Invest With Raj advisory",
        href: PRACTICE_URL,
        external: true,
      },
    ],
  },
  {
    title: "Raj's media",
    links: [
      {
        label: "Media room",
        href: "https://investwithraj.com/media",
        external: true,
      },
      {
        label: "Watch",
        href: "https://investwithraj.com/watch",
        external: true,
      },
      {
        label: "Podcast",
        href: "https://investwithraj.com/podcast",
        external: true,
      },
      {
        label: "Newsletter",
        href: "https://investwithraj.com/newsletter",
        external: true,
      },
      {
        label: "Press",
        href: "https://investwithraj.com/press",
        external: true,
      },
      {
        label: "Media kit",
        href: "https://investwithraj.com/press/media-kit",
        external: true,
      },
    ],
  },
] as const;

export default function NewsChrome() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const brandRef = useRef<HTMLAnchorElement>(null);
  const primaryNavRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const bookRef = useRef<HTMLAnchorElement>(null);
  const directoryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const menuTrigger = menuButtonRef.current;
    const previousOverflow = document.body.style.overflow;
    const previousDirectoryState = document.body.getAttribute(
      "data-news-directory-open",
    );
    window.dispatchEvent(new Event("iwr-news-directory-opening"));
    document.body.style.overflow = "hidden";
    document.body.setAttribute("data-news-directory-open", "true");

    const previousIsolation = new Map<
      HTMLElement,
      { inert: boolean; ariaHidden: string | null }
    >();
    const isolateElement = (element: Element | null) => {
      if (!(element instanceof HTMLElement) || previousIsolation.has(element)) {
        return;
      }
      previousIsolation.set(element, {
        inert: element.inert,
        ariaHidden: element.getAttribute("aria-hidden"),
      });
      element.inert = true;
      element.setAttribute("aria-hidden", "true");
    };
    const isolateBackground = () => {
      [
        brandRef.current,
        primaryNavRef.current,
        bookRef.current,
        document.getElementById("news-content"),
        document.querySelector("body > footer"),
        document.querySelector("[data-consent-layer]"),
      ].forEach(isolateElement);
    };

    isolateBackground();
    const backgroundObserver = new MutationObserver(isolateBackground);
    backgroundObserver.observe(document.body, { childList: true, subtree: true });

    const focusDirectory = window.requestAnimationFrame(() => {
      const firstLink = directoryRef.current?.querySelector<HTMLElement>(
        'a[href]:not([tabindex="-1"])',
      );
      (firstLink ?? directoryRef.current)?.focus();
    });

    const handleDirectoryKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }

      if (event.key !== "Tab") return;

      const directory = directoryRef.current;
      if (!menuTrigger || !directory) return;

      const directoryItems = Array.from(
        directory.querySelectorAll<HTMLElement>(
          'a[href]:not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"]), select:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      const focusable = [menuTrigger, ...directoryItems];
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

    window.addEventListener("keydown", handleDirectoryKeydown);
    return () => {
      window.cancelAnimationFrame(focusDirectory);
      backgroundObserver.disconnect();
      document.body.style.overflow = previousOverflow;
      if (previousDirectoryState === null) {
        document.body.removeAttribute("data-news-directory-open");
      } else {
        document.body.setAttribute(
          "data-news-directory-open",
          previousDirectoryState,
        );
      }
      window.removeEventListener("keydown", handleDirectoryKeydown);
      for (const [element, { inert, ariaHidden }] of previousIsolation) {
        element.inert = inert;
        if (ariaHidden === null) {
          element.removeAttribute("aria-hidden");
        } else {
          element.setAttribute("aria-hidden", ariaHidden);
        }
      }
      menuTrigger?.focus();
      window.dispatchEvent(new Event("iwr-consent-resume"));
    };
  }, [open]);

  if (pathname.startsWith("/internal")) return null;

  return (
    <>
      <InteractionAnalytics />
      <a className={styles.skip} href="#news-content">
        Skip to the intelligence
      </a>
      <header className={styles.chrome}>
        <Link
          ref={brandRef}
          href="/"
          className={styles.brand}
          aria-label="Invest With Raj Intelligence home"
          data-cta-level="3"
          data-cta-action="editorial"
          data-cta-source="news-navigation"
        >
          <IwrMark
            className={styles.brandMark}
            surface="dark"
            decorative
            priority
          />
          <span className={styles.brandCopy}>
            <b>Invest With Raj</b>
            <i>Daily Real Estate Intelligence</i>
          </span>
        </Link>

        <nav
          ref={primaryNavRef}
          className={styles.nav}
          aria-label="News desk"
          data-site-nav="news"
        >
          {primary.map((link) => {
            const active =
              link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);

            return (
              <Link
                href={link.href}
                key={link.href}
                aria-current={active ? "page" : undefined}
                data-cta-level="3"
                data-cta-action="editorial"
                data-cta-source="news-navigation"
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className={styles.actions}>
          <button
            ref={menuButtonRef}
            type="button"
            className={styles.menuButton}
            aria-label={open ? "Close site menu" : "Open site menu"}
            aria-expanded={open}
            aria-controls="news-directory"
            data-analytics-nav-toggle
            data-analytics-source="news-navigation"
            onClick={() => setOpen((current) => !current)}
          >
            <span>{open ? "Close" : "Menu"}</span>
            <i aria-hidden="true">
              <b />
              <b />
            </i>
          </button>
          <a
            ref={bookRef}
            className={styles.book}
            href={PRACTICE_URL}
            aria-label="Book a working call"
            rel="noopener noreferrer"
            data-cta-level="1"
            data-cta-action="book-call"
            data-cta-source="news-navigation"
          >
            <span className={styles.bookLong}>Book a working call</span>
            <span className={styles.bookShort}>Call</span>
            <span className={styles.bookArrow} aria-hidden="true">↗</span>
          </a>
        </div>
      </header>

      <div
        ref={directoryRef}
        className={`${styles.directory} ${open ? styles.directoryOpen : ""}`}
        id="news-directory"
        role="dialog"
        aria-modal="true"
        aria-labelledby="news-directory-title"
        aria-hidden={!open}
        data-site-directory
        tabIndex={-1}
        onClick={(event) => {
          if ((event.target as Element).closest("a[href]")) setOpen(false);
        }}
      >
        <div className={styles.directoryInner}>
          <div className={styles.directoryIntro}>
            <p>Invest With Raj · Daily Intelligence</p>
            <h2 id="news-directory-title">
              Read the market from every useful angle.
            </h2>
            <span>Source-cited UAE real estate reporting and decision tools.</span>
          </div>

          <nav className={styles.menuGroups} aria-label="Complete news directory">
            {menuGroups.map((group) => (
              <div className={styles.menuGroup} key={group.title}>
                <h3>{group.title}</h3>
                {group.links.map((link) =>
                  "external" in link ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      tabIndex={open ? 0 : -1}
                      key={link.label}
                      data-cta-level="3"
                      data-cta-action="editorial"
                      data-cta-source="news-directory"
                    >
                      <span>{link.label}</span>
                      <i aria-hidden="true">↗</i>
                    </a>
                  ) : (
                    <Link
                      href={link.href}
                      tabIndex={open ? 0 : -1}
                      key={link.label}
                      data-cta-level="3"
                      data-cta-action="editorial"
                      data-cta-source="news-directory"
                    >
                      <span>{link.label}</span>
                      <i aria-hidden="true">→</i>
                    </Link>
                  ),
                )}
              </div>
            ))}
          </nav>

          <div className={styles.directoryBase}>
            <a
              href={BRIEF_URL}
              rel="noopener noreferrer"
              tabIndex={open ? 0 : -1}
              data-cta-level="2"
              data-cta-action="start-brief"
              data-cta-source="news-directory"
            >
              Start your written brief
            </a>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              tabIndex={open ? 0 : -1}
              data-cta-level="2"
              data-cta-action="whatsapp"
              data-cta-source="news-directory"
            >
              WhatsApp Raj
            </a>
            <a
              href="mailto:office@investwithraj.com"
              tabIndex={open ? 0 : -1}
              data-cta-level="2"
              data-cta-action="direct-contact"
              data-cta-source="news-directory"
            >
              office@investwithraj.com
            </a>
            <span>Dubai · GMT+4</span>
            <span>News, analysis and advisory—connected.</span>
          </div>
        </div>
      </div>
    </>
  );
}
