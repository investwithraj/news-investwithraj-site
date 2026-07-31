import { newsWebsiteRef } from "./website";

export type CollectionItem = {
  name: string;
  url: string;
  description?: string;
};

export function collectionPageSchemas(input: {
  url: string;
  name: string;
  description: string;
  items: CollectionItem[];
  dateModified?: string;
  itemListOrder?: "ascending" | "descending" | "unordered";
}): [Record<string, unknown>, Record<string, unknown>] {
  const pageId = `${input.url}#collection`;
  const listId = `${input.url}#items`;

  return [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "@id": pageId,
      url: input.url,
      name: input.name,
      description: input.description,
      inLanguage: "en-AE",
      isPartOf: newsWebsiteRef,
      mainEntity: { "@id": listId },
      ...(input.dateModified ? { dateModified: input.dateModified } : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "@id": listId,
      numberOfItems: input.items.length,
      itemListOrder: `https://schema.org/ItemListOrder${
        input.itemListOrder === "ascending"
          ? "Ascending"
          : input.itemListOrder === "descending"
            ? "Descending"
            : "Unordered"
      }`,
      itemListElement: input.items.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
        url: item.url,
        ...(item.description ? { description: item.description } : {}),
      })),
    },
  ];
}

export function newsImageObjectSchema(input: {
  pageUrl: string;
  imageUrl: string;
  caption?: string;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ImageObject",
    "@id": `${input.pageUrl}#primaryimage`,
    contentUrl: input.imageUrl,
    url: input.imageUrl,
    ...(input.caption ? { caption: input.caption } : {}),
  };
}
