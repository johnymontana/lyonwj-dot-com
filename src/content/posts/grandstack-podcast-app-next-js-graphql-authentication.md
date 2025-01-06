---
title: "Getting Started With Next.js and GraphQL Authentication"
pubDate: 2021-01-24
description: "Building A GRANDstack Podcast App: Episode 4"
image:
  url: "/images/blog/livestreams/grandcast-4.png"
  alt: "Getting Started With Next.js and GraphQL Authentication"
tags: ["Next.js", "Neo4j", "GraphQL", "GRANDstack", "JavaScript", "GRANDcast"]
avatar:
  url: "/images/will.jpeg"
  alt: "#_"
author: William Lyon
---

_This is the fourth post in a series about building a podcast application using [GRANDstack](https://grandstack.io). Check out the previous episodes here:_

> - [**Episode 1:** "Podcast Search GraphQL API With Neo4j And The Podcast Index"](https://lyonwj.com/blog/grandstack-podcast-app-podcast-search-graphql-api)
> - [**Episode 2:** "GRANDcast.FM: User Auth & Podcast Subscribe Functionality"](https://lyonwj.com/blog/grandstack-podcast-app-user-auth-podcast-subscribe)
> - [**Episode 3:** "Parsing And Importing XML With Neo4j: Adding Episodes and Playlists"](https://lyonwj.com/blog/grandstack-podcast-app-parsing-xml-neo4j-rss-episodes-playlists)

In this post we turn our attention to the frontend of the podcast application we've been building on the [Neo4j livestream](https://www.twitch.tv/neo4j). So far we’ve focused on the backend and GraphQL API layer. This week we got started on the front end, using the Next.js React framework. You can find the livestream recording embedded below or on the [Neo4j Youtube channel](https://youtube.com/neo4j).

<iframe
  width="560"
  height="315"
  src="https://www.youtube-nocookie.com/embed/pB4YZBJmMl8?si=J0V5uSexhSsS9E6x"
  title="YouTube video player"
  frameborder="0"
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
  referrerpolicy="strict-origin-when-cross-origin"
  allowfullscreen
></iframe>

In this post we'll focus on getting started with Next.js, fetching data using GraphQL in our Next.js application, and setting up client-side authentication with GraphQL in Next.js so we can sign in and make authenticated requests to our GraphQL API.

# What Is Next.js?

Next.js is a web framework built on top of React that adds many features and conventions that aren't available by default with React. Things like server side rendering, file based routing, image optimization, code splitting and bundling, and adding server-side API routes are things we eventually need to deal with as our React application becomes more complex. With Next.js we have all these things (and lots more) available out of the box. I like to think of Next.js as React with batteries included.

![Next.js landing page](/images/blog/grandcast-4/nextjs.png)

# Getting Started With Next.js

The easiest way to get started with Next.js is using the `create-next-app` CLI. Similar to `create-react-app` or [`create-grandstack-app`](https://grandstack.io/docs/getting-started-grand-stack-starter), we can create an initial Next.js application from the command line.

```shell
npx create-next-app next-app
```

The `create-next-app` command can take an example argument to specify an example template to use. There are two example Next.js templates for using Next.js with Neo4j:

- [with-neo4j](https://github.com/vercel/next.js/tree/canary/examples/with-neo4j)
- [with-apollo-neo4j-graphql](https://github.com/vercel/next.js/tree/canary/examples/with-apollo-neo4j-graphql)

We're going to skip these Neo4j specific templates since we've already built out our GraphQL API. In a future post we'll see how we can move our GraphQL API into Next.js, taking advantage of the serverless function deployment built into Next.js API routes.

To start our Next.js application we'll run

```shell
npm run dev
```

which will start a local server at `localhost:3000` serving our Next.js application.

# GraphQL Data Fetching With Next.js

The first thing we want to do is make data fetching queries with GraphQL and display podcast data in our Next.js application. To do this we'll use Apollo Client. First, let's install Apollo Client, by default this will include the React hooks integration for Apollo Client as well.

```shell
npm i @apollo/client
```

In React applications we make use of the Provider pattern and the React Context API to make data available throughout the React component hierarchy. The React integration for Apollo Client includes an `ApolloProvider` component that we can use to inject an Apollo Client instance into the React component hierarchy, which will make Apollo Client available to any component in our application. To do this we need to create an Apollo Client instance and wrap our application's root component in the `ApolloProvider` component. In Next.js we can do this in the `_app.js` file.

```js
import "../styles/globals.css";
import {
  ApolloProvider,
  ApolloClient,
  InMemoryCache,
  HttpLink,
} from "@apollo/client";

function createApolloClient() {
  const link = new HttpLink({
    uri: "http://localhost:4001/graphql",
  });

  return new ApolloClient({
    link,
    cache: new InMemoryCache(),
  });
}

function MyApp({ Component, pageProps }) {
  return (
    <ApolloProvider client={createApolloClient()}>
      <Component {...pageProps} />
    </ApolloProvider>
  );
}

export default MyApp;
```

Note the use of an `HttpLink` instance. With Apollo Client, [links](https://www.apollographql.com/docs/link/) are composable units, similar to middleware, that allow us to inject logic into the networking layer of a GraphQL request. Here we create a link to point Apollo Client to our GraphQL API running at `localhost:4001/graphql`. Later, we'll use the link to add an authorization header that includes an auth token once a user has signed in to the application, but for now we'll start with making unauthenticated GraphQL requests.

## Making GraphQL Queries With Apollo Client In A Next.js Page

With Next.js' file based routing system we can create new pages just by creating a file in the `pages` directory and exporting a React component. Let's create a `podcasts` page to display a list of available podcasts. We'll make use of the `useQuery` Apollo Client hook to execute a GraphQL query to find all podcasts in the database and return their title.

```js
import { useQuery, gql } from "@apollo/client";

const PodcastQuery = gql`
  {
    Podcast {
      title
    }
  }
`;

const Podcasts = () => {
  const { data } = useQuery(PodcastQuery);

  return (
    <div>
      <ul>
        {data?.Podcast.map((v) => {
          return <li key={v.title}>{v.title}</li>;
        })}
      </ul>
    </div>
  );
};

export default Podcasts;
```

Next.js will automatically add a route at `/podcasts` to render our new page.

![List of podcasts](/images/blog/grandcast-4/podcasts.png)

There are only a few podcasts in the database since they are only added to the database when a user subscribes. Refer to [Episode 2](https://lyonwj.com/blog/grandstack-podcast-app-user-auth-podcast-subscribe#podcast-subscribe) to see how we implemented podcast subscribe functionality.

## Slight Detour - Setting Up The GraphQL VS Code Extension

If you use the VS Code editor it can be helpful to make use of the GraphQL VS Code extension. This extension will enable syntax highlighting in .graphql files, gql template tags, and can also be used to execute GraphQL queries that are tagged in your JavaScript files. To use the GraphQL VS Code extension you'll need to install it from the extension marketplace [here.](https://marketplace.visualstudio.com/items?itemName=GraphQL.vscode-graphql) Then you'll also need to configure your project's GraphQL APIs in a GraphQL config file. Here's a simple example for this project:

```yml
schema: "api/src/schema.graphql"
extensions:
  endpoints:
    default:
      url: http://localhost:4001/graphql
```

This will now allow us to execute GraphQL queries from VS Code that we've tagged with the `gql` template tag:

![GraphQL VS Code extension](/images/blog/grandcast-4/vscode-extension.png)

# Authenticated GraphQL Requests In Next.js

We've seen how to make use of Apollo Client in our Next.js application to render a list of available podcasts, however this only works for unauthenticated GraphQL requests. We need to allow users to sign in to our application and then once they've signed in expose the user-specific functionality that we've built into our GraphQL API layer: podcast subscribe, new episode feeds, and create/view/update episode playlists.

To handle authentication and the associated state (Is the user signed in? What is the user's auth token?) we will make use of the React Context API and the Provider pattern again, this time creating our own `AuthProvider` that will allow us to keep track of and update authentication related state. Specifically, we'll need to:

- Execute the `login` GraphQL mutation operation to sign a user into the application.
- The `login` GraphQL mutation will return a JWT token when a user successfully signs in. We'll need to keep track of that token.
- When a user is signed in and a valid JWT is generated we need to add the token to all GraphQL requests as an authentication header.
- Allow a user to sign out.

All of this functionality will then be made available to any of our application components by importing the `useAuth` hook that we will create in our authentication provider.

```js
import React, { useState, useContext, createContext } from "react";
import {
  ApolloProvider,
  ApolloClient,
  InMemoryCache,
  HttpLink,
  gql,
} from "@apollo/client";

const authContext = createContext();

export function AuthProvider({ children }) {
  const auth = useProvideAuth();

  return (
    <authContext.Provider value={auth}>
      <ApolloProvider client={auth.createApolloClient()}>
        {children}
      </ApolloProvider>
    </authContext.Provider>
  );
}

export const useAuth = () => {
  return useContext(authContext);
};

function useProvideAuth() {
  const [authToken, setAuthToken] = useState(null);

  const isSignedIn = () => {
    if (authToken) {
      return true;
    } else {
      return false;
    }
  };

  const getAuthHeaders = () => {
    if (!authToken) return null;

    return {
      authorization: `Bearer ${authToken}`,
    };
  };

  const createApolloClient = () => {
    const link = new HttpLink({
      uri: "http://localhost:4001/graphql",
      headers: getAuthHeaders(),
    });

    return new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });
  };

  const signIn = async ({ username, password }) => {
    const client = createApolloClient();
    const LoginMutation = gql`
      mutation signin($username: String!, $password: String!) {
        login(username: $username, password: $password) {
          token
        }
      }
    `;

    const result = await client.mutate({
      mutation: LoginMutation,
      variables: { username, password },
    });

    console.log(result);

    if (result?.data?.login?.token) {
      setAuthToken(result.data.login.token);
    }
  };

  const signOut = () => {
    setAuthToken(null);
  };

  return {
    setAuthToken,
    isSignedIn,
    signIn,
    signOut,
    createApolloClient,
  };
}
```

Note how we make use of the `HttpLink` to add the authentication header to GraphQL requests when a user is signed in. We also wrap the `ApolloProvider` component in our `AuthProvider` which will make Apollo Client and the authentication functionality available to any child components in the React component hierarchy. We'll need to update `_app.js` to use this new `AuthProvider`:

```js
import "../styles/globals.css";
import { AuthProvider } from "../lib/auth.js";

function MyApp({ Component, pageProps }) {
  return (
    <AuthProvider>
      <Component {...pageProps} />
    </AuthProvider>
  );
}

export default MyApp;
```

## The Sign In Flow

Now that we've implemented authentication functionality in our `AuthProvider` we can implement the sign in flow in our index page. First, we'll want to import the new `useAuth` hook we created:

```js
import { useAuth } from "../lib/auth.js";
```

Now, let's add a `SignIn` component with a form for the user to submit their username and password. When the user submits the form we'll call the `signIn` function made available in `auth.js` which will execute the `login` GraphQL mutation and generate an auth JSON Web Token (JWT).

```js
const SignIn = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const { signIn, signOut } = useAuth();

  function onSubmit(e) {
    e.preventDefault();
    signIn({ username, password });
  }

  return (
    <div>
      <form onSubmit={onSubmit}>
        <input
          type="text"
          placeholder="username"
          onChange={(e) => setUsername(e.target.value)}
        ></input>
        <input
          type="password"
          placeholder="password"
          onChange={(e) => setPassword(e.target.value)}
        ></input>
        <button type="submit">Sign In</button>
      </form>
    </div>
  );
};
```

Once a user is signed in we want to show their podcast episode feed - the most recent podcast episodes across all the podcasts they subscribe to. This is available via the `episodeFeed` GraphQL query field. We'll create a `FeedQuery` component to execute this query and render the results in a list. Since the user is signed in, the appropriate auth token will be added in the header of the GraphQL request, making this an authenticated GraphQL request against our API.

```js
const FeedQuery = gql`
  {
    episodeFeed(first: 50) {
      id
      title
      audio
      podcast {
        title
      }
    }
  }
`;

const EpisodeFeed = () => {
  const { data } = useQuery(FeedQuery);
  const { signOut } = useAuth();
  return (
    <div>
      <h1>Episode Feed</h1>
      <ul>
        {data?.episodeFeed.map((v) => {
          return <li key={v.id}>{v.title}</li>;
        })}
      </ul>
      <button onClick={() => signOut()}>Sign Out</button>
    </div>
  );
};
```

Next, we'll make use of the `isSignedIn` function made available via `useAuth` to determine whether to render the sign in form or the episode feed component.

```js
export default function Home() {
  const { isSignedIn } = useAuth();
  return (
    <div className={styles.container}>
      <Head>
        <title>GRANDcast.FM</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <h1>GRANDcast.FM</h1>
        {!isSignedIn() && <SignIn />}
        {isSignedIn() && <EpisodeFeed />}
      </main>
    </div>
  );
}
```

Now, when we first load the page we're presented with a sign in form that will execute the `login` GraphQL mutation when submitted. If a successful login, then the GraphQL server will generate an authorization JWT and return the token to the client. Our auth provider will store that token and attach it in the authorization header of all future GraphQL requests, until we log out.

![List of podcast episodes](/images/blog/grandcast-4/signin-form.png)

Once we're authenticated, instead of the login form, we're presented with a list of the most recent podcast episodes for all podcasts to which we subscribe. We can click the "Sign Out" button, which will update the authentication state in our application, remove the token from future GraphQL requests, and we'll be presented with the sign in form again.

![List of podcast episodes](/images/blog/grandcast-4/podcast-list.png)

Now that we've set up client-side authentication in our Next.js application we can start to explore the different data-fetching patterns available to us in Next.js. We skipped over this functionality in this post but the different server data-fetching models in Next.js are some of the most interesting features of the framework. We'll dig into this in the next episode.

Be sure to subscribe to the Neo4j livestream on [Twitch](https://www.twitch.tv/neo4j) or [Youtube](https://www.youtube.com/neo4j) to keep up to date as we build out more features in [GRANDcast.FM](https://grandcast.fm). What else would you like us to explore on the livestream? Let us know on [Twitter.](https://twitter.com/lyonwj) And please drop any comments and feedback specific to this post over at [Dev.to](https://dev.to/lyonwj/getting-started-with-next-js-and-graphql-authentication-building-grandcast-fm-episode-4-14em)

# Resources

- [Code on Github](https://github.com/johnymontana/grandcast.fm)
- [Next.js Tutorial](https://nextjs.org/learn/basics/create-nextjs-app)
- [Neo4j Next.js Example](https://github.com/vercel/next.js/tree/canary/examples/with-neo4j)
- [Neo4j Next.js Example With GraphQL](https://github.com/vercel/next.js/tree/canary/examples/with-apollo-neo4j-graphql)
- [GraphQL VSCode Extension](https://marketplace.visualstudio.com/items?itemName=GraphQL.vscode-graphql)
