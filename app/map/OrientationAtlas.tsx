"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import styles from "./map.module.css";

export interface AtlasArea {
  slug: string;
  name: string;
  emirate: "Dubai" | "Abu Dhabi" | "Ras Al Khaimah";
  kind: string;
  lat: number;
  lng: number;
}

const BOUNDS = {
  minLat: 24.25,
  maxLat: 25.82,
  minLng: 54.15,
  maxLng: 55.95,
};

function project(area: AtlasArea) {
  const x =
    ((area.lng - BOUNDS.minLng) / (BOUNDS.maxLng - BOUNDS.minLng)) * 100;
  const y =
    100 -
    ((area.lat - BOUNDS.minLat) / (BOUNDS.maxLat - BOUNDS.minLat)) * 100;
  return {
    x: Math.min(97, Math.max(3, x)),
    y: Math.min(94, Math.max(6, y)),
  };
}

export default function OrientationAtlas({ areas }: { areas: AtlasArea[] }) {
  const [emirate, setEmirate] = useState("All");
  const [kind, setKind] = useState("All");
  const [selectedSlug, setSelectedSlug] = useState(areas[0]?.slug ?? "");

  const emirates = useMemo(
    () => Array.from(new Set(areas.map((area) => area.emirate))),
    [areas],
  );
  const kinds = useMemo(
    () =>
      Array.from(new Set(areas.map((area) => area.kind))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [areas],
  );
  const filtered = useMemo(
    () =>
      areas.filter(
        (area) =>
          (emirate === "All" || area.emirate === emirate) &&
          (kind === "All" || area.kind === kind),
      ),
    [areas, emirate, kind],
  );
  const selected =
    filtered.find((area) => area.slug === selectedSlug) ?? filtered[0] ?? null;

  return (
    <div className={styles.atlasTool}>
      <div className={styles.filters} aria-label="Filter area index">
        <label>
          <span>Emirate</span>
          <select
            value={emirate}
            onChange={(event) => setEmirate(event.target.value)}
          >
            <option>All</option>
            {emirates.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Area type</span>
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value)}
          >
            <option>All</option>
            {kinds.map((item) => (
              <option key={item} value={item}>
                {item.replaceAll("-", " ")}
              </option>
            ))}
          </select>
        </label>
        <p aria-live="polite">
          {filtered.length} {filtered.length === 1 ? "area" : "areas"} shown
        </p>
      </div>

      <div className={styles.atlasLayout}>
        <div className={styles.plot}>
          <svg
            viewBox="0 0 1000 620"
            aria-hidden="true"
            focusable="false"
          >
            <rect width="1000" height="620" className={styles.plotGround} />
            {Array.from({ length: 9 }).map((_, index) => (
              <line
                key={`vertical-${index}`}
                x1={(index + 1) * 100}
                x2={(index + 1) * 100}
                y1="0"
                y2="620"
                className={styles.gridLine}
              />
            ))}
            {Array.from({ length: 5 }).map((_, index) => (
              <line
                key={`horizontal-${index}`}
                x1="0"
                x2="1000"
                y1={(index + 1) * 103}
                y2={(index + 1) * 103}
                className={styles.gridLine}
              />
            ))}
            <path
              d="M75 510 C210 390 300 390 420 300 S650 210 910 105"
              className={styles.coastline}
            />
            <text x="118" y="505" className={styles.plotLabel}>
              ABU DHABI
            </text>
            <text x="566" y="250" className={styles.plotLabel}>
              DUBAI
            </text>
            <text x="815" y="95" className={styles.plotLabel}>
              RAS AL KHAIMAH
            </text>
          </svg>

          {filtered.map((area) => {
            const point = project(area);
            const isSelected = selected?.slug === area.slug;
            return (
              <button
                key={area.slug}
                type="button"
                className={`${styles.node} ${
                  isSelected ? styles.nodeSelected : ""
                }`}
                style={{ left: `${point.x}%`, top: `${point.y}%` }}
                onClick={() => setSelectedSlug(area.slug)}
                aria-label={`Select ${area.name}, ${area.emirate}`}
                aria-pressed={isSelected}
              >
                <span aria-hidden />
                <small>{area.name}</small>
              </button>
            );
          })}
        </div>

        <aside className={styles.selection} aria-live="polite">
          {selected ? (
            <>
              <p>Selected area</p>
              <h3>{selected.name}</h3>
              <dl>
                <div>
                  <dt>Emirate</dt>
                  <dd>{selected.emirate}</dd>
                </div>
                <div>
                  <dt>Area type</dt>
                  <dd>{selected.kind.replaceAll("-", " ")}</dd>
                </div>
                <div>
                  <dt>Coordinates</dt>
                  <dd>
                    {selected.lat.toFixed(4)}, {selected.lng.toFixed(4)}
                  </dd>
                </div>
              </dl>
              <Link href={`/areas/${selected.slug}`}>Open area guide ↗</Link>
            </>
          ) : (
            <>
              <p>No matching areas</p>
              <h3>Adjust the filters to continue.</h3>
            </>
          )}
        </aside>
      </div>

      <div
        className={styles.tableWrap}
        role="region"
        aria-label="Filtered area index table"
        tabIndex={0}
      >
        <table>
          <caption>
            Text equivalent of the orientation atlas. Select an area or open
            its guide.
          </caption>
          <thead>
            <tr>
              <th scope="col">Area</th>
              <th scope="col">Emirate</th>
              <th scope="col">Type</th>
              <th scope="col">Coordinates</th>
              <th scope="col">Guide</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((area) => (
              <tr key={`table-${area.slug}`}>
                <th scope="row">
                  <button
                    type="button"
                    onClick={() => setSelectedSlug(area.slug)}
                    aria-pressed={selected?.slug === area.slug}
                  >
                    {area.name}
                  </button>
                </th>
                <td>{area.emirate}</td>
                <td>{area.kind.replaceAll("-", " ")}</td>
                <td>
                  {area.lat.toFixed(4)}, {area.lng.toFixed(4)}
                </td>
                <td>
                  <Link href={`/areas/${area.slug}`}>Open ↗</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
