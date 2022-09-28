# Offline HTML5 Maps Application

## Aims:

To produce an offline mapping application using recent HTML5 offline technologies such as application caching, local storage and the indexedDB. The application will be based on Open Street Map (OSM) data stored in a local database and rendered in realtime.

## Background:

Recent developments in HTML5 include the facility for producing "web" applications that work offline - that is, when no internet connection is present. This technology can be used to produce web-pages that can also be used as apps on mobile phones of all kinds.

Mapping applications are hugely popular on mobile devices, and many of us would be lost without them. In most cases - such as Google Maps - the maps are represented as image tiles that must be cached for offline use. Searching or route planning requires a data connection.

An alternative representation is "vector maps" where the actual location data of the roads and buildings is stored and rendered in realtime (one such app is "osmand"). Because the actual map data is available, it can be searched and presented as the user wishes without a data connection.

This project will experiment with new HTML5 technologies to produce a vector map application.

## Early Deliverables

### Proof of concept programs:

* A "hello world" offline HTML5 application.
* A "todo list" application using an indexedDB.
* Drawing shapes using the HTML5 canvas.
* A web page that loads and lists Open Street Map data in raw form.

### Reports

* Basic web page development in HTML5: html, javascript, css.
* Advanced technologies: jQuery, HTML5 canvas.
* Developing an offline HTML5 application: caching, localstorage, indexedDB.
* Open Street Map data representation and vector vs. image tile maps.

## Final Deliverables

* The program will work offline.
* The program will allow the user to load and display map data.
* The program will allow the user to zoom and move around the map.
* Features for improving rendering performance such as database indexing and image caching.

## Suggested Extensions

* Allowing the user to search for interesting features.
* Allowing the dynamic display of different kinds of data (E.g. highlight cafes on screen).
* The support of different OSM data formats.
* Downloading map data dynamically when a connection is present.

Reading

* Tutorials: http://www.w3schools.com/
* Offline HTML5 applications: https://developer.mozilla.org/en-US/docs/Web/HTML/Using_the_application_cache
* Indexed DB: http://www.ibm.com/developerworks/library/wa-indexeddb/
* Open Street Map: http://wiki.openstreetmap.org/wiki/Develop

