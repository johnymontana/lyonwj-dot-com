---
title: "Adding Frontend Features With Next.js, Chakra UI, & Apollo Client"
pubDate: 2021-03-21
description: "Building A GRANDstack Podcast App: Episode 6"
image:
  url: "/images/blog/grandcast-6/banner.png"
  alt: "Adding Frontend Features With Next.js, Chakra UI, & Apollo Client"
avatar:
  url: "/images/will.jpeg"
  alt: "#_"
tags: ["Next.js", "Neo4j", "GraphQL", "GRANDstack", "JavaScript", "GRANDcast"]
author: William Lyon
---

_This is the sixth post in a series about building a podcast application using [GRANDstack](https://grandstack.io). Check out the previous episodes here:_

> - [**Episode 1:** "Podcast Search GraphQL API With Neo4j And The Podcast Index"](https://lyonwj.com/blog/grandstack-podcast-app-podcast-search-graphql-api)
> - [**Episode 2:** "GRANDcast.FM: User Auth & Podcast Subscribe Functionality"](https://lyonwj.com/blog/grandstack-podcast-app-user-auth-podcast-subscribe)
> - [**Episode 3:** "Parsing And Importing XML With Neo4j: Adding Episodes and Playlists"](https://lyonwj.com/blog/grandstack-podcast-app-parsing-xml-neo4j-rss-episodes-playlists)
> - [**Episode 4:** "Getting Started With Next.js and GraphQL Authentication"](https://lyonwj.com/blog/grandstack-podcast-app-next-js-graphql-authentication)
> - [**Episode 5:** "Responsive Navigation Bar And Podcast Episode Component With Chakra UI"](https://lyonwj.com/blog/grandstack-podcast-app-chakra-ui-responsive-nav-bar-episode-component)

In this post we continue adding frontend features to [GRANDcast.FM](http://grandcast.fm), our podcast application built with [GRANDstack](https://grandstack.io) using Chakra UI, Next.js, and GraphQL with Apollo Client. Our goal this time is to add a playlist view and a podcast search results view. We worked through adding these features on a recent episode of the [Neo4j live stream](https://www.twitch.tv/neo4j):

<iframe
  width="560"
  height="315"
  src="https://www.youtube.com/embed/UXD89QFg0tU?si=-fBcoFpD1rO2N4M6"
  title="YouTube video player"
  frameborder="0"
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
  referrerpolicy="strict-origin-when-cross-origin"
  allowfullscreen
></iframe>

## Building The Playlist View

The first frontend feature we want to build is our playlist view. We want the user to be able to:

- See all their playlists
- Select a playlist and view the podcast episodes assigned to that playlist
- Create new playlists

Here's what the final playlist view will look like:

![Podcast playlist UI built with Chakra UI](/images/blog/grandcast-6/playlists.png)

In the [previous post](http://lyonwj.com/blog/grandstack-podcast-app-chakra-ui-responsive-nav-bar-episode-component) we created an `Episode` component that can display episode details, allow the user to play the episode, and add episodes to playlists, so we'll reuse that component in our playlist view.

In the playlist view we'll make use of the following Chakra UI components:

- [Flex](https://chakra-ui.com/docs/layout/flex) - Useful for creating responsive layout, renders a `div` with `display: flex`.
- [Popover](https://chakra-ui.com/docs/overlay/popover) - A floating dialog that can be triggered by a user interaction. We'll use a Popover to input playlist name when creating a new playlist.
- [VStack](https://chakra-ui.com/docs/layout/stack) - A layout component for stacking elements together vertically with uniform spacing. We'll use VStack for rendering a list of podcast Episode components in the selected playlist.

### Fetching Data With Apollo Client

First, we need to find the playlists that belong to the currently authenticated user. We'll populate a select input with the names of these playlists for the user to select.

In [Episode 3](http://lyonwj.com/blog/grandstack-podcast-app-parsing-xml-neo4j-rss-episodes-playlists) we added functionality in our GraphQL API for handling user playlists. Using the authentication token in the request header (see [Episode 4](https://lyonwj.com/blog/grandstack-podcast-app-next-js-graphql-authentication) for how we handle authentication in Next.js) our GraphQL API will find all playlists for the user, as well as podcast episodes assigned to each playlist.

![Fetching playlists in GraphQL Playground](/images/blog/grandcast-6/playground1.png)

Using the `playlists` GraphQL query field we can find all playlists and their associated podcast episodes for the currently authenticated user. We'll populate a select dropdown input with the name of each playlist and update a React state variable `selectedPlaylist` when the user selects a playlist from the select input.

```jsx
import { gql, useQuery } from "@apollo/client";

const GET_PLAYLISTS = gql`
  {
    playlists {
      name
      episodes {
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
  }
`;

export default function Playlists() {
  const { data } = useQuery(GET_PLAYLISTS);
  const [selectedPlaylist, setSelectedPlaylist] = useState("");

  return (
    <Container>
      {!isSignedIn() && <SignIn />}
      {isSignedIn() && (
        <div>
          <FormControl id="playlists">
            <FormLabel>Playlists</FormLabel>
            <Flex>
              <Select
                placeholder="Select playlist"
                onChange={(e) => setSelectedPlaylist(e.target.value)}
              >
                {data?.playlists?.map((p) => {
                  return (
                    <option key={p.name} value={p.name}>
                      {p.name}
                    </option>
                  );
                })}
              </Select>
            </Flex>
          </FormControl>
        </div>
      )}
    </Container>
  );
}
```

That takes care of the initial requirement of showing the user their playlists. Next, we add functionality for the user to create new playlists.

### Creating A New Playlist

In the GraphQL API we'll use the `createPlaylist` mutation to add a new playlist for the user. The mutation is implemented using a `@cypher` directive with the logic to create the playlist node in the database and connect is to the user node with an `OWNS` relationship. See [Episode 3](https://lyonwj.com/blog/grandstack-podcast-app-parsing-xml-neo4j-rss-episodes-playlists) for how we've implemented that in the GraphQL API.

Let's add a button next to the playlist select input that when clicked will trigger a popover, prompting the user to enter the name for the new playlist they'd like to create. The popover will also include a button to create the playlist, which will trigger Apollo Client to execute the `createPlaylist` GraphQL mutation, passing the playlist name as a variable.

```js
const CREATE_PLAYLIST = gql`
  mutation createNewPlaylist($playlistName: String!) {
    createPlaylist(name: $playlistName) {
      name
    }
  }
`;
```

We'll also need to update the Apollo Client cache to include the name of the new playlist so it will immediately show up in the playlist select input. This concept of immediately updating the frontend view is called "optimistic UI" - we update the UI optimistically, assuming the GraphQL call to the backend will successfully be executed as intended and update the view to represent the state after the data is updated.

We handle this by passing an `update` function when calling the mutation which will first read from the Apollo Client cache, add the new playlist to the list of cached playlists, and then update the cache including the new playlist.

```jsx
<Popover>
  <PopoverTrigger>
    <Button ml={4}>
      <AddIcon />
    </Button>
  </PopoverTrigger>
  <PopoverContent>
    <PopoverArrow />
    <PopoverCloseButton />
    <PopoverHeader>Create new playlist</PopoverHeader>
    <PopoverBody>
      <FormControl id="newplaylist">
        <FormLabel>New playlist</FormLabel>
        <Input type="text" onChange={(e) => setNewPlaylist(e.target.value)} />
        <Button
          mt={4}
          onClick={() =>
            createPlaylist({
              variables: { playlistName: newPlaylist },
              update: (proxy) => {
                const data = proxy.readQuery({
                  query: GET_PLAYLISTS,
                });
                proxy.writeQuery({
                  query: GET_PLAYLISTS,
                  data: {
                    playlists: [
                      ...data.playlists,
                      {
                        __typename: "Playlist",
                        name: newPlaylist,
                      },
                    ],
                  },
                });
              },
            })
          }
        >
          Create
        </Button>
      </FormControl>
    </PopoverBody>
  </PopoverContent>
</Popover>
```

The user can now view their playlists, create a new playlist, and immediately see their new playlist in the select input without refreshing the page and triggering a refresh of the data from the backend GraphQL server. The next requirement we need to address is showing the episodes for the selected playlist.

### Filtering For The Selected Playlist

When the user selects an episode from the select input, the `selectedPlaylists` React state variable is updated with the name of the selected playlist. Let's compute the filtered playlist array of episodes for that playlist.

```js
const filteredPlaylist = data?.playlists.filter((p) => {
  return p.name === selectedPlaylist;
})[0];
```

Now that `filteredPlaylist` is an array of episodes for the currently selected playlist we can use a VStack to render a list of Episode components, showing the user the episodes they've assigned to that playlist.

Because `filteredPlaylist` is dependent on our `selectedPlaylist` React state variable, when the user selects a new playlist from the select input the filtered playlist will be recomputed and the view updated.

```jsx
<VStack spacing={4}>
  {filteredPlaylist?.episodes?.map((e) => {
    return <Episode key={e.id} episode={e} playlists={data.playlists} />;
  })}
</VStack>
```

Because we already built the functionality for adding an episode to a playlist in the `Episode` component that logic is already available.

### Putting It All Together: Playlist View

Here's what the playlist view code looks like now. We make use of the file-based router in Next.js - creating `pages/playlists.js` will create a new route at `/playlists` in our application.

```jsx
import { useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import Episode from "../components/Episode";
import SignIn from "../components/SignIn";
import { useAuth } from "../lib/auth";
import {
  VStack,
  FormControl,
  FormLabel,
  FormHelperText,
  Select,
  Container,
  Popover,
  PopoverTrigger,
  PopoverHeader,
  PopoverBody,
  PopoverContent,
  PopoverArrow,
  PopoverCloseButton,
  Button,
  Flex,
  Input,
} from "@chakra-ui/react";

import { AddIcon } from "@chakra-ui/icons";

const CREATE_PLAYLIST = gql`
  mutation createNewPlaylist($playlistName: String!) {
    createPlaylist(name: $playlistName) {
      name
    }
  }
`;

const GET_PLAYLISTS = gql`
  {
    playlists {
      name
      episodes {
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
  }
`;

export default function Playlists() {
  const [createPlaylist] = useMutation(CREATE_PLAYLIST);
  const [newPlaylist, setNewPlaylist] = useState("");
  const { data } = useQuery(GET_PLAYLISTS);

  const [selectedPlaylist, setSelectedPlaylist] = useState("");
  const isPopoverOpen = useState(false);

  const { isSignedIn } = useAuth();

  // show signin form if not authenticated
  // create new playlist
  // dropdown to select playlist
  // show episodes for each playlist when selected

  const filteredPlaylist = data?.playlists.filter((p) => {
    return p.name === selectedPlaylist;
  })[0];

  return (
    <Container>
      {!isSignedIn() && <SignIn />}
      {isSignedIn() && (
        <div>
          <FormControl id="playlists">
            <FormLabel>Playlists</FormLabel>
            <Flex>
              <Select
                placeholder="Select playlist"
                onChange={(e) => setSelectedPlaylist(e.target.value)}
              >
                {data?.playlists?.map((p) => {
                  return (
                    <option key={p.name} value={p.name}>
                      {p.name}
                    </option>
                  );
                })}
              </Select>
              <Popover>
                <PopoverTrigger>
                  <Button ml={4}>
                    <AddIcon />
                  </Button>
                </PopoverTrigger>
                <PopoverContent>
                  <PopoverArrow />
                  <PopoverCloseButton />
                  <PopoverHeader>Create new playlist</PopoverHeader>
                  <PopoverBody>
                    <FormControl id="newplaylist">
                      <FormLabel>New playlist</FormLabel>
                      <Input
                        type="text"
                        onChange={(e) => setNewPlaylist(e.target.value)}
                      />
                      <Button
                        mt={4}
                        onClick={() =>
                          createPlaylist({
                            variables: { playlistName: newPlaylist },
                            update: (proxy) => {
                              const data = proxy.readQuery({
                                query: GET_PLAYLISTS,
                              });
                              proxy.writeQuery({
                                query: GET_PLAYLISTS,
                                data: {
                                  playlists: [
                                    ...data.playlists,
                                    {
                                      __typename: "Playlist",
                                      name: newPlaylist,
                                    },
                                  ],
                                },
                              });
                            },
                          })
                        }
                      >
                        Create
                      </Button>
                    </FormControl>
                  </PopoverBody>
                </PopoverContent>
              </Popover>
            </Flex>
            <FormHelperText>Foobar</FormHelperText>
          </FormControl>
          <VStack spacing={4}>
            {filteredPlaylist?.episodes?.map((e) => {
              return (
                <Episode key={e.id} episode={e} playlists={data.playlists} />
              );
            })}
          </VStack>
        </div>
      )}
    </Container>
  );
}
```

## Podcast Search Results View

The next feature to add is a podcast search results view. We want the user to be able to search for podcasts, view the results, and subscribe to podcasts listed in the search results.

![Podcast search built with Chakra UI](/images/blog/grandcast-6/search.png)

### Podcast Search GraphQL Query

In [Episode 1](https://lyonwj.com/blog/grandstack-podcast-app-podcast-search-graphql-api) we built the functionality for searching for podcasts using the Podcast Index REST API. That functionality is exposed in the `podcastSearch` GraphQL query field.

![Searching for podcasts using the GraphQL API](/images/blog/grandcast-6/playground2.png)

### The `Podcast` Component

Similar to the Episode component, let's create a component for displaying podcast details like the title, description, and image. Our Podcast component will also need to include the logic for subscribing the user to the podcast.

We'll make use of the following Chakra UI components:

- [Box](https://chakra-ui.com/docs/layout/box) - Useful for creating responsive layouts and grouping elements.
- [Flex](https://chakra-ui.com/docs/layout/flex) - Similar to Box, but uses `display: flex` CSS rule. We'll use Flex as the basis for our Podcast component.
- [Heading](https://chakra-ui.com/docs/typography/heading) - Used for rendering headlines, we'll use Heading to display the podcast title.
- [Text](https://chakra-ui.com/docs/typography/text) - For rendering text and paragraphs, we'll use Text to show the podcast description.
- [Tag](https://chakra-ui.com/docs/data-display/tag) - For labels or keywords, we'll use Tags to display the podcast categories.
- [Stack](https://chakra-ui.com/docs/layout/stack) - Used to stack elements together with even spacing, we'll use an inline Stack to group Tag components describing the podcast categories.

Here's the initial structure of the Podcast component, displaying the basic podcast detail information that comes back from the `podcastSearch` GraphQL query.

```jsx
const Podcast = ({ podcast }) => {
  const { title, itunesId, description, artwork, categories } = podcast;

  return (
    <Flex rounded="lg" borderWidth="2px" m={4} style={{ maxWidth: "700px" }}>
      <Box width="200px">
        <Image src={artwork} boxSize="200px" />
        <Button width="100%">
          <AddIcon />
        </Button>
      </Box>

      <Box m={4} maxWidth="300px">
        <Heading noOfLines={2}>{title}</Heading>
        <Text noOfLines={3}>{description}</Text>

        <Stack isInline>
          {categories.slice(0, 3).map((c) => {
            return <Tag>{c}</Tag>;
          })}
        </Stack>
      </Box>
    </Flex>
  );
};

export default Podcast;
```

Now's it's time to add the functionality for subscribing the user to the podcast when they click the subscribe button.

First, we define the GraphQL query we want to execute, including declaring the podcast's iTunes ID as a GraphQL variable.

```js
const PODCAST_SUBSCRIBE = gql`
  mutation podcastSubscribe($itunesID: String!) {
    subscribeToPodcast(itunesId: $itunesID) {
      title
      itunesId
    }
  }
`;
```

Now we use Apollo Client's `useMutation` hook to execute the mutation when the user clicks the button by triggering the mutation function in the button's `onClick` handler.

```jsx
import {
  Button,
  Flex,
  Box,
  Image,
  Heading,
  Text,
  Stack,
  Tag,
} from "@chakra-ui/react";
import { AddIcon } from "@chakra-ui/icons";
import { gql, useMutation } from "@apollo/client";

const PODCAST_SUBSCRIBE = gql`
  mutation podcastSubscribe($itunesID: String!) {
    subscribeToPodcast(itunesId: $itunesID) {
      title
      itunesId
    }
  }
`;

const Podcast = ({ podcast }) => {
  const { title, itunesId, description, artwork, categories } = podcast;
  const [subscribeMutation, { data }] = useMutation(PODCAST_SUBSCRIBE);

  return (
    <Flex rounded="lg" borderWidth="2px" m={4} style={{ maxWidth: "700px" }}>
      <Box width="200px">
        <Image src={artwork} boxSize="200px" />
        <Button
          width="100%"
          onClick={() =>
            subscribeMutation({ variables: { itunesID: itunesId } })
          }
        >
          <AddIcon />
        </Button>
      </Box>

      <Box m={4} maxWidth="300px">
        <Heading noOfLines={2}>{title}</Heading>
        <Text noOfLines={3}>{description}</Text>

        <Stack isInline>
          {categories.slice(0, 3).map((c) => {
            return <Tag>{c}</Tag>;
          })}
        </Stack>
      </Box>
    </Flex>
  );
};

export default Podcast;
```

### Adding The `/podcasts` Page

Again, we'll make use of Next.js's file based router by creating `pages/podcasts.js` to create a route at `/podcasts` in our application.

This page will be have a text input for the user to input their search terms and button to initiate the search. Because the user is taking an action (clicking the search button) to explicitly begin the search and execute the GraphQL `podcastSearch` query - rather than running the GraphQL query when the component loads - we'll use Apollo Client's `useLazyQuery` to manually execute the query.

```jsx
import { useState } from "react";
import { useLazyQuery, gql } from "@apollo/client";
import { useAuth } from "../lib/auth";
import SignIn from "../components/SignIn";
import {
  FormLabel,
  FormControl,
  Input,
  Button,
  Container,
  Flex,
  SimpleGrid,
  VStack,
} from "@chakra-ui/react";
import Podcast from "../components/Podcast";

const PodcastSearchQuery = gql`
  query podcastSearch($searchTerm: String!) {
    podcastSearch(searchTerm: $searchTerm) {
      itunesId
      title
      description
      feedURL
      artwork
      categories
    }
  }
`;

const Podcasts = () => {
  const [getPodcasts, { data }] = useLazyQuery(PodcastSearchQuery);
  const { isSignedIn } = useAuth();
  const [searchString, setSearchString] = useState("");
  return (
    <Container>
      {!isSignedIn() && <SignIn />}
      {isSignedIn() && (
        <div>
          <FormControl id="podcastsearch">
            <FormLabel>Search podcasts</FormLabel>
            <Flex>
              <Input onChange={(e) => setSearchString(e.target.value)} />
              <Button
                ml={4}
                onClick={() =>
                  getPodcasts({ variables: { searchTerm: searchString } })
                }
              >
                Search
              </Button>
            </Flex>
          </FormControl>
          <div>
            <VStack>
              {data &&
                data.podcastSearch.map((p) => {
                  return <Podcast podcast={p} />;
                })}
            </VStack>
          </div>
        </div>
      )}
    </Container>
  );
};

export default Podcasts;
```

With that we now some basic working functionality in our [GRANDcast.FM](http://grandcast.fm) podcast app. There are still a few things we need to address in upcoming streams:

- Move our GraphQL API into a Next.js API endpoint
- Deploy the application, including provisioning a Neo4j instance in the cloud
- Migrating to the [new Neo4j GraphQL Library](https://www.npmjs.com/package/@neo4j/graphql)

What else should we cover on the livestreams? Let me know on [Twitter](https://twitter.com/lyonwj) if you have any ideas for things you'd so see us explore on the livestreams.

## Resources

- [GRANDcast.FM code on GitHub](https://github.com/johnymontana/grandcast.fm)
- [Chakra UI docs](https://chakra-ui.com/docs/getting-started)
- [Apollo Client docs: executing queries manually with `useLazyQuery`](https://www.apollographql.com/docs/react/data/queries/#executing-queries-manually)
- [Apollo Client docs: optimistic UI](https://www.apollographql.com/docs/react/performance/optimistic-ui/)
- [Apollo Client docs: updating the cache](https://www.apollographql.com/docs/react/caching/cache-interaction/)
