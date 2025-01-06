---
title: "Mapping Airports of the World With Neo4j Spatial and Openflights"
pubDate: 2014-03-13
description: "Loading every airport in the world into Neo4j Spatial for the purposes of route finding."
image:
  url: "/images/blog/mapping-the-worlds-airports-with-neo4j-spatial-and-openflights-part-1/Screen_Shot_2014_03_13_at_8_53_30_AM.png"
  alt: "Mapping Airports of the World With Neo4j Spatial and Openflights"
tags: ["Neo4j", "GIS", "Python"]
author: William Lyon
avatar:
  url: "/images/will.jpeg"
  alt: "#_"
---

![Neo4j Spatial Browser](/images/blog/mapping-the-worlds-airports-with-neo4j-spatial-and-openflights-part-1/Screen_Shot_2014_03_13_at_8_53_30_AM.png)

When I was taking flight lessons, I learned that the maximum range of a [Cessna-172](http://en.wikipedia.org/wiki/Cessna_172) is about 1000km. Knowing this, **can we find a path across the globe where each airport in the path is within the range of a Cessna 172?** Let's use Neo4j Spatial to try to answer this question! This blog post will focus on loading data from [OpenFlights.org](http://openflights.org) into Neo4j and how we can use Neo4j Spatial to help us represent this data in a Neo4j graph database. The next post will show how we can use the Neo4j Spatial Java API to traverse our graph and answer this question.

## Neo4j Spatial

[Neo4j Spatial](https://github.com/neo4j/spatial) is a Neo4j Server plugin that allows for spatial operations within a Neo4j database. Spatial makes use of an in-graph [R-tree](http://en.wikipedia.org/wiki/R-tree) to create spatial indexes allowing for geographic queries in the context of Neo4j. For example, Spatial allows for queries to find nodes within a specified geographic region or within a certain distance of a specified point. Neo4j Spatial can easily be installed as a server extension. Pre-packaged ZIPs containing all the JARs needed are provided on the [Spatial GitHub page](https://github.com/neo4j/spatial). Alternatively, [GrapheneDB](http://graphenedb.com) provides Neo4j Spatial as a plugin option. Getting Spatial running on a GrapheneDB instance is literally as easy as a few clicks.

## OpenFlights.org Data

OpenFlights.org provides a [dataset](http://openflights.org/data.html) containing information about almost every airport in the world. This dataset includes 6977 airports, in CSV format:

- Airport ID
- Name
- City
- Country
- **IATA/FAA code**
- ICAO code
- **Latitude**
- **Longitude**
- Altitude
- Timezone
- DST

We are most interested in columns 4 (airport FAA code) and 6/7 (latitude/longitude). Here's what the row for my home airport, MSO, looks like:

```md
4216,"Missoula Intl","Missoula","United States","MSO","KMSO",46.916306,-114.090556,3205,-7,"A"
```

## Loading The Data

Like most Neo4j projects, we have several API choices for how we want to interact with the Neo4j Server. In the next post in this series we'll look at using the Spatial Java API, but for now we will use the REST interface. To make use of Spatial we will follow three steps:

1. Create a Spatial index
1. Create nodes with lat/lon data as properties
1. Add these nodes to the Spatial index

We also will create an index in Neo4j (with the same name as our Spatial layer) to that we can query the database using Cypher.

## Neo4j Spatial REST API

This Python script follows the steps outlined above and uses the REST interface to add each airport to the database.

```python
import csv
import requests
import json

headers = {'content-type': 'application/json'}

# Create geom index
url = "http://localhost:7474/db/data/index/node/"
payload= {
  "name" : "geom",
  "config" : {
    "provider" : "spatial",
    "geometry_type" : "point",
    "lat" : "lat",
    "lon" : "lon"
  }
}
r = requests.post(url, data=json.dumps(payload), headers=headers)

with open('../data/airports.dat', 'rb') as f:   # read data file
    reader = csv.reader(f)
    for row in reader:
        # create airport node
        url = "http://localhost:7474/db/data/node"
        payload = {'lon': float(row[7]), 'lat': float(row[6]), 'name': row[4]}
        r = requests.post(url, data=json.dumps(payload), headers=headers)
        node = r.json()['self']

        #add node to geom index
        url = "http://localhost:7474/db/data/index/node/geom"
        payload = {'value': 'dummy', 'key': 'dummy', 'uri': node}
        r = requests.post(url, data=json.dumps(payload), headers=headers)

        #add node to Spatial index
        url = "http://localhost:7474/db/data/ext/SpatialPlugin/graphdb/addNodeToLayer"
        payload = {'layer': 'geom', 'node': node}
        r = requests.post(url, data=json.dumps(payload), headers=headers)
```

First, the Spatial index is created, specifing the geometry type and properties that will contain lat/lon data on each node to be added to that index. The file `airports.dat` is our OpenFlights CSV file listing all airports. We iterate through each row, creating a node for each airport, adding that node to the Spatial index and then to the index we have created so we can later query using Cypher.

## Finding Airports

All airports should now be loaded into our database. Now we can start to query the database using some Spatial features to find airports.

### Using Cypher

The following Cypher query will search for an airport within 50km of my hometown, Missoula, MT.

```cypher
// Find airport within 50km of Missoula, MT
START n=node:geom('withinDistance:[46.9163, -114.0905, 50.0]') RETURN n
```

Running that in Neo4j we see:
![MSO query](/images/blog/mapping-the-worlds-airports-with-neo4j-spatial-and-openflights-part-1/Screen_Shot_2014_03_13_at_8_29_02_AM.png)

Alright, looks like Missoula has an airport! Great!

### Using the REST interface

We can also make use of the REST interface to find all airports within a certain georgraphic area, or within a certain distance of a specified point.

The endpoint `/db/data/ext/SpatialPlugin/graphdb/findGeometriesWithinDistance` will allow us to query for all airports within 175km of Missoula, MT:

```md
POST http://localhost:7474/db/data/ext/SpatialPlugin/graphdb/findGeometriesWithinDistance
BODY
{
"layer" : "geom",
"pointY" : 46.8625,
"pointX" : -114.0117,
"distanceInKm" : 175
}
```

```json
[
  {
    "labels": "http://localhost:7474/db/data/node/8358/labels",
    "outgoing_relationships": "http://localhost:7474/db/data/node/8358/relationships/out",
    "data": {
      "lon": -114.090556,
      "bbox": [-114.090556, 46.916306, -114.090556, 46.916306],
      "name": "MSO",
      "lat": 46.916306,
      "gtype": 1
    },
    "traverse": "http://localhost:7474/db/data/node/8358/traverse/{returnType}",
    "all_typed_relationships": "http://localhost:7474/db/data/node/8358/relationships/all/{-list|&|types}",
    "property": "http://localhost:7474/db/data/node/8358/properties/{key}",
    "self": "http://localhost:7474/db/data/node/8358",
    "properties": "http://localhost:7474/db/data/node/8358/properties",
    "outgoing_typed_relationships": "http://localhost:7474/db/data/node/8358/relationships/out/{-list|&|types}",
    "incoming_relationships": "http://localhost:7474/db/data/node/8358/relationships/in",
    "extensions": {},
    "create_relationship": "http://localhost:7474/db/data/node/8358/relationships",
    "paged_traverse": "http://localhost:7474/db/data/node/8358/paged/traverse/{returnType}{?pageSize,leaseTime}",
    "all_relationships": "http://localhost:7474/db/data/node/8358/relationships/all",
    "incoming_typed_relationships": "http://localhost:7474/db/data/node/8358/relationships/in/{-list|&|types}"
  },
  {
    "labels": "http://localhost:7474/db/data/node/7968/labels",
    "outgoing_relationships": "http://localhost:7474/db/data/node/7968/relationships/out",
    "data": {
      "lon": -112.497472,
      "bbox": [-112.497472, 45.954806, -112.497472, 45.954806],
      "name": "BTM",
      "lat": 45.954806,
      "gtype": 1
    },
    "traverse": "http://localhost:7474/db/data/node/7968/traverse/{returnType}",
    "all_typed_relationships": "http://localhost:7474/db/data/node/7968/relationships/all/{-list|&|types}",
    "property": "http://localhost:7474/db/data/node/7968/properties/{key}",
    "self": "http://localhost:7474/db/data/node/7968",
    "properties": "http://localhost:7474/db/data/node/7968/properties",
    "outgoing_typed_relationships": "http://localhost:7474/db/data/node/7968/relationships/out/{-list|&|types}",
    "incoming_relationships": "http://localhost:7474/db/data/node/7968/relationships/in",
    "extensions": {},
    "create_relationship": "http://localhost:7474/db/data/node/7968/relationships",
    "paged_traverse": "http://localhost:7474/db/data/node/7968/paged/traverse/{returnType}{?pageSize,leaseTime}",
    "all_relationships": "http://localhost:7474/db/data/node/7968/relationships/all",
    "incoming_typed_relationships": "http://localhost:7474/db/data/node/7968/relationships/in/{-list|&|types}"
  },
  {
    "labels": "http://localhost:7474/db/data/node/6931/labels",
    "outgoing_relationships": "http://localhost:7474/db/data/node/6931/relationships/out",
    "data": {
      "lon": -111.98275,
      "bbox": [-111.98275, 46.606806, -111.98275, 46.606806],
      "name": "HLN",
      "lat": 46.606806,
      "gtype": 1
    },
    "traverse": "http://localhost:7474/db/data/node/6931/traverse/{returnType}",
    "all_typed_relationships": "http://localhost:7474/db/data/node/6931/relationships/all/{-list|&|types}",
    "property": "http://localhost:7474/db/data/node/6931/properties/{key}",
    "self": "http://localhost:7474/db/data/node/6931",
    "properties": "http://localhost:7474/db/data/node/6931/properties",
    "outgoing_typed_relationships": "http://localhost:7474/db/data/node/6931/relationships/out/{-list|&|types}",
    "incoming_relationships": "http://localhost:7474/db/data/node/6931/relationships/in",
    "extensions": {},
    "create_relationship": "http://localhost:7474/db/data/node/6931/relationships",
    "paged_traverse": "http://localhost:7474/db/data/node/6931/paged/traverse/{returnType}{?pageSize,leaseTime}",
    "all_relationships": "http://localhost:7474/db/data/node/6931/relationships/all",
    "incoming_typed_relationships": "http://localhost:7474/db/data/node/6931/relationships/in/{-list|&|types}"
  },
  {
    "labels": "http://localhost:7474/db/data/node/8169/labels",
    "outgoing_relationships": "http://localhost:7474/db/data/node/8169/relationships/out",
    "data": {
      "lon": -114.256,
      "bbox": [-114.256, 48.310472, -114.256, 48.310472],
      "name": "FCA",
      "lat": 48.310472,
      "gtype": 1
    },
    "traverse": "http://localhost:7474/db/data/node/8169/traverse/{returnType}",
    "all_typed_relationships": "http://localhost:7474/db/data/node/8169/relationships/all/{-list|&|types}",
    "property": "http://localhost:7474/db/data/node/8169/properties/{key}",
    "self": "http://localhost:7474/db/data/node/8169",
    "properties": "http://localhost:7474/db/data/node/8169/properties",
    "outgoing_typed_relationships": "http://localhost:7474/db/data/node/8169/relationships/out/{-list|&|types}",
    "incoming_relationships": "http://localhost:7474/db/data/node/8169/relationships/in",
    "extensions": {},
    "create_relationship": "http://localhost:7474/db/data/node/8169/relationships",
    "paged_traverse": "http://localhost:7474/db/data/node/8169/paged/traverse/{returnType}{?pageSize,leaseTime}",
    "all_relationships": "http://localhost:7474/db/data/node/8169/relationships/all",
    "incoming_typed_relationships": "http://localhost:7474/db/data/node/8169/relationships/in/{-list|&|types}"
  }
]
```

Looking at the response we see that MSO (Missoula, MT), BTM (Butte, MT), HLN (Helena, MT) and FCA (Kalispell, MT) are airports within 175km of Missoula.

## Looking Forward

That was a quick introduction to Neo4j Spatial. The next post will show how we can use the Neo4j Spatial Java API for more advanced traversals and answer our original question: Is it possible to fly a Cessna 172 across the world and what is the route?
