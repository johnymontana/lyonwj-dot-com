---
title: "GRANDcast.FM: User Auth & Podcast Subscribe Functionality "
pubDate: 2020-12-11
description: "Building A GRANDstack Podcast App: Episode 2"
image:
  url: "/images/blog/grandstack-podcast-app-user-auth-podcast-subscribe/banner.png"
  alt: "User Auth and Podcast Subscribe Functionality"
tags: ["Neo4j", "GraphQL", "GRANDstack", "JavaScript"]
author: William Lyon
avatar:
  url: "/images/will.jpeg"
  alt: "#_"
---

![GRANDcast.FM logo](/images/blog/grandstack-podcast-app-user-auth-podcast-subscribe/grandcast.png)

> This is the second post in a series about building a podcast application using [GRANDstack](https://grandstack.io). Check out the first post, ["Podcast Search GraphQL API With Neo4j And The Podcast Index"](/blog/grandstack-podcast-app-podcast-search-graphql-api) where we start building the GraphQL API and implement podcast search functionality.

In the [previous post](/blog/grandstack-podcast-app-podcast-search-graphql-api) we started our GRANDstack podcast application by creating the GraphQL API and adding podcast search functionality using the Podcast Index API. After searching for podcasts the next thing our users will want to do is start subscribing to them, so in this episode we focus on allowing users to sign up and log in to our application and then implement "subscribe to podcast" functionality. We built this functionality on the [Neo4j live stream](https://twitch.tv/neo4j_) which you can watch here:

<iframe
  width="560"
  height="315"
  src="https://www.youtube-nocookie.com/embed/IOXmrIYij_g?si=9f2YSTe1OF8axoJU"
  title="YouTube video player"
  frameborder="0"
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
  referrerpolicy="strict-origin-when-cross-origin"
  allowfullscreen
></iframe>

# User Authentication

Let's start with implementing user authentication. We'll need to allow users to sign up for our application, create a username and choose a password. We'll also need to enable users to log in to the application and generate an authorization token for them.

## Setup

We'll make use of two packages to enable user authentication:

```shell
npm install jsonwebtoken bcrypt
```

- **[`bcrypt`](https://www.npmjs.com/package/bcrypt)** - an implementation of the bcrypt algorithm, a one-way hashing algorithm commonly used to hash passwords. We'll use this library to create a hash of a user's password when they register. We'll store the hash in the database and compare that to the password they submit when attempting to log in.

- **[`jsonwebtoken`](https://www.npmjs.com/package/jsonwebtoken)** a JavaScript implementation of JSON Web Token (JWT), a standard for cryptographically encoding JSON data into a token, which can then be used as an authorization token. We'll generate a signed JWT after a user successfully signs up or logs in which the user will then be able to use to make authenticated requests to our GraphQL API.

We'll also need to generate a random 256 bit secret to use for signing our tokens. By default `jsonwebtoken` will use the HS256 algorithm, we could also choose to use the RSA256 algorithm which uses public/private key pairs. We'll stick with the default HS256 algorithm and store the key as an environment variable by adding it to our `.env` file:

```env
JWT_SECRET=<RANDOM_256_BIT_SECRET_HERE>
```

## Sign Up

First, we'll add a new `signup` mutation to our GraphQL type definitions. This mutation field will take two arguments: `username` and `password`. Our new `signup` mutation will return an `AuthToken` object with a single string field called `token`.

```graphql
type Mutation {
  signup(username: String!, password: String!): AuthToken
}

type AuthToken {
  token: String!
}
```

Next, we implement the resolver function for the `signup` mutation field. We haven't created any resolvers yet because we've been taking advantage of the resolvers generated for us by `neo4j-graphql.js` but because we want to execute some custom logic in JavaScript that we can't express in Cypher we'll need to implement this resolver function.

Our `signup` resolver will take the user's password and hash it using `bcrypt`, store that hashed password and username in the database along with a randomly generated user id, then create a signed JWT that will include the username and id in the token's payload. The client application will then be able to use this auth token to make authenticated requests against our GraphQL API.

```js
import jwt from "jsonwebtoken";
import { compareSync, hashSync } from "bcrypt";

const resolvers = {
  Mutation: {
    signup: (obj, args, context, info) => {
      args.password = hashSync(args.password, 10);
      const session = context.driver.session();

      return session
        .run(
          `CREATE (u:User) SET u += $args, u.id = randomUUID()
           RETURN u`,
          { args }
        )
        .then((res) => {
          session.close();
          const { id, username } = res.records[0].get("u").properties;

          return {
            token: jwt.sign({ id, username }, process.env.JWT_SECRET, {
              expiredIn: "30d",
            }),
          };
        });
    },
  },
};
```

Now, if we execute the `signup` GraphQL mutation we can create new users and generate an authorization token for each user.

```graphql
mutation {
  signup(username: "jennycat", password: "feedme") {
    token
  }
}
```

![GraphQL mutation for user sign up](/images/blog/grandstack-podcast-app-user-auth-podcast-subscribe/graphql1.png)

We can also take the token, paste it into the JWT debugger at [jwt.io](https://jwt.io) to decode the payload to see what values are encoded in the token. We should see the username and the random id generated for the user.

![Using the JWT debugger to inspect the payload of our token](/images/blog/grandstack-podcast-app-user-auth-podcast-subscribe/jwt1.png)

And if we check in Neo4j we'll see the `User` node created in the database with the username, generated user id, and hashed password all stored in the database.

![The user node is created in the database](/images/blog/grandstack-podcast-app-user-auth-podcast-subscribe/db1.png)

New users are now able to sign up and register an account, but we also need to implement user login functionality so returning users can authenticate.

## Login

Implementing user login will be similar to how we implemented user sign up, but instead of creating the user node in the database we want to look it up by username in the database and compare the provided password with the hashed password stored in the database to make sure the user is providing the correct password in the GraphQL mutation argument.

First, we add a `login` field to the Mutation type in our GraphQL type definitions:

```graphql
type Mutation {
  signup(username: String!, password: String!): AuthToken
  login(username: String!, password: String!): AuthToken
}
```

And implement the resolver function for this mutation field in `index.js`. We'll look up the user by username and compare the provided password with the hashed password stored in the database. If the password doesn't match we throw an error, otherwise we generate a JWT authorization token.

```js
const resolvers = {
  signup: (obj, args, context, info) => {...},
  login: (obj, args, context, info) => {
    const session = context.driver.session();

    return session
      .run(
        `MATCH (u:User {username: $username}))
        RETURN u LIMIT 1`,
        { username: args.username }
      )
      .then((res) => {
        session.close();

        const { id, username, password } = res.records[0].get('u').properties;
        if (!compareSync(args.password, password)) {
          throw new Error('Authorization Error');
        }

        return {
          token: jwt.sign({ id, username }, process.env.JWT_SECRET, {
            expiresIn: '30d'
          })
        };
      });
  }
};
```

Now let's test the login operation using the username and password we created in the user sign up mutation previously. If all is working we should see a new authorization token.

```graphql
mutation {
  login(username: "jennycat", password: "feedme") {
    token
  }
}
```

![Using the JWT debugger to inspect the payload of our token](/images/blog/grandstack-podcast-app-user-auth-podcast-subscribe/graphql2.png)

# Authenticated GraphQL Requests

Now that we're able to register new users and allow users to sign in, we can start to handle authenticated requests and take into account the identity of the user in our application. To make authenticated GraphQL requests the auth token will be added to the request headers as an authorization bearer token.

```json
{
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImI3YjBmYmZkLTJjNzMtNDBiZS1hZGUxLTM1MjMzZWJhZDE5ZSIsInVzZXJuYW1lIjoiamVubnljYXQiLCJpYXQiOjE2MDc3NDI2MDUsImV4cCI6MTYxMDMzNDYwNX0._2xHiqrrwZR3ZXH9np9O2oWcx6iBsWd4OZLnd6DjtqY"
}
```

## Find The Authenticated User

First, let's add a GraphQL query field to return the currently authenticated user. To do this we'll need to figure out which user is making the authenticated GraphQL request.

### Cypher Params

We've already seen the powerful [`@cypher` directive functionality](https://grandstack.io/docs/graphql-custom-logic/#the-cypher-graphql-schema-directive) of the neo4j-graphql.js library that allows us to define custom logic using Cypher in our GraphQL schema. We saw that any arguments of the GraphQL field are passed into the Cypher statement as Cypher parameters. Now, we will take advantage of the ["Cypher Parameters" feature of the `@cypher` directive](https://grandstack.io/docs/neo4j-graphql-js-middleware-authorization#cypher-parameters-from-context) that allow us to pass values into the Cypher statement using the GraphQL context object.

**Any values in the `context.cypherParams` object will be available in Cypher queries using the `@cypher` schema directive.** This can be used to inject user specific information into these Cypher queries.

Let's update our instantiation of `ApolloServer` where we specify the value of the context object. Instead of an object, we can also define the context object using a function. This function is called on each request and is passed the request object, which will include the authorization header when making an authenticated GraphQL request. We'll grab the authorization token from the request header, validate it, and add the user id into the `cypherParams` object (remember that each token encodes the user id and username). This user id will then be available within the Cypher query when using the `@cypher` schema directive.

```js
const server = new ApolloServer({
  context: ({ req }) => {
    const token = req?.headers?.authorization?.slice(7);
    let userId;

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      userId = decoded.id;
    }
    return {
      cypherParams: { userId },
      driver,
      neo4jDatabase: process.env.NEO4J_DATABASE,
    };
  },
  schema,
});
```

Now, if an authorization token is specified in the GraphQL request, we can reference `$cypheParams.userId` in our Cypher query to refer to the currently authenticated user.

Let's add a GraphQL query field to return the current user, looking them up in the database by user id.

```graphql
type Query {
  currentUser: User
    @cypher(
      statement: """
      MATCH (u:User {id: $cypherParams.userId})
      RETURN u
      """
    )
}

type User {
  username: String
  id: ID!
}
```

We can now query for the currently authenticated user.

```graphql
{
  currentUser {
    username
    id
  }
}
```

## Podcast Subscribe

Now that we're able to make authenticated requests to the API we can implement functionality that allows a user to subscribe to podcasts. A user should only be able to see their own podcast subscriptions and should not be able to subscribe podcasts for other users.

### Subscribe Mutation

We'll add one more GraphQL mutation field, `subscribeToPodcast`, which will take a single argument, the `itunesId` of a podcast, and subscribe the user to the podcast. However, we haven't yet stored any podcast data in the database - our podcast search functionality is calling the Podcast Index API and returning results but not updating the database. In the `subscribeToPodcast` mutation we want to make sure we have the podcast details to store in the database so we'll first make a call to the Podcast Index to fetch the podcast details, store the details in a `Podcast` node, then create a `SUBSCRIBES_TO` relationship connecting the `User` node and `Podcast` node. We also add a `Podcast` type to our GraphQL type definitions to represent these nodes.

```graphql
type Mutation {
  signup(username: String!, password: String!): AuthToken
  login(username: String!, password: String!): AuthToken
  subscribeToPodcast(itunesId: String!): Podcast
    @cypher(
      statement: """
      WITH toString(timestamp()/1000) AS timestamp
      WITH {
      `User-Agent`: 'GRANDstackFM',
      `X-Auth-Date`: timestamp,
      `X-Auth-Key`: apoc.static.get('podcastkey'),
      `Authorization`: apoc.util.sha1([apoc.static.get('podcastkey') + apoc.static.get('podcastsecret') + timestamp])
      } AS headers
      CALL apoc.load.jsonParams('https://api.podcastindex.org/api/1.0/podcasts/byitunesid?id=' + apoc.text.urlencode($itunesId), headers, '', '') YIELD value
      WITH value.feed AS feed
      MATCH (u:User {id: $cypherParams.userId})
      MERGE (p:Podcast {itunesId: $itunesId})
      SET p.title       = feed.title,
          p.link        = feed.link,
          p.description = feed.description,
          p.feedURL     = feed.url,
          p.image       = feed.artwork
      MERGE (u)-[:SUBSCRIBES_TO]->(p)
      RETURN p
      """
    )
}

type Podcast {
  itunesId: ID!
  title: String
  link: String
  feedURL: String
  description: String
  image: String
}
```

After a few users log in and start subscribing to podcasts our graph starts to look like this:

![The graph of users and podcasts](/images/blog/grandstack-podcast-app-user-auth-podcast-subscribe/db2.png)

### Get List of Subscribed Podcasts For The Authenticated User

We also want to return the list of podcasts the authenticated user has subscribed to. To do this we add a `subscribedPodcasts` query field that will use the `$cypherParams.userID` value to find the `User` node in the database and any subscribed podcasts for the user.

```graphql
type Query {
  subscribedPodcasts: [Podcast]
    @cypher(
      statement: """
      MATCH (u:User {id: $cypherParams.userId})-[:SUBSCRIBES_TO]->(p:Podcast)
      RETURN p
      """
    )
}
```

We can now query for our subscribed podcasts - be sure to include our authorization token as an authorization header.

```graphql
{
  subscribedPodcasts {
    title
    description
    itunesId
    feedURL
    image
  }
}
```

![Subscribed podcasts](/images/blog/grandstack-podcast-app-user-auth-podcast-subscribe/graphql3.png)

We've now implemented user registration, log in, and podcast subscriptions in our GraphQL API. There are a few more cases we'll need to address (making sure users can't register the same username, better error handling, handling password reset, etc) but we now have basic authentication in our GraphQL API. In the next episode we'll start parsing feed URLs and adding episodes and playlists to the graph.

# Resources

- [Code on Github](https://github.com/johnymontana/grandcast.fm)
- [GRANDstack docs: Cypher parameters from context](https://grandstack.io/docs/neo4j-graphql-js-middleware-authorization#cypher-parameters-from-context)
- [`brcypt` npm package](https://www.npmjs.com/package/bcrypt)
- [`jsonwebtoken` npm package](https://www.npmjs.com/package/jsonwebtoken)
- [JWT debugger](https://jwt.io/)
- [Random key generator](https://randomkeygen.com/)
