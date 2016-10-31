import tape     from 'tape';
import L        from 'leaflet';
import Overview from '../';

const CENTER  = [22.2670, 114.188];
const ZOOM    = 13;
const OSM_URL = 'http://{s}.tile.osm.org/{z}/{x}/{y}.png';

const addStyle = (url, id = 'added-style') => {
  if (!document.querySelector(`#${id}`)) {
    const style = document.createElement('link');
    style.setAttribute('rel', 'stylesheet');
    style.setAttribute('href', url);
    document.head.appendChild(style);
  }
};

addStyle('//cdnjs.cloudflare.com/ajax/libs/leaflet/1.0.1/leaflet.css', 'leaflet-style');
addStyle('src/L.Control.Overview.css', 'control-style');

const createMap = () => {
  const container = document.createElement('div');
  container.style.width = container.style.height = '800px';
  document.body.appendChild(container);
  const map = L.map(container).setView(CENTER, ZOOM);
  return map;
}

tape('L.Control.Overview', (t) => {

  t.test('Export', (t) => {
    t.equal(typeof L.Control.Overview, 'function', 'control exposed');
    t.equal(typeof L.control.overview, 'function', 'factory exposed');
    t.end();
  });

  t.test('Control', (t) => {
    const map = createMap();

    t.end();
  });

  t.end();
});
