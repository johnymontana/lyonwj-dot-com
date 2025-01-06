---
title: "Building A GraphQL Server With Next.js"
pubDate: 2021-07-27
description: "Using Next.js API Routes And Deploying To Vercel & Neo4j Aura"
image:
  url: "/images/blog/graphql-server-nextjs/banner.png"
  alt: "Building A GraphQL Server With Next.js"
author: William Lyon
tags: ["GraphQL", "Next.js", "Cloud", "Neo4j"]
avatar:
  url: "/images/will.jpeg"
  alt: "#_"
---

In the [previous post](https://lyonwj.com/blog/no-cost-data-scraping-github-actions-neo4j-aura) we started working with data from the Lobsters social news aggregator site in [Neo4j Aura](https://dev.neo4j.com/neo4j-aura) with the ultimate goal of building a fullstack application that allows us to explore the data as an interactive graph visualization. In this post we continue our journey toward that fullstack goal, focusing on getting our API layer up and running using Next.js API routes, the Neo4j GraphQL library, Vercel and Neo4j Aura.

We're building this application on the [Neo4j livestream](https://youtube.com/neo4j) so you can check out the video recording to accompany this blog post here:

<iframe
  width="560"
  height="315"
  src="https://www.youtube-nocookie.com/embed/XVhdpP2GtPQ?si=-ohnJRY9F9GcZmgE"
  title="YouTube video player"
  frameborder="0"
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
  referrerpolicy="strict-origin-when-cross-origin"
  allowfullscreen
></iframe>

## Interactive Graph Visualization With Neo4j Bloom

Our goal is to build a web application that will demonstrate the power of data visualization when using social network data to, in this case, help us discover interesting and relevant content. Before we dive into building our fullstack application it's worth exploring what sort of graph data visualization tooling is available to us out of the box with Neo4j.

Perhaps the most relevant tool we might consider is [Neo4j Bloom.](https://lyonwj.com/blog/election-night-dashboard-neo4j-charts-bloom-visualization) Bloom is included in Neo4j Aura and Neo4j Desktop and allows the user to explore the graph visually without writing Cypher. Bloom is a standalone application that enables users to search for patterns, filter, explore and share graph visualizations.

![Neo4j Bloom graph visualization](/images/blog/graphql-server-nextjs/bloom1.png)

While Bloom is a powerful tool for use with Neo4j, it's not quite what we want for this project as we want to build a most custom and bespoke experience. There are also other "graph apps" available in Neo4j Desktop, such as the Charts app and Neomap that we can use to build visualizations and dashboards. I covered these in a previous post: ["Building An Election Night Dashboard With Neo4j Graph Apps: Bloom, Charts, & Neomap".](https://lyonwj.com/blog/election-night-dashboard-neo4j-charts-bloom-visualization)

## Next.js

[Next.js](https://nextjs.org/) is a fullstack React framework built and maintained by [Vercel](https://vercel.com/). Next.js includes many features out of the box that we typically need to set up in React applications - things like file-system routing, server side rendering, API routes, etc - which means we can focus on building our application and not boilerplate setup and configuration.

We covered Next.js in [a previous blog post](https://lyonwj.com/blog/grandstack-podcast-app-next-js-graphql-authentication) so I won't go over all the features now, but I'm a big fan of Next.js and use it with most of my new projects now.

![Next.js features](/images/blog/graphql-server-nextjs/nextjs1.png)

### `create-next-app`

The easiest way to get started with Next.js is to use [the `create-next-app` CLI](https://nextjs.org/docs/api-reference/create-next-app). This is a command line tool that enables us to quickly start building a new Next.js application. We can use it to create a new skeleton Next.js project or select from many of the example Next.js projects.

Let's use this to start a new Next.js application in our Lobsters Graph repository:

```shell
npx create-next-app next
```

We can now navigate to the `next` directory, and run `yarn dev` to start a local web server serving our Next.js application. We should see something like this with some placeholder content:

![Next.js features](/images/blog/graphql-server-nextjs/nextjs2.png)

In this post we're going to focus on building the GraphQL API for our application, rather than the frontend so we won't cover anything React specific today. Instead, we'll be using Next.js' API Routes feature to build our GraphQL API.

## Next.js API Routes

Next.js has support for [creating API endpoints](https://nextjs.org/docs/api-routes/introduction) to add backend functionality to our Next.js application - it really is a fullstack framework after all. To create a new API route we just create a new file in `pages/api` that will be mapped to a new API endpoint.

The skeleton Next.js application we created with `create-next-app` includes an API route example in `pages/api/hello.js`:

```js
// Next.js API route support: https://nextjs.org/docs/api-routes/introduction

export default function handler(req, res) {
  res.status(200).json({ name: "John Doe" });
}
```

If we make a request to `localhost:3000/api/hello` we'll get back a simple JSON object:

```json
{
  "name": "John Doe"
}
```

Let's use this API route functionality to add a GraphQL endpoint to our Next.js application.

## Creating A GraphQL Server In A Next.js API Route

Following [the GraphQL example linked in the Next.js documentation](https://github.com/vercel/next.js/tree/canary/examples/api-routes-graphql), we'll use the `micro` package and `apollo-server-micro` to set up a simple GraphQL server as an API route.

First, we'll install the necessary dependencies:

```shell
yarn add apollo-server-micro micro graphql
```

Micro is an HTTP server that works well with Next.js and more importantly for our purposes has an Apollo Server implementation. To create a GraphQL server with Apollo Server we need to create two things: GraphQL type definitions that define the data available in the API, and GraphQL resolver functions that contain the logic for actually resolving GraphQL operations. Apollo Server takes these two inputs, combines them into an executable GraphQL schema and handles the HTTP network layer involved in serving a GraphQL API.

Let's create simple GraphQL type definitions and a single resolver function to get our API up and running as an API route:

```js
import { gql, ApolloServer } from "apollo-server-micro";

const typeDefs = gql`
  type User {
    id: ID
  }

  type Query {
    getUser: User
  }
`;

const resolvers = {
  Query: {
    getUser: () => {
      return {
        id: "Foo",
      };
    },
  },
};

const apolloServer = new ApolloServer({
  typeDefs,
  resolvers,
});

const startServer = apolloServer.start();

export default async function handler(req, res) {
  await startServer;
  await apolloServer.createHandler({
    path: "/api/graphql",
  })(req, res);
}

export const config = {
  api: {
    bodyParser: false,
  },
};
```

We define a single Query field `getUser` and a single `User` type that has only one field, `id` and a resolver function that returns a single hardcoded `User` object.

## Using GraphQL Playground With Apollo Server v3

In previous versions of Apollo Server by default the GraphQL Playground in-browser tool for exploring GraphQL APIs was available. However, GraphQL Playground has been deprecated for some time now and the latest release of Apollo Server, v3, instead links to the hosted Apollo Studio tool on the "landing page" of the GraphQL API (the page loaded when the GraphQL endpoint is loaded in a web browser).

Apollo Studio is great, but since we want this to be a public GraphQL API that anyone can explore I want GraphQL Playground to be served on the landing page. Fortunately, we can [enable GraphQL Playground as a plugin](https://www.apollographql.com/docs/apollo-server/migration/#graphql-playground) with Apollo Server 3 with these changes:

```js
import { ApolloServerPluginLandingPageGraphQLPlayground } from "apollo-server-core";

...

const apolloServer = new ApolloServer({
  typeDefs,
  resolvers,
  playground: true,
  plugins: [ApolloServerPluginLandingPageGraphQLPlayground()],
});
```

Now when we load `localhost:3000/graphql/api` in a web browser we should see the familiar GraphQL Playground tool. To verify that our GraphQL server is working properly we can run this query:

```graphql
{
  getUser {
    id
  }
}
```

And we should see the simple result returned by our `getUser` resolver function:

```json
{
  "data": {
    "getUser": {
      "id": "Foo"
    }
  }
}
```

Now let's update our GraphQL schema from the placeholder to one that models our Lobsters graph data and works with Neo4j.

## Using The Neo4j GraphQL Library

The [Neo4j GraphQL library](https://dev.neo4j.com/graphql) allows us to build Node.js GraphQL APIs backed by Neo4j without writing any resolvers. All we need to do is write GraphQL type definition that define the data model of our database and the Neo4j GraphQL library takes care of the rest - generating a full CRUD GraphQL API and resolvers and translating arbitrary GraphQL operations to database queries.

![The Neo4j GraphQL library](/images/blog/graphql-server-nextjs/neo4jgraphql1.png)

First, let's install a couple of additional dependencies, the Neo4j GraphQL library and the Neo4j JavaScript driver:

```shell
yarn add @neo4j/graphql neo4j-driver
```

Next, we'll need to create the GraphQL type definitions that map to the property graph model we're using for the Lobsters data. If we refer back to the [previous post](https://lyonwj.com/blog/no-cost-data-scraping-github-actions-neo4j-aura) we can use the graph data model diagram we created using the Arrows.app tool:

![Our data model using Arrows.app](/images/blog/data-scraping/datamodel.png)

The Neo4j GraphQL library uses the following conventions to map GraphQL type definitions to the property graph model:

- GraphQL types map to node labels in the property graph model
- GraphQL scalar fields map to node properties in the property graph model
- GraphQL object and object array fields map to relationships in the property graph model
- The `@relationship` directive is used in the GraphQL type definitions to encode the relationship type and direction in the property graph model

Applying these conventions we end up with the following GraphQL type definitions that map to our Lobsters property graph in Neo4j:

```graphql
type User {
  username: String
  created: DateTime
  karma: Int
  about: String
  avatar: String
  articles: [Article] @relationship(type: "SUBMITTED", direction: OUT)
  invited: [User] @relationship(type: "INVITED_BY", direction: IN)
  invited_by: [User] @relationship(type: "INVITED_BY", direction: OUT)
}

type Article {
  id: ID
  url: String
  score: Int
  title: String
  comments: String
  created: DateTime
  user: User @relationship(type: "SUBMITTED", direction: IN)
  tags: [Tag] @relationship(type: "HAS_TAG", direction: OUT)
}

type Tag {
  name: String
  articles: [Article] @relationship(type: "HAS_TAG", direction: IN)
}
```

Now we'll remove the resolver functions from our placeholder GraphQL schema since we don't need to write manual resolvers when using the Neo4j GraphQL library and replace our GraphQL type definitions with the ones we wrote above.

We'll also create a Neo4j JavaScript driver instance to connect to our Neo4j Aura database, using environment variables for the connection credentials and we'll pass our GraphQL type definitions to the `Neo4jGraphQL` class constructor to generate our GraphQL API.

We also make use of the [`@exclude` directive](https://neo4j.com/docs/graphql-manual/current/) in our GraphQL type definitions to prevent any mutations from being added to the schema - we want this to be a read-only API, at least for now.

```js
import { gql, ApolloServer } from "apollo-server-micro";
import { ApolloServerPluginLandingPageGraphQLPlayground } from "apollo-server-core";
import { Neo4jGraphQL } from "@neo4j/graphql";
import neo4j from "neo4j-driver";
import "ts-tiny-invariant"; // importing this module as a workaround for issue described here: https://github.com/vercel/vercel/discussions/5846

const typeDefs = gql`
  type User @exclude(operations: [CREATE, UPDATE, DELETE]) {
    username: String
    created: DateTime
    karma: Int
    about: String
    avatar: String
    articles: [Article] @relationship(type: "SUBMITTED", direction: OUT)
    invited: [User] @relationship(type: "INVITED_BY", direction: IN)
    invited_by: [User] @relationship(type: "INVITED_BY", direction: OUT)
  }

  type Article @exclude(operations: [CREATE, UPDATE, DELETE]) {
    id: ID
    url: String
    score: Int
    title: String
    comments: String
    created: DateTime
    user: User @relationship(type: "SUBMITTED", direction: IN)
    tags: [Tag] @relationship(type: "HAS_TAG", direction: OUT)
  }

  type Tag @exclude(operations: [CREATE, UPDATE, DELETE]) {
    name: String
    articles: [Article] @relationship(type: "HAS_TAG", direction: IN)
  }
`;

const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
);

const neoSchema = new Neo4jGraphQL({ typeDefs, driver });

const apolloServer = new ApolloServer({
  schema: neoSchema.schema,
  playground: true,
  introspection: true,
  plugins: [ApolloServerPluginLandingPageGraphQLPlayground()],
});

const startServer = apolloServer.start();

export default async function handler(req, res) {
  await startServer;
  await apolloServer.createHandler({
    path: "/api/graphql",
  })(req, res);
}

export const config = {
  api: {
    bodyParser: false,
  },
};
```

Next.js supports setting environment variables using `.env` files, so let's create a `.env.local` file where we'll add the credentials for our Neo4j Aura instance. We'll also set the `DEBUG` environment variable to [enable debug logging for the Neo4j GraphQL library](https://neo4j.com/docs/graphql-manual/current/troubleshooting/). This will log the generated Cypher queries among other things, which can be helpful to understand how the database queries are generated from GraphQL operations.

```md
NEO4J_USER=neo4j
NEO4J_URI=neo4j+s://YOUR NEO4J AURA URI HERE
NEO4J_PASSWORD=YOUR NEO4J AURA PASSWORD HERE
DEBUG=@neo4j/graphql:\*
```

We now have a GraphQL endpoint running locally at `localhost:3000/api/graphql` that we can use to fetch data from our Neo4j Aura database using GraphQL. Next, we'll deploy our Next.js application on [Vercel](https://vercel.com/) so that it will be publicly accessible.

## Deploying To Vercel

Vercel is a cloud platform that we'll use to build and deploy our Next.js application. The frontend React application (once we build it!) will be built and hosted on a CDN and our GraphQL API route will be automatically deployed as a serverless function.

Vercel integrates with GitHub so once we commit our changes we can add our Next.js application by selecting the GitHub repository in Vercel. Because we're using a bit of a monorepo setup and our Next.js application is not in the root directory of the repository we just need to tell Vercel that the root directory of our Next.js application is the `next` directory. We'll also add our Neo4j Aura connection credentials as environment variables, setting values for `NEO4J_PASSWORD`, `NEO4J_URI`, and `NEO4J_USER` in the Vercel project configuration.

![Adding a new project to Vercel](/images/blog/graphql-server-nextjs/vercel1.png)

Once we've added our project the Vercel build service will pull down our code from GitHub, build the project and deploy our Next.js application (static content to a CDN and our GraphQL API to a serverless function). Our project is automatically assigned a domain and SSL certificate! Because we connected our project via GitHub any commits and pull requests will trigger another build. Each build is assigned its own unique URL which means pull requests will be built and deployed as a "preview build" which we can test and share before deploying to our main domain. This is really great collaboration feature.

![Vercel dashboard](/images/blog/graphql-server-nextjs/vercel2.png)

Since we added the GraphQL Playground plugin we can navigate to our Vercel project's URL in the browser [`https://lobste-rs-graph.vercel.app/api/graphql`](https://lobste-rs-graph.vercel.app/api/graphql) and test our GraphQL endpoint:

![GraphQL Playground and Vercel](/images/blog/graphql-server-nextjs/playground1.png)

Now that we've got our GraphQL API up, running, and deployed on Vercel in the next post we'll start building out the frontend application, taking a look at graph data visualization in React with GraphQL.

## Resources

- [Code available on GitHub](https://github.com/johnymontana/lobste.rs-graph)
- [No Cost Data Scraping With GitHub Actions](https://lyonwj.com/blog/no-cost-data-scraping-github-actions-neo4j-aura)
- [Neo4j Aura](https://dev.neo4j.com/neo4j-aura)
- [Graph Data Visualization With Neo4j Bloom](https://dev.neo4j.com/bloom)
- [Next.js](https://nextjs.org)
- [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction)
- [Neo4j GraphQL Library](https://dev.neo4j.com/graphql)
- [Using GraphQL Playground With Apollo Server v3](https://www.apollographql.com/docs/apollo-server/migration/#graphql-playground)
- [Vercel](https://vercel.com/)

For comments and discussion please [join the conversation for this post at Dev.to](https://dev.to/lyonwj/building-a-graphql-server-with-next-js-api-routes-g2)
