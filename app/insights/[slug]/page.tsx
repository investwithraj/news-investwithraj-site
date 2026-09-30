import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Markdown from "react-markdown";
import { getAllInsightSlugs, getInsightBySlug } from "@/content/insights";
import styles from "./edition.module.css";

const hub = "https://www.investwithraj.com/newsletter";
const subscribe = "https://www.linkedin.com/build-relation/newsletter-follow?entityUrn=7363172445052170241";
export const dynamicParams = false;
export function generateStaticParams() { return getAllInsightSlugs().map(slug => ({ slug })); }
export async function generateMetadata({params}: {params: Promise<{slug:string}>}): Promise<Metadata> {
  const a = getInsightBySlug((await params).slug);
  if (!a) return {title: "Edition not found"};
  const url = `https://news.investwithraj.com/insights/${a.slug}`;
  return { title: `${a.title} · Beyond the Deal`, description: a.subtitle,
    alternates: {canonical: a.linkedinUrl || url},
    openGraph: { type: "article", title: a.title, description: a.subtitle, url, publishedTime: a.publishedAt, modifiedTime: a.modifiedAt, authors: ["Raj Tomar"], images: [{url:a.heroImage.src,width:2400,height:1200,alt:a.heroImage.alt}] },
    twitter: {card:"summary_large_image",title:a.title,description:a.subtitle,images:[a.heroImage.src]},
  };
}
export default async function Edition({params}: {params:Promise<{slug:string}>}) {
  const a = getInsightBySlug((await params).slug);
  if (!a) notFound();
  const schema = {"@context":"https://schema.org","@type":"Article",headline:a.title,description:a.subtitle,datePublished:a.publishedAt,dateModified:a.modifiedAt,author:{"@type":"Person",name:"Raj Tomar",url:"https://www.investwithraj.com/about"},image:`https://news.investwithraj.com${a.heroImage.src}`,mainEntityOfPage:a.linkedinUrl || `https://news.investwithraj.com/insights/${a.slug}`,isPartOf:{"@type":"CreativeWorkSeries",name:"Beyond the Deal",url:hub}};
  return <main className={styles.page}>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema).replace(/</g,"\\u003c")}} />
    <header className={styles.heading}>
      <a className={styles.series} href={hub}>Beyond the Deal ↗</a>
      <p className={styles.meta}>Raj Tomar · <time dateTime={a.publishedAt}>{a.displayDate}</time> · {a.readTimeMin} min read</p>
      <h1>{a.title}</h1><p className={styles.dek}>{a.subtitle}</p>
    </header>
    <figure className={styles.hero}><Image src={a.heroImage.src} alt={a.heroImage.alt} width={2400} height={1200} sizes="(max-width: 768px) 100vw, 1200px" priority /><figcaption>{a.heroImage.credit}</figcaption></figure>
    <article className={styles.body}><Markdown>{a.body}</Markdown></article>
    <aside className={styles.references} aria-label="Further reading"><h2>Further reading</h2>{a.citations.map(c=><a href={c.url} key={c.url} target="_blank" rel="noopener noreferrer">{c.source} ↗</a>)}</aside>
    <section className={styles.subscribe}><div><p className={styles.series}>A letter every week</p><h2>Stay with the longer story.</h2><p>Ownership, neighbourhoods and the decisions behind UAE real estate.</p></div><div className={styles.actions}><a href={subscribe}>Subscribe on LinkedIn ↗</a>{a.linkedinUrl && <a href={a.linkedinUrl}>Read this edition on LinkedIn ↗</a>}<a href={hub}>Browse previous editions →</a><a href={a.cta.href}>{a.cta.label} →</a></div></section>
  </main>;
}
