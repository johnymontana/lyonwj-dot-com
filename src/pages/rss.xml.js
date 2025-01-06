import rss, { pagesGlobToRssItems } from "@astrojs/rss";
export async function GET(context) {
  return rss({
    title: "William Lyon",
    description: "Software, technology, startups, etc. ",
    site: context.site,
    items: await pagesGlobToRssItems(import.meta.glob("./blog/*.{md,mdx}")),
  });
}
