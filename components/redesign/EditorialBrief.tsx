import Image from "next/image";
import Link from "next/link";
import { Fragment } from "react";
import type { NewsArticle } from "@/content/news/types";
import { categoryLabel, hasVerifiedEditorialImage, readingMinutes } from "@/lib/news-editorial";
import { EDITORIAL } from "@/lib/constants";
import styles from "./EditorialBrief.module.css";

export default function EditorialBrief({ article }: { article: NewsArticle }) {
  const brief = article.brief!;
  return <main id="main" className={styles.page}>
    <div className={styles.wrap}>
      <Link className={styles.back} href="/news">← All news</Link>
      <article>
        <header className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>{article.market.join(" / ")} · {categoryLabel(article.category)}</p>
            <h1>{article.title}</h1>
            <p className={styles.dek}>{article.subtitle}</p>
            <div className={styles.byline}><a href={EDITORIAL.bylineUrl}>IWR News</a><time dateTime={article.publishedAt}>{article.displayDate}</time><span>{readingMinutes(article)} min read</span></div>
          </div>
          {hasVerifiedEditorialImage(article) ? <figure>
            <Image src={article.heroImage.src} alt={article.heroImage.alt} width={article.heroImage.width!} height={article.heroImage.height!} priority sizes="(max-width: 760px) 92vw, 44vw" />
            <figcaption>{article.heroImage.credit}{article.heroImage.licenceUrl ? <> · <a href={article.heroImage.sourceUrl} target="_blank" rel="noopener noreferrer">Source</a> · <a href={article.heroImage.licenceUrl} target="_blank" rel="noopener noreferrer">Licence</a> · Resized; original framing retained.</> : null}</figcaption>
          </figure> : null}
        </header>
        {brief.figures ? <div className={styles.figures}>{brief.figures.map(figure=><div key={figure.label}><strong>{figure.value}</strong><span>{figure.label}</span></div>)}</div> : null}
        <div className={styles.reading}>
          <aside><h2>The investor question</h2><p>{brief.note || "What does this announcement change for the place, project or commitment you are considering?"}</p></aside>
          <div className={`${styles.body} article-body`}>
            {article.body.split(/\n\n+/).map((paragraph,index)=><Fragment key={index}>{brief.headings?.filter(heading=>heading.beforeParagraph===index).map(heading=><h2 key={heading.title}>{heading.title}</h2>)}<p>{paragraph}</p></Fragment>)}
            <div className={styles.sources}><strong>Source</strong>{article.citations.map(citation=><a key={citation.url} href={citation.url} target="_blank" rel="noopener noreferrer">{citation.source} ↗</a>)}</div>
          </div>
        </div>
        {brief.related ? <section className={styles.related}><div><p>Go deeper</p><h2>{brief.related.title}</h2></div><a href={brief.related.href}>{brief.related.label} ↗</a></section> : null}
        <nav className={styles.closing} aria-label="Next steps"><Link href="/news">More UAE real estate news</Link><a href={article.cta.href}>{article.cta.label} ↗</a></nav>
      </article>
    </div>
  </main>;
}
