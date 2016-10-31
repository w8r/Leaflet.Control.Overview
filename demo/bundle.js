(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (global){
'use strict';

var _ = require('../');

var _2 = _interopRequireDefault(_);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var CENTER = [22.2670, 114.188];
var ZOOM = 13;
var OSM_URL = 'http://{s}.tile.osm.org/{z}/{x}/{y}.png';

var map = global.map = L.map('map').setView(CENTER, ZOOM);

var tiles = L.tileLayer(OSM_URL, {
  attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

map.addControl(new _2.default(L.tileLayer(OSM_URL, tiles.options), {}));

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../":2}],2:[function(require,module,exports){
'use strict';

module.exports = require('./src/L.Control.Overview');

},{"./src/L.Control.Overview":9}],3:[function(require,module,exports){
require('./src/SVG');
require('./src/SVG.VML');
require('./src/Canvas');
require('./src/Path.Transform');
require('./src/Path.Drag');

module.exports = L.Path.Drag;

},{"./src/Canvas":4,"./src/Path.Drag":5,"./src/Path.Transform":6,"./src/SVG":8,"./src/SVG.VML":7}],4:[function(require,module,exports){
L.Util.trueFn = function() {
  return true;
};

L.Canvas.include({

  /**
   * Do nothing
   * @param  {L.Path} layer
   */
  _resetTransformPath: function(layer) {
    if (!this._containerCopy) return;

    delete this._containerCopy;

    if (layer._containsPoint_) {
      layer._containsPoint = layer._containsPoint_;
      delete layer._containsPoint_;

      this._requestRedraw(layer);
    }
  },


  /**
   * Algorithm outline:
   *
   * 1. pre-transform - clear the path out of the canvas, copy canvas state
   * 2. at every frame:
   *    2.1. save
   *    2.2. redraw the canvas from saved one
   *    2.3. transform
   *    2.4. draw path
   *    2.5. restore
   *
   * @param  {L.Path}         layer
   * @param  {Array.<Number>} matrix
   */
  transformPath: function(layer, matrix) {
    var copy = this._containerCopy;
    var ctx = this._ctx;
    var m = L.Browser.retina ? 2 : 1;
    var bounds = this._bounds;
    var size = bounds.getSize();
    var pos = bounds.min;

    if (!copy) {
      copy = this._containerCopy = document.createElement('canvas');
      document.body.appendChild(copy);

      copy.width = m * size.x;
      copy.height = m * size.y;

      layer._removed = true;
      this._redraw();

      copy.getContext('2d').translate(m * bounds.min.x, m * bounds.min.y);
      copy.getContext('2d').drawImage(this._container, 0, 0);
      this._initPath(layer);
      layer._containsPoint_ = layer._containsPoint;
      layer._containsPoint = L.Util.trueFn;
    }

    ctx.save();
    ctx.clearRect(pos.x, pos.y, size.x * m, size.y * m);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.restore();
    ctx.save();

    ctx.drawImage(this._containerCopy, 0, 0, size.x, size.y);
    ctx.transform.apply(ctx, matrix);

    var layers = this._layers;
    this._layers = {};

    this._initPath(layer);
    layer._updatePath();

    this._layers = layers;
    ctx.restore();
  }

});

},{}],5:[function(require,module,exports){
/**
 * Drag handler
 * @class L.Path.Drag
 * @extends {L.Handler}
 */
L.Handler.PathDrag = L.Handler.extend( /** @lends  L.Path.Drag.prototype */ {

  statics: {
    DRAGGING_CLS: 'leaflet-path-draggable',
  },


  /**
   * @param  {L.Path} path
   * @constructor
   */
  initialize: function(path) {

    /**
     * @type {L.Path}
     */
    this._path = path;

    /**
     * @type {Array.<Number>}
     */
    this._matrix = null;

    /**
     * @type {L.Point}
     */
    this._startPoint = null;

    /**
     * @type {L.Point}
     */
    this._dragStartPoint = null;

    /**
     * @type {Boolean}
     */
    this._mapDraggingWasEnabled = false;

  },

  /**
   * Enable dragging
   */
  addHooks: function() {
    this._path.on('mousedown', this._onDragStart, this);

    this._path.options.className = this._path.options.className ?
        (this._path.options.className + ' ' + L.Handler.PathDrag.DRAGGING_CLS) :
         L.Handler.PathDrag.DRAGGING_CLS;

    if (this._path._path) {
      L.DomUtil.addClass(this._path._path, L.Handler.PathDrag.DRAGGING_CLS);
    }
  },

  /**
   * Disable dragging
   */
  removeHooks: function() {
    this._path.off('mousedown', this._onDragStart, this);

    this._path.options.className = this._path.options.className
      .replace(new RegExp('\\s+' + L.Handler.PathDrag.DRAGGING_CLS), '');
    if (this._path._path) {
      L.DomUtil.removeClass(this._path._path, L.Handler.PathDrag.DRAGGING_CLS);
    }
  },

  /**
   * @return {Boolean}
   */
  moved: function() {
    return this._path._dragMoved;
  },

  /**
   * Start drag
   * @param  {L.MouseEvent} evt
   */
  _onDragStart: function(evt) {
    var eventType = evt.originalEvent._simulated ? 'touchstart' : evt.originalEvent.type;

    this._mapDraggingWasEnabled = false;
    this._startPoint = evt.containerPoint.clone();
    this._dragStartPoint = evt.containerPoint.clone();
    this._matrix = [1, 0, 0, 1, 0, 0];
    L.DomEvent.stop(evt.originalEvent);

    L.DomUtil.addClass(this._path._renderer._container, 'leaflet-interactive');
    L.DomEvent
      .on(document, L.Draggable.MOVE[eventType], this._onDrag,    this)
      .on(document, L.Draggable.END[eventType],  this._onDragEnd, this);

    if (this._path._map.dragging.enabled()) {
      // I guess it's required because mousdown gets simulated with a delay
      //this._path._map.dragging._draggable._onUp(evt);

      this._path._map.dragging.disable();
      this._mapDraggingWasEnabled = true;
    }
    this._path._dragMoved = false;

    if (this._path._popup) { // that might be a case on touch devices as well
      this._path._popup._close();
    }

    this._replaceCoordGetters(evt);
  },

  /**
   * Dragging
   * @param  {L.MouseEvent} evt
   */
  _onDrag: function(evt) {
    L.DomEvent.stop(evt);

    var first = (evt.touches && evt.touches.length >= 1 ? evt.touches[0] : evt);
    var containerPoint = this._path._map.mouseEventToContainerPoint(first);

    var x = containerPoint.x;
    var y = containerPoint.y;

    var dx = x - this._startPoint.x;
    var dy = y - this._startPoint.y;

    if (!this._path._dragMoved && (dx || dy)) {
      this._path._dragMoved = true;
      this._path.fire('dragstart', evt);
      // we don't want that to happen on click
      this._path.bringToFront();
    }

    this._matrix[4] += dx;
    this._matrix[5] += dy;

    this._startPoint.x = x;
    this._startPoint.y = y;

    this._path.fire('predrag', evt);
    this._path._transform(this._matrix);
    this._path.fire('drag', evt);
  },

  /**
   * Dragging stopped, apply
   * @param  {L.MouseEvent} evt
   */
  _onDragEnd: function(evt) {
    var containerPoint = this._path._map.mouseEventToContainerPoint(evt);
    var moved = this.moved();

    // apply matrix
    if (moved) {
      this._transformPoints(this._matrix);
      this._path._updatePath();
      this._path._project();
      this._path._transform(null);

      L.DomEvent.stop(evt);
    }


    L.DomEvent
      .off(document, 'mousemove touchmove', this._onDrag, this)
      .off(document, 'mouseup touchend',    this._onDragEnd, this);

    this._restoreCoordGetters();

    // consistency
    if (moved) {
      this._path.fire('dragend', {
        distance: Math.sqrt(
          L.LineUtil._sqDist(this._dragStartPoint, containerPoint)
        )
      });

      // hack for skipping the click in canvas-rendered layers
      var contains = this._path._containsPoint;
      this._path._containsPoint = L.Util.falseFn;
      L.Util.requestAnimFrame(function() {
        L.DomEvent._skipped({ type: 'click' });
        this._path._containsPoint = contains;
      }, this);
    }

    this._matrix          = null;
    this._startPoint      = null;
    this._dragStartPoint  = null;
    this._path._dragMoved = false;

    if (this._mapDraggingWasEnabled) {
      if (moved) L.DomEvent._fakeStop({ type: 'click' });
      this._path._map.dragging.enable();
    }
  },


  /**
   * Applies transformation, does it in one sweep for performance,
   * so don't be surprised about the code repetition.
   *
   * [ x ]   [ a  b  tx ] [ x ]   [ a * x + b * y + tx ]
   * [ y ] = [ c  d  ty ] [ y ] = [ c * x + d * y + ty ]
   *
   * @param {Array.<Number>} matrix
   */
  _transformPoints: function(matrix, dest) {
    var path = this._path;
    var i, len, latlng;

    var px = L.point(matrix[4], matrix[5]);

    var crs = path._map.options.crs;
    var transformation = crs.transformation;
    var scale = crs.scale(path._map.getZoom());
    var projection = crs.projection;

    var diff = transformation.untransform(px, scale)
      .subtract(transformation.untransform(L.point(0, 0), scale));
    var applyTransform = !dest;

    path._bounds = new L.LatLngBounds();

    // console.time('transform');
    // all shifts are in-place
    if (path._point) { // L.Circle
      dest = projection.unproject(
        projection.project(path._latlng)._add(diff));
      if (applyTransform) {
        path._latlng = dest;
        path._point._add(px);
      }
    } else if (path._rings || path._parts) { // everything else
      var rings   = path._rings || path._parts;
      var latlngs = path._latlngs;
      dest = dest || latlngs;
      if (!L.Util.isArray(latlngs[0])) { // polyline
        latlngs = [latlngs];
        dest    = [dest];
      }
      for (i = 0, len = rings.length; i < len; i++) {
        dest[i] = dest[i] || [];
        for (var j = 0, jj = rings[i].length; j < jj; j++) {
          latlng     = latlngs[i][j];
          dest[i][j] = projection
            .unproject(projection.project(latlng)._add(diff));
          if (applyTransform) {
            path._bounds.extend(latlngs[i][j]);
            rings[i][j]._add(px);
          }
        }
      }
    }
    return dest;
    // console.timeEnd('transform');
  },



  /**
   * If you want to read the latlngs during the drag - your right,
   * but they have to be transformed
   */
  _replaceCoordGetters: function() {
    if (this._path.getLatLng) { // Circle, CircleMarker
      this._path.getLatLng_ = this._path.getLatLng;
      this._path.getLatLng = L.Util.bind(function() {
        return this.dragging._transformPoints(this.dragging._matrix, {});
      }, this._path);
    } else if (this._path.getLatLngs) {
      this._path.getLatLngs_ = this._path.getLatLngs;
      this._path.getLatLngs = L.Util.bind(function() {
        return this.dragging._transformPoints(this.dragging._matrix, []);
      }, this._path);
    }
  },


  /**
   * Put back the getters
   */
  _restoreCoordGetters: function() {
    if (this._path.getLatLng_) {
      this._path.getLatLng = this._path.getLatLng_;
      delete this._path.getLatLng_;
    } else if (this._path.getLatLngs_) {
      this._path.getLatLngs = this._path.getLatLngs_;
      delete this._path.getLatLngs_;
    }
  }

});


/**
 * @param  {L.Path} layer
 * @return {L.Path}
 */
L.Handler.PathDrag.makeDraggable = function(layer) {
  layer.dragging = new L.Handler.PathDrag(layer);
  return layer;
};


/**
 * Also expose as a method
 * @return {L.Path}
 */
L.Path.prototype.makeDraggable = function() {
  return L.Handler.PathDrag.makeDraggable(this);
};


L.Path.addInitHook(function() {
  if (this.options.draggable) {
    // ensure interactive
    this.options.interactive = true;

    if (this.dragging) {
      this.dragging.enable();
    } else {
      L.Handler.PathDrag.makeDraggable(this);
      this.dragging.enable();
    }
  } else if (this.dragging) {
    this.dragging.disable();
  }
});

},{}],6:[function(require,module,exports){
/**
 * Leaflet vector features drag functionality
 * @author Alexander Milevski <info@w8r.name>
 * @preserve
 */

/**
 * Matrix transform path for SVG/VML
 * Renderer-independent
 */
L.Path.include({

	/**
	 * Applies matrix transformation to SVG
	 * @param {Array.<Number>?} matrix
	 */
	_transform: function(matrix) {
		if (this._renderer) {
			if (matrix) {
				this._renderer.transformPath(this, matrix);
			} else {
				// reset transform matrix
				this._renderer._resetTransformPath(this);
				this._update();
			}
		}
		return this;
	},

	/**
	 * Check if the feature was dragged, that'll supress the click event
	 * on mouseup. That fixes popups for example
	 *
	 * @param  {MouseEvent} e
	 */
	_onMouseClick: function(e) {
		if ((this.dragging && this.dragging.moved()) ||
			(this._map.dragging && this._map.dragging.moved())) {
			return;
		}

		this._fireMouseEvent(e);
	}

});

},{}],7:[function(require,module,exports){
L.SVG.include(!L.Browser.vml ? {} : {

	/**
	 * Reset transform matrix
	 */
	_resetTransformPath: function(layer) {
		if (layer._skew) {
			// super important! workaround for a 'jumping' glitch:
			// disable transform before removing it
			layer._skew.on = false;
			layer._path.removeChild(layer._skew);
			layer._skew = null;
		}
	},

	/**
	 * Applies matrix transformation to VML
	 * @param {L.Path}         layer
	 * @param {Array.<Number>} matrix
	 */
	transformPath: function(layer, matrix) {
		var skew = layer._skew;

		if (!skew) {
			skew = L.SVG.create('skew');
			layer._path.appendChild(skew);
			skew.style.behavior = 'url(#default#VML)';
			layer._skew = skew;
		}

		// handle skew/translate separately, cause it's broken
		var mt = matrix[0].toFixed(8) + ' ' + matrix[1].toFixed(8) + ' ' +
			matrix[2].toFixed(8) + ' ' + matrix[3].toFixed(8) + ' 0 0';
		var offset = Math.floor(matrix[4]).toFixed() + ', ' +
			Math.floor(matrix[5]).toFixed() + '';

		var s = this._path.style;
		var l = parseFloat(s.left);
		var t = parseFloat(s.top);
		var w = parseFloat(s.width);
		var h = parseFloat(s.height);

		if (isNaN(l))       l = 0;
		if (isNaN(t))       t = 0;
		if (isNaN(w) || !w) w = 1;
		if (isNaN(h) || !h) h = 1;

		var origin = (-l / w - 0.5).toFixed(8) + ' ' + (-t / h - 0.5).toFixed(8);

		skew.on = 'f';
		skew.matrix = mt;
		skew.origin = origin;
		skew.offset = offset;
		skew.on = true;
	}

});

},{}],8:[function(require,module,exports){
L.SVG.include({

	/**
	 * Reset transform matrix
	 */
	_resetTransformPath: function(layer) {
		layer._path.setAttributeNS(null, 'transform', '');
	},

	/**
	 * Applies matrix transformation to SVG
	 * @param {L.Path}         layer
	 * @param {Array.<Number>} matrix
	 */
	transformPath: function(layer, matrix) {
		layer._path.setAttributeNS(null, 'transform',
			'matrix(' + matrix.join(' ') + ')');
	}

});

},{}],9:[function(require,module,exports){
'use strict';

require('leaflet-path-drag');

var Minimap = L.Map.extend({});

/**
 * @class L.Control.Overview
 * @extends {L.Control}
 */
L.Control.Overview = L.Control.extend({

  options: {
    position: 'bottomright',

    rectangle: true,
    rectangleClass: L.Rectangle,
    rectangleOptions: {
      draggable: true,
      weight: 2
    },

    mapOptions: {
      attributionControl: false,
      zoomControl: false,
      boxZoom: false,
      zoomAnimation: false
    },

    fixedZoomLevel: false,
    zoomOffset: 3,

    autoDetectLayers: true,
    filterLayers: function filterLayers(layer) {
      return layer instanceof L.TileLayer || layer instanceof L.ImageOverlay || layer instanceof L.DivOverlay;
    },

    minimapClass: Minimap,

    className: 'leaflet-bar leaflet-overview',
    mapClassName: 'leaflet-overview--map',
    rectangleClassName: 'leaflet-overview--rectangle',

    updateDelay: 300
  },

  /**
   * @constructor
   * @param {Object}
   */
  initialize: function initialize(layers, options) {

    /**
     * @type {L.Map}
     */
    this._overviewmap = null;

    /**
     * @type {L.Rectangle}
     */
    this._rectangle = null;

    /**
     * @type {Boolean}
     */
    this._skipUpdate = false;

    /**
     * @type {Array.<L.Layer>}
     */
    this._layers = L.Util.isArray(layers) ? layers : [layers];

    this._updateThrottled = L.Util.throttle(this._update, this.options.updateDelay, this);

    L.Control.prototype.initialize.call(this, options);
  },
  onAdd: function onAdd(map) {
    this._container = L.DomUtil.create('div', this.options.className);
    L.DomEvent.disableScrollPropagation(this._container).disableClickPropagation(this._container);

    this._mapContainer = L.DomUtil.create('div', this.options.mapClassName, this._container);

    map.on('moveend zoomend viewreset', this._updateThrottled, this).on('layeradd', this._onLayerAdded, this).on('move', this._onMapMove, this);

    this._createMap();

    return this._container;
  },
  onRemove: function onRemove(map) {
    this._overviewmap.removeLayer(this._rectangle);
    this._overviewmap.remove();
    this._overviewmap = this._rectangle = null;

    map.off('moveend zoomend viewreset', this._updateThrottled, this).off('layeradd', this._onLayerAdded, this).off('move', this._onMapMove, this);
  },


  get rectangle() {
    return this._rect;
  },

  get overview() {
    return this._overviewmap;
  },

  _createMap: function _createMap() {
    var _this = this;

    L.Util.requestAnimFrame(function () {
      var OverviewMap = _this.options.minimapClass;
      var zoom = typeof _this.options.fixedZoomLevel === 'number' ? _this.options.fixedZoomLevel : _this._map.getZoom() - _this.options.zoomOffset;

      _this._overviewmap = new OverviewMap(_this._mapContainer, _this.options.mapOptions).setView(_this._map.getCenter(), zoom);

      _this._overviewmap.on('dragstart', _this._onMapDragStart, _this).on('drag', _this._onMapDrag, _this).on('dragend', _this._onMapDragEnd, _this).on('moveend', _this._onMoveend, _this);

      for (var i = 0, len = _this._layers.length; i < len; i++) {
        _this._overviewmap.addLayer(_this._layers[i]);
      }
      _this._createRect();
    });
  },
  _createRect: function _createRect() {
    if (this.options.rectangle) {
      var Rectangle = this.options.rectangleClass;
      this._rect = new Rectangle(this._map.getBounds(), L.Util.extend({ className: this.options.rectangleClassName }, this.options.rectangleOptions));
      this._rect.on('dragend', this._onRectDragend, this);
      this._overviewmap.addLayer(this._rect);
    }
  },
  _onLayerAdded: function _onLayerAdded(evt) {
    console.log(evt);
  },


  /**
   * Mini-map -> main map update
   */
  _onMoveend: function _onMoveend(evt) {
    if (!this._skipUpdate) {
      console.log('tttt');
      this._skipUpdate = true;
      this._map.setView(this._overviewmap.getCenter());
    }
  },


  /**
   * Main map -> overview map update
   */
  _update: function _update(evt) {
    if (this._skipUpdate) {
      this._skipUpdate = false;
      return;
    }
    console.log('update from the map');
    var zoom = this.options.fixedZoomLevel ? this._overviewmap.getZoom() : this._map.getZoom() - this.options.zoomOffset;
    this._overviewmap.setView(this._map.getCenter(), zoom);
    this._rect.setLatLngs(this._rect._boundsToLatLngs(this._map.getBounds()));
  },
  _onRectDragend: function _onRectDragend() {
    this._skipUpdate = true;
    this._overviewmap.setView(this._rect.getBounds().getCenter());
    this._map.setView(this._rect.getBounds().getCenter());
  },
  _onMapDragStart: function _onMapDragStart() {},
  _onMapDragEnd: function _onMapDragEnd() {},
  _onMapDrag: function _onMapDrag() {
    //this._rect.setLatLngs(this._map.getBounds());
  },
  _onMapMove: function _onMapMove() {
    if (this._rect) {
      //this._skipUpdate = true;
      //this._rect.setBounds(this._map.getBounds());
    }
  }
});

L.Control.Overview.Map = Minimap;

// factory
L.control.overview = function (options) {
  return new L.Control.Overview(options);
};

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

},{"leaflet-path-drag":3}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJkZW1vL2FwcC5qcyIsImluZGV4LmpzIiwibm9kZV9tb2R1bGVzL2xlYWZsZXQtcGF0aC1kcmFnL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2xlYWZsZXQtcGF0aC1kcmFnL3NyYy9DYW52YXMuanMiLCJub2RlX21vZHVsZXMvbGVhZmxldC1wYXRoLWRyYWcvc3JjL1BhdGguRHJhZy5qcyIsIm5vZGVfbW9kdWxlcy9sZWFmbGV0LXBhdGgtZHJhZy9zcmMvUGF0aC5UcmFuc2Zvcm0uanMiLCJub2RlX21vZHVsZXMvbGVhZmxldC1wYXRoLWRyYWcvc3JjL1NWRy5WTUwuanMiLCJub2RlX21vZHVsZXMvbGVhZmxldC1wYXRoLWRyYWcvc3JjL1NWRy5qcyIsInNyYy9MLkNvbnRyb2wuT3ZlcnZpZXcuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7QUNBQTs7Ozs7O0FBRUEsSUFBTSxTQUFVLENBQUMsT0FBRCxFQUFVLE9BQVYsQ0FBaEI7QUFDQSxJQUFNLE9BQVUsRUFBaEI7QUFDQSxJQUFNLFVBQVUseUNBQWhCOztBQUVBLElBQU0sTUFBTSxPQUFPLEdBQVAsR0FBYSxFQUFFLEdBQUYsQ0FBTSxLQUFOLEVBQWEsT0FBYixDQUFxQixNQUFyQixFQUE2QixJQUE3QixDQUF6Qjs7QUFFQSxJQUFNLFFBQVEsRUFBRSxTQUFGLENBQVksT0FBWixFQUFxQjtBQUNqQyxlQUFhO0FBRG9CLENBQXJCLEVBRVgsS0FGVyxDQUVMLEdBRkssQ0FBZDs7QUFJQSxJQUFJLFVBQUosQ0FBZSxlQUFhLEVBQUUsU0FBRixDQUFZLE9BQVosRUFBcUIsTUFBTSxPQUEzQixDQUFiLEVBQWtELEVBQWxELENBQWY7Ozs7Ozs7QUNaQSxPQUFPLE9BQVAsR0FBaUIsUUFBUSwwQkFBUixDQUFqQjs7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdVQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ3BCQSxRQUFRLG1CQUFSOztBQUVBLElBQU0sVUFBVSxFQUFFLEdBQUYsQ0FBTSxNQUFOLENBQWEsRUFBYixDQUFoQjs7QUFFQTs7OztBQUlBLEVBQUUsT0FBRixDQUFVLFFBQVYsR0FBcUIsRUFBRSxPQUFGLENBQVUsTUFBVixDQUFpQjs7QUFFcEMsV0FBUztBQUNQLGNBQVUsYUFESDs7QUFHUCxlQUFrQixJQUhYO0FBSVAsb0JBQWtCLEVBQUUsU0FKYjtBQUtQLHNCQUFrQjtBQUNoQixpQkFBVyxJQURLO0FBRWhCLGNBQVc7QUFGSyxLQUxYOztBQVVQLGdCQUFrQjtBQUNoQiwwQkFBb0IsS0FESjtBQUVoQixtQkFBb0IsS0FGSjtBQUdoQixlQUFvQixLQUhKO0FBSWhCLHFCQUFvQjtBQUpKLEtBVlg7O0FBaUJQLG9CQUFrQixLQWpCWDtBQWtCUCxnQkFBa0IsQ0FsQlg7O0FBb0JQLHNCQUFrQixJQXBCWDtBQXFCUCxrQkFBa0I7QUFBQSxhQUNoQixpQkFBaUIsRUFBRSxTQUFuQixJQUNBLGlCQUFpQixFQUFFLFlBRG5CLElBRUEsaUJBQWlCLEVBQUUsVUFISDtBQUFBLEtBckJYOztBQTJCUCxrQkFBYyxPQTNCUDs7QUE2QlAsZUFBb0IsOEJBN0JiO0FBOEJQLGtCQUFvQix1QkE5QmI7QUErQlAsd0JBQW9CLDZCQS9CYjs7QUFpQ1AsaUJBQWE7QUFqQ04sR0FGMkI7O0FBc0NwQzs7OztBQUlBLFlBMUNvQyxzQkEwQ3hCLE1BMUN3QixFQTBDaEIsT0ExQ2dCLEVBMENQOztBQUUzQjs7O0FBR0EsU0FBSyxZQUFMLEdBQW9CLElBQXBCOztBQUVBOzs7QUFHQSxTQUFLLFVBQUwsR0FBb0IsSUFBcEI7O0FBR0E7OztBQUdBLFNBQUssV0FBTCxHQUFvQixLQUFwQjs7QUFHQTs7O0FBR0EsU0FBSyxPQUFMLEdBQW9CLEVBQUUsSUFBRixDQUFPLE9BQVAsQ0FBZSxNQUFmLElBQXlCLE1BQXpCLEdBQWtDLENBQUMsTUFBRCxDQUF0RDs7QUFFQSxTQUFLLGdCQUFMLEdBQXdCLEVBQUUsSUFBRixDQUFPLFFBQVAsQ0FDdEIsS0FBSyxPQURpQixFQUNSLEtBQUssT0FBTCxDQUFhLFdBREwsRUFDa0IsSUFEbEIsQ0FBeEI7O0FBR0EsTUFBRSxPQUFGLENBQVUsU0FBVixDQUFvQixVQUFwQixDQUErQixJQUEvQixDQUFvQyxJQUFwQyxFQUEwQyxPQUExQztBQUNELEdBdEVtQztBQXlFcEMsT0F6RW9DLGlCQXlFN0IsR0F6RTZCLEVBeUV4QjtBQUNWLFNBQUssVUFBTCxHQUFrQixFQUFFLE9BQUYsQ0FBVSxNQUFWLENBQWlCLEtBQWpCLEVBQXdCLEtBQUssT0FBTCxDQUFhLFNBQXJDLENBQWxCO0FBQ0EsTUFBRSxRQUFGLENBQ0csd0JBREgsQ0FDNEIsS0FBSyxVQURqQyxFQUVHLHVCQUZILENBRTJCLEtBQUssVUFGaEM7O0FBSUEsU0FBSyxhQUFMLEdBQXFCLEVBQUUsT0FBRixDQUFVLE1BQVYsQ0FBaUIsS0FBakIsRUFDbkIsS0FBSyxPQUFMLENBQWEsWUFETSxFQUNRLEtBQUssVUFEYixDQUFyQjs7QUFHQSxRQUNHLEVBREgsQ0FDTSwyQkFETixFQUNtQyxLQUFLLGdCQUR4QyxFQUMwRCxJQUQxRCxFQUVHLEVBRkgsQ0FFTSxVQUZOLEVBRW1CLEtBQUssYUFGeEIsRUFFeUMsSUFGekMsRUFHRyxFQUhILENBR00sTUFITixFQUdjLEtBQUssVUFIbkIsRUFHK0IsSUFIL0I7O0FBS0EsU0FBSyxVQUFMOztBQUVBLFdBQU8sS0FBSyxVQUFaO0FBQ0QsR0ExRm1DO0FBNkZwQyxVQTdGb0Msb0JBNkYxQixHQTdGMEIsRUE2RnJCO0FBQ2IsU0FBSyxZQUFMLENBQWtCLFdBQWxCLENBQThCLEtBQUssVUFBbkM7QUFDQSxTQUFLLFlBQUwsQ0FBa0IsTUFBbEI7QUFDQSxTQUFLLFlBQUwsR0FBb0IsS0FBSyxVQUFMLEdBQWtCLElBQXRDOztBQUVBLFFBQ0csR0FESCxDQUNPLDJCQURQLEVBQ29DLEtBQUssZ0JBRHpDLEVBQzJELElBRDNELEVBRUcsR0FGSCxDQUVPLFVBRlAsRUFFb0IsS0FBSyxhQUZ6QixFQUV3QyxJQUZ4QyxFQUdHLEdBSEgsQ0FHTyxNQUhQLEVBR2UsS0FBSyxVQUhwQixFQUdnQyxJQUhoQztBQUlELEdBdEdtQzs7O0FBeUdwQyxNQUFJLFNBQUosR0FBaUI7QUFDZixXQUFPLEtBQUssS0FBWjtBQUNELEdBM0dtQzs7QUE4R3BDLE1BQUksUUFBSixHQUFnQjtBQUNkLFdBQU8sS0FBSyxZQUFaO0FBQ0QsR0FoSG1DOztBQW1IcEMsWUFuSG9DLHdCQW1IdEI7QUFBQTs7QUFDWixNQUFFLElBQUYsQ0FBTyxnQkFBUCxDQUF3QixZQUFNO0FBQzVCLFVBQU0sY0FBYyxNQUFLLE9BQUwsQ0FBYSxZQUFqQztBQUNBLFVBQU0sT0FBUSxPQUFPLE1BQUssT0FBTCxDQUFhLGNBQXBCLEtBQXVDLFFBQXhDLEdBQ1gsTUFBSyxPQUFMLENBQWEsY0FERixHQUVYLE1BQUssSUFBTCxDQUFVLE9BQVYsS0FBc0IsTUFBSyxPQUFMLENBQWEsVUFGckM7O0FBSUEsWUFBSyxZQUFMLEdBQW9CLElBQUksV0FBSixDQUNsQixNQUFLLGFBRGEsRUFFbEIsTUFBSyxPQUFMLENBQWEsVUFGSyxFQUdqQixPQUhpQixDQUdULE1BQUssSUFBTCxDQUFVLFNBQVYsRUFIUyxFQUdjLElBSGQsQ0FBcEI7O0FBS0EsWUFBSyxZQUFMLENBQ0csRUFESCxDQUNNLFdBRE4sRUFDbUIsTUFBSyxlQUR4QixTQUVHLEVBRkgsQ0FFTSxNQUZOLEVBRW1CLE1BQUssVUFGeEIsU0FHRyxFQUhILENBR00sU0FITixFQUdtQixNQUFLLGFBSHhCLFNBSUcsRUFKSCxDQUlNLFNBSk4sRUFJbUIsTUFBSyxVQUp4Qjs7QUFNQSxXQUFLLElBQUksSUFBSSxDQUFSLEVBQVcsTUFBTSxNQUFLLE9BQUwsQ0FBYSxNQUFuQyxFQUEyQyxJQUFJLEdBQS9DLEVBQW9ELEdBQXBELEVBQXlEO0FBQ3ZELGNBQUssWUFBTCxDQUFrQixRQUFsQixDQUEyQixNQUFLLE9BQUwsQ0FBYSxDQUFiLENBQTNCO0FBQ0Q7QUFDRCxZQUFLLFdBQUw7QUFDRCxLQXJCRDtBQXNCRCxHQTFJbUM7QUE2SXBDLGFBN0lvQyx5QkE2SXJCO0FBQ2IsUUFBSSxLQUFLLE9BQUwsQ0FBYSxTQUFqQixFQUE0QjtBQUMxQixVQUFNLFlBQVksS0FBSyxPQUFMLENBQWEsY0FBL0I7QUFDQSxXQUFLLEtBQUwsR0FBYSxJQUFJLFNBQUosQ0FBYyxLQUFLLElBQUwsQ0FBVSxTQUFWLEVBQWQsRUFDWCxFQUFFLElBQUYsQ0FBTyxNQUFQLENBQWMsRUFBRSxXQUFXLEtBQUssT0FBTCxDQUFhLGtCQUExQixFQUFkLEVBQ0UsS0FBSyxPQUFMLENBQWEsZ0JBRGYsQ0FEVyxDQUFiO0FBR0EsV0FBSyxLQUFMLENBQVcsRUFBWCxDQUFjLFNBQWQsRUFBeUIsS0FBSyxjQUE5QixFQUE4QyxJQUE5QztBQUNBLFdBQUssWUFBTCxDQUFrQixRQUFsQixDQUEyQixLQUFLLEtBQWhDO0FBQ0Q7QUFDRixHQXRKbUM7QUF5SnBDLGVBekpvQyx5QkF5SnJCLEdBekpxQixFQXlKaEI7QUFDbEIsWUFBUSxHQUFSLENBQVksR0FBWjtBQUNELEdBM0ptQzs7O0FBOEpwQzs7O0FBR0EsWUFqS29DLHNCQWlLeEIsR0FqS3dCLEVBaUtuQjtBQUNmLFFBQUksQ0FBQyxLQUFLLFdBQVYsRUFBdUI7QUFDckIsY0FBUSxHQUFSLENBQVksTUFBWjtBQUNBLFdBQUssV0FBTCxHQUFtQixJQUFuQjtBQUNBLFdBQUssSUFBTCxDQUFVLE9BQVYsQ0FBa0IsS0FBSyxZQUFMLENBQWtCLFNBQWxCLEVBQWxCO0FBQ0Q7QUFDRixHQXZLbUM7OztBQTBLcEM7OztBQUdBLFNBN0tvQyxtQkE2SzNCLEdBN0syQixFQTZLdEI7QUFDWixRQUFJLEtBQUssV0FBVCxFQUFzQjtBQUNwQixXQUFLLFdBQUwsR0FBbUIsS0FBbkI7QUFDQTtBQUNEO0FBQ0QsWUFBUSxHQUFSLENBQVkscUJBQVo7QUFDQSxRQUFNLE9BQU8sS0FBSyxPQUFMLENBQWEsY0FBYixHQUNYLEtBQUssWUFBTCxDQUFrQixPQUFsQixFQURXLEdBRVgsS0FBSyxJQUFMLENBQVUsT0FBVixLQUFzQixLQUFLLE9BQUwsQ0FBYSxVQUZyQztBQUdBLFNBQUssWUFBTCxDQUFrQixPQUFsQixDQUEwQixLQUFLLElBQUwsQ0FBVSxTQUFWLEVBQTFCLEVBQWlELElBQWpEO0FBQ0EsU0FBSyxLQUFMLENBQVcsVUFBWCxDQUFzQixLQUFLLEtBQUwsQ0FBVyxnQkFBWCxDQUE0QixLQUFLLElBQUwsQ0FBVSxTQUFWLEVBQTVCLENBQXRCO0FBQ0QsR0F4TG1DO0FBMkxwQyxnQkEzTG9DLDRCQTJMbEI7QUFDaEIsU0FBSyxXQUFMLEdBQW1CLElBQW5CO0FBQ0EsU0FBSyxZQUFMLENBQWtCLE9BQWxCLENBQTBCLEtBQUssS0FBTCxDQUFXLFNBQVgsR0FBdUIsU0FBdkIsRUFBMUI7QUFDQSxTQUFLLElBQUwsQ0FBVSxPQUFWLENBQWtCLEtBQUssS0FBTCxDQUFXLFNBQVgsR0FBdUIsU0FBdkIsRUFBbEI7QUFDRCxHQS9MbUM7QUFrTXBDLGlCQWxNb0MsNkJBa01qQixDQUVsQixDQXBNbUM7QUF1TXBDLGVBdk1vQywyQkF1TW5CLENBRWhCLENBek1tQztBQTRNcEMsWUE1TW9DLHdCQTRNdEI7QUFDWjtBQUNELEdBOU1tQztBQWlOcEMsWUFqTm9DLHdCQWlOdEI7QUFDWixRQUFJLEtBQUssS0FBVCxFQUFnQjtBQUNkO0FBQ0E7QUFDRDtBQUNGO0FBdE5tQyxDQUFqQixDQUFyQjs7QUEwTkEsRUFBRSxPQUFGLENBQVUsUUFBVixDQUFtQixHQUFuQixHQUF5QixPQUF6Qjs7QUFFQTtBQUNBLEVBQUUsT0FBRixDQUFVLFFBQVYsR0FBcUIsVUFBQyxPQUFEO0FBQUEsU0FBYSxJQUFJLEVBQUUsT0FBRixDQUFVLFFBQWQsQ0FBdUIsT0FBdkIsQ0FBYjtBQUFBLENBQXJCOztBQUVBLEVBQUUsR0FBRixDQUFNLFlBQU4sQ0FBbUI7QUFDakIsbUJBQWlCO0FBREEsQ0FBbkI7O0FBSUEsRUFBRSxHQUFGLENBQU0sV0FBTixDQUFrQixZQUFZO0FBQzdCLE1BQUksS0FBSyxPQUFMLENBQWEsZUFBakIsRUFBa0M7QUFDakMsU0FBSyxlQUFMLEdBQXVCLElBQUksRUFBRSxPQUFGLENBQVUsUUFBZCxFQUF2QjtBQUNBLFNBQUssVUFBTCxDQUFnQixLQUFLLGVBQXJCO0FBQ0E7QUFDRCxDQUxEOztBQU9BLE9BQU8sT0FBUCxHQUFpQixFQUFFLE9BQUYsQ0FBVSxRQUEzQiIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJpbXBvcnQgT3ZlcnZpZXcgZnJvbSAnLi4vJztcblxuY29uc3QgQ0VOVEVSICA9IFsyMi4yNjcwLCAxMTQuMTg4XTtcbmNvbnN0IFpPT00gICAgPSAxMztcbmNvbnN0IE9TTV9VUkwgPSAnaHR0cDovL3tzfS50aWxlLm9zbS5vcmcve3p9L3t4fS97eX0ucG5nJztcblxuY29uc3QgbWFwID0gZ2xvYmFsLm1hcCA9IEwubWFwKCdtYXAnKS5zZXRWaWV3KENFTlRFUiwgWk9PTSk7XG5cbmNvbnN0IHRpbGVzID0gTC50aWxlTGF5ZXIoT1NNX1VSTCwge1xuICBhdHRyaWJ1dGlvbjogJyZjb3B5OyA8YSBocmVmPVwiaHR0cDovL29zbS5vcmcvY29weXJpZ2h0XCI+T3BlblN0cmVldE1hcDwvYT4gY29udHJpYnV0b3JzJ1xufSkuYWRkVG8obWFwKTtcblxubWFwLmFkZENvbnRyb2wobmV3IE92ZXJ2aWV3KEwudGlsZUxheWVyKE9TTV9VUkwsIHRpbGVzLm9wdGlvbnMpLCB7fSkpO1xuIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL3NyYy9MLkNvbnRyb2wuT3ZlcnZpZXcnKTtcbiIsInJlcXVpcmUoJy4vc3JjL1NWRycpO1xucmVxdWlyZSgnLi9zcmMvU1ZHLlZNTCcpO1xucmVxdWlyZSgnLi9zcmMvQ2FudmFzJyk7XG5yZXF1aXJlKCcuL3NyYy9QYXRoLlRyYW5zZm9ybScpO1xucmVxdWlyZSgnLi9zcmMvUGF0aC5EcmFnJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gTC5QYXRoLkRyYWc7XG4iLCJMLlV0aWwudHJ1ZUZuID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiB0cnVlO1xufTtcblxuTC5DYW52YXMuaW5jbHVkZSh7XG5cbiAgLyoqXG4gICAqIERvIG5vdGhpbmdcbiAgICogQHBhcmFtICB7TC5QYXRofSBsYXllclxuICAgKi9cbiAgX3Jlc2V0VHJhbnNmb3JtUGF0aDogZnVuY3Rpb24obGF5ZXIpIHtcbiAgICBpZiAoIXRoaXMuX2NvbnRhaW5lckNvcHkpIHJldHVybjtcblxuICAgIGRlbGV0ZSB0aGlzLl9jb250YWluZXJDb3B5O1xuXG4gICAgaWYgKGxheWVyLl9jb250YWluc1BvaW50Xykge1xuICAgICAgbGF5ZXIuX2NvbnRhaW5zUG9pbnQgPSBsYXllci5fY29udGFpbnNQb2ludF87XG4gICAgICBkZWxldGUgbGF5ZXIuX2NvbnRhaW5zUG9pbnRfO1xuXG4gICAgICB0aGlzLl9yZXF1ZXN0UmVkcmF3KGxheWVyKTtcbiAgICB9XG4gIH0sXG5cblxuICAvKipcbiAgICogQWxnb3JpdGhtIG91dGxpbmU6XG4gICAqXG4gICAqIDEuIHByZS10cmFuc2Zvcm0gLSBjbGVhciB0aGUgcGF0aCBvdXQgb2YgdGhlIGNhbnZhcywgY29weSBjYW52YXMgc3RhdGVcbiAgICogMi4gYXQgZXZlcnkgZnJhbWU6XG4gICAqICAgIDIuMS4gc2F2ZVxuICAgKiAgICAyLjIuIHJlZHJhdyB0aGUgY2FudmFzIGZyb20gc2F2ZWQgb25lXG4gICAqICAgIDIuMy4gdHJhbnNmb3JtXG4gICAqICAgIDIuNC4gZHJhdyBwYXRoXG4gICAqICAgIDIuNS4gcmVzdG9yZVxuICAgKlxuICAgKiBAcGFyYW0gIHtMLlBhdGh9ICAgICAgICAgbGF5ZXJcbiAgICogQHBhcmFtICB7QXJyYXkuPE51bWJlcj59IG1hdHJpeFxuICAgKi9cbiAgdHJhbnNmb3JtUGF0aDogZnVuY3Rpb24obGF5ZXIsIG1hdHJpeCkge1xuICAgIHZhciBjb3B5ID0gdGhpcy5fY29udGFpbmVyQ29weTtcbiAgICB2YXIgY3R4ID0gdGhpcy5fY3R4O1xuICAgIHZhciBtID0gTC5Ccm93c2VyLnJldGluYSA/IDIgOiAxO1xuICAgIHZhciBib3VuZHMgPSB0aGlzLl9ib3VuZHM7XG4gICAgdmFyIHNpemUgPSBib3VuZHMuZ2V0U2l6ZSgpO1xuICAgIHZhciBwb3MgPSBib3VuZHMubWluO1xuXG4gICAgaWYgKCFjb3B5KSB7XG4gICAgICBjb3B5ID0gdGhpcy5fY29udGFpbmVyQ29weSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpO1xuICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChjb3B5KTtcblxuICAgICAgY29weS53aWR0aCA9IG0gKiBzaXplLng7XG4gICAgICBjb3B5LmhlaWdodCA9IG0gKiBzaXplLnk7XG5cbiAgICAgIGxheWVyLl9yZW1vdmVkID0gdHJ1ZTtcbiAgICAgIHRoaXMuX3JlZHJhdygpO1xuXG4gICAgICBjb3B5LmdldENvbnRleHQoJzJkJykudHJhbnNsYXRlKG0gKiBib3VuZHMubWluLngsIG0gKiBib3VuZHMubWluLnkpO1xuICAgICAgY29weS5nZXRDb250ZXh0KCcyZCcpLmRyYXdJbWFnZSh0aGlzLl9jb250YWluZXIsIDAsIDApO1xuICAgICAgdGhpcy5faW5pdFBhdGgobGF5ZXIpO1xuICAgICAgbGF5ZXIuX2NvbnRhaW5zUG9pbnRfID0gbGF5ZXIuX2NvbnRhaW5zUG9pbnQ7XG4gICAgICBsYXllci5fY29udGFpbnNQb2ludCA9IEwuVXRpbC50cnVlRm47XG4gICAgfVxuXG4gICAgY3R4LnNhdmUoKTtcbiAgICBjdHguY2xlYXJSZWN0KHBvcy54LCBwb3MueSwgc2l6ZS54ICogbSwgc2l6ZS55ICogbSk7XG4gICAgY3R4LnNldFRyYW5zZm9ybSgxLCAwLCAwLCAxLCAwLCAwKTtcbiAgICBjdHgucmVzdG9yZSgpO1xuICAgIGN0eC5zYXZlKCk7XG5cbiAgICBjdHguZHJhd0ltYWdlKHRoaXMuX2NvbnRhaW5lckNvcHksIDAsIDAsIHNpemUueCwgc2l6ZS55KTtcbiAgICBjdHgudHJhbnNmb3JtLmFwcGx5KGN0eCwgbWF0cml4KTtcblxuICAgIHZhciBsYXllcnMgPSB0aGlzLl9sYXllcnM7XG4gICAgdGhpcy5fbGF5ZXJzID0ge307XG5cbiAgICB0aGlzLl9pbml0UGF0aChsYXllcik7XG4gICAgbGF5ZXIuX3VwZGF0ZVBhdGgoKTtcblxuICAgIHRoaXMuX2xheWVycyA9IGxheWVycztcbiAgICBjdHgucmVzdG9yZSgpO1xuICB9XG5cbn0pO1xuIiwiLyoqXG4gKiBEcmFnIGhhbmRsZXJcbiAqIEBjbGFzcyBMLlBhdGguRHJhZ1xuICogQGV4dGVuZHMge0wuSGFuZGxlcn1cbiAqL1xuTC5IYW5kbGVyLlBhdGhEcmFnID0gTC5IYW5kbGVyLmV4dGVuZCggLyoqIEBsZW5kcyAgTC5QYXRoLkRyYWcucHJvdG90eXBlICovIHtcblxuICBzdGF0aWNzOiB7XG4gICAgRFJBR0dJTkdfQ0xTOiAnbGVhZmxldC1wYXRoLWRyYWdnYWJsZScsXG4gIH0sXG5cblxuICAvKipcbiAgICogQHBhcmFtICB7TC5QYXRofSBwYXRoXG4gICAqIEBjb25zdHJ1Y3RvclxuICAgKi9cbiAgaW5pdGlhbGl6ZTogZnVuY3Rpb24ocGF0aCkge1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0wuUGF0aH1cbiAgICAgKi9cbiAgICB0aGlzLl9wYXRoID0gcGF0aDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtBcnJheS48TnVtYmVyPn1cbiAgICAgKi9cbiAgICB0aGlzLl9tYXRyaXggPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0wuUG9pbnR9XG4gICAgICovXG4gICAgdGhpcy5fc3RhcnRQb2ludCA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TC5Qb2ludH1cbiAgICAgKi9cbiAgICB0aGlzLl9kcmFnU3RhcnRQb2ludCA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7Qm9vbGVhbn1cbiAgICAgKi9cbiAgICB0aGlzLl9tYXBEcmFnZ2luZ1dhc0VuYWJsZWQgPSBmYWxzZTtcblxuICB9LFxuXG4gIC8qKlxuICAgKiBFbmFibGUgZHJhZ2dpbmdcbiAgICovXG4gIGFkZEhvb2tzOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLl9wYXRoLm9uKCdtb3VzZWRvd24nLCB0aGlzLl9vbkRyYWdTdGFydCwgdGhpcyk7XG5cbiAgICB0aGlzLl9wYXRoLm9wdGlvbnMuY2xhc3NOYW1lID0gdGhpcy5fcGF0aC5vcHRpb25zLmNsYXNzTmFtZSA/XG4gICAgICAgICh0aGlzLl9wYXRoLm9wdGlvbnMuY2xhc3NOYW1lICsgJyAnICsgTC5IYW5kbGVyLlBhdGhEcmFnLkRSQUdHSU5HX0NMUykgOlxuICAgICAgICAgTC5IYW5kbGVyLlBhdGhEcmFnLkRSQUdHSU5HX0NMUztcblxuICAgIGlmICh0aGlzLl9wYXRoLl9wYXRoKSB7XG4gICAgICBMLkRvbVV0aWwuYWRkQ2xhc3ModGhpcy5fcGF0aC5fcGF0aCwgTC5IYW5kbGVyLlBhdGhEcmFnLkRSQUdHSU5HX0NMUyk7XG4gICAgfVxuICB9LFxuXG4gIC8qKlxuICAgKiBEaXNhYmxlIGRyYWdnaW5nXG4gICAqL1xuICByZW1vdmVIb29rczogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5fcGF0aC5vZmYoJ21vdXNlZG93bicsIHRoaXMuX29uRHJhZ1N0YXJ0LCB0aGlzKTtcblxuICAgIHRoaXMuX3BhdGgub3B0aW9ucy5jbGFzc05hbWUgPSB0aGlzLl9wYXRoLm9wdGlvbnMuY2xhc3NOYW1lXG4gICAgICAucmVwbGFjZShuZXcgUmVnRXhwKCdcXFxccysnICsgTC5IYW5kbGVyLlBhdGhEcmFnLkRSQUdHSU5HX0NMUyksICcnKTtcbiAgICBpZiAodGhpcy5fcGF0aC5fcGF0aCkge1xuICAgICAgTC5Eb21VdGlsLnJlbW92ZUNsYXNzKHRoaXMuX3BhdGguX3BhdGgsIEwuSGFuZGxlci5QYXRoRHJhZy5EUkFHR0lOR19DTFMpO1xuICAgIH1cbiAgfSxcblxuICAvKipcbiAgICogQHJldHVybiB7Qm9vbGVhbn1cbiAgICovXG4gIG1vdmVkOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5fcGF0aC5fZHJhZ01vdmVkO1xuICB9LFxuXG4gIC8qKlxuICAgKiBTdGFydCBkcmFnXG4gICAqIEBwYXJhbSAge0wuTW91c2VFdmVudH0gZXZ0XG4gICAqL1xuICBfb25EcmFnU3RhcnQ6IGZ1bmN0aW9uKGV2dCkge1xuICAgIHZhciBldmVudFR5cGUgPSBldnQub3JpZ2luYWxFdmVudC5fc2ltdWxhdGVkID8gJ3RvdWNoc3RhcnQnIDogZXZ0Lm9yaWdpbmFsRXZlbnQudHlwZTtcblxuICAgIHRoaXMuX21hcERyYWdnaW5nV2FzRW5hYmxlZCA9IGZhbHNlO1xuICAgIHRoaXMuX3N0YXJ0UG9pbnQgPSBldnQuY29udGFpbmVyUG9pbnQuY2xvbmUoKTtcbiAgICB0aGlzLl9kcmFnU3RhcnRQb2ludCA9IGV2dC5jb250YWluZXJQb2ludC5jbG9uZSgpO1xuICAgIHRoaXMuX21hdHJpeCA9IFsxLCAwLCAwLCAxLCAwLCAwXTtcbiAgICBMLkRvbUV2ZW50LnN0b3AoZXZ0Lm9yaWdpbmFsRXZlbnQpO1xuXG4gICAgTC5Eb21VdGlsLmFkZENsYXNzKHRoaXMuX3BhdGguX3JlbmRlcmVyLl9jb250YWluZXIsICdsZWFmbGV0LWludGVyYWN0aXZlJyk7XG4gICAgTC5Eb21FdmVudFxuICAgICAgLm9uKGRvY3VtZW50LCBMLkRyYWdnYWJsZS5NT1ZFW2V2ZW50VHlwZV0sIHRoaXMuX29uRHJhZywgICAgdGhpcylcbiAgICAgIC5vbihkb2N1bWVudCwgTC5EcmFnZ2FibGUuRU5EW2V2ZW50VHlwZV0sICB0aGlzLl9vbkRyYWdFbmQsIHRoaXMpO1xuXG4gICAgaWYgKHRoaXMuX3BhdGguX21hcC5kcmFnZ2luZy5lbmFibGVkKCkpIHtcbiAgICAgIC8vIEkgZ3Vlc3MgaXQncyByZXF1aXJlZCBiZWNhdXNlIG1vdXNkb3duIGdldHMgc2ltdWxhdGVkIHdpdGggYSBkZWxheVxuICAgICAgLy90aGlzLl9wYXRoLl9tYXAuZHJhZ2dpbmcuX2RyYWdnYWJsZS5fb25VcChldnQpO1xuXG4gICAgICB0aGlzLl9wYXRoLl9tYXAuZHJhZ2dpbmcuZGlzYWJsZSgpO1xuICAgICAgdGhpcy5fbWFwRHJhZ2dpbmdXYXNFbmFibGVkID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy5fcGF0aC5fZHJhZ01vdmVkID0gZmFsc2U7XG5cbiAgICBpZiAodGhpcy5fcGF0aC5fcG9wdXApIHsgLy8gdGhhdCBtaWdodCBiZSBhIGNhc2Ugb24gdG91Y2ggZGV2aWNlcyBhcyB3ZWxsXG4gICAgICB0aGlzLl9wYXRoLl9wb3B1cC5fY2xvc2UoKTtcbiAgICB9XG5cbiAgICB0aGlzLl9yZXBsYWNlQ29vcmRHZXR0ZXJzKGV2dCk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIERyYWdnaW5nXG4gICAqIEBwYXJhbSAge0wuTW91c2VFdmVudH0gZXZ0XG4gICAqL1xuICBfb25EcmFnOiBmdW5jdGlvbihldnQpIHtcbiAgICBMLkRvbUV2ZW50LnN0b3AoZXZ0KTtcblxuICAgIHZhciBmaXJzdCA9IChldnQudG91Y2hlcyAmJiBldnQudG91Y2hlcy5sZW5ndGggPj0gMSA/IGV2dC50b3VjaGVzWzBdIDogZXZ0KTtcbiAgICB2YXIgY29udGFpbmVyUG9pbnQgPSB0aGlzLl9wYXRoLl9tYXAubW91c2VFdmVudFRvQ29udGFpbmVyUG9pbnQoZmlyc3QpO1xuXG4gICAgdmFyIHggPSBjb250YWluZXJQb2ludC54O1xuICAgIHZhciB5ID0gY29udGFpbmVyUG9pbnQueTtcblxuICAgIHZhciBkeCA9IHggLSB0aGlzLl9zdGFydFBvaW50Lng7XG4gICAgdmFyIGR5ID0geSAtIHRoaXMuX3N0YXJ0UG9pbnQueTtcblxuICAgIGlmICghdGhpcy5fcGF0aC5fZHJhZ01vdmVkICYmIChkeCB8fCBkeSkpIHtcbiAgICAgIHRoaXMuX3BhdGguX2RyYWdNb3ZlZCA9IHRydWU7XG4gICAgICB0aGlzLl9wYXRoLmZpcmUoJ2RyYWdzdGFydCcsIGV2dCk7XG4gICAgICAvLyB3ZSBkb24ndCB3YW50IHRoYXQgdG8gaGFwcGVuIG9uIGNsaWNrXG4gICAgICB0aGlzLl9wYXRoLmJyaW5nVG9Gcm9udCgpO1xuICAgIH1cblxuICAgIHRoaXMuX21hdHJpeFs0XSArPSBkeDtcbiAgICB0aGlzLl9tYXRyaXhbNV0gKz0gZHk7XG5cbiAgICB0aGlzLl9zdGFydFBvaW50LnggPSB4O1xuICAgIHRoaXMuX3N0YXJ0UG9pbnQueSA9IHk7XG5cbiAgICB0aGlzLl9wYXRoLmZpcmUoJ3ByZWRyYWcnLCBldnQpO1xuICAgIHRoaXMuX3BhdGguX3RyYW5zZm9ybSh0aGlzLl9tYXRyaXgpO1xuICAgIHRoaXMuX3BhdGguZmlyZSgnZHJhZycsIGV2dCk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIERyYWdnaW5nIHN0b3BwZWQsIGFwcGx5XG4gICAqIEBwYXJhbSAge0wuTW91c2VFdmVudH0gZXZ0XG4gICAqL1xuICBfb25EcmFnRW5kOiBmdW5jdGlvbihldnQpIHtcbiAgICB2YXIgY29udGFpbmVyUG9pbnQgPSB0aGlzLl9wYXRoLl9tYXAubW91c2VFdmVudFRvQ29udGFpbmVyUG9pbnQoZXZ0KTtcbiAgICB2YXIgbW92ZWQgPSB0aGlzLm1vdmVkKCk7XG5cbiAgICAvLyBhcHBseSBtYXRyaXhcbiAgICBpZiAobW92ZWQpIHtcbiAgICAgIHRoaXMuX3RyYW5zZm9ybVBvaW50cyh0aGlzLl9tYXRyaXgpO1xuICAgICAgdGhpcy5fcGF0aC5fdXBkYXRlUGF0aCgpO1xuICAgICAgdGhpcy5fcGF0aC5fcHJvamVjdCgpO1xuICAgICAgdGhpcy5fcGF0aC5fdHJhbnNmb3JtKG51bGwpO1xuXG4gICAgICBMLkRvbUV2ZW50LnN0b3AoZXZ0KTtcbiAgICB9XG5cblxuICAgIEwuRG9tRXZlbnRcbiAgICAgIC5vZmYoZG9jdW1lbnQsICdtb3VzZW1vdmUgdG91Y2htb3ZlJywgdGhpcy5fb25EcmFnLCB0aGlzKVxuICAgICAgLm9mZihkb2N1bWVudCwgJ21vdXNldXAgdG91Y2hlbmQnLCAgICB0aGlzLl9vbkRyYWdFbmQsIHRoaXMpO1xuXG4gICAgdGhpcy5fcmVzdG9yZUNvb3JkR2V0dGVycygpO1xuXG4gICAgLy8gY29uc2lzdGVuY3lcbiAgICBpZiAobW92ZWQpIHtcbiAgICAgIHRoaXMuX3BhdGguZmlyZSgnZHJhZ2VuZCcsIHtcbiAgICAgICAgZGlzdGFuY2U6IE1hdGguc3FydChcbiAgICAgICAgICBMLkxpbmVVdGlsLl9zcURpc3QodGhpcy5fZHJhZ1N0YXJ0UG9pbnQsIGNvbnRhaW5lclBvaW50KVxuICAgICAgICApXG4gICAgICB9KTtcblxuICAgICAgLy8gaGFjayBmb3Igc2tpcHBpbmcgdGhlIGNsaWNrIGluIGNhbnZhcy1yZW5kZXJlZCBsYXllcnNcbiAgICAgIHZhciBjb250YWlucyA9IHRoaXMuX3BhdGguX2NvbnRhaW5zUG9pbnQ7XG4gICAgICB0aGlzLl9wYXRoLl9jb250YWluc1BvaW50ID0gTC5VdGlsLmZhbHNlRm47XG4gICAgICBMLlV0aWwucmVxdWVzdEFuaW1GcmFtZShmdW5jdGlvbigpIHtcbiAgICAgICAgTC5Eb21FdmVudC5fc2tpcHBlZCh7IHR5cGU6ICdjbGljaycgfSk7XG4gICAgICAgIHRoaXMuX3BhdGguX2NvbnRhaW5zUG9pbnQgPSBjb250YWlucztcbiAgICAgIH0sIHRoaXMpO1xuICAgIH1cblxuICAgIHRoaXMuX21hdHJpeCAgICAgICAgICA9IG51bGw7XG4gICAgdGhpcy5fc3RhcnRQb2ludCAgICAgID0gbnVsbDtcbiAgICB0aGlzLl9kcmFnU3RhcnRQb2ludCAgPSBudWxsO1xuICAgIHRoaXMuX3BhdGguX2RyYWdNb3ZlZCA9IGZhbHNlO1xuXG4gICAgaWYgKHRoaXMuX21hcERyYWdnaW5nV2FzRW5hYmxlZCkge1xuICAgICAgaWYgKG1vdmVkKSBMLkRvbUV2ZW50Ll9mYWtlU3RvcCh7IHR5cGU6ICdjbGljaycgfSk7XG4gICAgICB0aGlzLl9wYXRoLl9tYXAuZHJhZ2dpbmcuZW5hYmxlKCk7XG4gICAgfVxuICB9LFxuXG5cbiAgLyoqXG4gICAqIEFwcGxpZXMgdHJhbnNmb3JtYXRpb24sIGRvZXMgaXQgaW4gb25lIHN3ZWVwIGZvciBwZXJmb3JtYW5jZSxcbiAgICogc28gZG9uJ3QgYmUgc3VycHJpc2VkIGFib3V0IHRoZSBjb2RlIHJlcGV0aXRpb24uXG4gICAqXG4gICAqIFsgeCBdICAgWyBhICBiICB0eCBdIFsgeCBdICAgWyBhICogeCArIGIgKiB5ICsgdHggXVxuICAgKiBbIHkgXSA9IFsgYyAgZCAgdHkgXSBbIHkgXSA9IFsgYyAqIHggKyBkICogeSArIHR5IF1cbiAgICpcbiAgICogQHBhcmFtIHtBcnJheS48TnVtYmVyPn0gbWF0cml4XG4gICAqL1xuICBfdHJhbnNmb3JtUG9pbnRzOiBmdW5jdGlvbihtYXRyaXgsIGRlc3QpIHtcbiAgICB2YXIgcGF0aCA9IHRoaXMuX3BhdGg7XG4gICAgdmFyIGksIGxlbiwgbGF0bG5nO1xuXG4gICAgdmFyIHB4ID0gTC5wb2ludChtYXRyaXhbNF0sIG1hdHJpeFs1XSk7XG5cbiAgICB2YXIgY3JzID0gcGF0aC5fbWFwLm9wdGlvbnMuY3JzO1xuICAgIHZhciB0cmFuc2Zvcm1hdGlvbiA9IGNycy50cmFuc2Zvcm1hdGlvbjtcbiAgICB2YXIgc2NhbGUgPSBjcnMuc2NhbGUocGF0aC5fbWFwLmdldFpvb20oKSk7XG4gICAgdmFyIHByb2plY3Rpb24gPSBjcnMucHJvamVjdGlvbjtcblxuICAgIHZhciBkaWZmID0gdHJhbnNmb3JtYXRpb24udW50cmFuc2Zvcm0ocHgsIHNjYWxlKVxuICAgICAgLnN1YnRyYWN0KHRyYW5zZm9ybWF0aW9uLnVudHJhbnNmb3JtKEwucG9pbnQoMCwgMCksIHNjYWxlKSk7XG4gICAgdmFyIGFwcGx5VHJhbnNmb3JtID0gIWRlc3Q7XG5cbiAgICBwYXRoLl9ib3VuZHMgPSBuZXcgTC5MYXRMbmdCb3VuZHMoKTtcblxuICAgIC8vIGNvbnNvbGUudGltZSgndHJhbnNmb3JtJyk7XG4gICAgLy8gYWxsIHNoaWZ0cyBhcmUgaW4tcGxhY2VcbiAgICBpZiAocGF0aC5fcG9pbnQpIHsgLy8gTC5DaXJjbGVcbiAgICAgIGRlc3QgPSBwcm9qZWN0aW9uLnVucHJvamVjdChcbiAgICAgICAgcHJvamVjdGlvbi5wcm9qZWN0KHBhdGguX2xhdGxuZykuX2FkZChkaWZmKSk7XG4gICAgICBpZiAoYXBwbHlUcmFuc2Zvcm0pIHtcbiAgICAgICAgcGF0aC5fbGF0bG5nID0gZGVzdDtcbiAgICAgICAgcGF0aC5fcG9pbnQuX2FkZChweCk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChwYXRoLl9yaW5ncyB8fCBwYXRoLl9wYXJ0cykgeyAvLyBldmVyeXRoaW5nIGVsc2VcbiAgICAgIHZhciByaW5ncyAgID0gcGF0aC5fcmluZ3MgfHwgcGF0aC5fcGFydHM7XG4gICAgICB2YXIgbGF0bG5ncyA9IHBhdGguX2xhdGxuZ3M7XG4gICAgICBkZXN0ID0gZGVzdCB8fCBsYXRsbmdzO1xuICAgICAgaWYgKCFMLlV0aWwuaXNBcnJheShsYXRsbmdzWzBdKSkgeyAvLyBwb2x5bGluZVxuICAgICAgICBsYXRsbmdzID0gW2xhdGxuZ3NdO1xuICAgICAgICBkZXN0ICAgID0gW2Rlc3RdO1xuICAgICAgfVxuICAgICAgZm9yIChpID0gMCwgbGVuID0gcmluZ3MubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgZGVzdFtpXSA9IGRlc3RbaV0gfHwgW107XG4gICAgICAgIGZvciAodmFyIGogPSAwLCBqaiA9IHJpbmdzW2ldLmxlbmd0aDsgaiA8IGpqOyBqKyspIHtcbiAgICAgICAgICBsYXRsbmcgICAgID0gbGF0bG5nc1tpXVtqXTtcbiAgICAgICAgICBkZXN0W2ldW2pdID0gcHJvamVjdGlvblxuICAgICAgICAgICAgLnVucHJvamVjdChwcm9qZWN0aW9uLnByb2plY3QobGF0bG5nKS5fYWRkKGRpZmYpKTtcbiAgICAgICAgICBpZiAoYXBwbHlUcmFuc2Zvcm0pIHtcbiAgICAgICAgICAgIHBhdGguX2JvdW5kcy5leHRlbmQobGF0bG5nc1tpXVtqXSk7XG4gICAgICAgICAgICByaW5nc1tpXVtqXS5fYWRkKHB4KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGRlc3Q7XG4gICAgLy8gY29uc29sZS50aW1lRW5kKCd0cmFuc2Zvcm0nKTtcbiAgfSxcblxuXG5cbiAgLyoqXG4gICAqIElmIHlvdSB3YW50IHRvIHJlYWQgdGhlIGxhdGxuZ3MgZHVyaW5nIHRoZSBkcmFnIC0geW91ciByaWdodCxcbiAgICogYnV0IHRoZXkgaGF2ZSB0byBiZSB0cmFuc2Zvcm1lZFxuICAgKi9cbiAgX3JlcGxhY2VDb29yZEdldHRlcnM6IGZ1bmN0aW9uKCkge1xuICAgIGlmICh0aGlzLl9wYXRoLmdldExhdExuZykgeyAvLyBDaXJjbGUsIENpcmNsZU1hcmtlclxuICAgICAgdGhpcy5fcGF0aC5nZXRMYXRMbmdfID0gdGhpcy5fcGF0aC5nZXRMYXRMbmc7XG4gICAgICB0aGlzLl9wYXRoLmdldExhdExuZyA9IEwuVXRpbC5iaW5kKGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5kcmFnZ2luZy5fdHJhbnNmb3JtUG9pbnRzKHRoaXMuZHJhZ2dpbmcuX21hdHJpeCwge30pO1xuICAgICAgfSwgdGhpcy5fcGF0aCk7XG4gICAgfSBlbHNlIGlmICh0aGlzLl9wYXRoLmdldExhdExuZ3MpIHtcbiAgICAgIHRoaXMuX3BhdGguZ2V0TGF0TG5nc18gPSB0aGlzLl9wYXRoLmdldExhdExuZ3M7XG4gICAgICB0aGlzLl9wYXRoLmdldExhdExuZ3MgPSBMLlV0aWwuYmluZChmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZHJhZ2dpbmcuX3RyYW5zZm9ybVBvaW50cyh0aGlzLmRyYWdnaW5nLl9tYXRyaXgsIFtdKTtcbiAgICAgIH0sIHRoaXMuX3BhdGgpO1xuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBQdXQgYmFjayB0aGUgZ2V0dGVyc1xuICAgKi9cbiAgX3Jlc3RvcmVDb29yZEdldHRlcnM6IGZ1bmN0aW9uKCkge1xuICAgIGlmICh0aGlzLl9wYXRoLmdldExhdExuZ18pIHtcbiAgICAgIHRoaXMuX3BhdGguZ2V0TGF0TG5nID0gdGhpcy5fcGF0aC5nZXRMYXRMbmdfO1xuICAgICAgZGVsZXRlIHRoaXMuX3BhdGguZ2V0TGF0TG5nXztcbiAgICB9IGVsc2UgaWYgKHRoaXMuX3BhdGguZ2V0TGF0TG5nc18pIHtcbiAgICAgIHRoaXMuX3BhdGguZ2V0TGF0TG5ncyA9IHRoaXMuX3BhdGguZ2V0TGF0TG5nc187XG4gICAgICBkZWxldGUgdGhpcy5fcGF0aC5nZXRMYXRMbmdzXztcbiAgICB9XG4gIH1cblxufSk7XG5cblxuLyoqXG4gKiBAcGFyYW0gIHtMLlBhdGh9IGxheWVyXG4gKiBAcmV0dXJuIHtMLlBhdGh9XG4gKi9cbkwuSGFuZGxlci5QYXRoRHJhZy5tYWtlRHJhZ2dhYmxlID0gZnVuY3Rpb24obGF5ZXIpIHtcbiAgbGF5ZXIuZHJhZ2dpbmcgPSBuZXcgTC5IYW5kbGVyLlBhdGhEcmFnKGxheWVyKTtcbiAgcmV0dXJuIGxheWVyO1xufTtcblxuXG4vKipcbiAqIEFsc28gZXhwb3NlIGFzIGEgbWV0aG9kXG4gKiBAcmV0dXJuIHtMLlBhdGh9XG4gKi9cbkwuUGF0aC5wcm90b3R5cGUubWFrZURyYWdnYWJsZSA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gTC5IYW5kbGVyLlBhdGhEcmFnLm1ha2VEcmFnZ2FibGUodGhpcyk7XG59O1xuXG5cbkwuUGF0aC5hZGRJbml0SG9vayhmdW5jdGlvbigpIHtcbiAgaWYgKHRoaXMub3B0aW9ucy5kcmFnZ2FibGUpIHtcbiAgICAvLyBlbnN1cmUgaW50ZXJhY3RpdmVcbiAgICB0aGlzLm9wdGlvbnMuaW50ZXJhY3RpdmUgPSB0cnVlO1xuXG4gICAgaWYgKHRoaXMuZHJhZ2dpbmcpIHtcbiAgICAgIHRoaXMuZHJhZ2dpbmcuZW5hYmxlKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIEwuSGFuZGxlci5QYXRoRHJhZy5tYWtlRHJhZ2dhYmxlKHRoaXMpO1xuICAgICAgdGhpcy5kcmFnZ2luZy5lbmFibGUoKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAodGhpcy5kcmFnZ2luZykge1xuICAgIHRoaXMuZHJhZ2dpbmcuZGlzYWJsZSgpO1xuICB9XG59KTtcbiIsIi8qKlxuICogTGVhZmxldCB2ZWN0b3IgZmVhdHVyZXMgZHJhZyBmdW5jdGlvbmFsaXR5XG4gKiBAYXV0aG9yIEFsZXhhbmRlciBNaWxldnNraSA8aW5mb0B3OHIubmFtZT5cbiAqIEBwcmVzZXJ2ZVxuICovXG5cbi8qKlxuICogTWF0cml4IHRyYW5zZm9ybSBwYXRoIGZvciBTVkcvVk1MXG4gKiBSZW5kZXJlci1pbmRlcGVuZGVudFxuICovXG5MLlBhdGguaW5jbHVkZSh7XG5cblx0LyoqXG5cdCAqIEFwcGxpZXMgbWF0cml4IHRyYW5zZm9ybWF0aW9uIHRvIFNWR1xuXHQgKiBAcGFyYW0ge0FycmF5LjxOdW1iZXI+P30gbWF0cml4XG5cdCAqL1xuXHRfdHJhbnNmb3JtOiBmdW5jdGlvbihtYXRyaXgpIHtcblx0XHRpZiAodGhpcy5fcmVuZGVyZXIpIHtcblx0XHRcdGlmIChtYXRyaXgpIHtcblx0XHRcdFx0dGhpcy5fcmVuZGVyZXIudHJhbnNmb3JtUGF0aCh0aGlzLCBtYXRyaXgpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8gcmVzZXQgdHJhbnNmb3JtIG1hdHJpeFxuXHRcdFx0XHR0aGlzLl9yZW5kZXJlci5fcmVzZXRUcmFuc2Zvcm1QYXRoKHRoaXMpO1xuXHRcdFx0XHR0aGlzLl91cGRhdGUoKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH0sXG5cblx0LyoqXG5cdCAqIENoZWNrIGlmIHRoZSBmZWF0dXJlIHdhcyBkcmFnZ2VkLCB0aGF0J2xsIHN1cHJlc3MgdGhlIGNsaWNrIGV2ZW50XG5cdCAqIG9uIG1vdXNldXAuIFRoYXQgZml4ZXMgcG9wdXBzIGZvciBleGFtcGxlXG5cdCAqXG5cdCAqIEBwYXJhbSAge01vdXNlRXZlbnR9IGVcblx0ICovXG5cdF9vbk1vdXNlQ2xpY2s6IGZ1bmN0aW9uKGUpIHtcblx0XHRpZiAoKHRoaXMuZHJhZ2dpbmcgJiYgdGhpcy5kcmFnZ2luZy5tb3ZlZCgpKSB8fFxuXHRcdFx0KHRoaXMuX21hcC5kcmFnZ2luZyAmJiB0aGlzLl9tYXAuZHJhZ2dpbmcubW92ZWQoKSkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl9maXJlTW91c2VFdmVudChlKTtcblx0fVxuXG59KTtcbiIsIkwuU1ZHLmluY2x1ZGUoIUwuQnJvd3Nlci52bWwgPyB7fSA6IHtcblxuXHQvKipcblx0ICogUmVzZXQgdHJhbnNmb3JtIG1hdHJpeFxuXHQgKi9cblx0X3Jlc2V0VHJhbnNmb3JtUGF0aDogZnVuY3Rpb24obGF5ZXIpIHtcblx0XHRpZiAobGF5ZXIuX3NrZXcpIHtcblx0XHRcdC8vIHN1cGVyIGltcG9ydGFudCEgd29ya2Fyb3VuZCBmb3IgYSAnanVtcGluZycgZ2xpdGNoOlxuXHRcdFx0Ly8gZGlzYWJsZSB0cmFuc2Zvcm0gYmVmb3JlIHJlbW92aW5nIGl0XG5cdFx0XHRsYXllci5fc2tldy5vbiA9IGZhbHNlO1xuXHRcdFx0bGF5ZXIuX3BhdGgucmVtb3ZlQ2hpbGQobGF5ZXIuX3NrZXcpO1xuXHRcdFx0bGF5ZXIuX3NrZXcgPSBudWxsO1xuXHRcdH1cblx0fSxcblxuXHQvKipcblx0ICogQXBwbGllcyBtYXRyaXggdHJhbnNmb3JtYXRpb24gdG8gVk1MXG5cdCAqIEBwYXJhbSB7TC5QYXRofSAgICAgICAgIGxheWVyXG5cdCAqIEBwYXJhbSB7QXJyYXkuPE51bWJlcj59IG1hdHJpeFxuXHQgKi9cblx0dHJhbnNmb3JtUGF0aDogZnVuY3Rpb24obGF5ZXIsIG1hdHJpeCkge1xuXHRcdHZhciBza2V3ID0gbGF5ZXIuX3NrZXc7XG5cblx0XHRpZiAoIXNrZXcpIHtcblx0XHRcdHNrZXcgPSBMLlNWRy5jcmVhdGUoJ3NrZXcnKTtcblx0XHRcdGxheWVyLl9wYXRoLmFwcGVuZENoaWxkKHNrZXcpO1xuXHRcdFx0c2tldy5zdHlsZS5iZWhhdmlvciA9ICd1cmwoI2RlZmF1bHQjVk1MKSc7XG5cdFx0XHRsYXllci5fc2tldyA9IHNrZXc7XG5cdFx0fVxuXG5cdFx0Ly8gaGFuZGxlIHNrZXcvdHJhbnNsYXRlIHNlcGFyYXRlbHksIGNhdXNlIGl0J3MgYnJva2VuXG5cdFx0dmFyIG10ID0gbWF0cml4WzBdLnRvRml4ZWQoOCkgKyAnICcgKyBtYXRyaXhbMV0udG9GaXhlZCg4KSArICcgJyArXG5cdFx0XHRtYXRyaXhbMl0udG9GaXhlZCg4KSArICcgJyArIG1hdHJpeFszXS50b0ZpeGVkKDgpICsgJyAwIDAnO1xuXHRcdHZhciBvZmZzZXQgPSBNYXRoLmZsb29yKG1hdHJpeFs0XSkudG9GaXhlZCgpICsgJywgJyArXG5cdFx0XHRNYXRoLmZsb29yKG1hdHJpeFs1XSkudG9GaXhlZCgpICsgJyc7XG5cblx0XHR2YXIgcyA9IHRoaXMuX3BhdGguc3R5bGU7XG5cdFx0dmFyIGwgPSBwYXJzZUZsb2F0KHMubGVmdCk7XG5cdFx0dmFyIHQgPSBwYXJzZUZsb2F0KHMudG9wKTtcblx0XHR2YXIgdyA9IHBhcnNlRmxvYXQocy53aWR0aCk7XG5cdFx0dmFyIGggPSBwYXJzZUZsb2F0KHMuaGVpZ2h0KTtcblxuXHRcdGlmIChpc05hTihsKSkgICAgICAgbCA9IDA7XG5cdFx0aWYgKGlzTmFOKHQpKSAgICAgICB0ID0gMDtcblx0XHRpZiAoaXNOYU4odykgfHwgIXcpIHcgPSAxO1xuXHRcdGlmIChpc05hTihoKSB8fCAhaCkgaCA9IDE7XG5cblx0XHR2YXIgb3JpZ2luID0gKC1sIC8gdyAtIDAuNSkudG9GaXhlZCg4KSArICcgJyArICgtdCAvIGggLSAwLjUpLnRvRml4ZWQoOCk7XG5cblx0XHRza2V3Lm9uID0gJ2YnO1xuXHRcdHNrZXcubWF0cml4ID0gbXQ7XG5cdFx0c2tldy5vcmlnaW4gPSBvcmlnaW47XG5cdFx0c2tldy5vZmZzZXQgPSBvZmZzZXQ7XG5cdFx0c2tldy5vbiA9IHRydWU7XG5cdH1cblxufSk7XG4iLCJMLlNWRy5pbmNsdWRlKHtcblxuXHQvKipcblx0ICogUmVzZXQgdHJhbnNmb3JtIG1hdHJpeFxuXHQgKi9cblx0X3Jlc2V0VHJhbnNmb3JtUGF0aDogZnVuY3Rpb24obGF5ZXIpIHtcblx0XHRsYXllci5fcGF0aC5zZXRBdHRyaWJ1dGVOUyhudWxsLCAndHJhbnNmb3JtJywgJycpO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBBcHBsaWVzIG1hdHJpeCB0cmFuc2Zvcm1hdGlvbiB0byBTVkdcblx0ICogQHBhcmFtIHtMLlBhdGh9ICAgICAgICAgbGF5ZXJcblx0ICogQHBhcmFtIHtBcnJheS48TnVtYmVyPn0gbWF0cml4XG5cdCAqL1xuXHR0cmFuc2Zvcm1QYXRoOiBmdW5jdGlvbihsYXllciwgbWF0cml4KSB7XG5cdFx0bGF5ZXIuX3BhdGguc2V0QXR0cmlidXRlTlMobnVsbCwgJ3RyYW5zZm9ybScsXG5cdFx0XHQnbWF0cml4KCcgKyBtYXRyaXguam9pbignICcpICsgJyknKTtcblx0fVxuXG59KTtcbiIsInJlcXVpcmUoJ2xlYWZsZXQtcGF0aC1kcmFnJyk7XG5cbmNvbnN0IE1pbmltYXAgPSBMLk1hcC5leHRlbmQoe30pO1xuXG4vKipcbiAqIEBjbGFzcyBMLkNvbnRyb2wuT3ZlcnZpZXdcbiAqIEBleHRlbmRzIHtMLkNvbnRyb2x9XG4gKi9cbkwuQ29udHJvbC5PdmVydmlldyA9IEwuQ29udHJvbC5leHRlbmQoe1xuXG4gIG9wdGlvbnM6IHtcbiAgICBwb3NpdGlvbjogJ2JvdHRvbXJpZ2h0JyxcblxuICAgIHJlY3RhbmdsZTogICAgICAgIHRydWUsXG4gICAgcmVjdGFuZ2xlQ2xhc3M6ICAgTC5SZWN0YW5nbGUsXG4gICAgcmVjdGFuZ2xlT3B0aW9uczoge1xuICAgICAgZHJhZ2dhYmxlOiB0cnVlLFxuICAgICAgd2VpZ2h0OiAgICAyXG4gICAgfSxcblxuICAgIG1hcE9wdGlvbnM6ICAgICAgIHtcbiAgICAgIGF0dHJpYnV0aW9uQ29udHJvbDogZmFsc2UsXG4gICAgICB6b29tQ29udHJvbDogICAgICAgIGZhbHNlLFxuICAgICAgYm94Wm9vbTogICAgICAgICAgICBmYWxzZSxcbiAgICAgIHpvb21BbmltYXRpb246ICAgICAgZmFsc2VcbiAgICB9LFxuXG4gICAgZml4ZWRab29tTGV2ZWw6ICAgZmFsc2UsXG4gICAgem9vbU9mZnNldDogICAgICAgMyxcblxuICAgIGF1dG9EZXRlY3RMYXllcnM6IHRydWUsXG4gICAgZmlsdGVyTGF5ZXJzOiAgICAgbGF5ZXIgPT4gKFxuICAgICAgbGF5ZXIgaW5zdGFuY2VvZiBMLlRpbGVMYXllciAgICB8fFxuICAgICAgbGF5ZXIgaW5zdGFuY2VvZiBMLkltYWdlT3ZlcmxheSB8fFxuICAgICAgbGF5ZXIgaW5zdGFuY2VvZiBMLkRpdk92ZXJsYXlcbiAgICApLFxuXG4gICAgbWluaW1hcENsYXNzOiBNaW5pbWFwLFxuXG4gICAgY2xhc3NOYW1lOiAgICAgICAgICAnbGVhZmxldC1iYXIgbGVhZmxldC1vdmVydmlldycsXG4gICAgbWFwQ2xhc3NOYW1lOiAgICAgICAnbGVhZmxldC1vdmVydmlldy0tbWFwJyxcbiAgICByZWN0YW5nbGVDbGFzc05hbWU6ICdsZWFmbGV0LW92ZXJ2aWV3LS1yZWN0YW5nbGUnLFxuXG4gICAgdXBkYXRlRGVsYXk6IDMwMFxuICB9LFxuXG4gIC8qKlxuICAgKiBAY29uc3RydWN0b3JcbiAgICogQHBhcmFtIHtPYmplY3R9XG4gICAqL1xuICBpbml0aWFsaXplIChsYXllcnMsIG9wdGlvbnMpIHtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtMLk1hcH1cbiAgICAgKi9cbiAgICB0aGlzLl9vdmVydmlld21hcCA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TC5SZWN0YW5nbGV9XG4gICAgICovXG4gICAgdGhpcy5fcmVjdGFuZ2xlICAgPSBudWxsO1xuXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7Qm9vbGVhbn1cbiAgICAgKi9cbiAgICB0aGlzLl9za2lwVXBkYXRlICA9IGZhbHNlO1xuXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7QXJyYXkuPEwuTGF5ZXI+fVxuICAgICAqL1xuICAgIHRoaXMuX2xheWVycyAgICAgID0gTC5VdGlsLmlzQXJyYXkobGF5ZXJzKSA/IGxheWVycyA6IFtsYXllcnNdO1xuXG4gICAgdGhpcy5fdXBkYXRlVGhyb3R0bGVkID0gTC5VdGlsLnRocm90dGxlKFxuICAgICAgdGhpcy5fdXBkYXRlLCB0aGlzLm9wdGlvbnMudXBkYXRlRGVsYXksIHRoaXMpO1xuXG4gICAgTC5Db250cm9sLnByb3RvdHlwZS5pbml0aWFsaXplLmNhbGwodGhpcywgb3B0aW9ucyk7XG4gIH0sXG5cblxuICBvbkFkZCAobWFwKSB7XG4gICAgdGhpcy5fY29udGFpbmVyID0gTC5Eb21VdGlsLmNyZWF0ZSgnZGl2JywgdGhpcy5vcHRpb25zLmNsYXNzTmFtZSk7XG4gICAgTC5Eb21FdmVudFxuICAgICAgLmRpc2FibGVTY3JvbGxQcm9wYWdhdGlvbih0aGlzLl9jb250YWluZXIpXG4gICAgICAuZGlzYWJsZUNsaWNrUHJvcGFnYXRpb24odGhpcy5fY29udGFpbmVyKTtcblxuICAgIHRoaXMuX21hcENvbnRhaW5lciA9IEwuRG9tVXRpbC5jcmVhdGUoJ2RpdicsXG4gICAgICB0aGlzLm9wdGlvbnMubWFwQ2xhc3NOYW1lLCB0aGlzLl9jb250YWluZXIpO1xuXG4gICAgbWFwXG4gICAgICAub24oJ21vdmVlbmQgem9vbWVuZCB2aWV3cmVzZXQnLCB0aGlzLl91cGRhdGVUaHJvdHRsZWQsIHRoaXMpXG4gICAgICAub24oJ2xheWVyYWRkJywgIHRoaXMuX29uTGF5ZXJBZGRlZCwgICB0aGlzKVxuICAgICAgLm9uKCdtb3ZlJywgdGhpcy5fb25NYXBNb3ZlLCB0aGlzKTtcblxuICAgIHRoaXMuX2NyZWF0ZU1hcCgpO1xuXG4gICAgcmV0dXJuIHRoaXMuX2NvbnRhaW5lcjtcbiAgfSxcblxuXG4gIG9uUmVtb3ZlIChtYXApIHtcbiAgICB0aGlzLl9vdmVydmlld21hcC5yZW1vdmVMYXllcih0aGlzLl9yZWN0YW5nbGUpO1xuICAgIHRoaXMuX292ZXJ2aWV3bWFwLnJlbW92ZSgpO1xuICAgIHRoaXMuX292ZXJ2aWV3bWFwID0gdGhpcy5fcmVjdGFuZ2xlID0gbnVsbDtcblxuICAgIG1hcFxuICAgICAgLm9mZignbW92ZWVuZCB6b29tZW5kIHZpZXdyZXNldCcsIHRoaXMuX3VwZGF0ZVRocm90dGxlZCwgdGhpcylcbiAgICAgIC5vZmYoJ2xheWVyYWRkJywgIHRoaXMuX29uTGF5ZXJBZGRlZCwgdGhpcylcbiAgICAgIC5vZmYoJ21vdmUnLCB0aGlzLl9vbk1hcE1vdmUsIHRoaXMpO1xuICB9LFxuXG5cbiAgZ2V0IHJlY3RhbmdsZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX3JlY3Q7XG4gIH0sXG5cblxuICBnZXQgb3ZlcnZpZXcgKCkge1xuICAgIHJldHVybiB0aGlzLl9vdmVydmlld21hcDtcbiAgfSxcblxuXG4gIF9jcmVhdGVNYXAgKCkge1xuICAgIEwuVXRpbC5yZXF1ZXN0QW5pbUZyYW1lKCgpID0+IHtcbiAgICAgIGNvbnN0IE92ZXJ2aWV3TWFwID0gdGhpcy5vcHRpb25zLm1pbmltYXBDbGFzcztcbiAgICAgIGNvbnN0IHpvb20gPSAodHlwZW9mIHRoaXMub3B0aW9ucy5maXhlZFpvb21MZXZlbCA9PT0gJ251bWJlcicpID9cbiAgICAgICAgdGhpcy5vcHRpb25zLmZpeGVkWm9vbUxldmVsOlxuICAgICAgICB0aGlzLl9tYXAuZ2V0Wm9vbSgpIC0gdGhpcy5vcHRpb25zLnpvb21PZmZzZXQ7XG5cbiAgICAgIHRoaXMuX292ZXJ2aWV3bWFwID0gbmV3IE92ZXJ2aWV3TWFwKFxuICAgICAgICB0aGlzLl9tYXBDb250YWluZXIsXG4gICAgICAgIHRoaXMub3B0aW9ucy5tYXBPcHRpb25zKVxuICAgICAgICAuc2V0Vmlldyh0aGlzLl9tYXAuZ2V0Q2VudGVyKCksIHpvb20pO1xuXG4gICAgICB0aGlzLl9vdmVydmlld21hcFxuICAgICAgICAub24oJ2RyYWdzdGFydCcsIHRoaXMuX29uTWFwRHJhZ1N0YXJ0LCB0aGlzKVxuICAgICAgICAub24oJ2RyYWcnLCAgICAgIHRoaXMuX29uTWFwRHJhZywgICAgICB0aGlzKVxuICAgICAgICAub24oJ2RyYWdlbmQnLCAgIHRoaXMuX29uTWFwRHJhZ0VuZCwgICB0aGlzKVxuICAgICAgICAub24oJ21vdmVlbmQnLCAgIHRoaXMuX29uTW92ZWVuZCwgICAgICB0aGlzKTtcblxuICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHRoaXMuX2xheWVycy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICB0aGlzLl9vdmVydmlld21hcC5hZGRMYXllcih0aGlzLl9sYXllcnNbaV0pO1xuICAgICAgfVxuICAgICAgdGhpcy5fY3JlYXRlUmVjdCgpO1xuICAgIH0pO1xuICB9LFxuXG5cbiAgX2NyZWF0ZVJlY3QgKCkge1xuICAgIGlmICh0aGlzLm9wdGlvbnMucmVjdGFuZ2xlKSB7XG4gICAgICBjb25zdCBSZWN0YW5nbGUgPSB0aGlzLm9wdGlvbnMucmVjdGFuZ2xlQ2xhc3M7XG4gICAgICB0aGlzLl9yZWN0ID0gbmV3IFJlY3RhbmdsZSh0aGlzLl9tYXAuZ2V0Qm91bmRzKCksXG4gICAgICAgIEwuVXRpbC5leHRlbmQoeyBjbGFzc05hbWU6IHRoaXMub3B0aW9ucy5yZWN0YW5nbGVDbGFzc05hbWUgfSxcbiAgICAgICAgICB0aGlzLm9wdGlvbnMucmVjdGFuZ2xlT3B0aW9ucykpO1xuICAgICAgdGhpcy5fcmVjdC5vbignZHJhZ2VuZCcsIHRoaXMuX29uUmVjdERyYWdlbmQsIHRoaXMpO1xuICAgICAgdGhpcy5fb3ZlcnZpZXdtYXAuYWRkTGF5ZXIodGhpcy5fcmVjdCk7XG4gICAgfVxuICB9LFxuXG5cbiAgX29uTGF5ZXJBZGRlZCAoZXZ0KSB7XG4gICAgY29uc29sZS5sb2coZXZ0KTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBNaW5pLW1hcCAtPiBtYWluIG1hcCB1cGRhdGVcbiAgICovXG4gIF9vbk1vdmVlbmQgKGV2dCkge1xuICAgIGlmICghdGhpcy5fc2tpcFVwZGF0ZSkge1xuICAgICAgY29uc29sZS5sb2coJ3R0dHQnKTtcbiAgICAgIHRoaXMuX3NraXBVcGRhdGUgPSB0cnVlO1xuICAgICAgdGhpcy5fbWFwLnNldFZpZXcodGhpcy5fb3ZlcnZpZXdtYXAuZ2V0Q2VudGVyKCkpO1xuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBNYWluIG1hcCAtPiBvdmVydmlldyBtYXAgdXBkYXRlXG4gICAqL1xuICBfdXBkYXRlIChldnQpIHtcbiAgICBpZiAodGhpcy5fc2tpcFVwZGF0ZSkge1xuICAgICAgdGhpcy5fc2tpcFVwZGF0ZSA9IGZhbHNlO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zb2xlLmxvZygndXBkYXRlIGZyb20gdGhlIG1hcCcpO1xuICAgIGNvbnN0IHpvb20gPSB0aGlzLm9wdGlvbnMuZml4ZWRab29tTGV2ZWwgP1xuICAgICAgdGhpcy5fb3ZlcnZpZXdtYXAuZ2V0Wm9vbSgpIDpcbiAgICAgIHRoaXMuX21hcC5nZXRab29tKCkgLSB0aGlzLm9wdGlvbnMuem9vbU9mZnNldDtcbiAgICB0aGlzLl9vdmVydmlld21hcC5zZXRWaWV3KHRoaXMuX21hcC5nZXRDZW50ZXIoKSwgem9vbSk7XG4gICAgdGhpcy5fcmVjdC5zZXRMYXRMbmdzKHRoaXMuX3JlY3QuX2JvdW5kc1RvTGF0TG5ncyh0aGlzLl9tYXAuZ2V0Qm91bmRzKCkpKTtcbiAgfSxcblxuXG4gIF9vblJlY3REcmFnZW5kICgpIHtcbiAgICB0aGlzLl9za2lwVXBkYXRlID0gdHJ1ZTtcbiAgICB0aGlzLl9vdmVydmlld21hcC5zZXRWaWV3KHRoaXMuX3JlY3QuZ2V0Qm91bmRzKCkuZ2V0Q2VudGVyKCkpO1xuICAgIHRoaXMuX21hcC5zZXRWaWV3KHRoaXMuX3JlY3QuZ2V0Qm91bmRzKCkuZ2V0Q2VudGVyKCkpO1xuICB9LFxuXG5cbiAgX29uTWFwRHJhZ1N0YXJ0ICgpIHtcblxuICB9LFxuXG5cbiAgX29uTWFwRHJhZ0VuZCAoKSB7XG5cbiAgfSxcblxuXG4gIF9vbk1hcERyYWcgKCkge1xuICAgIC8vdGhpcy5fcmVjdC5zZXRMYXRMbmdzKHRoaXMuX21hcC5nZXRCb3VuZHMoKSk7XG4gIH0sXG5cblxuICBfb25NYXBNb3ZlICgpIHtcbiAgICBpZiAodGhpcy5fcmVjdCkge1xuICAgICAgLy90aGlzLl9za2lwVXBkYXRlID0gdHJ1ZTtcbiAgICAgIC8vdGhpcy5fcmVjdC5zZXRCb3VuZHModGhpcy5fbWFwLmdldEJvdW5kcygpKTtcbiAgICB9XG4gIH1cblxufSk7XG5cbkwuQ29udHJvbC5PdmVydmlldy5NYXAgPSBNaW5pbWFwO1xuXG4vLyBmYWN0b3J5XG5MLmNvbnRyb2wub3ZlcnZpZXcgPSAob3B0aW9ucykgPT4gbmV3IEwuQ29udHJvbC5PdmVydmlldyhvcHRpb25zKTtcblxuTC5NYXAubWVyZ2VPcHRpb25zKHtcbiAgb3ZlcnZpZXdDb250cm9sOiBmYWxzZVxufSk7XG5cbkwuTWFwLmFkZEluaXRIb29rKGZ1bmN0aW9uICgpIHtcblx0aWYgKHRoaXMub3B0aW9ucy5vdmVydmlld0NvbnRyb2wpIHtcblx0XHR0aGlzLm92ZXJ2aWV3Q29udHJvbCA9IG5ldyBMLkNvbnRyb2wuT3ZlcnZpZXcoKTtcblx0XHR0aGlzLmFkZENvbnRyb2wodGhpcy5vdmVydmlld0NvbnRyb2wpO1xuXHR9XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBMLkNvbnRyb2wuT3ZlcnZpZXc7XG4iXX0=
