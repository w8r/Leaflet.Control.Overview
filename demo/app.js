import Overview from '../';

const CENTER  = [22.2670, 114.188];
const ZOOM    = 13;
const OSM_URL = 'http://{s}.tile.osm.org/{z}/{x}/{y}.png';

const map = global.map = L.map('map').setView(CENTER, ZOOM);

const tiles = L.tileLayer(OSM_URL, {
  attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

map.addControl(new Overview(L.tileLayer(OSM_URL, tiles.options), {}));
