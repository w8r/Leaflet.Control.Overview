require('leaflet-path-drag');

const Minimap = L.Map.extend({});

/**
 * @class L.Control.Overview
 * @extends {L.Control}
 */
L.Control.Overview = L.Control.extend({

  options: {
    position: 'bottomright',

    rectangle:        true,
    rectangleClass:   L.Rectangle,
    rectangleOptions: {
      draggable: true,
      weight:    2
    },

    mapOptions:       {
      attributionControl: false,
      zoomControl:        false,
      boxZoom:            false,
      zoomAnimation:      false
    },

    fixedZoomLevel:   false,
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

    updateDelay: 300
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

    this._updateThrottled = L.Util.throttle(
      this._update, this.options.updateDelay, this);

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
      .on('moveend zoomend viewreset', this._updateThrottled, this)
      .on('layeradd',  this._onLayerAdded,   this)
      .on('move', this._onMapMove, this);

    this._createMap();

    return this._container;
  },


  onRemove (map) {
    this._overviewmap.removeLayer(this._rectangle);
    this._overviewmap.remove();
    this._overviewmap = this._rectangle = null;

    map
      .off('moveend zoomend viewreset', this._updateThrottled, this)
      .off('layeradd',  this._onLayerAdded, this)
      .off('move', this._onMapMove, this);
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
      const zoom = (typeof this.options.fixedZoomLevel === 'number') ?
        this.options.fixedZoomLevel:
        this._map.getZoom() - this.options.zoomOffset;

      this._overviewmap = new OverviewMap(
        this._mapContainer,
        this.options.mapOptions)
        .setView(this._map.getCenter(), zoom);

      this._overviewmap
        .on('dragstart', this._onMapDragStart, this)
        .on('drag',      this._onMapDrag,      this)
        .on('dragend',   this._onMapDragEnd,   this)
        .on('moveend',   this._onMoveend,      this);

      for (let i = 0, len = this._layers.length; i < len; i++) {
        this._overviewmap.addLayer(this._layers[i]);
      }
      this._createRect();
    });
  },


  _createRect () {
    if (this.options.rectangle) {
      const Rectangle = this.options.rectangleClass;
      this._rect = new Rectangle(this._map.getBounds(),
        L.Util.extend({ className: this.options.rectangleClassName },
          this.options.rectangleOptions));
      this._rect.on('dragend', this._onRectDragend, this);
      this._overviewmap.addLayer(this._rect);
    }
  },


  _onLayerAdded (evt) {
    console.log(evt);
  },


  /**
   * Mini-map -> main map update
   */
  _onMoveend (evt) {
    if (!this._skipUpdate) {
      console.log('tttt');
      this._skipUpdate = true;
      this._map.setView(this._overviewmap.getCenter());
    }
  },


  /**
   * Main map -> overview map update
   */
  _update (evt) {
    if (this._skipUpdate) {
      this._skipUpdate = false;
      return;
    }
    console.log('update from the map');
    const zoom = this.options.fixedZoomLevel ?
      this._overviewmap.getZoom() :
      this._map.getZoom() - this.options.zoomOffset;
    this._overviewmap.setView(this._map.getCenter(), zoom);
    this._rect.setLatLngs(this._rect._boundsToLatLngs(this._map.getBounds()));
  },


  _onRectDragend () {
    this._skipUpdate = true;
    this._overviewmap.setView(this._rect.getBounds().getCenter());
    this._map.setView(this._rect.getBounds().getCenter());
  },


  _onMapDragStart () {

  },


  _onMapDragEnd () {

  },


  _onMapDrag () {
    //this._rect.setLatLngs(this._map.getBounds());
  },


  _onMapMove () {
    if (this._rect) {
      //this._skipUpdate = true;
      //this._rect.setBounds(this._map.getBounds());
    }
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
