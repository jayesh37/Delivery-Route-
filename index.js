var points = []
var APIKEY = "vh5r6VnkAcVCUo9EvX4u9t0JwWZ4kZXb"
// Instructions list from the Routing API
var instructions = new Map()
// This is our location
var LAST_MILE = {
  lat: 19.076090,
  lng: 72.877426
}
// the Map object is created and 
// assigned to the container with id="mymap"
var map = tt.map({
  key: APIKEY,
  container: 'mymap',
  center: LAST_MILE,
  zoom: 11,
  style: './lightAndTraffic.json',
  styleVisibility: {
    trafficFlow: true,
    trafficIncidents: true
  }
});
// Will add the 'van' marker as the head quarters location and add the location
// to the waypoints array. We need this as the first element should be the HQ
var displayHQ = function () {
  // add a marker
  var markerElement = document.createElement('div');
  markerElement.className = 'marker';
  markerElement.style.backgroundImage = 'url(van.png)';
  var marker = new tt.Marker({ element: markerElement })
    .setLngLat(LAST_MILE)
    .setDraggable(true)
    .addTo(map);
  marker.on('dragend', function (event) {
    console.log(event)
  })
  // Add the first point as the HQ
  points.push({
    name: 'hq',
    location: LAST_MILE,
    innerMarker: marker
  })
}
// Callback to handle when the map is loaded. In this case we just add the HQ marker
map.on('load', function () {
  displayHQ()
})
// Callback when a click event happens on the map. 
// We create a destination marker and reverse geocode the coordinates
// to get the address  
map.on('click', function (event) {
  // reverse geocode address
  tt.services.reverseGeocode({
    key: APIKEY,
    position: event.lngLat
  })
    .go()
    .then(function (response) {
      console.log(response)
      var firstResult = response.addresses[0]
      var address = firstResult.address.freeformAddress
      var position = firstResult.position
      // create the marker in this position
      marker = createMarker(position);
      points.push({
        name: points.length,
        location: position,
        innerMarker: marker
      })
      marker.addTo(map)
      // Update the delivery list
      addDelivery(address, position)
    })
})
// Move the map to another location
var goto = function (position) {
  map.easeTo({
    center: position,
    zoom: 17
  })
}
// Add a line to the list of instructions on the screen
var addInstruction = function (text) {
  var ul = document.getElementById("instructions")
  var li = document.createElement('li');
  var element = document.createElement('div')
  element.innerHTML = text
  li.appendChild(element)
  ul.appendChild(li)
}
// Add a delivery location to the list on the screen
var addDelivery = function (address, position) {
  // add delivery to the list
  var ul = document.getElementById("deliveries")
  var li = document.createElement('li');
  var element = document.createElement('div')
  element.innerHTML = address
  element.onclick = function () { goto(position) }
  li.appendChild(element)
  ul.appendChild(li)
  routeOptimizedTime()
  routeOptimizedDistance()
}
// Create a default destination marker. In this case it is a yellow 'shield'
// with the consecutive number inside
var createMarker = function (lngLat) {
  var markerElement = document.createElement('div')
  markerElement.className = 'marker';
  markerElement.innerHTML = ' ' + points.length + ' '
  markerElement.style.textAlign = 'center'
  markerElement.style.backgroundImage = 'url(shield.png)'
  var marker = new tt.Marker({
    element: markerElement, anchor: 'top'
  })
  marker.setLngLat(lngLat)
  return marker
}
// Handler to the button on the screen to search for an address as destination
// Geocoding the address we provide the coordinates. Then we add it as a delivery location
var addDestination = function () {
  tt.services.geocode({
    key: APIKEY,
    query: document.getElementById("location").value,
    boundingBox: map.getBounds()
  })
    .go()
    .then(function (result) {
      if (result.results) {
        console.log(result)
        if (result.results.length > 0) {
          var position = result.results[0].position
          var address = result.results[0].address.freeformAddress
          marker = createMarker(position);
          points.push({
            name: points.length,
            location: position,
            innerMarker: marker
          })
          marker.addTo(map)
          addDelivery(address, position)
        }
      }
    });
  document.getElementById("location").value = ""
}
// Remove the route layer from the map
var clearRoute = function (name) {
  if (map.getLayer(name)) {
    map.removeLayer(name)
    map.removeSource(name)
  }
}
// Parse the instructions for speed and distance map, to display them on the screen
var displayInstructions = function (id) {
  // Clear the instructions list 
  var lis = document.querySelectorAll('#instructions li')
  for (var i = 0; li = lis[i]; i++) {
    li.parentNode.removeChild(li)
  }
  if (instructions.get(id)) {
    var textArea = ''
    instructions.get(id).forEach(function (text) {
      //addInstruction(text)
      textArea += '. ' + text + '\n'
    })
    document.getElementById("instructionList").value = textArea
  }
}
// Clear the  delivery list
var clearDeliveries = function () {
  // Clear the delivery list 
  var lis = document.querySelectorAll('#deliveries li')
  for (var i = 0; li = lis[i]; i++) {
    li.parentNode.removeChild(li)
  }
  // Remove all points except the first one
  while (points.length > 1) {
    var el = points.pop()
    var marker = el.innerMarker
    marker.remove();
  }
  // remove route layers
  clearRoute('red')
  clearRoute('blue')
  // clear summaries
  document.getElementById('summaryByTime').innerHTML = ''
  document.getElementById('summaryByDistance').innerHTML = ''
}
// Perform the search for the nearest neighbor calculation for distance
var routeOptimizedDistance = function () {
  // delete current optimized route
  clearRoute('blue')
  nearestNeighbor(points, 'summaryByDistance', 'blue')
}
// Perform the search for the nearest neighbor calculation for speed
var routeOptimizedTime = function () {
  // delete current optimized route
  clearRoute('red')
  nearestNeighbor(points, 'summaryByTime', 'red')
}
// Call the routing API to create a route with the selected waypoint order (in the 'options')
// At the end we get the instructions and add the layer on the map
var createRoute = function (options, color, reportId) {
  tt.services.calculateRoute(options).go().then(function (response) {
    var geojson = response.toGeoJson()
    // Get summary of speed and distance
    var length = geojson.features[0].properties.summary.lengthInMeters
    var time = geojson.features[0].properties.summary.travelTimeInSeconds
    // get the instructions
    if (response.routes[0].guidance.instructionGroups &&
      response.routes[0].guidance.instructionGroups.length > 0) {
      var instList = response.routes[0].guidance.instructionGroups.map(function (element) {
        return element.groupMessage
      })
      instructions.set(reportId, instList);
      console.log(instList)
    }
    // Display the distance and time sumary
    var tmpString = document.getElementById(reportId).innerHTML
    document.getElementById(reportId).innerHTML = tmpString +
      '<br>Route is ' + convertToKM(length) + ' Km and will arrive in ' + convertSecondstoTime(time) + ''
    map.addLayer({
      'id': color,
      'type': 'line',
      'source': {
        'type': 'geojson',
        'data': geojson
      },
      'paint': {
        'line-color': color,
        'line-width': 6
      }
    })
  })
}
// 
var extractLocations = function (points) {
  var locations = []
  points.forEach(element => {
    locations.push(element.location)
  });
  return locations
}
const nearestNeighbor = async (points, id, color) => {
  var nPoints = [...points]
  // get the first one as the origin
  const path = [nPoints.shift()]
  while (nPoints.length > 0) {
    // sort remaining points in place by their
    // distance from the last point in the current path
    var lastPoint = path[path.length - 1]
    var currentMatrix = await getSummaries(lastPoint, nPoints)
    nPoints.sort(
      (a, b) =>
        getCost(id, currentMatrix, lastPoint, b) - getCost(id, currentMatrix, lastPoint, a)
    )
    // go to the closest remaining point
    path.push(nPoints.pop())
  }
  // return to start after visiting all other points
  path.push(path[0])
  var routeDescription = '';
  for (element of path) {
    routeDescription += '(' + element.name + ')'
  }
  document.getElementById(id).innerHTML = routeDescription
  // Add route
  // The locations are a map of the path
  var routeOptions = {
    key: APIKEY,
    locations: path.map(function (element) { return element.location }),
    travelMode: 'truck',
    instructionsType: 'text',
    language: 'es-ES'
  }
  createRoute(routeOptions, color, id)
}
