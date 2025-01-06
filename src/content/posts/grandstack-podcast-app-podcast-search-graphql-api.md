---
title: "Podcast Search GraphQL API With Neo4j And The Podcast Index"
pubDate: 2020-12-06
description: "Building A GRANDstack Podcast App: Episode 1"
image:
  url: "/images/blog/grandstack-podcast-app-podcast-search-graphql-api/grandcast.png"
  alt: "Podcast Search GraphQL API With Neo4j And The Podcast Index"
tags: ["Neo4j", "GraphQL", "GRANDstack", "JavaScript"]
author: William Lyon
avatar:
  url: "/images/will.jpeg"
  alt: "#_"
---

![GRANDcast.FM logo](/images/blog/grandstack-podcast-app-podcast-search-graphql-api/grandcast.png)

A few weeks ago I was complaining about the podcast app I was using. There was some problem with updating my playlists and I was grumpy because the app wasn't pulling down any episodes. My wife suggested I just build my own podcast application and use that instead. She was just trying to get me to shut up and stop complaining, but I thought that actually sounded like a fun project. So this week on the [Neo4j livestream](https://twitch.tv/neo4j_) we kicked off a new project: building a podcast application with [GRANDstack!](https://grandstack.io)

In this first week we went over the graph data model we'll need for this application and started building the GraphQL API for the project, focusing on implementing podcast search functionality using the Podcast Index API. This blog post covers what we built in that stream, but you can watch the recording of the stream here:

<iframe
  width="560"
  height="315"
  src="https://www.youtube-nocookie.com/embed/lsGgFxGwHlw?si=T_8Nv-tn_Oa22w-f"
  title="YouTube video player"
  frameborder="0"
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
  referrerpolicy="strict-origin-when-cross-origin"
  allowfullscreen
></iframe>

# Graph Data Modeling

When beginning a new project I always like to start with a data modeling exercise. In my mind graph data modeling is an iterative process that begins as soon as you start defining the business requirements of the application. The steps of the graph data modeling iterative process:

1. Identify the entities. These become **nodes.**
2. How are these entities connected? These connections become **relationships.**
3. What attributes describe the entities? These become **node properties.**
4. What attributes are specific to how entities are connected? These become **relationship properties.**

Once you have an initial model, work through the business requirements and try to identify a traversal through the graph model that fulfills the requirement. If you can't traverse the graph to answer the necessary question, you may need to update the graph model.

