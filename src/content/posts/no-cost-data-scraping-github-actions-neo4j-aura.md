---
title: "No Cost Data Scraping With GitHub Actions And Neo4j Aura"
pubDate: 2021-01-07
description: "Using The Flat Data GitHub Action To Import Data From The Lobste.rs News Site"
image:
  url: "/images/blog/data-scraping/banner.png"
  alt: "No cost data scraping with GitHub Actions and Neo4j Aura"
tags: ["Neo4j", "Cloud", "GitHub", "Data scraping"]
author: William Lyon
avatar:
  url: "/images/will.jpeg"
  alt: "#_"
---

When working with data a common task is fetching data from some external source on a recurring basis and importing into a database for further analysis or as part of our application. Setting up servers to handle this can be time consuming and error prone. I recently came across a workflow using [GitHub Actions](https://github.com/features/actions) and [Neo4j Aura](https://dev.neo4j.com/neo4j-aura) that makes this a breeze and with the free tiers of both GitHub Actions and Neo4j Aura is free to set up and run forever - great for side projects!

In this post we'll take a look at setting up this workflow to scrape data from the [Lobsters](https://lobste.rs/) news aggregator and import into a [Neo4j Aura Free](https://dev.neo4j.com/aura-landing) instance using GitHub Actions. We built this on the [Neo4j livestream](https://twitch.tv/neo4j) so check out the recording if you prefer video:

<iframe
  width="560"
  height="315"
  src="https://www.youtube-nocookie.com/embed/jAweyWeO2cM?si=_jDA8zd81ATDe9xM"
  title="YouTube video player"
  frameborder="0"
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
  referrerpolicy="strict-origin-when-cross-origin"
  allowfullscreen
></iframe>

## A Look At The Data - Lobsters

[Lobsters](https://lobste.rs/) is a social news aggregator. Users post links to articles and the community votes and comments on them in a discussion thread. An algorithm determines the ranking of the submissions, with the most recent and noteworthy articles floating to the front page. To be able to submit and comment users must be invited by an existing user and this user-invite graph is publicly available, helping to keep discussions civil and avoid fraudulent upvoting to game submission rankings.

![The Lobste.rs Social News Aggregator](/images/blog/data-scraping/lobsters.png)

I've been thinking about social networks recently and want to build an application to help explore relevant news articles using graph visualization so building something using data from Lobsters seems like a great fit. We want to import data about users and article submissions into Neo4j as the basis of our application, but how to get started? Fortunately, Lobsters makes two JSON endpoints available to fetch data about the [newest](https://lobste.rs/newest.json) and the ["hottest"](https://lobste.rs/hottest.json) submissions. Each has a similar format and looks like this.

![JSON data representing the latest stories submitted to Lobsters](/images/blog/data-scraping/lobsters-json.png)

Now that we know what our JSON data looks like we can think about how to start importing this data into Neo4j Aura as a graph.

## Neo4j Aura

[Neo4j Aura](https://dev.neo4j.com/neo4j-aura) is a managed cloud service from Neo4j allowing us to run Neo4j clusters in the cloud with a few clicks and handles things like backups, upgrades, and administration so we don't have to worry about it. Best of all for our purposes, Neo4j Aura has a free tier that will allow us to build this project without even putting in a credit card.

Let's [sign-in to Neo4j Aura](https://dev.neo4j.com/aura) and create an Aura Free instance:

![Provisioning a Neo4j Aura Free instance](/images/blog/data-scraping/aura1.png)

We'll immediately be given a generated password that we'll need to save to access our Neo4j Aura instance. We can change this later.

![Be sure to save your password, you will need this later](/images/blog/data-scraping/aura2.png)

Next, our Aura instance will take a few moments to be provisioned.

![Neo4j Aura instance is starting up...](/images/blog/data-scraping/aura3.png)

Once our Neo4j Aura instance is ready we'll see the connection string in the dashboard. Let's open up Neo4j Browser to start working with our data.

![Our Neo4j Aura instance is ready](/images/blog/data-scraping/aura4.png)

Since we're working with JSON data we can make use of the [`apoc.load.json`](https://neo4j.com/labs/apoc/4.1/import/load-json/) procedure from the [APOC standard library](https://neo4j.com/labs/apoc/) to import a JSON file using Cypher. First, let's just pull this file in to make sure we can parse it. This Cypher statement will parse the newest Lobsters submissions and return an array of objects that we can work with in Cypher:

```cypher
CALL apoc.load.json("https://lobste.rs/newest.json") YIELD value
RETURN value
```

If we run this in Neo4j Browser we'll see the parsed array of objects returned. We haven't actually created any data in the database yet - we're just parsing the JSON file and returning the results.

![Using apoc.load.json](/images/blog/data-scraping/apoc1.png)

We'll use Cypher to define the graph structure we want to create from this data, but we first need to think a bit about how we want to model this data as a graph. I think of graph modeling as a multi-step process, at the highest level the steps are:

1. Identify the entities in our data - these become nodes.
1. Identify how these entities are connected - these connections become relationships.
1. Identify the pieces of data that describe the entities or connections - these become properties.

[Arrows.app](https://arrows.app) is a great tool for drawing and storing these graph models. Here's what our graph model for the Lobsters data looks like in Arrows:

![Our data model using Arrows.app](/images/blog/data-scraping/datamodel.png)

Now we can write the Cypher to import our data according to this model. We'll use `apoc.load.json` to parse the JSON file, then use `UNWIND` to iterate over this array of objects. We'll then use the `MERGE` Cypher clause to add users, articles, and tags to the database. The `MERGE` statement allows us to avoid creating duplicates in the graph - with `MERGE` only patterns that don't already exist in the graph are created.

This makes our import statement idempotent - we can run it over and over again on the same data and we won't make any changes to the database unless the data changes.

```cypher
CALL apoc.load.json("https://lobste.rs/newest.json") YIELD value
UNWIND value AS article
MERGE (s:User {username: article.submitter_user.username})
ON CREATE SET s.about = article.submitter_user.about,
              s.created = DateTime(article.submitter_user.created_at),
              s.karma = article.submitter_user.karma,
              s.avatar_url = "https://lobsete.rs" + article.submitter_user.avatar_url
MERGE (i:User {username: article.submitter_user.invited_by_user})
MERGE (i)<-[:INVITED_BY]-(s)
MERGE (a:Article {short_id: article.short_id})
SET a.url = article.url,
    a.score = article.score,
    a.created = DateTime(article.created_at),
    a.title = article.title,
    a.comments = article.comments_url
MERGE (s)-[:SUBMITTED]->(a)
WITH article, a
UNWIND article.tags AS tag
MERGE (t:Tag {name: tag})
MERGE (a)-[:HAS_TAG]->(t)
```

To verify we've imported this data correctly we can visualize it in Neo4j Browser - let's check to make sure the property values are what we expect and makes sense.

![Using apoc.load.json](/images/blog/data-scraping/apoc2.png)

That's great, but the Lobsters data will be continually changing as new articles are submitted and voted on - we want to import it on an ongoing basis. Let's use GitHub Actions to do this!

## GitHub Actions And Flat Graph

[GitHub Actions](https://github.com/features/actions) allows us to define workflows that are triggered by GitHub events (like commits, pull requests, etc). We can write custom code to run when an Action is triggered or choose from existing Actions published by community members in the GitHub Action Marketplace. While commonly used for CI/CD workflows, we can also schedule Actions to run at a specified interval.

The GitHub team recently released the [Flat Data project](https://octo.github.com/projects/flat-data) which aims to simplify data and ETL workflows. Flat Data includes the Flat Data GitHub Action, a VSCode extension for creating Flat Data workflows, and a web app for viewing data. The Flat Data Action allows us to schedule a GitHub action to periodically fetch data via a URL or SQL statement, check the data into git, and run a postprocessing step to, for example, insert data into a database.

This sounds perfect for what we want to accomplish with Lobsters and Neo4j Aura - let's give it a try! First, we'll sign into GitHub and create a new repository:

![Creating a new GitHub repo](/images/blog/data-scraping/github1.png)

Because we selected "Add a README file" we can immediately start to make commits to our repo and use the built-in editor in the GitHub web UI to set up our Flat Data Action. We can also clone the repo locally, but I'll just use the built-in text editor.

![Creating a new GitHub repo](/images/blog/data-scraping/github2.png)

To create a new GitHub action we'll add a new file `.github/workflows/lobsters.yml`. In this YAML file we will

1. Give a name to our new Action - let's call it "Lobsters Data Import".
1. Identity the events we want to trigger this action. We want it to run anytime this YAML file is updated and also schedule it to run every 60 minutes.
1. We then define the steps we want to run in our Action:

- First, we'll check out the repo using the `actions/checkout@v2` action
- Then we'll use the `githubocto/flat@v2` Action to fetch our Lobsters JSON file and check it into our repo as `newest.json`

```yml
name: Lobsters Data Import

on:
  push:
    paths:
      - .github/workflows/lobsters.yml
  workflow_dispatch:
  schedule:
    - cron: "*/60 * * * *"

jobs:
  scheduled:
    runs-on: ubuntu-latest
    steps:
      - name: Check out repo
        uses: actions/checkout@v2
      - name: Fetch newest
        uses: githubocto/flat@v2
        with:
          http_url: https://lobste.rs/newest.json
          downloaded_filename: newest.json
```

Using the in-browser editor in GitHub we should see something like this:

![Creating a new GitHub repo](/images/blog/data-scraping/github3.png)

Our GitHub Action will run immediately after committing the new file and in a few seconds we'll see a new commit, checking in the `newest.json` file with the data from Lobsters.

![Creating a new GitHub repo](/images/blog/data-scraping/github4.png)

Great - we've fetched the newest Lobsters article submissions and checked them into our repository and scheduled a GitHub Action to refresh this data every hour. Now we're ready to update our GitHub Action to import data into Neo4j.

First, we'll need to add secrets to our GitHub repository so our Action can connect to our Neo4j Aura instance and we don't have to expose our connection credentials. In GitHub select the "Settings" tab then navigate to the "Secrets" section and select the "New repository secret" button.

![Creating a new GitHub repo](/images/blog/data-scraping/github5.png)

We'll create three secrets `NEO4J_USER`, `NEO4J_PASSWORD`, and `NEO4J_URI` with the connection credentials specific to the Neo4j Aura instance we created earlier.

![Creating a new GitHub rep](/images/blog/data-scraping/github6.png)

We'll now be able to reference these secrets values in the YAML file where we define our GitHub Action to connect to our Neo4j Aura instance.

### The Flat Graph GitHub Action

The Flat Data GitHub Action includes support for a post-processing step that allows us to run a JavaScript or Python script after the data is fetched. We could write a simple script to use the Neo4j language driver to connect to our Neo4j Aura instance and run a Cypher import statement, passing in the JSON data as a Cypher parameter, however there is also the [Flat _Graph_](https://github.com/marketplace/actions/flat-graph) GitHub Action which does just this.

![Flat Graph GitHub Action](/images/blog/data-scraping/flat-graph.png)

Flat Graph is designed to work with the Flat Data GitHub Action and allows us to declare the Cypher import statement we want to run and our Neo4j Aura connection credentials as another step in our GitHub Action. Flat Graph will load the specified JSON file and pass it as a Cypher parameter called `$value` so our Cypher import statement just needs to reference this Cypher parameter to work with the data fetched by Flat Data in the previous step of our Action.

We'll use the Cypher statement we wrote above using `apoc.load.json`, but adapt it to use this convention. We'll also reference the Neo4j Aura connection credentials we defined as GitHub secrets. Let's update our `lobsters.yml` file:

```yml
name: Lobsters Data Import

on:
  push:
    paths:
      - .github/workflows/lobsters.yml
  workflow_dispatch:
  schedule:
    - cron: "*/60 * * * *"

jobs:
  scheduled:
    runs-on: ubuntu-latest
    steps:
      - name: Check out repo
        uses: actions/checkout@v2
      - name: Fetch newest
        uses: githubocto/flat@v2
        with:
          http_url: https://lobste.rs/newest.json
          downloaded_filename: newest.json
      - name: Neo4j import
        uses: johnymontana/flat-graph@v1.2
        with:
          neo4j-user: ${{secrets.NEO4J_USER}}
          neo4j-password: ${{secrets.NEO4J_PASSWORD}}
          neo4j-uri: ${{secrets.NEO4J_URI}}
          filename: newest.json
          cypher-query: >
            UNWIND $value AS article
            MERGE (s:User {username: article.submitter_user.username})
            ON CREATE SET s.about = article.submitter_user.about,
              s.created = DateTime(article.submitter_user.created_at),
              s.karma = article.submitter_user.karma,
              s.avatar_url = "https://lobsete.rs" + article.submitter_user.avatar_url
            MERGE (i:User {username: article.submitter_user.invited_by_user})
            MERGE (i)<-[:INVITED_BY]-(s)
            MERGE (a:Article {short_id: article.short_id})
            SET a.url = article.url,
                a.score = article.score,
                a.created = DateTime(article.created_at),
                a.title = article.title,
                a.comments = article.comments_url
            MERGE (s)-[:SUBMITTED]->(a)
            WITH article, a
            UNWIND article.tags AS tag
            MERGE (t:Tag {name: tag})
            MERGE (a)-[:HAS_TAG]->(t)
```

Once we commit the change our Action will run - loading the latest Lobsters article data into our Neo4j Aura instance. This Action will run each hour updating our database with the latest Lobsters data.

## What's Next?

We've now set up a serverless data scraping workflow to fetch all new articles submitted to Lobsters and import into Neo4j Aura using GitHub Actions. Next, we'll take a look at data visualization options and we begin to explore this dataset and build a web application to help us find relevant information. If you'd like to follow along we'll be coding this on the Neo4j Livestream on [Twitch](https://twitch.tv/neo4j) and [YouTube](https://www.youtube.com/neo4j). You can also [subscribe to my newsletter](https://lyonwj.com/newsletter) to be notified as new posts are up. Happy graphing!

## Resources

- [Neo4j Aura](https://dev.neo4j.com/neo4j-aura)
- [Lobste.rs](http://lobste.rs/)
- [GitHub Actions](https://github.com/features/actions)
- [GitHub Flat Data](https://octo.github.com/projects/flat-data)
- [Flat Graph GitHub Action](https://github.com/marketplace/actions/flat-graph)
- [Code on GitHub](https://github.com/johnymontana/lobste.rs-graph)

For comments and discussion please [join the conversation for this post at Dev.to](https://dev.to/lyonwj/no-cost-data-scraping-with-github-actions-and-neo4j-aura-372b)
