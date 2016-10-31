require('leaflet-path-drag');

const Minimap = L.Map.extend({});

/**
 * @class L.Control.Overview
 * @extends {L.Control}
 */
L.Control.Overview = L.Control.extend({

  options: {
    position: 'bottomright',

    reactangle:       true,
    rectangleClass:   L.Rectangle,
    rectangleOptions: {
      draggable: true,
      weight:    2
    },

    mapOptions:       {
      attributionControl: false,
      zoomControl:        false,
      boxZoom:            false
    },
    zoomOffset:       3,
    autoDetectLayers: true,
    filterLayers:     layer => (
      layer instanceof L.TileLayer    ||
      layer instanceof L.ImageOverlay ||
      layer instanceof L.DivOverlay
    ),

    minimapClass: Minimap,

    className:          'leaflet-bar leaflet-overview',
    mapClassName:       'leaflet-overview--map',
    rectangleClassName: 'leaflet-overview--rectangle',
  },

  /**
   * @constructor
   * @param {Object}
   */
  initialize (layers, options) {

    /**
     * @type {L.Map}
     */
    this._overviewmap = null;

    /**
     * @type {L.Rectangle}
     */
    this._rectangle   = null;


    /**
     * @type {Boolean}
     */
    this._skipUpdate  = false;


    /**
     * @type {Array.<L.Layer>}
     */
    this._layers      = L.Util.isArray(layers) ? layers : [layers];

    L.Control.prototype.initialize.call(this, options);
  },


  onAdd (map) {
    this._container = L.DomUtil.create('div', this.options.className);
    L.DomEvent
      .disableScrollPropagation(this._container)
      .disableClickPropagation(this._container);

    this._mapContainer = L.DomUtil.create('div',
      this.options.mapClassName, this._container);

    map
      .on('moveend zoomend viewreset', this._update, this)
      .on('layeradd', this._onLayerAdded, this);

    this._createMap();

    return this._container;
  },


  onRemove (map) {
    this._overviewmap.removeLayer(this._rectangle);
    this._overviewmap.remove();
    this._overviewmap = this._rectangle = null;

    map
      .off('moveend zoomend viewreset', this._update, this)
      .off('layeradd', this._onLayerAdded, this);
  },


  get rectangle () {
    return this._rect;
  },


  get overview () {
    return this._overviewmap;
  },


  _createMap () {
    L.Util.requestAnimFrame(() => {
      const OverviewMap = this.options.minimapClass;
      this._overviewmap = new OverviewMap(
        this._mapContainer,
        this.options.mapOptions)
        .setView(this._map.getCenter(),
          this._map.getZoom() - this.options.zoomOffset);

      this._overviewmap.on('moveend', this._onMoveend, this);
      for (let i = 0, len = this._layers.length; i < len; i++) {
        this._overviewmap.addLayer(this._layers[i]);
      }
      this._createRect();
    });
  },


  _createRect () {
    const Rectangle = this.options.rectangleClass;
    this._rect = new Rectangle(this._map.getBounds(),
      L.Util.extend({ className: this.options.rectangleClassName },
        this.options.rectangleOptions));
    this._rect.on('dragend', this._onRectDragend, this);
    this._overviewmap.addLayer(this._rect);
  },


  _onLayerAdded (evt) {
    console.log(evt);
  },


  _onMoveend () {
    if (this._skipUpdate) {
      this._skipUpdate = false;
    } else {
      this._map.setView(this._overviewmap.getCenter());
    }
  },


  _update () {
    this._skipUpdate = true;
    this._overviewmap.setView(this._map.getCenter(),
      this._map.getZoom() - this.options.zoomOffset);
    this._rect.setLatLngs(this._rect._boundsToLatLngs(this._map.getBounds()));
  },


  _onRectDragend () {
    this._overviewmap.setView(this._rect.getBounds().getCenter());
  }

});

L.Control.Overview.Map = Minimap;

// factory
L.control.overview = (options) => new L.Control.Overview(options);

L.Map.mergeOptions({
  overviewControl: false
});

L.Map.addInitHook(function () {
	if (this.options.overviewControl) {
		this.overviewControl = new L.Control.Overview();
		this.addControl(this.overviewControl);
	}
});

module.exports = L.Control.Overview;
