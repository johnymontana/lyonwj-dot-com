---
title: "Finding The Perfect Christmas Tree With USFS Motor Vehicle User Map Data, QGIS, & SedonaDB"
pubDate: 2023-12-04
description: "Using aerial imagery and Spatial SQL to explore Forest Service road networks"
image:
  url: "/images/blog/finding-tree/07-navigation-final.png"
  alt: "Finding The Perfect Christmas Tree With USFS Motor Vehicle User Map Data, QGIS, & SedonaDB"
tags: ["Wherobots", "Apache Sedona", "SQL"]
author: William Lyon
avatar:
  url: "/images/will.jpeg"
  alt: "#_"
---

Every year with my family I head out into a nearby National Forest with a saw (except when I forget to bring it) and a National Forest Motor Vehicle User Map (MVUM) to find the annual Lyon family Christmas tree. I always wondered if I could analyze the data for the MVUMs to make my own map for hunting Christmas trees - so that's what I did for this map as part of the [30 Day Map Challenge.](https://github.com/johnymontana/30-day-map-challenge/tree/main)

I also did a bit of research using aerial imagery and QGIS to find areas that might have the perfect Christmas trees, then loaded the National Forest MVUM data in [Wherobots Cloud](https://wherobots.com/wherobots-cloud/) to find the forest service roads leading to the areas I annotated in QGIS with Spatial SQL.

![Finding the perfect Christmas tree](/images/blog/finding-tree/07-navigation-final.png)

To follow along create a free account in [Wherobots Cloud](https://www.wherobots.services)

## Loading National Forest Motor Vehicle User Map Data

The US Forest Service publishes the National Forest Motor Vehicle User Map (MVUM) which shows roads and trails for accessing National Forest land. These maps are usually my primary navigation method when I'm driving into a National Forest. The USFS makes this map data available for download [here](https://data-usfs.hub.arcgis.com/datasets/motor-vehicle-use-map-roads-feature-layer/explore) as GeoJSON, CSV, or Shapefile.

I downloaded the Shapefile format, then uploaded it to Wherobots Cloud via the "Files" tab, which allows me to access this data via S3.

![Working with files in Wherobots Cloud](/images/blog/assets/finding-tree/files1.png)

Now we're ready to import that Shapefile into SedonaDB.

```py
# To import a Shapefile into SedonaDB we can use the built-in ShapefileReader which will
#   give us a SpatialRDD then convert that SpatialRDD to a Spatial DataFrame
# Then we create a new view called roads with this MVUM map data
# Finally we print the schema of the roads_df DataFrame

spatialRDD = ShapefileReader.readToGeometryRDD(sedona, S3_URL_ROADS_SHP)
roads_df = Adapter.toDf(spatialRDD, sedona)
roads_df.createOrReplaceTempView("roads")
roads_df.printSchema()
```

```md
root
|-- geometry: geometry (nullable = true)
|-- OBJECTID: string (nullable = true)
|-- RTE*CN: string (nullable = true)
|-- ID: string (nullable = true)
|-- NAME: string (nullable = true)
|-- BMP: string (nullable = true)
|-- EMP: string (nullable = true)
|-- SEG_LENGTH: string (nullable = true)
|-- GIS_MILES: string (nullable = true)
|-- SYMBOL: string (nullable = true)
|-- MVUM_SYMBO: string (nullable = true)
|-- JURISDICTI: string (nullable = true)
|-- OPERATIONA: string (nullable = true)
|-- SURFACETYP: string (nullable = true)
|-- SYSTEM: string (nullable = true)
|-- SEASONAL: string (nullable = true)
|-- PASSENGERV: string (nullable = true)
|-- PASSENGE_1: string (nullable = true)
|-- HIGHCLEARA: string (nullable = true)
|-- HIGHCLEA_1: string (nullable = true)
|-- TRUCK: string (nullable = true)
|-- TRUCK_DATE: string (nullable = true)
|-- BUS: string (nullable = true)
|-- BUS_DATESO: string (nullable = true)
|-- MOTORHOME: string (nullable = true)
|-- MOTORHOME*: string (nullable = true)
|-- FOURWD*GT5: string (nullable = true)
|-- FOURWD_G_1: string (nullable = true)
|-- TWOWD_GT50: string (nullable = true)
|-- TWOWD_GT_1: string (nullable = true)
|-- TRACKED_OH: string (nullable = true)
|-- TRACKED\_\_1: string (nullable = true)
|-- OTHER_OHV*: string (nullable = true)
|-- OTHER_OH_1: string (nullable = true)
|-- ATV: string (nullable = true)
|-- ATV_DATESO: string (nullable = true)
|-- MOTORCYCLE: string (nullable = true)
|-- MOTORCYC_1: string (nullable = true)
|-- OTHERWHEEL: string (nullable = true)
|-- OTHERWHE_1: string (nullable = true)
|-- TRACKED**2: string (nullable = true)
|-- TRACKED**3: string (nullable = true)
|-- OTHER_OH_2: string (nullable = true)
|-- OTHER_OH_3: string (nullable = true)
|-- ADMINORG: string (nullable = true)
|-- SECURITYID: string (nullable = true)
|-- DISTRICTNA: string (nullable = true)
|-- FORESTNAME: string (nullable = true)
|-- FIELD_ID: string (nullable = true)
|-- SBS_SYMBOL: string (nullable = true)
|-- ROUTESTATU: string (nullable = true)
|-- GLOBALID: string (nullable = true)
|-- TA_SYMBOL: string (nullable = true)
|-- SHAPE: string (nullable = true)
|-- SHAPELEN: string (nullable = true)
```

Now that we've created a view with our roads data we can use Spatial SQL to query our MVUM data.

```py
sedona.sql("SELECT COUNT(*) AS num FROM roads").show()
```

```md
+------+
| num |
+------+
|151457|
+------+
```

Since we're going to be hunting for Christmas trees near Santa, Idaho we know we're only interested in roads within the Idaho Panhandle National Forests.

```py
idaho_df = sedona.sql("""
SELECT geometry, NAME as name, FORESTNAME AS forest, SEASONAL AS seasonal, SYMBOL AS symbol FROM roads
WHERE FORESTNAME = 'Idaho Panhandle National Forests'
""")
idaho_df.createOrReplaceTempView("idaho")
idaho_df.show(5)
```

```md
+--------------------+-----------------+--------------------+--------+------+
| geometry | name | forest |seasonal|symbol|
+--------------------+-----------------+--------------------+--------+------+
|LINESTRING (-115....| DOMINION CREEK |Idaho Panhandle N...|yearlong| 3|
|LINESTRING (-116....| PLACER RIDGE A |Idaho Panhandle N...|yearlong| 1|
|LINESTRING (-116....| RAINEY HILL |Idaho Panhandle N...|yearlong| 1|
|LINESTRING (-117....| URANIUM |Idaho Panhandle N...|yearlong| 1|
|LINESTRING (-116....|HAMILTON MOUNTAIN|Idaho Panhandle N...|yearlong| 1|
+--------------------+-----------------+--------------------+--------+------+
```

```py
SedonaKepler.create_map(idaho_df, name="Roads")
```

![Visualizing roads using SedonaKepler](/images/blog/finding-tree/kepler_roads.png)

That's a lot of roads! How are we going to figure out where the best Christmas trees are? Let's look at aerial imagery of the area to find what look like nice tree stands to help narrow down the hunt a bit. We'll use my favorite desktop GIS tool QGIS for this.

## Annotating Aerial Imagery In QGIS

QGIS by default includes tile layers from OpenStreetMap, but we can also add other tile server connections to bring in tile layers from other providers. [This StackExchange answer](https://gis.stackexchange.com/questions/20191/adding-basemaps-in-qgis/217670#217670) describes how to add aerial imagery from Google and Bing to QGIS.

![Adding a new tile server to QGIS](/images/blog/finding-tree/qgis_newtiles.png)

![Adding Google aerial imagery](/images/blog/assets/finding-tree/qgis_google.png)

Once we add the aerial imagery tile layer we can start to explore the area where
we hope to find some great Christmas trees, in this case in the Idaho Panhandle National
Forests. We're looking for nice heavy green tree stands, not too much vertical variation
for easy access and not near streams and rivers or hiking trails.

Let's add a new layer to our QGIS project so we can keep track of where these tree stands are. I chose a Geopackage layer with Polygon geometry because we're going to draw polygons over the aerial imagery to indicate places that we think will be good for potential trees.

![Adding a new layer in QGIS](/images/blog/assets/finding-tree/qgis_newlayer.png)

Right-click on the layer and choose "Toggle editing" then click the icon to create
a new polygon. We can now draw polygons over the aerial imagery, each new polygon
will be added as a new feature to our new Geopackage layer. I didn't create any other
fields so the `fid` is a sequence that will be autogenerated. If you wanted to keep
notes about why you thought this area looked good you could do that by adding another
field to the layer.

![Adding polygon features](/images/blog/finding-tree/qgis_polygon.png)

Once we've annotated a few areas (I found 5 or 6) we can right click on our layer and select "Save as". I exported this layer as GeoJSON, to a file called `idaho_treestands.geojson`.

![LinkedIn Post](/images/blog/finding-tree/qgis_exportgeojson.png)

## Finding Roads To Our Tree Stands With SedonaDB

Now that we've exported our polygon annotations as GeoJSON it's time to import that data into SedonaDB along with our road data so we can the Forest Service roads that will take us to our tree stands. Return to the "Files" tab in Wherobots Cloud and upload the GeoJSON file we just exported from QGIS.

![The Wherobots Files interface](/images/blog/finding-tree/files2.png)

To import GeoJSON into SedonaDB we can use Spark's built-in JSON import functionality if we first define the schema used by GeoJSON.

```py
schema = "type string, name string, crs string, features array<struct<type string, geometry string, properties map<string, string>>>"
```

```py
tree_df = sedona.read.option('multiline', True).json(S3_URL_TREES, schema=schema).selectExpr("explode(features) as features").select("features.*").withColumn("geometry", expr("ST_GeomFromGeoJson(geometry)")).withColumn("fid", expr("properties['fid']")).drop("properties").drop("type")
tree_df.createOrReplaceTempView("trees")
tree_df.show(5)
```

```md
+--------------------+---+
| geometry |fid|
+--------------------+---+
|POLYGON ((-116.52...| 1|
|POLYGON ((-116.54...| 2|
|POLYGON ((-116.12...| 3|
|POLYGON ((-116.16...| 4|
|POLYGON ((-116.09...| 5|
+--------------------+---+
only showing top 5 rows
```

```py
SedonaKepler.create_map(tree_df, name="Tree Stands")
```

![Visualizing the tree layer with SedonaKepler](/images/blog/finding-tree/kepler_trees.png)

As we can see above I found 6 possible tree stands I want to explore. Now we can do a spatial join operation to find the Forest Service roads nearest these tree stands. We could either use the [`ST_Distance` Spatial SQL function](https://docs.wherobots.services/1.2.0/references/sedonadb/vector-data/Function/?h=st_distance#st_distance) to find the closest roads or perhaps use [the `ST_Intersects` predicate](https://docs.wherobots.services/1.2.0/references/sedonadb/vector-data/Predicate/#st_intersects) if we just want to find the roads that go through the tree stands we annotated.

```py
routes1_df = sedona.sql("""
SELECT idaho.geometry, name, forest, seasonal, symbol
FROM idaho, trees
WHERE ST_Intersects(trees.geometry, idaho.geometry)
""")

routes1_df.show()
```

```md
+--------------------+----------------+--------------------+--------+------+
| geometry | name | forest |seasonal|symbol|
+--------------------+----------------+--------------------+--------+------+
|LINESTRING (-116....| PALOUSE DIVIDE |Idaho Panhandle N...|yearlong| 1|
|LINESTRING (-116....| CLARKIA MARBLE |Idaho Panhandle N...|yearlong| 1|
|LINESTRING (-116....|BONNEVILLE POWER|Idaho Panhandle N...|yearlong| 1|
|LINESTRING (-116....| SWAN PEAK |Idaho Panhandle N...|yearlong| 1|
|LINESTRING (-116....| CORNWALL CREEK |Idaho Panhandle N...|yearlong| 1|
|LINESTRING (-116....| LACEY CREEK |Idaho Panhandle N...|yearlong| 1|
|LINESTRING (-116....| CRANBERRY |Idaho Panhandle N...|yearlong| 1|
+--------------------+----------------+--------------------+--------+------+
```

```py
map = SedonaKepler.create_map(routes1_df, name="routes")
SedonaKepler.add_df(map, tree_df, name="Tree Stands")
```

![](/images/blog/finding-tree/kepler_route1.png)

As we can see above most of our tree stands have Forest Service roads leading right though them. We want to expand our route a bit though - we want to know what roads we need to take to turn onto the roads that intersect our tree stands. To do this we can use a SQL subquery to find roads that either intersect or touch the roads that intersect our tree stands.

```py
routes_df = sedona.sql("""
SELECT DISTINCT idaho.geometry, idaho.name, idaho.forest, idaho.seasonal
FROM (
    SELECT idaho.geometry, name, forest, seasonal, symbol
    FROM idaho, trees
    WHERE ST_Intersects(trees.geometry, idaho.geometry)) AS routes, idaho
WHERE ST_Touches(idaho.geometry, routes.geometry)
""")
routes_df.show()
```

```md
+--------------------+------------------+--------------------+--------+
| geometry | name | forest |seasonal|
+--------------------+------------------+--------------------+--------+
|LINESTRING (-116....| CLARKIA MARBLE |Idaho Panhandle N...|yearlong|
|LINESTRING (-116....| CHARLIE CREEK |Idaho Panhandle N...|yearlong|
|LINESTRING (-116....| CRANBERRY |Idaho Panhandle N...|yearlong|
|LINESTRING (-116....| CAMP 3 |Idaho Panhandle N...|yearlong|
|LINESTRING (-116....| PALOUSE DIVIDE |Idaho Panhandle N...|yearlong|
|LINESTRING (-116....| 3332 E |Idaho Panhandle N...|yearlong|
|LINESTRING (-116....| HOMESTEAD CREEK |Idaho Panhandle N...|yearlong|
|LINESTRING (-116....| PALOUSE DIVIDE |Idaho Panhandle N...|seasonal|
|LINESTRING (-116....| EAGLE CREEK |Idaho Panhandle N...|yearlong|
|LINESTRING (-116....| BONNEVILLE POWER |Idaho Panhandle N...|yearlong|
|LINESTRING (-116....|CHARLIE CONNECTION|Idaho Panhandle N...|yearlong|
|LINESTRING (-116....| CRANE |Idaho Panhandle N...|yearlong|
|LINESTRING (-116....| 3332 F |Idaho Panhandle N...|yearlong|
|LINESTRING (-116....| HOODOO |Idaho Panhandle N...|yearlong|
|LINESTRING (-116....| LACEY CREEK |Idaho Panhandle N...|yearlong|
|LINESTRING (-116....| CLARKIA MARBLE |Idaho Panhandle N...|yearlong|
|LINESTRING (-116....| CORNWALL CREEK |Idaho Panhandle N...|yearlong|
+--------------------+------------------+--------------------+--------+
```

![Visualizing routes with SedonaKepler](/images/blog/finding-tree/kepler_routes.png)

That gives us a better indication of how to navigate to our tree stands! Next, we'll export our route data to GeoJSON to load back into QGIS to combine with other data from our MVUM dataset to create a navigation map so we can find our Christmas trees!

```py
routes_gdf = geopandas.GeoDataFrame(routes_df.toPandas(), geometry="geometry")
routes_gdf.to_file('routes.geojson', driver='GeoJSON')
```

And here's the final map:

![Christmas Tree Hunting Near Santa, Idaho](/images/blog/finding-tree/07-navigation-final.png)

## Resources

- [Code on GitHub](https://github.com/johnymontana/30-day-map-challenge/blob/main/notebooks/07-navigation.ipynb)
- [Wherobots Cloud](https://wherobots.com/wherobots-cloud/)