After going through this process initially we ended up with a graph model that looks like this (created using the [Arrows graph diagramming tool.](http://www.apcjones.com/arrows/))

![Building a podcast application livestream](/images/blog/grandstack-podcast-app-podcast-search-graphql-api/datamodel.png)

# Podcast Search

The first feature I wanted to implement is podcast search since that's the first thing our users will want to do. Our [GRANDstack application](https://grandstack.io) will be powered by a GraphQL API so we want to expose this podcast search functionality in our GraphQL API. We'll make use of GRANDstack's [`@cypher` schema directive](https://grandstack.io/docs/graphql-custom-logic/#the-cypher-graphql-schema-directive) functionality for adding custom logic to implement this podcast search functionality, but instead of searching a Neo4j database, we'll query a 3rd party API endpoint to search for podcasts.

## Podcast Index

![The Podcast Index](/images/blog/grandstack-podcast-app-podcast-search-graphql-api/podcastindex.jpg)

We don't don't want to maintain an index of all possible podcasts in existence, instead we'll use a 3rd party API to enable searching for podcasts, in this case a service call [the Podcast Index.](https://podcastindex.org/) The Podcast Index is committed to maintaining an open API of podcasts for the preservation of free speech. In line with its goal anyone can register for an API token and begin building application using its API.

### Searching Endpoint

Looking at the [API docs for the Podcast Index](https://podcastindex-org.github.io/docs-api/) we can see there is an API endpoint for searching for podcasts. To use this endpoint we include a single query parameter which is our search term:

`/api/1.0/search/nyterm?=q=neo4j`

```json
{
  "status": "true",
  "feeds": [
    {
      "id": 969306,
      "title": "Graphistania: Podcast for Neo4j Graph Database community",
      "url": "http://feeds.soundcloud.com/users/soundcloud:users:141739624/sounds.rss",
      "originalUrl": "http://feeds.soundcloud.com/users/soundcloud:users:141739624/sounds.rss",
      "link": "http://blog.bruggen.com",
      "description": "Podcast by The Neo4j Graph Database Community",
      "author": "The Neo4j Graph Database Community",
      "ownerName": "Graphistania",
      "image": "http://i1.sndcdn.com/avatars-000135096101-qekfg1-original.png",
      "artwork": "http://i1.sndcdn.com/avatars-000135096101-qekfg1-original.png",
      "lastUpdateTime": 1606220307,
      "lastCrawlTime": 1607132366,
      "lastParseTime": 1606220308,
      "lastGoodHttpStatusTime": 1607132366,
      "lastHttpStatus": 200,
      "contentType": "application/rss+xml; charset=utf-8",
      "itunesId": 975377379,
      "generator": null,
      "language": "en",
      "type": 0,
      "dead": 0,
      "crawlErrors": 0,
      "parseErrors": 0,
      "categories": {
        "102": "Technology"
      },
      "locked": 0,
      "imageUrlHash": 775621088
    }
  ],
  "count": 1,
  "query": "neo4j",
  "description": "Found matching feeds."
}
```

### Authorization Headers

According to the [Podcast Index API documentation](https://podcastindex-org.github.io/docs-api/) each request need to be authenticated using "Amazon style" request authorization token headers. This means that each request must include the following headers:

- `User-Agent` - to identify our application "GRANDcast.FM"
- `X-Auth-Date` - the current unix epoch time, expressed in seconds.
- `X-Auth-Key` - our API key. We can get a free API key [simply by registering.](https://api.podcastindex.org/)
- `Authorization` - a SHA1 hash of our API key, API secret, and the current unix epoch time concatenated together

Since we want to use the `@cypher` schema directive to query the Podcast Index, we'll need to format and parse the request to this API using Cypher. How can we make a HTTP request, format the request headers, and parse a JSON response with Cypher?

## APOC To The Rescue

Fortunately the [APOC standard library for Neo4j](https://neo4j.com/labs/apoc/) has some helpful procedures and functions that will enable us to query the Podcast Index API with Cypher. We'll make use of the follow APOC procedures and functions:

- [**`apoc.load.jsonParams`**](https://neo4j.com/labs/apoc/4.1/overview/apoc.load/apoc.load.jsonParams/) - load data from a JSON URL, including passing a request payload and our authorization headers
- [**`apoc.static.get`**](https://neo4j.com/labs/apoc/4.0/misc/static-values/) - reading static values such as API credentials from a config file so we don't have to check our secrets into version control
- [**`apoc.util.sha1`**](https://neo4j.com/labs/apoc/4.1/overview/apoc.util/apoc.util.sha1/) - compute the SHA1 hash of a string. We'll use this to compute the hash for the `Authorization` token in our request.
- [**`apoc.text.urlencode`**](https://neo4j.com/labs/apoc/4.0/overview/apoc.text/apoc.text.urlencode/) - encode text so it can be safely used in a URL. We use this URL encode the search term parameter.
- [**`apoc.map.values`**](https://neo4j.com/labs/apoc/4.1/overview/apoc.map/apoc.map.values/) - convert a map into a list of values. We'll use this to work with the categories data for podcast search results.

First, we'll add our API credentials from Podcast Index to `apoc.conf`:

```shell
apoc.static.podcastkey=<YOUR_API_KEY_HERE>
apoc.static.podcastsecret=<YOUR_API_SECRET_HERE>

```

We'll now be able to reference these values using the `apoc.static.get()` function.

Putting everything together the Cypher query to search for podcasts using the Podcast Index API endpoint looks like this:

```cypher
WITH toString(timestamp()/1000) AS timestamp
WITH {
  `User-Agent`: "GRANDstackFM",
  `X-Auth-Date`: timestamp,
  `X-Auth-Key`: apoc.static.get('podcastkey'),
  `Authorization`: apoc.util.sha1([apoc.static.get('podcastkey') + apoc.static.get('podcastsecret') + timestamp])
} AS headers
CALL apoc.load.jsonParams("https://api.podcastindex.org/api/1.0/search/byterm?q=" + apoc.text.urlencode($searchTerm), headers, '', '') YIELD value
RETURN value
```

# GraphQL API

Now that we're able to use Cypher to search for podcasts it's time to start building our GraphQL API. We'll use the `create-grandstack-app` command line tool to quickly create the skeleton for our GraphQL server application.

## `create-grandstack-app`

The [`create-grandstack-app` CLI](https://grandstack.io/docs/getting-started-grand-stack-starter/#create-grandstack-app) is a utility for creating GRANDstack applications based on the GRANDstack starter project. Here we'll use it to create the GraphQL server application, but not the frontend since we're not ready to start thinking about the client application yet.

```shell
npx create-grandstack-app grandstack.fm
```

This command will fetch the latest release of the GRANDstack Starter project and ask us a few questions about how to connect to our Neo4j database.

![create-grandstack-app CLI](/images/blog/grandstack-podcast-app-podcast-search-graphql-api/cli.png)

We now have a functional GraphQL server application in the `grandcast.fm/` directory that can serve a GraphQL endpoint backed by our local Neo4j database. Since we selected the `API-Only` option we don't yet have a frontend for the application.

## `@cypher` GraphQL Schema Directive

Now it's time to edit the GraphQL type definitions of our GraphQL server application. We want to:

- create a `Query` field `podcastSearch` that returns a list of `PodcastSearchResult` objects
- add the Cypher query we wrote above as a `@cypher` schema directive, defining the logic for this `podcastSearch` field
- the `podcastSearch` field will take a String argument `searchTerm` that will be passed as a Cypher parameter to the indicated Cypher query

We'll replace the template type definitions found in `grandstack.fm/api/src/schema.graphql` with the following:

```graphql
type Query {
  podcastSearch(searchTerm: String!): [PodcastSearchResult]
    @cypher(
      statement: """
      WITH toString(timestamp()/1000) AS timestamp
      WITH {
        `User-Agent`: "GRANDstackFM",
        `X-Auth-Date`: timestamp,
        `X-Auth-Key`: apoc.static.get('podcastkey'),
        `Authorization`: apoc.util.sha1([apoc.static.get('podcastkey')+apoc.static.get('podcastsecret') +timestamp])
      } AS headers
      CALL apoc.load.jsonParams("https://api.podcastindex.org/api/1.0/search/byterm?q=" + apoc.text.urlencode($searchTerm), headers, '', '') YIELD value
      UNWIND value.feeds AS feed
      RETURN {
       itunesId: feed.itunesId,
       title: feed.title,
       description: feed.description,
       feedURL: feed.url,
       artwork: feed.artwork,
       categories: apoc.map.values(feed.categories, keys(feed.categories))
      }
      """
    )
}

type PodcastSearchResult {
  itunesId: String
  title: String
  description: String
  feedURL: String
  artwork: String
  categories: [String]
}
```

Next, in `src/index.js` we'll add the `PodcastSearchResult` to the types to be excluded from the schema augmentation process. Since this type represents results from the Podcast Index API call we don't want to generate query and mutation operations for this type. We'll also comment out the `init(driver)` line to initialize the database, saving that for later.

We'll leave the rest of the file untouched:

```js
import { typeDefs } from "./graphql-schema";
import { ApolloServer } from "apollo-server-express";
import express from "express";
import neo4j from "neo4j-driver";
import { makeAugmentedSchema } from "neo4j-graphql-js";
import dotenv from "dotenv";
import { initializeDatabase } from "./initialize";

// set environment variables from .env
dotenv.config();

const app = express();

/*
 * Create an executable GraphQL schema object from GraphQL type definitions
 * including autogenerated queries and mutations.
 * Optionally a config object can be included to specify which types to include
 * in generated queries and/or mutations. Read more in the docs:
 * https://grandstack.io/docs/neo4j-graphql-js-api.html#makeaugmentedschemaoptions-graphqlschema
 */

const schema = makeAugmentedSchema({
  typeDefs,
  config: {
    query: {
      exclude: ["PodcastSearchResult"],
    },
    mutation: {
      exclude: ["PodcastSearchResult"],
    },
  },
});

/*
 * Create a Neo4j driver instance to connect to the database
 * using credentials specified as environment variables
 * with fallback to defaults
 */
const driver = neo4j.driver(
  process.env.NEO4J_URI || "bolt://localhost:7687",
  neo4j.auth.basic(
    process.env.NEO4J_USER || "neo4j",
    process.env.NEO4J_PASSWORD || "neo4j"
  ),
  {
    encrypted: process.env.NEO4J_ENCRYPTED ? "ENCRYPTION_ON" : "ENCRYPTION_OFF",
  }
);

/*
 * Perform any database initialization steps such as
 * creating constraints or ensuring indexes are online
 *
 */
const init = async (driver) => {
  await initializeDatabase(driver);
};

/*
 * We catch any errors that occur during initialization
 * to handle cases where we still want the API to start
 * regardless, such as running with a read only user.
 * In this case, ensure that any desired initialization steps
 * have occurred
 */

//init(driver)

/*
 * Create a new ApolloServer instance, serving the GraphQL schema
 * created using makeAugmentedSchema above and injecting the Neo4j driver
 * instance into the context object so it is available in the
 * generated resolvers to connect to the database.
 */
const server = new ApolloServer({
  context: { driver, neo4jDatabase: process.env.NEO4J_DATABASE },
  schema: schema,
  introspection: true,
  playground: true,
});

// Specify host, port and path for GraphQL endpoint
const port = process.env.GRAPHQL_SERVER_PORT || 4001;
const path = process.env.GRAPHQL_SERVER_PATH || "/graphql";
const host = process.env.GRAPHQL_SERVER_HOST || "0.0.0.0";

/*
 * Optionally, apply Express middleware for authentication, etc
 * This also also allows us to specify a path for the GraphQL endpoint
 */
server.applyMiddleware({ app, path });

app.listen({ host, port, path }, () => {
  console.log(`GraphQL server ready at http://${host}:${port}${path}`);
});
```

## Querying With GraphQL

We can now start our GraphQL server application and start searching for podcasts:

```shell
➜ npm run start
...
Successfully compiled 6 files with Babel (411ms).
GraphQL server ready at http://0.0.0.0:4001/graphql
```

Now our GraphQL server application is running locally at `localhost:4001/graphql`. If we open up a web browser and navigate to that URL we'll see the GraphQL Playground tool. GraphQL Playground allows us to view the results of _introspection_ of our GraphQL endpoint. This allows us to see the entry points for the GraphQL schema (the `Query`, `Mutation`, and `Subscription` fields) as well as the types, fields, and how the types are connected, essentially the schema of the API.

Let's query the GraphQL endpoint to find podcasts using the search term "Neo4j":

```graphql
{
  podcastSearch(searchTerm: "Neo4j") {
    title
    description
    artwork
    feedURL
    itunesId
    categories
  }
}
```

![Querying the GraphQL endpoint with GraphQL Playground](/images/blog/grandstack-podcast-app-podcast-search-graphql-api/query.png)

We now have a GraphQL API to enable our users to search for podcasts. Next, we'll need to enable users to subscribe to podcasts and for that to work we'll need to think about how to add users and enable them to log in and authenticate. So that's what we'll focus on next time.

# Resources

- [Code on Github](https://github.com/johnymontana/grandcast.fm)
- [Neo4j YouTube Channel](https://www.youtube.com/neo4j)
- [Building a GRANDstack Real Estate search application](https://github.com/johnymontana/willow-grandstack)
- [Building a travel guide with Gatsby.js, GraphQL, & Neo4j](https://github.com/johnymontana/central-perk)
- [Arrows graph diagramming tool](http://www.apcjones.com/arrows/)
- [Podcast Index API](https://podcastindex.org/)
- [Fullstack GraphQL Application With GRANDstack book](https://grandstack.io/ebook)
