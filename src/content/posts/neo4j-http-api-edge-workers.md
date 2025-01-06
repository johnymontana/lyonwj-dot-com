---
title: "Building A Location Aware Endpoint Using Neo4j And Cloudflare Workers"
pubDate: 2020-11-20
description: "Using the new Jolt format with HTTP in Neo4j 4.2 with edge network handlers."
image:
  url: "/images/blog/neo4j-http-api-edge-workers/workersfull.png"
  alt: "Building A Location Aware Endpoint Using Neo4j and Cloudflare Workers"
tags: ["Neo4j", "JavaScript", "Cloud"]
author: William Lyon
avatar:
  url: "/images/will.jpeg"
  alt: "#_"
---

![Using Cloudflare Workers with Neo4j Jolt](/images/blog/neo4j-http-api-edge-workers/Jolt.png)

In this post we take a look at some updates made to the Neo4j HTTP API in the latest Neo4j 4.2 release, specifically a new result serialization format called Jolt (short for JSON Bolt). We then see how to use the Neo4j transactional Cypher HTTP endpoint in a Cloudflare Worker to build a location personalized election result endpoint.

I covered this topic in a recent [Neo4j Livestream](https://www.twitch.tv/neo4j_) so if you'd prefer to watch the video recording you can find that here:

<iframe
  width="560"
  height="315"
  src="https://www.youtube-nocookie.com/embed/mVFPWlF8TWk?si=9Uau_oc7Sex7voG4"
  title="YouTube video player"
  frameborder="0"
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
  referrerpolicy="strict-origin-when-cross-origin"
  allowfullscreen
></iframe>

## Overview Of The Neo4j HTTP API

In most cases when we're building applications with Neo4j we use one of the [Neo4j language drivers](https://neo4j.com/developer/language-guides/) to connect to Neo4j, send Cypher queries, and work with the results. These drivers allow us to use the language of our choice depending on what we're using for our application. Under the hood these drivers are using the Bolt protocol to connect to Neo4j and results are serialized using an efficient binary serialization format called PackStream. The drivers abstract away this protocol and serialization and allow us to focus on building our application.

However, in addition to the Bolt endpoint, there is also a transactional Cypher endpoint that can be used with Neo4j in cases where Bolt isn't a viable option. To find the HTTP transaction endpoint you can use the [discovery HTTP endpoint](https://neo4j.com/docs/http-api/current/) to list all available endpoints for your Neo4j instance:

```json

GET http://localhost:7474/
Accept: application/json

----------------------------

200 OK
Content-Type: application/json

{
  "bolt_direct": "bolt://localhost:7687",
  "bolt_routing": "neo4j://localhost:7687",
  "cluster": "http://localhost:7687/db/{databaseName}/cluster",
  "transaction": "http://localhost:7474/db/{databaseName}/tx",
  "neo4j_version": "4.0.0",
  "neo4j_edition": "enterprise"
}

```

### The Transactional Cypher HTTP Endpoint

![The transactional Cypher HTTP endpoint](/images/blog/neo4j-http-api-edge-workers/cypher-http-api.png)

The transactional Cypher HTTP endpoint enables us to open transactions, execute Cypher statements, commit or rollback transactions, and work with the results of our Cypher statements via HTTP requests. Results are serialized using either JSON or (as of Neo4j 4.2) Jolt.

## Jolt = JSON + Bolt

Jolt is short for JSON Bolt and is a JSON based format that encodes the response value's type along with the value in a singleton object. This allows us to represent all types from the PackStream type system used by Bolt. One of the problems with using JSON for data serialization is that we can only natively represent a subset of PackStream types (think of datetime types, geospatial type, 64-bit integers, etc).

In formats like MessagePack and PackStream a marker is used to encode the type of the value.

![Sized values in Neo4j's PackStream](/images/blog/neo4j-http-api-edge-workers/sized-value.png)

With Jolt the key of the singleton object indicates the type, and the value stores the value. Refer to [the Jolt documentation](https://neo4j.com/docs/http-api/current/actions/result-format/#_jolt) for the full encoding documentation but let's look at a few examples.

| Type Label | Type         | Encoding Example                                                             |
| ---------- | ------------ | ---------------------------------------------------------------------------- |
| `Z`        | Integer      | `{ "Z": "123" }`                                                             |
| `T`        | Datetime     | `{ "T": "2002-04-16T12:34:56"}`                                              |
| `@`        | Geospatial   | `{"@": "POINT (30 10)"}`                                                     |
| `()`       | Node         | `{"()": [ node_id, [ node_labels], {"prop1": "value1", "prop2": "value2"}]}` |
| `<-`       | Relationship | `{"<-": [ rel_id, end_node_id, rel_type, start_node_id, {properties}]}`      |
| `->`       | Relationship | `{"->": [ rel_id, start_node_id, rel_type, end_node_id, {properties}]}`      |

Note that the value for nodes and relationships is a tuple (a 3-tuple for nodes and a 5-tuple for relationships) since indexing into a tuple is more efficient than working with an object in most cases.

### Jolt Node

Here's an example of how a Node is serialized using Jolt.

```json
{
  "()": [
    9285,
    ["Airport"],
    {
      "code": "REH",
      "name": "Rehoboth Airport",
      "location": {
        "@": "SRID=4326;POINT(-75.122 38.72)"
      }
    }
  ]
}
```

This represents a node with internal id 9285, a single label `Airport` and three properties, `code`, `name`, and `location` where `location` is a `Point` type.

### Jolt Relationship

And here's an example of a relationship represented in Jolt. Specifically, a relationship connecting the node with id 5129 to node with id 9285, of type `IN_STATE`, internal relationship id of 8, and no properties.

```json
{
  "->": [5129, 9285, "IN_STATE", 8, {}]
}
```

Jolt nodes and relationships can be composed in an array to represent a path in the graph. We'll see an example of that later on in this post.

## Example Using The Election Results Dataset

![The Neo4j election results data model](/images/blog/neo4j-http-api-edge-workers/datamodel.png)

On election night a few weeks ago I thought it would be fun to import live elections results data into Neo4j while we were all waiting for the results to come in. I won't cover how to import that dataset in this post, but you can access the database at `elections.graph.zone` using the username `elections` and password `elections`.

Let's query this database and see what Jolt looks like for a real Cypher response. Here's a simple Cypher query that will return nodes and relationships:

```cypher
MATCH (state:State {name: $state})<-[rel:IN_STATE]-(cas) RETURN * LIMIT 1
```

To construct the HTTP request for sending this Cypher query, I like to use Postman which makes it easy to add the appropriate authorization and content headers.

![Querying the Neo4j HTTP API using Postman](/images/blog/neo4j-http-api-edge-workers/postman.png)

But of course we can also use tools like curl:

```shell
curl --location --request POST 'https://elections.graph.zone/db/neo4j/tx/commit/' \
--header 'Accept: application/vnd.neo4j.jolt+json-seq' \
--header 'Content-Type: application/json' \
--header 'Authorization: Basic ZWxlY3Rpb25zOmVsZWN0aW9ucw==' \
--data-raw '{
  "statements" : [ {
    "statement" : "MATCH (state:State {name: $state})<-[rel:IN_STATE]-(cas) RETURN * LIMIT 1",
    "parameters" : {
      "state" : "Delaware"
    }
  } ]
}'
```

Note the `Accept` header `application/vnd.neo4j.jolt+json-seq` which indicates we want Jolt to be returned from this request. Here's what the response body looks like:

```json
{
    "header": {
        "fields": [
            "cas",
            "rel",
            "state"
        ]
    }
}
{
    "data": [
        {
            "()": [
                9285,
                [
                    "Airport"
                ],
                {
                    "code": "REH",
                    "name": "Rehoboth Airport",
                    "location": {
                        "@": "SRID=4326;POINT(-75.122 38.72)"
                    }
                }
            ]
        },
        {
            "->": [
                5129,
                9285,
                "IN_STATE",
                8,
                {}
            ]
        },
        {
            "()": [
                8,
                [
                    "State"
                ],
                {
                    "result": "winner",
                    "biden_winner": true,
                    "absentee_votes": 0,
                    "name": "Delaware",
                    "votes": 504010,
                    "id": "DE",
                    "electoral_votes": 3,
                    "trump_winner": false
                }
            ]
        }
    ]
}
{
    "summary": {}
}
{
    "info": {}
}
```

This Jolt response represents a path in the graph, an airport node connected to a state node:

![The Neo4j election results data model](/images/blog/neo4j-http-api-edge-workers/path.png)

If we replace the `Accept` header with `application/json`, we can see how the result would be serialized using JSON. Notice how the different types are encoded via JSON.

```json
{
  "results": [
    {
      "columns": ["cas", "rel", "state"],
      "data": [
        {
          "row": [
            {
              "code": "REH",
              "name": "Rehoboth Airport",
              "location": {
                "type": "Point",
                "coordinates": [-75.122, 38.72],
                "crs": {
                  "srid": 4326,
                  "name": "wgs-84",
                  "type": "link",
                  "properties": {
                    "href": "http://spatialreference.org/ref/epsg/4326/ogcwkt/",
                    "type": "ogcwkt"
                  }
                }
              }
            },
            {},
            {
              "result": "winner",
              "biden_winner": true,
              "absentee_votes": 0,
              "name": "Delaware",
              "votes": 504010,
              "id": "DE",
              "electoral_votes": 3,
              "trump_winner": false
            }
          ],
          "meta": [
            {
              "id": 9285,
              "type": "node",
              "deleted": false
            },
            {
              "id": 5129,
              "type": "relationship",
              "deleted": false
            },
            {
              "id": 8,
              "type": "node",
              "deleted": false
            }
          ]
        }
      ]
    }
  ],
  "errors": []
}
```

In most case when we're building applications using Neo4j we make use of one of the [Neo4j language drivers](https://neo4j.com/developer/language-guides/), specific to whichever language we're using to build our application. These drivers use the Bolt protocol for working with Cypher and give us a language specific and idiomatic way of using Cypher in our applications without having to think about the underlying transport or serialization layer. The Neo4j drivers are available for many languages and officially supported by Neo4j. So why would we ever want to use the HTTP transactional Cypher endpoint for working with Neo4j?

There are a few cases where it makes sense to send Cypher over HTTP to Neo4j instead of using the Bolt language drivers. Perhaps we're using one of the few languages that doesn't currently have a Neo4j driver. Or perhaps we're using a system that will trigger a webhook and we want to use a POST request to insert some data into our database. Or perhaps we are using edge handlers like Cloudflare Workers. In a Worker we're not (currently) able to make arbitrary TCP requests, which means we can't use Bolt - but we can use the transactional Cypher HTTP API.

## Cloudflare Workers

![Cloudflare Workers](/images/blog/neo4j-http-api-edge-workers/workers.png)

Edge handlers like Cloudflare Workers are the next iteration of serverless and a technology that I'm really excited about. Workers are comparable to function-as-a-service (FaaS) offerings like AWS Lambda, but address many of the shortcomings of FaaS, such as handling global deployment and eliminating the cold-start problem that can impact the performance of FaaS. A Cloudflare Worker is deployed to the global CDN edge network and runs on the same machines tasked with delivering static content as part of the CDN.

Since Workers are deployed to the global CDN that means each worker can be location-aware, taking into account the location of the user who initiated the request and serving a personalized response based on the location of the user. Let's see how we can use Cloudflare Workers with our election dataset in Neo4j to create an endpoint that will serve election results relevant for the user based on their location.

Because Cloudflare Workers run in a custom runtime on Cloudflare's global CDN there are currently some limitations. One of those limitations is that a Worker currently is not able to open an arbitrary TCP connection. That means we aren't able to use Bolt to connect to our Neo4j database - however we can use HTTP requests to connect to Neo4j. Good thing we just learned about the transactional Cypher endpoint!

### A Location Personalized Election Results Endpoint

If we take a look at the [Cloudflare Workers example page](https://developers.cloudflare.com/workers/examples) we see an example worker for "accessing the Cloudflare object". The Cloudflare object is attached to the request object passed to our worker and will contain some location specific information.

```js
addEventListener("fetch", (event) => {
  const data =
    event.request.cf !== undefined
      ? event.request.cf
      : { error: "The `cf` object is not available inside the preview." };

  return event.respondWith(
    new Response(JSON.stringify(data, null, 2), {
      headers: {
        "content-type": "application/json;charset=UTF-8",
      },
    })
  );
});
```

You can hit [this endpoint](https://accessing-the-cloudflare-object.workers-sites-examples.workers.dev/) and see relevant information based on your request.

```json
{
tlsExportedAuthenticator: {
 ...
},
tlsVersion: "TLSv1.3",
httpProtocol: "HTTP/2",
edgeRequestKeepAliveStatus: 1,
requestPriority: "weight=256;exclusive=1",
country: "US",
clientAcceptEncoding: "gzip, deflate, br",
clientTcpRtt: 27,
colo: "SEA",
tlsClientAuth: {
certIssuerDNLegacy: "",
certIssuerDN: "",
certIssuerDNRFC2253: "",
certSubjectDNLegacy: "",
certNotAfter: "",
certVerified: "NONE",
certFingerprintSHA1: "",
certSubjectDN: "",
certFingerprintSHA256: "",
certNotBefore: "",
certSerial: "",
certPresented: "0",
certSubjectDNRFC2253: ""
},
asn: 33588
}
```

What we're most interested in is the `colo` value. According to [the Cloudflare Workers docs](https://developers.cloudflare.com/workers/runtime-apis/request#incomingrequestcfproperties), the `colo` is the three-letter airport code of the data center that the request hit. Now you see why our Neo4j database includes airports!

What we want to do now is find the airport that represents the data center where the request was resolved then traverse our graph to find the state node, traverse to all counties in the state and return election result data for those counties so that we're showing the user the election results for only their state. Cloudflare has a geoip service as well, so we could enable that to get the actual latitude and longitude of where a request originated, however I'm using the free tier of Cloudflare and don't have access to that feature.

Let's modify our Cypher query from above to find the relevant airport given the data center and return the election results for all counties in that state. Using a Cypher feature called a pattern comprehension we'll project out the object we want to return to the user, returning only the relevant properties and computing others (such as the vote percentage for each candidate).

```cypher
MATCH (a:Airport {code: $colo})-[:IN_STATE]->(s:State)
RETURN {
    state: s.name, votes: s.votes, absenteeVotes: s.absentee_votes, bidenWin: s.biden_winner,
    trumpWin: s.trump_winner,
    counties:
    [(s)<-[:IN_STATE]-(c:County) | { name: c.name, trumpVotes: c.trump, bidenVotes: c.biden,
    pct_trump: (toFloat(c.trump) / (c.trump+c.biden)),
    pct_biden: (toFloat(c.biden) / (c.trump+c.biden))}]
} AS data
```

Running this query using the `ILG` airport code (for New Castle Airport in Delaware) we see the election results for each Delaware county.

```json
{
  "votes": 504010,
  "state": "Delaware",
  "trumpWin": false,
  "bidenWin": true,
  "absenteeVotes": 0,
  "counties": [
    {
      "pct_trump": 0.556867221214585,
      "name": "Sussex",
      "pct_biden": 0.44313277878541496,
      "bidenVotes": 56682,
      "trumpVotes": 71230
    },
    {
      "pct_trump": 0.31180177700618916,
      "name": "New Castle",
      "pct_biden": 0.6881982229938108,
      "bidenVotes": 195034,
      "trumpVotes": 88364
    },
    {
      "pct_trump": 0.47929547340493917,
      "name": "Kent",
      "pct_biden": 0.5207045265950608,
      "bidenVotes": 44552,
      "trumpVotes": 41009
    }
  ]
}
```

Now let's create a new Worker using [the Cloudflare console](https://dash.cloudflare.com/) and execute this Cypher query against our Neo4j instance using the HTTP API (remember that in a Cloudflare Worker we currently aren't able to make arbitrary TCP connections so using one of the Bolt language drivers for Neo4j isn't an option here)

![The Cloudflare Workers console](/images/blog/neo4j-http-api-edge-workers/cloudflareconsole.png)

We'll use `fetch` to make our HTTP request and return a JSON object with the relevant election result data, depending on the location of the user:

```js
addEventListener("fetch", (event) => {
  const colo =
    (event.request && event.request.cf && event.request.cf.colo) || "SFO";
  event.respondWith(handleRequest(event.request, colo));
});

/**
 * Respond to the request
 * @param {Request} request
 */
async function handleRequest(request, colo) {
  var myHeaders = new Headers();
  // add this header to enable Jolt format
  //myHeaders.append("Accept", "application/vnd.neo4j.jolt+json-seq");
  myHeaders.append("Accept", "application/json");
  myHeaders.append("Content-Type", "application/json");
  myHeaders.append("Authorization", "Basic bmVvNGo6bGV0bWVpbg==");

  const statement = `MATCH (a:Airport {code: $colo})-[:IN_STATE]->(s:State)
    RETURN {
      state: s.name, votes: s.votes, absenteeVotes: s.absentee_votes, bidenWin: s.biden_winner, 
        trumpWin: s.trump_winner,
      counties: 
        [(s)<-[:IN_STATE]-(c:County) | { name: c.name, trumpVotes: c.trump, bidenVotes: c.biden, 
        pct_trump: (toFloat(c.trump) / (c.trump+c.biden)), 
        pct_biden: (toFloat(c.biden) / (c.trump+c.biden))}]
    } AS data`;

  var raw = JSON.stringify({
    statements: [{ statement, parameters: { colo } }],
  });

  var requestOptions = {
    method: "POST",
    headers: myHeaders,
    body: raw,
    redirect: "follow",
  };

  const response = await fetch(
    "https://elections.graph.zone/db/neo4j/tx/commit/",
    requestOptions
  );
  const result = await response.json();
  return new Response(
    JSON.stringify(
      (result &&
        result.results[0] &&
        result.results[0].data[0] &&
        result.results[0].data[0].row &&
        result.results[0].data[0].row[0]) || { colo },
      null,
      2
    ),
    {
      status: 200,
      headers: {
        "content-type": "application/json;charset=UTF-8",
      },
    }
  );
}
```

Since this dataset is US specific if the request hits an edge outside the US instead of election results we just return the datacenter of that edge. Also, note that in the Cloudflare testing console the `cf` object isn't available on the request, so we fall back to a default airport code of `SFO`.

Our worker is immediately globally deployed. If we hit [the endpoint](https://shrill-bread-4677.graphstuff.workers.dev/), we'll now see election result data based on our location. Here's what it looks like if we hit the San Francisco data center:

```json
{
  "state": "California",
  "votes": 17175022,
  "absenteeVotes": 8420433,
  "trumpWin": false,
  "bidenWin": true,
  "counties": [
    {
      "pct_trump": 0.12156237491482494,
      "pct_biden": 0.8784376250851751,
      "name": "San Francisco",
      "bidenVotes": 656185,
      "trumpVotes": 90806
    }, ...
  ]
}
```

You can try it at [this endpoint](https://shrill-bread-4677.graphstuff.workers.dev/) and you should see election results relevant for your location.

## Resources

- Learn more about the Neo4j HTTP API in [the Neo4j HTTP API docs](https://neo4j.com/docs/http-api/4.2-preview/actions/result-format/).
- Learn more about Bolt, PackStream, and underlying details of the Neo4j drivers at [7687.org](https://7687.org/)
- Learn more about Cloudflare Workers at the [Cloudflare Workers landing page.](https://workers.cloudflare.com/)
- More details about using pattern comprehensions with Cypher in [this blog post.](https://neo4j.com/blog/cypher-graphql-neo4j-3-1-preview/)
