---
title: "Spatial Search Functionality With Neo4j"
pubDate: 2023-01-03
description: "Radius Distance, Bounding Box, and Point in Polygon Search With Graphs"
image:
  url: "/images/blog/nodes2022/spatial_search.png"
  alt: "Spatial Search Functionality With Neo4j"
tags:
  - Neo4j
  - Spatial
  - GIS
author: William Lyon
avatar:
  url: "/images/will.jpeg"
  alt: "#_"
---

In this post we explore some techniques for working with geospatial data in Neo4j. We will cover some basic spatial Cypher functions, spatial search, routing algorithms, and different methods of importing geospatial data into Neo4j. Be sure to sign up for my newsletter to be notified of new blog posts like these:

This post is based on my talk at [NODES 2022](https://dev.neo4j.com/nodes-videos), so you can watch the video recording instead:

<iframe
  width="560"
  height="315"
  src="https://www.youtube-nocookie.com/embed/-fs8ozxKklQ?si=u9Pl0TRIdefyuhxD"
  title="YouTube video player"
  frameborder="0"
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
  referrerpolicy="strict-origin-when-cross-origin"
  allowfullscreen
></iframe>

## Spatial Cypher Functions And The `Point` Type

Native geospatial functionality in Neo4j is based on support for a native `Point` type. The `Point` data type can be used to represent point data using either 3D or 2D geographic (WGS84) or cartesian coordinates reference systems (CRS). Points (or arrays of points) can be stored as properties on nodes or relationships in Neo4j. Cypher contains [several functions for working with points](https://neo4j.com/docs/cypher-manual/current/syntax/spatial/), notably:

- `point()` - for creating `Point` instances
- `point.distance()` - calculates distance between two points. Can also be used for radius distance search when used in a `WHERE` predicate
- `point.withinBBox()` - to find points within a given bounding box

Point instances can be created using the `point()` function in Cypher and passing an object that specifies latitude, longitude, and optionally height (when using geographic CRS) or x, y and optionally z (when using cartesian CRS). In this article we will focus on the 2D geographic CRS (using latitude an longitude).

Here we create a point instance by specifying latitude and longitude:

```Cypher
RETURN point(
  {latitude:49.38713, longitude:12.12711}
)
```

```md
╒════════════════════════════════════════════════╕
│"point({latitude:49.38713, longitude:12.12711})"│
╞════════════════════════════════════════════════╡
│point({srid:4326, x:12.12711, y:49.38713}) │
└────────────────────────────────────────────────┘
```

To set a point property value we can use the `SET` Cypher command. Here we create a new `PointOfInterest` node representing a bakery and set the `location` property to a point value:

```Cypher
CREATE (p:PointOfInterest)
SET p.name = "West Side Bakery",
p.location = point(
  {latitude:49.38713, longitude:12.12711}
)
RETURN p
```

![Creating a node with a location point property](/images/blog/nodes2022/node.png)

We can use the `point.distance()` function to search for our bakery. Here we search for nodes with the `PointOfInterest` label that are within 200 meters of a given latitude and longitude:

```Cypher
MATCH (p:PointOfInterest)
WHERE point.distance(
  p.location, point({latitude:49.38713, longitude:12.12711})
) < 200
RETURN p
```

Let's look at some real-world data to see how we can implement spatial search functionality in a simple web map application.

## Spatial Search With Neo4j

A common feature for web applications that deal with geospatial data involves spatial search: finding things near other things or within the bounds of a box or perhaps within a polygon. Let's see how we can use Neo4j to search for points of interest on a map using Leaflet.js for the following types of spatial search:

1. Radius distance search
2. Within Bounding Box
3. Within Polygon

![Spatial search with Neo4j - radius distance, bounding box, and point in polygon](/images/blog/nodes2022/spatial_search.png)

Code [on GitHub: johnymontana/geospatial-graph-demos.](https://github.com/johnymontana/geospatial-graph-demos)

I wanted to use a real world dataset, so I pulled in points of interest from the [Daylight Earth Table](https://daylightmap.org/earth/) distribution of OpenStreetMap. The Daylight Earth Table is based on the Daylight OpenStreetMap distribution, but adds a data schema that classifies OpenStreetMap tags into a three level ontology: theme, class, and subclass. We'll be using the "poi" theme.

![The Daylight Earth Table OpenStreetMap distribution](/images/blog/nodes2022/daylight.png)

Currently there are almost 39 million points of interest in the dataset. The Daylight Earth Table is available in Parquet files stored in S3 so I used the `pandas` Python library to read the Parquet files from S3 into a DataFrame. By converting the DataFrame to Python dicts and passing in batches as Cypher parameters we can import the dataset in a few minutes.

```Python
# Here we define a function to split our DataFrame into batches for import

def insert_data(query, rows, batch_size=10000):
    total = 0
    batch = 0
    start = time.time()
    result = None

    while batch * batch_size < len(rows):
        res = conn.query(query, parameters = {'rows': rows[batch*batch_size:(batch+1)*batch_size].to_dict('records')}, db="osmpois")
        total += res[0]['total']
        batch += 1
        result = {"total": total, "batches": batch, "time": time.time()-start}
        print(result)
    return result
```

```Cypher
def insert_pois(rows, batch_size=10000):
    print(rows)
    query = '''
    UNWIND $rows AS row
    CREATE (p:PointOfInterest {name: row.names.local})
    CREATE (g:Geometry)
    SET g.location = point({latitude: toFloat(row.point[1]), longitude: toFloat(row.point[0]) })
    CREATE (g)<-[:HAS_GEOMETRY]-(p)
    SET g:Point
    CREATE (t:Tags)
    SET t += row.original_tags_dict
    CREATE (p)-[:HAS_TAGS]->(t)
    WITH *
    CALL apoc.create.addLabels(p, [row.class, row.subclass]) YIELD node
    RETURN COUNT(*) AS total
    '''
    return insert_data(query, rows, batch_size)
```

![Importing the Daylight Earth Table OpenStreetMap distribution into Neo4j](/images/blog/nodes2022/daylight_notebook.png)

See the code on GitHub: [johnymontana/daylight-earth-graph](https://github.com/johnymontana/daylight-earth-graph)

### Radius Distance Search

Now that we have all points of interest loaded into Neo4j we'll create a point index to enable fast index-backed spatial search operations.

```Cypher
CREATE POINT INDEX poiIndex
FOR (p:Point) ON (p.location)
```

Our first spatial search type is radius distance search: finding all points of interest within a given distance of a point.

![Radius distance search with Neo4j](/images/blog/nodes2022/radius_search.png)

Here we search for all points of interest within 200 meters of a point in Northern California.

```Cypher
PROFILE MATCH (p:Point)
WHERE
point.distance(p.location, point({latitude: 37.563434, longitude:-122.322255})) < 200
RETURN p{.*} AS point
```

By prepending `PROFILE` to our Cypher query we will render the database query plan as well as basic performance metrics for the query, such as memory usage, execution time, number of rows at each operation, and db hits. We can see that our point index is used resulting in an execution time of 1-2ms. Compare to the execution plan on the left which does not use an index and rather must scan every point of interest and takes about 4 seconds to execute. When we're dealing with millions of nodes it behooves us to make sure our spatial search operations are using an index for best performance.

![Radius distance search query plan with and without index](/images/blog/nodes2022/radius_index_plan.png)

### Cypher Bounding Box Search

The next type of spatial search to consider is searching within a rectangular bounding box.

![Bounding box search](/images/blog/nodes2022/bounding_box.png)

We will use the [`point.withinBBox`](https://neo4j.com/docs/cypher-manual/current/functions/spatial/#functions-withinBBox) Cypher predicate function to accomplish this. This function takes 3 arguments: a point value that defines a location and two other point values that define the bounding box's lower left and upper right points.

```Cypher
MATCH (p:Point)
WHERE point.withinBBox(
  p.location,
  point({longitude:-122.325447, latitude: 37.55948 }),  // Lower left point
  point({longitude:-122.314675 , latitude: 37.563596})) // Upper right point
RETURN p
```

We can prepend `PROFILE` to the above Cypher query to verify that we are indeed using the index for this spatial search operation.

![Query plan - using index for bounding box search](/images/blog/nodes2022/index2.png)

### Point In Polygon Search

Point in polygon search will return points within the bounds of an arbitrary polygon. Point in polygon search is not natively supported in Neo4j, however with some help on the client side of our application we can accomplish a polygon search while taking advantage of the point database index to ensure the search is fast. To accomplish this we will use the following steps:

1. Convert polygon to bounding box
2. Cypher `withinBBox` query
3. Filter results to those within polygon

![Node chart visualization example](/images/blog/nodes2022/point_in_polygon_search.png)

Index backed point in polygon search can be accomplished by first converting the polygon to a bounding box, using Cypher's `point.withinBBox` predicate function to find points within the bounding box (using our database index), and then filtering the results on the client to the polygon bounds. [Example code here](https://github.com/johnymontana/geospatial-graph-demos/blob/main/src/index.html#L175-L231), using [Turf.js](https://turfjs.org/):

```js
const polygon = layer.toGeoJSON();
var bbox = turf.bbox(polygon); // convert polygon to bounding box

// Within Bounding Box Cypher query
const cypher = `
    MATCH (p:Point)-[:HAS_GEOMETRY]-(poi:PointOfInterest)-[:HAS_TAGS]->(t:Tags)
    WHERE point.withinBBox(
        p.location,
        point({longitude: $lowerLeftLon, latitude: $lowerLeftLat }),
        point({longitude: $upperRightLon, latitude: $upperRightLat}))
    RETURN p { latitude: p.location.latitude,
               longitude: p.location.longitude,
               name: poi.name,
               categories: labels(poi),
               tags: t{.*}
            } AS point
          `;

var session = driver.session({
    database: "osmpois",
    defaultAccessMode: neo4j.session.READ,
});

session
    .run(cypher, {
        lowerLeftLat: bbox[1],
        lowerLeftLon: bbox[0],
        upperRightLat: bbox[3],
        upperRightLon: bbox[2],
    })
    .then((result) => {
        const bboxpois = [];
        result.records.forEach((record) => {
            const poi = record.get("point");
            var point = [poi.longitude, poi.latitude];
            bboxpois.push(point);
        });
        // filter results of bouding box query to polygon bounds
        const poisWithin = turf.pointsWithinPolygon(
            turf.points(bboxpois),
            polygon
        );

        poisWithin.features.forEach((e) => {
            L.marker([
                e.geometry.coordinates[1],
                e.geometry.coordinates[0],
            ])
            .addTo(map)
            .bindPopup("Polygon");
        })
```

You can find the code for the spatial search examples (including using the Leaflet.js web map with Neo4j) [on GitHub: johnymontana/geospatial-graph-demos](https://github.com/johnymontana/geospatial-graph-demos)

### Working With Line Geometries

So far we've been working with points, let's take a quick look at an example using line geometries. For this quick example I exported my Strava activities data and loaded into Neo4j.

![Node chart visualization example](/images/blog/nodes2022/bloom2.png)

To import data, first export user data from Strava then to add activities we will use the exported `activities.csv` file and load individual activity routes from the GPX files (first converted to geojson):

```Cypher
// Create Activity Nodes
LOAD CSV WITH HEADERS FROM "file:///activities.csv" AS row
MERGE (a:Activity {activity_id: row.`Activity ID`})
SET a.filename = row.Filename,
    a.activity_type = row.`Activity Type`,
    a.distance = toFloat(row.Distance),
    a.activity_name = row.`Activity Name`,
    a.activity_data = row.`Activity Date`,
    a.activity_description = row.`Activity Description`,
    a.max_grade = toFloat(row.`Max Grade`),
    a.elevation_high = toFloat(row.`Elevation High`),
    a.elevation_loss = toFloat(row.`Elevation Loss`),
    a.elevation_gain = toFloat(row.`Elevation Gain`),
    a.elevation_low = toFloat(row.`Elevation Low`),
    a.moving_time = toFloat(row.`Moving Time`),
    a.max_speed = toFloat(row.`Max Speed`),
    a.avg_grade = toFloat(row.`Average Grade`);

// Parse geojson geometries and create Geometry:Line nodes
MATCH (a:Activity)
WITH a WHERE a.filename IS NOT NULL AND a.filename CONTAINS ".gpx"
MERGE (n:Geometry {geom_id:a.activity_id })
MERGE (n)<-[:HAS_FEATURE]-(a)
WITH n,a
CALL apoc.load.json('file:///' + replace(a.filename, '.gpx', '.geojson')) YIELD value
UNWIND value.features[0].geometry.coordinates AS coord
WITH n, collect(point({latitude: coord[1], longitude: coord[0]})) AS coords
SET n.coordinates = coords
SET n:Line;
```

We store the routes as an array of point values to represent the line geometry of each route. Now, we can use the same spatial search techniques described above with our line geometries.

![Airport graph model](/images/blog/nodes2022/line_search.png)

By using the list predicate `any` Cypher function in our query we can check if at least one point in the line are within the radius distance search distance.

```Cypher
WITH point({latitude: $latitude, longitude: $longitude}) AS radiusCenter
MATCH (g:Geometry)<-[:HAS_FEATURE]-(a:Activity)
WHERE any(
  p IN g.coordinates WHERE point.distance(p, radiusCenter) < $radius
)
RETURN *
```

Code for this example is available [on GitHub here](https://github.com/johnymontana/geospatial-graph-demos#line-geometry-search).

## Routing With Graph Algorithms

One more use case I'd like to touch on besides spatial search is that of routing. We'll use the [Graph Data Science Neo4j Sandbox](https://dev.neo4j.com/sandbox) to find airline routes between airports.

![Airport graph model](/images/blog/nodes2022/routing1.png)

There are a number of relevant path finding algorithms we might consider. In this case we will use Dijkstra's algorithm, an extension of breadth first search that uses relationship weights to find the shortest path between two nodes, or airports in our case. Dijkstra's algorithm is one of many available in Neo4j's Graph Data Science library. First, we will project our airline route graph into an in-memory projected graph structure used by the Graph Data Science library:

```Cypher
CALL gds.graph.project(
  'routes-weighted',
  'Airport',
  'HAS_ROUTE',
  {
    relationshipProperties: 'distance'
  }
) YIELD graphName, nodeProjection, nodeCount,
  relationshipProjection, relationshipCount
```

Then, to search for the shortest path between two airports we use the [`gds.shortestPath.dijkstra` procedure](https://neo4j.com/docs/graph-data-science/current/algorithms/dijkstra-source-target/):

```Cypher
MATCH (source:Airport {iata: 'PUQ'}), (target:Airport {iata: 'HNL'})
CALL gds.shortestPath.dijkstra.stream('routes-weighted', {
  sourceNode: source,
  targetNode: target,
  relationshipWeightProperty: 'distance'
})
YIELD index, sourceNode, targetNode,
   totalCost, nodeIds, costs, path
RETURN
nodes(path) as path
```

![Routing between airports using the Dijkstra algorithm](/images/blog/nodes2022/routing2.png)

In this post we introduced some of the spatial functionality natively supported by Neo4j including the point type and related Cypher functions and demonstrated how to accomplish various spatial search operations as well as a brief look at routing with graph algorithms.

## Resources

- [Cypher manual for spatial Cypher functions](https://neo4j.com/docs/cypher-manual/current/syntax/spatial/)
- [Spatial search map example code](https://github.com/johnymontana/geospatial-graph-demos)
- [Daylight Earth Table](https://daylightmap.org/earth/)
- [Importing Daylight Earth Table points of interest into Neo4j (Python code)](https://github.com/johnymontana/daylight-earth-graph)
- [Spatial search Leaflet.js + Neo4j demo code](https://github.com/johnymontana/geospatial-graph-demos)

For comments and discussion please [join the conversation for this post at Dev.to](https://dev.to/lyonwj/spatial-search-functionality-with-neo4j-1c8h)
