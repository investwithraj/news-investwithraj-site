"use client";

import styles from "./Privacy.module.css";

export default function PrivacyControls() {
  return (
    <button
      type="button"
      className={styles.manage}
      onClick={() =>
        window.dispatchEvent(new CustomEvent("iwr-consent-reopen"))
      }
    >
      Review or change privacy choices
    </button>
  );
}
