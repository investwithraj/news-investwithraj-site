import Link from "next/link";

import styles from "./NotFound.module.css";

export default function NotFound() {
  return (
    <main id="main" className={styles.page}>
      <div className={styles.grid} aria-hidden="true" />
      <div className={styles.frame}>
        <p className={styles.eyebrow}>404 · Route not found</p>
        <h1>This page is not in the brief.</h1>
        <p className={styles.copy}>
          Return to the latest source-linked intelligence or browse the complete
          reporting archive.
        </p>
        <div className={styles.actions}>
          <Link href="/">Latest intelligence <span aria-hidden="true">↗</span></Link>
          <Link href="/news">Reporting archive <span aria-hidden="true">→</span></Link>
        </div>
      </div>
    </main>
  );
}
