"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import styles from "./NewsFooter.module.css";

const PRACTICE_URL =
  "https://investwithraj.com/engage?utm_source=news.investwithraj.com&utm_medium=footer&utm_campaign=editorial_to_advisory";
const BRIEF_URL =
  "https://investwithraj.com/brief?utm_source=news.investwithraj.com&utm_medium=footer&utm_campaign=editorial_to_advisory";
const WHATSAPP_URL =
  "https://wa.me/971589966085?text=Hello%20Raj%2C%20I%20came%20from%20Invest%20With%20Raj%20Intelligence.";

const groups = [
  {
    title: "Newsroom",
    links: [
      { label: "Latest", href: "/" },
      { label: "All news", href: "/news" },
      { label: "Market pulse", href: "/pulse" },
    ],
  },
  {
    title: "Market intelligence",
    links: [
      { label: "Areas", href: "/areas" },
      { label: "Developers", href: "/developers" },
      { label: "Live map", href: "/map" },
      { label: "Spatial view", href: "/spatial" },
    ],
  },
  {
    title: "Decision tools",
    links: [
      { label: "Ask Raj", href: "/ask" },
      { label: "Terminal", href: "/terminal" },
      { label: "RSS", href: "/rss.xml" },
    ],
  },
  {
    title: "Publication",
    links: [
      { label: "About", href: "/about" },
      { label: "Editorial standards", href: "/about/editorial-standards" },
      { label: "Privacy", href: "/legal/privacy" },
      {
        label: "Corrections",
        href: "mailto:office@investwithraj.com?subject=Correction%20request",
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

export default function NewsFooter() {
  const pathname = usePathname();
  if (pathname.startsWith("/internal")) return null;

  return (
    <footer className={styles.footer} data-site-footer="news">
      <div className={styles.frame}>
        <div className={styles.callout}>
          <div>
            <p>From intelligence to action</p>
            <h2>
              Read the market.
              <br />
              Then decide.
            </h2>
          </div>
          <div className={styles.calloutActions}>
            <a
              href={PRACTICE_URL}
              rel="noopener noreferrer"
              className={styles.calloutLink}
              data-cta-level="1"
              data-cta-action="book-call"
              data-cta-source="news-footer"
            >
              <span>Book a working call with Raj</span>
              <span aria-hidden="true">↗</span>
            </a>
            <div className={styles.secondaryActions}>
              <a
                href={BRIEF_URL}
                rel="noopener noreferrer"
                data-cta-level="2"
                data-cta-action="start-brief"
                data-cta-source="news-footer"
              >
                Start a written brief
              </a>
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                data-cta-level="2"
                data-cta-action="whatsapp"
                data-cta-source="news-footer"
              >
                WhatsApp
              </a>
            </div>
          </div>
        </div>

        <div className={styles.directory}>
          <div className={styles.identity}>
            <Link
              href="/"
              className={styles.brand}
              data-cta-level="3"
              data-cta-action="editorial"
              data-cta-source="news-footer"
            >
              <span>Invest With Raj</span>
              <strong>Intelligence.</strong>
            </Link>
            <p>
              Independent UAE property reporting, analysis and decision
              intelligence from Raj Tomar.
            </p>
            <a
              href="mailto:office@investwithraj.com"
              data-cta-level="2"
              data-cta-action="direct-contact"
              data-cta-source="news-footer"
            >
              office@investwithraj.com
            </a>
          </div>

          <nav className={styles.groups} aria-label="News footer">
            {groups.map((group) => (
              <div className={styles.group} key={group.title}>
                <h3>{group.title}</h3>
                {group.links.map((link) =>
                  "external" in link ? (
                    <a
                      href={link.href}
                      key={link.label}
                      target={
                        link.href.startsWith("http") ? "_blank" : undefined
                      }
                      rel={
                        link.href.startsWith("http")
                          ? "noopener noreferrer"
                          : undefined
                      }
                      data-cta-level="3"
                      data-cta-action="editorial"
                      data-cta-source="news-footer"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      href={link.href}
                      key={link.label}
                      data-cta-level="3"
                      data-cta-action="editorial"
                      data-cta-source="news-footer"
                    >
                      {link.label}
                    </Link>
                  ),
                )}
              </div>
            ))}
          </nav>
        </div>

        <div className={styles.base}>
          <span>© {new Date().getFullYear()} Invest With Raj Intelligence</span>
          <span>Independent · Dubai · GMT+4</span>
          <div>
            <a
              href={PRACTICE_URL}
              rel="noopener noreferrer"
              data-cta-level="3"
              data-cta-action="editorial"
              data-cta-source="news-footer"
            >
              Advisory ↗
            </a>
            <a
              href="/sitemap.xml"
              data-cta-level="3"
              data-cta-action="editorial"
              data-cta-source="news-footer"
            >
              Sitemap
            </a>
            <a
              href="/rss.xml"
              data-cta-level="3"
              data-cta-action="editorial"
              data-cta-source="news-footer"
            >
              RSS
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
