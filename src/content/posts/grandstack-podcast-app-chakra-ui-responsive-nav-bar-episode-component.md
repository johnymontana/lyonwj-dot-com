---
title: "Building A Responsive Navigation Bar And Podcast Episode Feed With The Chakra UI React Component Library"
pubDate: 2021-03-21
description: "Building A GRANDstack Podcast App: Episode 5"
image:
  url: "/images/blog/grandcast-5/banner.png"
  alt: "Building a Responsive Navigation Bar and Podcast Episode Feed With The Chakra UI React Component Library"
avatar:
  url: "/images/will.jpeg"
  alt: "#_"
tags: ["Next.js", "Neo4j", "GraphQL", "GRANDstack", "JavaScript", "GRANDcast"]
author: William Lyon
---

_This is the fifth post in a series about building a podcast application using [GRANDstack](https://grandstack.io). Check out the previous episodes here:_

> - [**Episode 1:** "Podcast Search GraphQL API With Neo4j And The Podcast Index"](https://lyonwj.com/blog/grandstack-podcast-app-podcast-search-graphql-api)
> - [**Episode 2:** "GRANDcast.FM: User Auth & Podcast Subscribe Functionality"](https://lyonwj.com/blog/grandstack-podcast-app-user-auth-podcast-subscribe)
> - [**Episode 3:** "Parsing And Importing XML With Neo4j: Adding Episodes and Playlists"](https://lyonwj.com/blog/grandstack-podcast-app-parsing-xml-neo4j-rss-episodes-playlists)
> - [**Episode 4:** "Getting Started With Next.js and GraphQL Authentication"](https://lyonwj.com/blog/grandstack-podcast-app-next-js-graphql-authentication)

In this post we turn our attention to the frontend of the podcast application we've been building on the [Neo4j livestream](https://www.twitch.tv/neo4j). So far we’ve focused on the backend and GraphQL API layer. This week we got started on the front end, using the Next.js React framework and the Chakra UI component library. You can find the livestream recording embedded below or on the [Neo4j Youtube channel](https://youtube.com/neo4j).

<iframe
  width="560"
  height="315"
  src="https://www.youtube-nocookie.com/embed/x0_a9tOpExc?si=AdVh1rzTJ4g3K2vy"
  title="YouTube video player"
  frameborder="0"
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
  referrerpolicy="strict-origin-when-cross-origin"
  allowfullscreen
></iframe>

## The Chakra UI Component Library

Chakra UI is a component library for React. For me, Chakra is a good middle-ground component library between the approach of Tailwind CSS, which offers utility CSS classes that can then be used to build components and more heavy-weight component libraries like Material UI. The [Chakra docs](https://chakra-ui.com/) describe Chakra UI as "a simple, modular and accessible component library that gives you the building blocks you need to build your React applications" which I think is a fair description.

I use Chakra on my personal website and in a few other projects so I thought it would be a good fit for our podcast application.

## Installing Chakra UI

First, we'll install Chakra UI and its dependencies:

```shell
npm i @chakra-ui/react @emotion/react@^11 @emotion/styled@^11 framer-motion@^4
```

We're also going to use the Chakra icon library so let's install that package as well:

```shell
npm i @chakra-ui/icons
```

Since we're using Next.js the next step for installing Chakra is to edit `pages/_app.js` to inject the `ChakraProvider` component into our application's React component hierarchy.

```jsx
import { AuthProvider } from "../lib/auth.js";
import { ChakraProvider } from "@chakra-ui/react";

function MyApp({ Component, pageProps }) {
  return (
    <ChakraProvider>
      <AuthProvider>
        <Component {...pageProps} />
      </AuthProvider>
    </ChakraProvider>
  );
}
```

## Improving Our Sign In Form

Let's make use of the Chakra UI form components to improve the look and feel of our sign in form. We'll use the following Chakra UI components:

- [FormControl](https://chakra-ui.com/docs/form/form-control) - The Form Control component provides a form wrapper and is useful for adding labels, helper text, and form validation.
- [Button](https://chakra-ui.com/docs/form/button) - Chakra UI buttons can support custom icons.
- [Input](https://chakra-ui.com/docs/form/input) - For gathering user input in a text field.

```jsx
import { useState } from "react";
import { useAuth } from "../lib/auth";
import { FormControl, FormLabel, Button, Input } from "@chakra-ui/react";

const SignIn = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { signIn } = useAuth();

  function onSubmit(e) {
    e.preventDefault();
    signIn({ username, password });
  }

  return (
    <div>
      <FormControl b={"1px"} id="signin">
        <FormLabel m={4}>Sign In</FormLabel>
        <Input
          m={4}
          type="text"
          placeholder="username"
          onChange={(e) => setUsername(e.target.value)}
        ></Input>
        <Input
          m={4}
          type="password"
          placeholder="password"
          onChange={(e) => setPassword(e.target.value)}
        ></Input>
        <Button w={"100%"} m={4} type="submit" onClick={onSubmit}>
          Log In
        </Button>
      </FormControl>
    </div>
  );
};

export default SignIn;
```

## Building A Responsive Header

Now we're ready to add a responsive header to our application. We'd like it to act as a navigation bar, showing the various options like "home", "playlists", "search", etc. When on a mobile device or narrow width the header should collapse and show a hamburger menu option to expand the menu items. I used [this blog post](https://raptis.wtf/blog/build-a-landing-page-with-chakra-ui-part-1/#the-responsive-header-component) from Jim Raptis as a guide for creating the header using Chakra UI. His post goes into more detail on creating a responsive hero section and his nav bar has some additional features so if you want a more complete example see Jim's post.

Here's what our responsive navigation header will look like in various states with our updated sign in form:

![Responsive header with Chakra UI](/images/blog/grandcast-5/navbar.png)

We'll make use of the following Chakra-UI components:

- [Box](https://chakra-ui.com/docs/layout/box) - Useful for creating responsive layouts and grouping elements.
- [Flex](https://chakra-ui.com/docs/layout/flex) - Similar to Box, but uses `display: flex` CSS rule for working with flexbox CSS.
- [Text](https://chakra-ui.com/docs/typography/text) - For rendering text, has some helper props for styling.

First, we create a `MenuItem` component that will render each individual item in the menu. We use the [next/link component](https://nextjs.org/docs/api-reference/next/link) for handling the client-side transition between routes. We also make use of the Chakra UI [style props](https://chakra-ui.com/docs/features/style-props) to conditionally add less margin if the menu item is the last in the menu and also depending on the responsive breakpoints.

```jsx
import Link from "next/Link";
import { Text } from "@chakra-ui/react";

const MenuItem = ({ children, isLast, to = "/" }) => {
  return (
    <Text
      mb={{ base: isLast ? 0 : 8, sm: 0 }}
      mr={{ base: 0, sm: isLast ? 0 : 8 }}
      display="block"
    >
      <Link href={to}>{children}</Link>
    </Text>
  );
};
```

We'll use a React state variable to toggle the hamburger menu, but the trick to showing/hiding the hamburger icon is by conditionally setting `display: none` on that element once we're at the medium breakpoint.

```jsx
import { useState } from 'react';
import { Flex, Box, Text } from '@chakra-ui/react';
import { CloseIcon, HamburgerIcon } from '@chakra-ui/icons';

const Header = (props) => {
  const [show, setShow] = useState(false);
  const toggleMenu = () => setShow(!show);

  return (
    ...

    <Box display={{ base: 'block', md: 'none' }} onClick={toggleMenu}>
      {show ? <CloseIcon /> : <HamburgerIcon />}
    </Box>

    ...
  );
};
```

All together our Header component code looks like this:

```jsx
import { useState } from "react";
import { Flex, Box, Text } from "@chakra-ui/react";
import { CloseIcon, HamburgerIcon } from "@chakra-ui/icons";
import Link from "next/Link";

const MenuItem = ({ children, isLast, to = "/" }) => {
  return (
    <Text
      mb={{ base: isLast ? 0 : 8, sm: 0 }}
      mr={{ base: 0, sm: isLast ? 0 : 8 }}
      display="block"
    >
      <Link href={to}>{children}</Link>
    </Text>
  );
};

const Header = (props) => {
  const [show, setShow] = useState(false);
  const toggleMenu = () => setShow(!show);
  return (
    <Flex
      mb={8}
      p={8}
      as="nav"
      align="center"
      justify="space-between"
      wrap="wrap"
      w="100%"
    >
      <Box w="200px">
        <Text fontSize="lg" fontWeight="bold">
          GRANDcast.FM
        </Text>
      </Box>

      <Box display={{ base: "block", md: "none" }} onClick={toggleMenu}>
        {show ? <CloseIcon /> : <HamburgerIcon />}
      </Box>

      <Box
        display={{ base: show ? "block" : "none", md: "block" }}
        flexBasis={{ base: "100%", md: "auto" }}
      >
        <Flex
          align="center"
          justify={["center", "space-between", "flex-end", "flex-end"]}
          direction={["column", "row", "row", "row"]}
          pt={[4, 4, 0, 0]}
        >
          <MenuItem to="/">Home</MenuItem>
          <MenuItem to="/podcasts">Podcasts</MenuItem>
          <MenuItem to="/playlists">Playlists</MenuItem>
          <MenuItem to="/search" isLast>
            Search
          </MenuItem>
        </Flex>
      </Box>
    </Flex>
  );
};

export default Header;
```

We want our header to show up on all pages across our application so we'll update `pages/_app.js` and include our new `Header` component in the React component hierarchy for all pages.

```jsx
import { AuthProvider } from "../lib/auth.js";
import { ChakraProvider } from "@chakra-ui/react";
import Header from "../components/Header";

function MyApp({ Component, pageProps }) {
  return (
    <ChakraProvider>
      <AuthProvider>
        <Header />
        <Component {...pageProps} />
      </AuthProvider>
    </ChakraProvider>
  );
}
```

## Episode Feed

Once the user has signed in, the application's landing page should show a list of the most recent episodes across the podcasts that the currently authenticated user subscribes to. From there the user can choose to play an episode or assign an episode to a playlist.

![A podcast feed built with Chakra UI](/images/blog/grandcast-5/feed1.png)

### The Episode Component

Let's first build an Episode component that will display the details of the episode, allow the user to play the audio, or assign the episode to a playlist.

![Podcast React component with Chakra UI](/images/blog/grandcast-5/episode.png)

To do this we'll make use of the following Chakra UI components:

- [Accordion](https://chakra-ui.com/docs/disclosure/accordion) - Used to display high-level information that can then be expanded for detailed information. We'll use an Accordion to show and hide the episodes show notes.
- [Flex](https://chakra-ui.com/docs/layout/flex) - For responsive layouts using flexbox CSS.
- [Menu](https://chakra-ui.com/docs/overlay/menu) - An overlay component for rendering a dropdown menu of buttons.

Our Episode component will take two objects as props: podcast (the details for a particular podcast episode) and playlists (the users playlists and episodes assigned to each). We'll use a Flex component as the main structure for the component.

```jsx
import {
  Accordion,
  AccordionItem,
  AccordionIcon,
  AccordionButton,
  AccordionPanel,
  Box,
  Flex,
  Image,
  Text,
  Heading,
  Spacer,
  Button,
} from "@chakra-ui/react";

import { AddIcon } from "@chakra-ui/icons";

const Episode = ({ episode, playlists }) => {
  return (
    <Flex
      style={{ maxWidth: "700px", width: "100%" }}
      border="1px"
      rounded="lg"
    >
      <Box style={{ width: "125px" }}>
        <Image boxSize="125px" src={episode.podcast.image} m={2} />
        <AddIcon />
      </Box>
      <Flex ml={4} direction="column" style={{ width: "100%" }}>
        <div>
          <Accordion allowToggle>
            <AccordionItem>
              <h2>
                <AccordionButton>
                  <Box flex="1" textAlign="left">
                    <Heading size="sm">{episode.title}</Heading>
                  </Box>
                  <AccordionIcon />
                </AccordionButton>
              </h2>
              <AccordionPanel pb={4} m={4}>
                <div
                  dangerouslySetInnerHTML={{ __html: episode.summary }}
                ></div>
              </AccordionPanel>
            </AccordionItem>
          </Accordion>
        </div>
        <Flex direction="column">
          <Text fontSize="lg" mr={4} isTruncated>
            {episode.podcast?.title}
          </Text>
          <Spacer />
          <Text mr={4} as="i">
            {`${episode.pubDate.month}/${episode.pubDate.day}/${episode.pubDate.year}`}
          </Text>
        </Flex>
        <div
          style={{
            marginRight: "4px",
            marginBottom: "4px",
            marginTop: "auto",
          }}
        >
          <audio style={{ width: "100%" }} controls>
            <source src={episode.audio} type="audio/mpeg"></source>
          </audio>
        </div>
      </Flex>
    </Flex>
  );
};

export default Episode;
```

Next, we need to execute a GraphQL mutation when a user wants to add the episode to a playlist. Our GraphQL API has a `addEpisodeToPlaylist` mutation field to handle this. We'll declare the `episodeId` and `playlistName` arguments as GraphQL variables when defining the GraphQL mutation operation and use the `useMutation` Apollo Client GraphQL hook.

```js
import { gql, useMutation } from '@apollo/client';

const ADD_EPISODE_TO_PLAYLIST = gql`
  mutation addToPlaylist($episodeId: ID!, $playlistName: String!) {
    addEpisodeToPlaylist(name: $playlistName, podcastId: $episodeId) {
      name
    }
  }
`;

const Episode = ({ episode, playlists }) => {
  const [addEpisode] = useMutation(ADD_EPISODE_TO_PLAYLIST);

  ...
}
```

Below the episode's image we included an add icon. We want to use that icon button to trigger a Menu that will show the currently authenticated user's playlists, giving the user the option of selecting which playlist they want to add the episode to. We need a way to tell the user if this episode has already been assigned to the playlist, though. To do that let's create a function `isEpisodeInPlaylist` that will take a playlistName as an argument and return true if the episode has already been assigned to the given playlist.

```js
const isEpisodeInPlaylist = (playlistName) => {
  const playlist = playlists.filter((i) => {
    return playlistName === i.name;
  });

  const episodes = playlist[0].episodes?.map((v) => {
    return v.id;
  });

  return episodes?.includes(episode.id);

  // playlist structure = [{name: "Foobar", episodes: [{id: 123}]}]
};
```

Now we're ready to add the Menu to the Episode component. We'll show a CheckIcon if the episode is already assigned to the playlist. The onClick handler for the playlist MenuItem will execute the `addEpisodeToPlaylist` GraphQL mutation.

```jsx
<Menu m={2} style={{ width: "125px" }}>
  <MenuButton m={2} style={{ width: "125px" }} as={Button}>
    <AddIcon />
  </MenuButton>
  <MenuList>
    {playlists?.map((v) => {
      return (
        <MenuItem
          icon={isEpisodeInPlaylist(v.name) ? <CheckIcon /> : null}
          key={v.name}
          onClick={() => {
            addEpisode({
              variables: {
                episodeId: episode.id,
                playlistName: v.name,
              },
            });
          }}
        >
          {v.name}
        </MenuItem>
      );
    })}
  </MenuList>
</Menu>
```

Putting it all together the code for our Episode component now looks like this:

```jsx
import {
  Accordion,
  AccordionItem,
  AccordionIcon,
  AccordionButton,
  AccordionPanel,
  Box,
  Flex,
  Image,
  Text,
  Heading,
  Spacer,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Button,
} from "@chakra-ui/react";

import { AddIcon, CheckIcon } from "@chakra-ui/icons";

import { gql, useMutation } from "@apollo/client";

const ADD_EPISODE_TO_PLAYLIST = gql`
  mutation addToPlaylist($episodeId: ID!, $playlistName: String!) {
    addEpisodeToPlaylist(name: $playlistName, podcastId: $episodeId) {
      name
    }
  }
`;

const Episode = ({ episode, playlists }) => {
  const [addEpisode] = useMutation(ADD_EPISODE_TO_PLAYLIST);

  const isEpisodeInPlaylist = (playlistName) => {
    const playlist = playlists.filter((i) => {
      return playlistName === i.name;
    });

    const episodes = playlist[0].episodes?.map((v) => {
      return v.id;
    });

    return episodes?.includes(episode.id);

    // playlist structure = [{name: "Foobar", episodes: [{id: 123}]}]
  };

  return (
    <Flex
      style={{ maxWidth: "700px", width: "100%" }}
      border="1px"
      rounded="lg"
    >
      <Box style={{ width: "125px" }}>
        <Image boxSize="125px" src={episode.podcast.image} m={2} />
        <Menu m={2} style={{ width: "125px" }}>
          <MenuButton m={2} style={{ width: "125px" }} as={Button}>
            <AddIcon />
          </MenuButton>
          <MenuList>
            {playlists?.map((v) => {
              return (
                <MenuItem
                  icon={isEpisodeInPlaylist(v.name) ? <CheckIcon /> : null}
                  key={v.name}
                  onClick={() => {
                    addEpisode({
                      variables: {
                        episodeId: episode.id,
                        playlistName: v.name,
                      },
                    });
                  }}
                >
                  {v.name}
                </MenuItem>
              );
            })}
          </MenuList>
        </Menu>
      </Box>
      <Flex ml={4} direction="column" style={{ width: "100%" }}>
        <div>
          <Accordion allowToggle>
            <AccordionItem>
              <h2>
                <AccordionButton>
                  <Box flex="1" textAlign="left">
                    <Heading size="sm">{episode.title}</Heading>
                  </Box>
                  <AccordionIcon />
                </AccordionButton>
              </h2>
              <AccordionPanel pb={4} m={4}>
                <div
                  dangerouslySetInnerHTML={{ __html: episode.summary }}
                ></div>
              </AccordionPanel>
            </AccordionItem>
          </Accordion>
        </div>
        <Flex direction="column">
          <Text fontSize="lg" mr={4} isTruncated>
            {episode.podcast?.title}
          </Text>
          <Spacer />
          <Text mr={4} as="i">
            {`${episode.pubDate.month}/${episode.pubDate.day}/${episode.pubDate.year}`}
          </Text>
        </Flex>
        <div
          style={{
            marginRight: "4px",
            marginBottom: "4px",
            marginTop: "auto",
          }}
        >
          <audio style={{ width: "100%" }} controls>
            <source src={episode.audio} type="audio/mpeg"></source>
          </audio>
        </div>
      </Flex>
    </Flex>
  );
};

export default Episode;
```

Now we're ready to update `pages/index.js`. We added the data-fetching logic to fetch the users most recent episodes from the GraphQL API [previously](https://lyonwj.com/blog/grandstack-podcast-app-next-js-graphql-authentication) so we don't need to worry about that. Instead of rendering a list of episode titles, we'll map over the episode data from the GraphQL result and render our new Episode component, wrapped in a VStack component from Chakra UI to add uniform spacing between episodes in the feed.

```js
import Head from "next/head";
import { useState } from "react";
import styles from "../styles/Home.module.css";
import { gql, useQuery } from "@apollo/client";
import { useAuth } from "../lib/auth.js";
import SignIn from "../components/SignIn";
import Episode from "../components/Episode";
import { Container, VStack } from "@chakra-ui/react";

const EpisodeFeed = () => {
  const FeedQuery = gql`
    {
      episodeFeed(first: 50) {
        id
        title
        audio
        summary
        image
        pubDate {
          day
          month
          year
        }
        podcast {
          title
          image
        }
      }
    }
  `;

  const PlaylistQuery = gql`
    {
      playlists {
        name
        episodes {
          id
        }
      }
    }
  `;

  const { data } = useQuery(FeedQuery);
  const { data: playlistData } = useQuery(PlaylistQuery);
  const { signOut } = useAuth();

  return (
    <div>
      <VStack spacing={8} w={"100%"}>
        {data?.episodeFeed.map((v) => {
          // return <li key={v.id}>{v.title}</li>
          return (
            <Episode
              key={v.id}
              episode={v}
              playlists={playlistData?.playlists}
            />
          );
        })}
      </VStack>
      <button onClick={() => signOut()}>Sign Out</button>
    </div>
  );
};

export default function Home() {
  const { isSignedIn } = useAuth();
  return (
    <div>
      <Head>
        <title>GRANDcast.FM</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Container>
        {!isSignedIn() && <SignIn />}
        {isSignedIn() && <EpisodeFeed />}
      </Container>
    </div>
  );
}
```

That covers some initial basic functionality in our application. Users can now sign in, view and listen to the most recent episodes of the podcasts they subscribe to, and assign episodes to playlists. In [the next episode](http://lyonwj.com/blog/grandstack-podcast-app-chakra-ui-next-js-graphql-apollo-client) we'll continue adding frontend functionality using Chakra UI, Next.js, and GraphQL with Apollo Client.

## Resources

- [GRANDcast.FM code on GitHub](https://github.com/johnymontana/grandcast.fm)
- [Chakra UI Docs](https://chakra-ui.com/docs/getting-started)
- [Blog post from Jim Raptis on building a landing page with Chakra UI](https://raptis.wtf/blog/build-a-landing-page-with-chakra-ui-part-1/)
- [HTML audio element guide](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/audio)
- [Guide to working with flexbox CSS](https://css-tricks.com/snippets/css/a-guide-to-flexbox/)
