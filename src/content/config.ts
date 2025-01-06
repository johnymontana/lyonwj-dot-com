import { defineCollection, z } from "astro:content";
const store = defineCollection({
  schema: z.object({
    title: z.string(),
    price: z.number(),
    preview: z.string(),
    checkout: z.string(),
    license: z.string(),
    highlights: z.array(z.string()),
    description: z.string(),
    image: z.object({
      url: z.string(),
      alt: z.string(),
    }),
  }),
});
const projects = defineCollection({
  schema: z.object({
    pubDate: z.date(),
    title: z.string(),
    subtitle: z.string(),
    live: z.string(),
    image: z.object({
      url: z.string(),
      alt: z.string(),
    }),
  }),
});
const authors = defineCollection({
  schema: z.object({
    title: z.string(),
    images: z.array(
      z.object({
        url: z.string(),
        alt: z.string(),
        name: z.string(),
        description: z.string(),
      })
    ),
  }),
});
const infopages = defineCollection({
  schema: z.object({
    page: z.string(),
    pubDate: z.date(),
  }),
});
const postsCollection = defineCollection({
  schema: z.object({
    title: z.string(),
    pubDate: z.date(),
    description: z.string(),
    author: z.string(),
    image: z.object({
      url: z.string(),
      alt: z.string(),
    }),
    avatar: z.object({
      url: z.string(),
      alt: z.string(),
    }),
    tags: z.array(z.string()),
  }),
});
export const collections = {
  store: store,
  projects: projects,
  authors: authors,
  infopages: infopages,
  posts: postsCollection,
};
