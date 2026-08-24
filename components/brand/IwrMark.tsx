import Image from "next/image";

import { IWR_BRAND_ASSETS, IWR_BRAND_VERSION } from "./brand-assets";
import styles from "./BrandMarks.module.css";

type IwrMarkProps = Readonly<{
  surface?: "light" | "dark";
  className?: string;
  decorative?: boolean;
  label?: string;
  priority?: boolean;
}>;

export default function IwrMark({
  surface = "light",
  className,
  decorative = false,
  label = "Invest With Raj",
  priority = false,
}: IwrMarkProps) {
  const asset =
    surface === "dark" ? IWR_BRAND_ASSETS.knockout : IWR_BRAND_ASSETS.color;

  return (
    <span
      className={className ? `${styles.mark} ${className}` : styles.mark}
      aria-hidden={decorative ? "true" : undefined}
      data-iwr-brand-version={IWR_BRAND_VERSION}
      data-iwr-logo-surface={surface}
    >
      <Image
        className={styles.image}
        src={asset}
        width={1280}
        height={640}
        alt={decorative ? "" : label}
        preload={priority}
        unoptimized
        draggable={false}
      />
    </span>
  );
}
