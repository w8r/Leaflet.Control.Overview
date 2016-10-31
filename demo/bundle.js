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

    reactangle: true,
    rectangleClass: L.Rectangle,
    rectangleOptions: {
      draggable: true,
      weight: 2
    },

    mapOptions: {
      attributionControl: false,
      zoomControl: false,
      boxZoom: false
    },
    zoomOffset: 3,
    autoDetectLayers: true,
    filterLayers: function filterLayers(layer) {
      return layer instanceof L.TileLayer || layer instanceof L.ImageOverlay || layer instanceof L.DivOverlay;
    },

    minimapClass: Minimap,

    className: 'leaflet-bar leaflet-overview',
    mapClassName: 'leaflet-overview--map',
    rectangleClassName: 'leaflet-overview--rectangle'
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

    L.Control.prototype.initialize.call(this, options);
  },
  onAdd: function onAdd(map) {
    this._container = L.DomUtil.create('div', this.options.className);
    L.DomEvent.disableScrollPropagation(this._container).disableClickPropagation(this._container);

    this._mapContainer = L.DomUtil.create('div', this.options.mapClassName, this._container);

    map.on('moveend zoomend viewreset', this._update, this).on('layeradd', this._onLayerAdded, this);

    this._createMap();

    return this._container;
  },
  onRemove: function onRemove(map) {
    this._overviewmap.removeLayer(this._rectangle);
    this._overviewmap.remove();
    this._overviewmap = this._rectangle = null;

    map.off('moveend zoomend viewreset', this._update, this).off('layeradd', this._onLayerAdded, this);
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
      _this._overviewmap = new OverviewMap(_this._mapContainer, _this.options.mapOptions).setView(_this._map.getCenter(), _this._map.getZoom() - _this.options.zoomOffset);

      _this._overviewmap.on('moveend', _this._onMoveend, _this);
      for (var i = 0, len = _this._layers.length; i < len; i++) {
        _this._overviewmap.addLayer(_this._layers[i]);
      }
      _this._createRect();
    });
  },
  _createRect: function _createRect() {
    var Rectangle = this.options.rectangleClass;
    this._rect = new Rectangle(this._map.getBounds(), L.Util.extend({ className: this.options.rectangleClassName }, this.options.rectangleOptions));
    this._rect.on('dragend', this._onRectDragend, this);
    this._overviewmap.addLayer(this._rect);
  },
  _onLayerAdded: function _onLayerAdded(evt) {
    console.log(evt);
  },
  _onMoveend: function _onMoveend() {
    if (this._skipUpdate) {
      this._skipUpdate = false;
    } else {
      this._map.setView(this._overviewmap.getCenter());
    }
  },
  _update: function _update() {
    this._skipUpdate = true;
    this._overviewmap.setView(this._map.getCenter(), this._map.getZoom() - this.options.zoomOffset);
    this._rect.setLatLngs(this._rect._boundsToLatLngs(this._map.getBounds()));
  },
  _onRectDragend: function _onRectDragend() {
    this._overviewmap.setView(this._rect.getBounds().getCenter());
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJkZW1vL2FwcC5qcyIsImluZGV4LmpzIiwibm9kZV9tb2R1bGVzL2xlYWZsZXQtcGF0aC1kcmFnL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2xlYWZsZXQtcGF0aC1kcmFnL3NyYy9DYW52YXMuanMiLCJub2RlX21vZHVsZXMvbGVhZmxldC1wYXRoLWRyYWcvc3JjL1BhdGguRHJhZy5qcyIsIm5vZGVfbW9kdWxlcy9sZWFmbGV0LXBhdGgtZHJhZy9zcmMvUGF0aC5UcmFuc2Zvcm0uanMiLCJub2RlX21vZHVsZXMvbGVhZmxldC1wYXRoLWRyYWcvc3JjL1NWRy5WTUwuanMiLCJub2RlX21vZHVsZXMvbGVhZmxldC1wYXRoLWRyYWcvc3JjL1NWRy5qcyIsInNyYy9MLkNvbnRyb2wuT3ZlcnZpZXcuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7QUNBQTs7Ozs7O0FBRUEsSUFBTSxTQUFVLENBQUMsT0FBRCxFQUFVLE9BQVYsQ0FBaEI7QUFDQSxJQUFNLE9BQVUsRUFBaEI7QUFDQSxJQUFNLFVBQVUseUNBQWhCOztBQUVBLElBQU0sTUFBTSxPQUFPLEdBQVAsR0FBYSxFQUFFLEdBQUYsQ0FBTSxLQUFOLEVBQWEsT0FBYixDQUFxQixNQUFyQixFQUE2QixJQUE3QixDQUF6Qjs7QUFFQSxJQUFNLFFBQVEsRUFBRSxTQUFGLENBQVksT0FBWixFQUFxQjtBQUNqQyxlQUFhO0FBRG9CLENBQXJCLEVBRVgsS0FGVyxDQUVMLEdBRkssQ0FBZDs7QUFJQSxJQUFJLFVBQUosQ0FBZSxlQUFhLEVBQUUsU0FBRixDQUFZLE9BQVosRUFBcUIsTUFBTSxPQUEzQixDQUFiLEVBQWtELEVBQWxELENBQWY7Ozs7Ozs7QUNaQSxPQUFPLE9BQVAsR0FBaUIsUUFBUSwwQkFBUixDQUFqQjs7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdVQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ3BCQSxRQUFRLG1CQUFSOztBQUVBLElBQU0sVUFBVSxFQUFFLEdBQUYsQ0FBTSxNQUFOLENBQWEsRUFBYixDQUFoQjs7QUFFQTs7OztBQUlBLEVBQUUsT0FBRixDQUFVLFFBQVYsR0FBcUIsRUFBRSxPQUFGLENBQVUsTUFBVixDQUFpQjs7QUFFcEMsV0FBUztBQUNQLGNBQVUsYUFESDs7QUFHUCxnQkFBa0IsSUFIWDtBQUlQLG9CQUFrQixFQUFFLFNBSmI7QUFLUCxzQkFBa0I7QUFDaEIsaUJBQVcsSUFESztBQUVoQixjQUFXO0FBRkssS0FMWDs7QUFVUCxnQkFBa0I7QUFDaEIsMEJBQW9CLEtBREo7QUFFaEIsbUJBQW9CLEtBRko7QUFHaEIsZUFBb0I7QUFISixLQVZYO0FBZVAsZ0JBQWtCLENBZlg7QUFnQlAsc0JBQWtCLElBaEJYO0FBaUJQLGtCQUFrQjtBQUFBLGFBQ2hCLGlCQUFpQixFQUFFLFNBQW5CLElBQ0EsaUJBQWlCLEVBQUUsWUFEbkIsSUFFQSxpQkFBaUIsRUFBRSxVQUhIO0FBQUEsS0FqQlg7O0FBdUJQLGtCQUFjLE9BdkJQOztBQXlCUCxlQUFvQiw4QkF6QmI7QUEwQlAsa0JBQW9CLHVCQTFCYjtBQTJCUCx3QkFBb0I7QUEzQmIsR0FGMkI7O0FBZ0NwQzs7OztBQUlBLFlBcENvQyxzQkFvQ3hCLE1BcEN3QixFQW9DaEIsT0FwQ2dCLEVBb0NQOztBQUUzQjs7O0FBR0EsU0FBSyxZQUFMLEdBQW9CLElBQXBCOztBQUVBOzs7QUFHQSxTQUFLLFVBQUwsR0FBb0IsSUFBcEI7O0FBR0E7OztBQUdBLFNBQUssV0FBTCxHQUFvQixLQUFwQjs7QUFHQTs7O0FBR0EsU0FBSyxPQUFMLEdBQW9CLEVBQUUsSUFBRixDQUFPLE9BQVAsQ0FBZSxNQUFmLElBQXlCLE1BQXpCLEdBQWtDLENBQUMsTUFBRCxDQUF0RDs7QUFFQSxNQUFFLE9BQUYsQ0FBVSxTQUFWLENBQW9CLFVBQXBCLENBQStCLElBQS9CLENBQW9DLElBQXBDLEVBQTBDLE9BQTFDO0FBQ0QsR0E3RG1DO0FBZ0VwQyxPQWhFb0MsaUJBZ0U3QixHQWhFNkIsRUFnRXhCO0FBQ1YsU0FBSyxVQUFMLEdBQWtCLEVBQUUsT0FBRixDQUFVLE1BQVYsQ0FBaUIsS0FBakIsRUFBd0IsS0FBSyxPQUFMLENBQWEsU0FBckMsQ0FBbEI7QUFDQSxNQUFFLFFBQUYsQ0FDRyx3QkFESCxDQUM0QixLQUFLLFVBRGpDLEVBRUcsdUJBRkgsQ0FFMkIsS0FBSyxVQUZoQzs7QUFJQSxTQUFLLGFBQUwsR0FBcUIsRUFBRSxPQUFGLENBQVUsTUFBVixDQUFpQixLQUFqQixFQUNuQixLQUFLLE9BQUwsQ0FBYSxZQURNLEVBQ1EsS0FBSyxVQURiLENBQXJCOztBQUdBLFFBQ0csRUFESCxDQUNNLDJCQUROLEVBQ21DLEtBQUssT0FEeEMsRUFDaUQsSUFEakQsRUFFRyxFQUZILENBRU0sVUFGTixFQUVrQixLQUFLLGFBRnZCLEVBRXNDLElBRnRDOztBQUlBLFNBQUssVUFBTDs7QUFFQSxXQUFPLEtBQUssVUFBWjtBQUNELEdBaEZtQztBQW1GcEMsVUFuRm9DLG9CQW1GMUIsR0FuRjBCLEVBbUZyQjtBQUNiLFNBQUssWUFBTCxDQUFrQixXQUFsQixDQUE4QixLQUFLLFVBQW5DO0FBQ0EsU0FBSyxZQUFMLENBQWtCLE1BQWxCO0FBQ0EsU0FBSyxZQUFMLEdBQW9CLEtBQUssVUFBTCxHQUFrQixJQUF0Qzs7QUFFQSxRQUNHLEdBREgsQ0FDTywyQkFEUCxFQUNvQyxLQUFLLE9BRHpDLEVBQ2tELElBRGxELEVBRUcsR0FGSCxDQUVPLFVBRlAsRUFFbUIsS0FBSyxhQUZ4QixFQUV1QyxJQUZ2QztBQUdELEdBM0ZtQzs7O0FBOEZwQyxNQUFJLFNBQUosR0FBaUI7QUFDZixXQUFPLEtBQUssS0FBWjtBQUNELEdBaEdtQzs7QUFtR3BDLE1BQUksUUFBSixHQUFnQjtBQUNkLFdBQU8sS0FBSyxZQUFaO0FBQ0QsR0FyR21DOztBQXdHcEMsWUF4R29DLHdCQXdHdEI7QUFBQTs7QUFDWixNQUFFLElBQUYsQ0FBTyxnQkFBUCxDQUF3QixZQUFNO0FBQzVCLFVBQU0sY0FBYyxNQUFLLE9BQUwsQ0FBYSxZQUFqQztBQUNBLFlBQUssWUFBTCxHQUFvQixJQUFJLFdBQUosQ0FDbEIsTUFBSyxhQURhLEVBRWxCLE1BQUssT0FBTCxDQUFhLFVBRkssRUFHakIsT0FIaUIsQ0FHVCxNQUFLLElBQUwsQ0FBVSxTQUFWLEVBSFMsRUFJaEIsTUFBSyxJQUFMLENBQVUsT0FBVixLQUFzQixNQUFLLE9BQUwsQ0FBYSxVQUpuQixDQUFwQjs7QUFNQSxZQUFLLFlBQUwsQ0FBa0IsRUFBbEIsQ0FBcUIsU0FBckIsRUFBZ0MsTUFBSyxVQUFyQztBQUNBLFdBQUssSUFBSSxJQUFJLENBQVIsRUFBVyxNQUFNLE1BQUssT0FBTCxDQUFhLE1BQW5DLEVBQTJDLElBQUksR0FBL0MsRUFBb0QsR0FBcEQsRUFBeUQ7QUFDdkQsY0FBSyxZQUFMLENBQWtCLFFBQWxCLENBQTJCLE1BQUssT0FBTCxDQUFhLENBQWIsQ0FBM0I7QUFDRDtBQUNELFlBQUssV0FBTDtBQUNELEtBYkQ7QUFjRCxHQXZIbUM7QUEwSHBDLGFBMUhvQyx5QkEwSHJCO0FBQ2IsUUFBTSxZQUFZLEtBQUssT0FBTCxDQUFhLGNBQS9CO0FBQ0EsU0FBSyxLQUFMLEdBQWEsSUFBSSxTQUFKLENBQWMsS0FBSyxJQUFMLENBQVUsU0FBVixFQUFkLEVBQ1gsRUFBRSxJQUFGLENBQU8sTUFBUCxDQUFjLEVBQUUsV0FBVyxLQUFLLE9BQUwsQ0FBYSxrQkFBMUIsRUFBZCxFQUNFLEtBQUssT0FBTCxDQUFhLGdCQURmLENBRFcsQ0FBYjtBQUdBLFNBQUssS0FBTCxDQUFXLEVBQVgsQ0FBYyxTQUFkLEVBQXlCLEtBQUssY0FBOUIsRUFBOEMsSUFBOUM7QUFDQSxTQUFLLFlBQUwsQ0FBa0IsUUFBbEIsQ0FBMkIsS0FBSyxLQUFoQztBQUNELEdBakltQztBQW9JcEMsZUFwSW9DLHlCQW9JckIsR0FwSXFCLEVBb0loQjtBQUNsQixZQUFRLEdBQVIsQ0FBWSxHQUFaO0FBQ0QsR0F0SW1DO0FBeUlwQyxZQXpJb0Msd0JBeUl0QjtBQUNaLFFBQUksS0FBSyxXQUFULEVBQXNCO0FBQ3BCLFdBQUssV0FBTCxHQUFtQixLQUFuQjtBQUNELEtBRkQsTUFFTztBQUNMLFdBQUssSUFBTCxDQUFVLE9BQVYsQ0FBa0IsS0FBSyxZQUFMLENBQWtCLFNBQWxCLEVBQWxCO0FBQ0Q7QUFDRixHQS9JbUM7QUFrSnBDLFNBbEpvQyxxQkFrSnpCO0FBQ1QsU0FBSyxXQUFMLEdBQW1CLElBQW5CO0FBQ0EsU0FBSyxZQUFMLENBQWtCLE9BQWxCLENBQTBCLEtBQUssSUFBTCxDQUFVLFNBQVYsRUFBMUIsRUFDRSxLQUFLLElBQUwsQ0FBVSxPQUFWLEtBQXNCLEtBQUssT0FBTCxDQUFhLFVBRHJDO0FBRUEsU0FBSyxLQUFMLENBQVcsVUFBWCxDQUFzQixLQUFLLEtBQUwsQ0FBVyxnQkFBWCxDQUE0QixLQUFLLElBQUwsQ0FBVSxTQUFWLEVBQTVCLENBQXRCO0FBQ0QsR0F2Sm1DO0FBMEpwQyxnQkExSm9DLDRCQTBKbEI7QUFDaEIsU0FBSyxZQUFMLENBQWtCLE9BQWxCLENBQTBCLEtBQUssS0FBTCxDQUFXLFNBQVgsR0FBdUIsU0FBdkIsRUFBMUI7QUFDRDtBQTVKbUMsQ0FBakIsQ0FBckI7O0FBZ0tBLEVBQUUsT0FBRixDQUFVLFFBQVYsQ0FBbUIsR0FBbkIsR0FBeUIsT0FBekI7O0FBRUE7QUFDQSxFQUFFLE9BQUYsQ0FBVSxRQUFWLEdBQXFCLFVBQUMsT0FBRDtBQUFBLFNBQWEsSUFBSSxFQUFFLE9BQUYsQ0FBVSxRQUFkLENBQXVCLE9BQXZCLENBQWI7QUFBQSxDQUFyQjs7QUFFQSxFQUFFLEdBQUYsQ0FBTSxZQUFOLENBQW1CO0FBQ2pCLG1CQUFpQjtBQURBLENBQW5COztBQUlBLEVBQUUsR0FBRixDQUFNLFdBQU4sQ0FBa0IsWUFBWTtBQUM3QixNQUFJLEtBQUssT0FBTCxDQUFhLGVBQWpCLEVBQWtDO0FBQ2pDLFNBQUssZUFBTCxHQUF1QixJQUFJLEVBQUUsT0FBRixDQUFVLFFBQWQsRUFBdkI7QUFDQSxTQUFLLFVBQUwsQ0FBZ0IsS0FBSyxlQUFyQjtBQUNBO0FBQ0QsQ0FMRDs7QUFPQSxPQUFPLE9BQVAsR0FBaUIsRUFBRSxPQUFGLENBQVUsUUFBM0IiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiaW1wb3J0IE92ZXJ2aWV3IGZyb20gJy4uLyc7XG5cbmNvbnN0IENFTlRFUiAgPSBbMjIuMjY3MCwgMTE0LjE4OF07XG5jb25zdCBaT09NICAgID0gMTM7XG5jb25zdCBPU01fVVJMID0gJ2h0dHA6Ly97c30udGlsZS5vc20ub3JnL3t6fS97eH0ve3l9LnBuZyc7XG5cbmNvbnN0IG1hcCA9IGdsb2JhbC5tYXAgPSBMLm1hcCgnbWFwJykuc2V0VmlldyhDRU5URVIsIFpPT00pO1xuXG5jb25zdCB0aWxlcyA9IEwudGlsZUxheWVyKE9TTV9VUkwsIHtcbiAgYXR0cmlidXRpb246ICcmY29weTsgPGEgaHJlZj1cImh0dHA6Ly9vc20ub3JnL2NvcHlyaWdodFwiPk9wZW5TdHJlZXRNYXA8L2E+IGNvbnRyaWJ1dG9ycydcbn0pLmFkZFRvKG1hcCk7XG5cbm1hcC5hZGRDb250cm9sKG5ldyBPdmVydmlldyhMLnRpbGVMYXllcihPU01fVVJMLCB0aWxlcy5vcHRpb25zKSwge30pKTtcbiIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9zcmMvTC5Db250cm9sLk92ZXJ2aWV3Jyk7XG4iLCJyZXF1aXJlKCcuL3NyYy9TVkcnKTtcbnJlcXVpcmUoJy4vc3JjL1NWRy5WTUwnKTtcbnJlcXVpcmUoJy4vc3JjL0NhbnZhcycpO1xucmVxdWlyZSgnLi9zcmMvUGF0aC5UcmFuc2Zvcm0nKTtcbnJlcXVpcmUoJy4vc3JjL1BhdGguRHJhZycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEwuUGF0aC5EcmFnO1xuIiwiTC5VdGlsLnRydWVGbiA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gdHJ1ZTtcbn07XG5cbkwuQ2FudmFzLmluY2x1ZGUoe1xuXG4gIC8qKlxuICAgKiBEbyBub3RoaW5nXG4gICAqIEBwYXJhbSAge0wuUGF0aH0gbGF5ZXJcbiAgICovXG4gIF9yZXNldFRyYW5zZm9ybVBhdGg6IGZ1bmN0aW9uKGxheWVyKSB7XG4gICAgaWYgKCF0aGlzLl9jb250YWluZXJDb3B5KSByZXR1cm47XG5cbiAgICBkZWxldGUgdGhpcy5fY29udGFpbmVyQ29weTtcblxuICAgIGlmIChsYXllci5fY29udGFpbnNQb2ludF8pIHtcbiAgICAgIGxheWVyLl9jb250YWluc1BvaW50ID0gbGF5ZXIuX2NvbnRhaW5zUG9pbnRfO1xuICAgICAgZGVsZXRlIGxheWVyLl9jb250YWluc1BvaW50XztcblxuICAgICAgdGhpcy5fcmVxdWVzdFJlZHJhdyhsYXllcik7XG4gICAgfVxuICB9LFxuXG5cbiAgLyoqXG4gICAqIEFsZ29yaXRobSBvdXRsaW5lOlxuICAgKlxuICAgKiAxLiBwcmUtdHJhbnNmb3JtIC0gY2xlYXIgdGhlIHBhdGggb3V0IG9mIHRoZSBjYW52YXMsIGNvcHkgY2FudmFzIHN0YXRlXG4gICAqIDIuIGF0IGV2ZXJ5IGZyYW1lOlxuICAgKiAgICAyLjEuIHNhdmVcbiAgICogICAgMi4yLiByZWRyYXcgdGhlIGNhbnZhcyBmcm9tIHNhdmVkIG9uZVxuICAgKiAgICAyLjMuIHRyYW5zZm9ybVxuICAgKiAgICAyLjQuIGRyYXcgcGF0aFxuICAgKiAgICAyLjUuIHJlc3RvcmVcbiAgICpcbiAgICogQHBhcmFtICB7TC5QYXRofSAgICAgICAgIGxheWVyXG4gICAqIEBwYXJhbSAge0FycmF5LjxOdW1iZXI+fSBtYXRyaXhcbiAgICovXG4gIHRyYW5zZm9ybVBhdGg6IGZ1bmN0aW9uKGxheWVyLCBtYXRyaXgpIHtcbiAgICB2YXIgY29weSA9IHRoaXMuX2NvbnRhaW5lckNvcHk7XG4gICAgdmFyIGN0eCA9IHRoaXMuX2N0eDtcbiAgICB2YXIgbSA9IEwuQnJvd3Nlci5yZXRpbmEgPyAyIDogMTtcbiAgICB2YXIgYm91bmRzID0gdGhpcy5fYm91bmRzO1xuICAgIHZhciBzaXplID0gYm91bmRzLmdldFNpemUoKTtcbiAgICB2YXIgcG9zID0gYm91bmRzLm1pbjtcblxuICAgIGlmICghY29weSkge1xuICAgICAgY29weSA9IHRoaXMuX2NvbnRhaW5lckNvcHkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKTtcbiAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoY29weSk7XG5cbiAgICAgIGNvcHkud2lkdGggPSBtICogc2l6ZS54O1xuICAgICAgY29weS5oZWlnaHQgPSBtICogc2l6ZS55O1xuXG4gICAgICBsYXllci5fcmVtb3ZlZCA9IHRydWU7XG4gICAgICB0aGlzLl9yZWRyYXcoKTtcblxuICAgICAgY29weS5nZXRDb250ZXh0KCcyZCcpLnRyYW5zbGF0ZShtICogYm91bmRzLm1pbi54LCBtICogYm91bmRzLm1pbi55KTtcbiAgICAgIGNvcHkuZ2V0Q29udGV4dCgnMmQnKS5kcmF3SW1hZ2UodGhpcy5fY29udGFpbmVyLCAwLCAwKTtcbiAgICAgIHRoaXMuX2luaXRQYXRoKGxheWVyKTtcbiAgICAgIGxheWVyLl9jb250YWluc1BvaW50XyA9IGxheWVyLl9jb250YWluc1BvaW50O1xuICAgICAgbGF5ZXIuX2NvbnRhaW5zUG9pbnQgPSBMLlV0aWwudHJ1ZUZuO1xuICAgIH1cblxuICAgIGN0eC5zYXZlKCk7XG4gICAgY3R4LmNsZWFyUmVjdChwb3MueCwgcG9zLnksIHNpemUueCAqIG0sIHNpemUueSAqIG0pO1xuICAgIGN0eC5zZXRUcmFuc2Zvcm0oMSwgMCwgMCwgMSwgMCwgMCk7XG4gICAgY3R4LnJlc3RvcmUoKTtcbiAgICBjdHguc2F2ZSgpO1xuXG4gICAgY3R4LmRyYXdJbWFnZSh0aGlzLl9jb250YWluZXJDb3B5LCAwLCAwLCBzaXplLngsIHNpemUueSk7XG4gICAgY3R4LnRyYW5zZm9ybS5hcHBseShjdHgsIG1hdHJpeCk7XG5cbiAgICB2YXIgbGF5ZXJzID0gdGhpcy5fbGF5ZXJzO1xuICAgIHRoaXMuX2xheWVycyA9IHt9O1xuXG4gICAgdGhpcy5faW5pdFBhdGgobGF5ZXIpO1xuICAgIGxheWVyLl91cGRhdGVQYXRoKCk7XG5cbiAgICB0aGlzLl9sYXllcnMgPSBsYXllcnM7XG4gICAgY3R4LnJlc3RvcmUoKTtcbiAgfVxuXG59KTtcbiIsIi8qKlxuICogRHJhZyBoYW5kbGVyXG4gKiBAY2xhc3MgTC5QYXRoLkRyYWdcbiAqIEBleHRlbmRzIHtMLkhhbmRsZXJ9XG4gKi9cbkwuSGFuZGxlci5QYXRoRHJhZyA9IEwuSGFuZGxlci5leHRlbmQoIC8qKiBAbGVuZHMgIEwuUGF0aC5EcmFnLnByb3RvdHlwZSAqLyB7XG5cbiAgc3RhdGljczoge1xuICAgIERSQUdHSU5HX0NMUzogJ2xlYWZsZXQtcGF0aC1kcmFnZ2FibGUnLFxuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBwYXJhbSAge0wuUGF0aH0gcGF0aFxuICAgKiBAY29uc3RydWN0b3JcbiAgICovXG4gIGluaXRpYWxpemU6IGZ1bmN0aW9uKHBhdGgpIHtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtMLlBhdGh9XG4gICAgICovXG4gICAgdGhpcy5fcGF0aCA9IHBhdGg7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7QXJyYXkuPE51bWJlcj59XG4gICAgICovXG4gICAgdGhpcy5fbWF0cml4ID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtMLlBvaW50fVxuICAgICAqL1xuICAgIHRoaXMuX3N0YXJ0UG9pbnQgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0wuUG9pbnR9XG4gICAgICovXG4gICAgdGhpcy5fZHJhZ1N0YXJ0UG9pbnQgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0Jvb2xlYW59XG4gICAgICovXG4gICAgdGhpcy5fbWFwRHJhZ2dpbmdXYXNFbmFibGVkID0gZmFsc2U7XG5cbiAgfSxcblxuICAvKipcbiAgICogRW5hYmxlIGRyYWdnaW5nXG4gICAqL1xuICBhZGRIb29rczogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5fcGF0aC5vbignbW91c2Vkb3duJywgdGhpcy5fb25EcmFnU3RhcnQsIHRoaXMpO1xuXG4gICAgdGhpcy5fcGF0aC5vcHRpb25zLmNsYXNzTmFtZSA9IHRoaXMuX3BhdGgub3B0aW9ucy5jbGFzc05hbWUgP1xuICAgICAgICAodGhpcy5fcGF0aC5vcHRpb25zLmNsYXNzTmFtZSArICcgJyArIEwuSGFuZGxlci5QYXRoRHJhZy5EUkFHR0lOR19DTFMpIDpcbiAgICAgICAgIEwuSGFuZGxlci5QYXRoRHJhZy5EUkFHR0lOR19DTFM7XG5cbiAgICBpZiAodGhpcy5fcGF0aC5fcGF0aCkge1xuICAgICAgTC5Eb21VdGlsLmFkZENsYXNzKHRoaXMuX3BhdGguX3BhdGgsIEwuSGFuZGxlci5QYXRoRHJhZy5EUkFHR0lOR19DTFMpO1xuICAgIH1cbiAgfSxcblxuICAvKipcbiAgICogRGlzYWJsZSBkcmFnZ2luZ1xuICAgKi9cbiAgcmVtb3ZlSG9va3M6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuX3BhdGgub2ZmKCdtb3VzZWRvd24nLCB0aGlzLl9vbkRyYWdTdGFydCwgdGhpcyk7XG5cbiAgICB0aGlzLl9wYXRoLm9wdGlvbnMuY2xhc3NOYW1lID0gdGhpcy5fcGF0aC5vcHRpb25zLmNsYXNzTmFtZVxuICAgICAgLnJlcGxhY2UobmV3IFJlZ0V4cCgnXFxcXHMrJyArIEwuSGFuZGxlci5QYXRoRHJhZy5EUkFHR0lOR19DTFMpLCAnJyk7XG4gICAgaWYgKHRoaXMuX3BhdGguX3BhdGgpIHtcbiAgICAgIEwuRG9tVXRpbC5yZW1vdmVDbGFzcyh0aGlzLl9wYXRoLl9wYXRoLCBMLkhhbmRsZXIuUGF0aERyYWcuRFJBR0dJTkdfQ0xTKTtcbiAgICB9XG4gIH0sXG5cbiAgLyoqXG4gICAqIEByZXR1cm4ge0Jvb2xlYW59XG4gICAqL1xuICBtb3ZlZDogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuX3BhdGguX2RyYWdNb3ZlZDtcbiAgfSxcblxuICAvKipcbiAgICogU3RhcnQgZHJhZ1xuICAgKiBAcGFyYW0gIHtMLk1vdXNlRXZlbnR9IGV2dFxuICAgKi9cbiAgX29uRHJhZ1N0YXJ0OiBmdW5jdGlvbihldnQpIHtcbiAgICB2YXIgZXZlbnRUeXBlID0gZXZ0Lm9yaWdpbmFsRXZlbnQuX3NpbXVsYXRlZCA/ICd0b3VjaHN0YXJ0JyA6IGV2dC5vcmlnaW5hbEV2ZW50LnR5cGU7XG5cbiAgICB0aGlzLl9tYXBEcmFnZ2luZ1dhc0VuYWJsZWQgPSBmYWxzZTtcbiAgICB0aGlzLl9zdGFydFBvaW50ID0gZXZ0LmNvbnRhaW5lclBvaW50LmNsb25lKCk7XG4gICAgdGhpcy5fZHJhZ1N0YXJ0UG9pbnQgPSBldnQuY29udGFpbmVyUG9pbnQuY2xvbmUoKTtcbiAgICB0aGlzLl9tYXRyaXggPSBbMSwgMCwgMCwgMSwgMCwgMF07XG4gICAgTC5Eb21FdmVudC5zdG9wKGV2dC5vcmlnaW5hbEV2ZW50KTtcblxuICAgIEwuRG9tVXRpbC5hZGRDbGFzcyh0aGlzLl9wYXRoLl9yZW5kZXJlci5fY29udGFpbmVyLCAnbGVhZmxldC1pbnRlcmFjdGl2ZScpO1xuICAgIEwuRG9tRXZlbnRcbiAgICAgIC5vbihkb2N1bWVudCwgTC5EcmFnZ2FibGUuTU9WRVtldmVudFR5cGVdLCB0aGlzLl9vbkRyYWcsICAgIHRoaXMpXG4gICAgICAub24oZG9jdW1lbnQsIEwuRHJhZ2dhYmxlLkVORFtldmVudFR5cGVdLCAgdGhpcy5fb25EcmFnRW5kLCB0aGlzKTtcblxuICAgIGlmICh0aGlzLl9wYXRoLl9tYXAuZHJhZ2dpbmcuZW5hYmxlZCgpKSB7XG4gICAgICAvLyBJIGd1ZXNzIGl0J3MgcmVxdWlyZWQgYmVjYXVzZSBtb3VzZG93biBnZXRzIHNpbXVsYXRlZCB3aXRoIGEgZGVsYXlcbiAgICAgIC8vdGhpcy5fcGF0aC5fbWFwLmRyYWdnaW5nLl9kcmFnZ2FibGUuX29uVXAoZXZ0KTtcblxuICAgICAgdGhpcy5fcGF0aC5fbWFwLmRyYWdnaW5nLmRpc2FibGUoKTtcbiAgICAgIHRoaXMuX21hcERyYWdnaW5nV2FzRW5hYmxlZCA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMuX3BhdGguX2RyYWdNb3ZlZCA9IGZhbHNlO1xuXG4gICAgaWYgKHRoaXMuX3BhdGguX3BvcHVwKSB7IC8vIHRoYXQgbWlnaHQgYmUgYSBjYXNlIG9uIHRvdWNoIGRldmljZXMgYXMgd2VsbFxuICAgICAgdGhpcy5fcGF0aC5fcG9wdXAuX2Nsb3NlKCk7XG4gICAgfVxuXG4gICAgdGhpcy5fcmVwbGFjZUNvb3JkR2V0dGVycyhldnQpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBEcmFnZ2luZ1xuICAgKiBAcGFyYW0gIHtMLk1vdXNlRXZlbnR9IGV2dFxuICAgKi9cbiAgX29uRHJhZzogZnVuY3Rpb24oZXZ0KSB7XG4gICAgTC5Eb21FdmVudC5zdG9wKGV2dCk7XG5cbiAgICB2YXIgZmlyc3QgPSAoZXZ0LnRvdWNoZXMgJiYgZXZ0LnRvdWNoZXMubGVuZ3RoID49IDEgPyBldnQudG91Y2hlc1swXSA6IGV2dCk7XG4gICAgdmFyIGNvbnRhaW5lclBvaW50ID0gdGhpcy5fcGF0aC5fbWFwLm1vdXNlRXZlbnRUb0NvbnRhaW5lclBvaW50KGZpcnN0KTtcblxuICAgIHZhciB4ID0gY29udGFpbmVyUG9pbnQueDtcbiAgICB2YXIgeSA9IGNvbnRhaW5lclBvaW50Lnk7XG5cbiAgICB2YXIgZHggPSB4IC0gdGhpcy5fc3RhcnRQb2ludC54O1xuICAgIHZhciBkeSA9IHkgLSB0aGlzLl9zdGFydFBvaW50Lnk7XG5cbiAgICBpZiAoIXRoaXMuX3BhdGguX2RyYWdNb3ZlZCAmJiAoZHggfHwgZHkpKSB7XG4gICAgICB0aGlzLl9wYXRoLl9kcmFnTW92ZWQgPSB0cnVlO1xuICAgICAgdGhpcy5fcGF0aC5maXJlKCdkcmFnc3RhcnQnLCBldnQpO1xuICAgICAgLy8gd2UgZG9uJ3Qgd2FudCB0aGF0IHRvIGhhcHBlbiBvbiBjbGlja1xuICAgICAgdGhpcy5fcGF0aC5icmluZ1RvRnJvbnQoKTtcbiAgICB9XG5cbiAgICB0aGlzLl9tYXRyaXhbNF0gKz0gZHg7XG4gICAgdGhpcy5fbWF0cml4WzVdICs9IGR5O1xuXG4gICAgdGhpcy5fc3RhcnRQb2ludC54ID0geDtcbiAgICB0aGlzLl9zdGFydFBvaW50LnkgPSB5O1xuXG4gICAgdGhpcy5fcGF0aC5maXJlKCdwcmVkcmFnJywgZXZ0KTtcbiAgICB0aGlzLl9wYXRoLl90cmFuc2Zvcm0odGhpcy5fbWF0cml4KTtcbiAgICB0aGlzLl9wYXRoLmZpcmUoJ2RyYWcnLCBldnQpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBEcmFnZ2luZyBzdG9wcGVkLCBhcHBseVxuICAgKiBAcGFyYW0gIHtMLk1vdXNlRXZlbnR9IGV2dFxuICAgKi9cbiAgX29uRHJhZ0VuZDogZnVuY3Rpb24oZXZ0KSB7XG4gICAgdmFyIGNvbnRhaW5lclBvaW50ID0gdGhpcy5fcGF0aC5fbWFwLm1vdXNlRXZlbnRUb0NvbnRhaW5lclBvaW50KGV2dCk7XG4gICAgdmFyIG1vdmVkID0gdGhpcy5tb3ZlZCgpO1xuXG4gICAgLy8gYXBwbHkgbWF0cml4XG4gICAgaWYgKG1vdmVkKSB7XG4gICAgICB0aGlzLl90cmFuc2Zvcm1Qb2ludHModGhpcy5fbWF0cml4KTtcbiAgICAgIHRoaXMuX3BhdGguX3VwZGF0ZVBhdGgoKTtcbiAgICAgIHRoaXMuX3BhdGguX3Byb2plY3QoKTtcbiAgICAgIHRoaXMuX3BhdGguX3RyYW5zZm9ybShudWxsKTtcblxuICAgICAgTC5Eb21FdmVudC5zdG9wKGV2dCk7XG4gICAgfVxuXG5cbiAgICBMLkRvbUV2ZW50XG4gICAgICAub2ZmKGRvY3VtZW50LCAnbW91c2Vtb3ZlIHRvdWNobW92ZScsIHRoaXMuX29uRHJhZywgdGhpcylcbiAgICAgIC5vZmYoZG9jdW1lbnQsICdtb3VzZXVwIHRvdWNoZW5kJywgICAgdGhpcy5fb25EcmFnRW5kLCB0aGlzKTtcblxuICAgIHRoaXMuX3Jlc3RvcmVDb29yZEdldHRlcnMoKTtcblxuICAgIC8vIGNvbnNpc3RlbmN5XG4gICAgaWYgKG1vdmVkKSB7XG4gICAgICB0aGlzLl9wYXRoLmZpcmUoJ2RyYWdlbmQnLCB7XG4gICAgICAgIGRpc3RhbmNlOiBNYXRoLnNxcnQoXG4gICAgICAgICAgTC5MaW5lVXRpbC5fc3FEaXN0KHRoaXMuX2RyYWdTdGFydFBvaW50LCBjb250YWluZXJQb2ludClcbiAgICAgICAgKVxuICAgICAgfSk7XG5cbiAgICAgIC8vIGhhY2sgZm9yIHNraXBwaW5nIHRoZSBjbGljayBpbiBjYW52YXMtcmVuZGVyZWQgbGF5ZXJzXG4gICAgICB2YXIgY29udGFpbnMgPSB0aGlzLl9wYXRoLl9jb250YWluc1BvaW50O1xuICAgICAgdGhpcy5fcGF0aC5fY29udGFpbnNQb2ludCA9IEwuVXRpbC5mYWxzZUZuO1xuICAgICAgTC5VdGlsLnJlcXVlc3RBbmltRnJhbWUoZnVuY3Rpb24oKSB7XG4gICAgICAgIEwuRG9tRXZlbnQuX3NraXBwZWQoeyB0eXBlOiAnY2xpY2snIH0pO1xuICAgICAgICB0aGlzLl9wYXRoLl9jb250YWluc1BvaW50ID0gY29udGFpbnM7XG4gICAgICB9LCB0aGlzKTtcbiAgICB9XG5cbiAgICB0aGlzLl9tYXRyaXggICAgICAgICAgPSBudWxsO1xuICAgIHRoaXMuX3N0YXJ0UG9pbnQgICAgICA9IG51bGw7XG4gICAgdGhpcy5fZHJhZ1N0YXJ0UG9pbnQgID0gbnVsbDtcbiAgICB0aGlzLl9wYXRoLl9kcmFnTW92ZWQgPSBmYWxzZTtcblxuICAgIGlmICh0aGlzLl9tYXBEcmFnZ2luZ1dhc0VuYWJsZWQpIHtcbiAgICAgIGlmIChtb3ZlZCkgTC5Eb21FdmVudC5fZmFrZVN0b3AoeyB0eXBlOiAnY2xpY2snIH0pO1xuICAgICAgdGhpcy5fcGF0aC5fbWFwLmRyYWdnaW5nLmVuYWJsZSgpO1xuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBBcHBsaWVzIHRyYW5zZm9ybWF0aW9uLCBkb2VzIGl0IGluIG9uZSBzd2VlcCBmb3IgcGVyZm9ybWFuY2UsXG4gICAqIHNvIGRvbid0IGJlIHN1cnByaXNlZCBhYm91dCB0aGUgY29kZSByZXBldGl0aW9uLlxuICAgKlxuICAgKiBbIHggXSAgIFsgYSAgYiAgdHggXSBbIHggXSAgIFsgYSAqIHggKyBiICogeSArIHR4IF1cbiAgICogWyB5IF0gPSBbIGMgIGQgIHR5IF0gWyB5IF0gPSBbIGMgKiB4ICsgZCAqIHkgKyB0eSBdXG4gICAqXG4gICAqIEBwYXJhbSB7QXJyYXkuPE51bWJlcj59IG1hdHJpeFxuICAgKi9cbiAgX3RyYW5zZm9ybVBvaW50czogZnVuY3Rpb24obWF0cml4LCBkZXN0KSB7XG4gICAgdmFyIHBhdGggPSB0aGlzLl9wYXRoO1xuICAgIHZhciBpLCBsZW4sIGxhdGxuZztcblxuICAgIHZhciBweCA9IEwucG9pbnQobWF0cml4WzRdLCBtYXRyaXhbNV0pO1xuXG4gICAgdmFyIGNycyA9IHBhdGguX21hcC5vcHRpb25zLmNycztcbiAgICB2YXIgdHJhbnNmb3JtYXRpb24gPSBjcnMudHJhbnNmb3JtYXRpb247XG4gICAgdmFyIHNjYWxlID0gY3JzLnNjYWxlKHBhdGguX21hcC5nZXRab29tKCkpO1xuICAgIHZhciBwcm9qZWN0aW9uID0gY3JzLnByb2plY3Rpb247XG5cbiAgICB2YXIgZGlmZiA9IHRyYW5zZm9ybWF0aW9uLnVudHJhbnNmb3JtKHB4LCBzY2FsZSlcbiAgICAgIC5zdWJ0cmFjdCh0cmFuc2Zvcm1hdGlvbi51bnRyYW5zZm9ybShMLnBvaW50KDAsIDApLCBzY2FsZSkpO1xuICAgIHZhciBhcHBseVRyYW5zZm9ybSA9ICFkZXN0O1xuXG4gICAgcGF0aC5fYm91bmRzID0gbmV3IEwuTGF0TG5nQm91bmRzKCk7XG5cbiAgICAvLyBjb25zb2xlLnRpbWUoJ3RyYW5zZm9ybScpO1xuICAgIC8vIGFsbCBzaGlmdHMgYXJlIGluLXBsYWNlXG4gICAgaWYgKHBhdGguX3BvaW50KSB7IC8vIEwuQ2lyY2xlXG4gICAgICBkZXN0ID0gcHJvamVjdGlvbi51bnByb2plY3QoXG4gICAgICAgIHByb2plY3Rpb24ucHJvamVjdChwYXRoLl9sYXRsbmcpLl9hZGQoZGlmZikpO1xuICAgICAgaWYgKGFwcGx5VHJhbnNmb3JtKSB7XG4gICAgICAgIHBhdGguX2xhdGxuZyA9IGRlc3Q7XG4gICAgICAgIHBhdGguX3BvaW50Ll9hZGQocHgpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAocGF0aC5fcmluZ3MgfHwgcGF0aC5fcGFydHMpIHsgLy8gZXZlcnl0aGluZyBlbHNlXG4gICAgICB2YXIgcmluZ3MgICA9IHBhdGguX3JpbmdzIHx8IHBhdGguX3BhcnRzO1xuICAgICAgdmFyIGxhdGxuZ3MgPSBwYXRoLl9sYXRsbmdzO1xuICAgICAgZGVzdCA9IGRlc3QgfHwgbGF0bG5ncztcbiAgICAgIGlmICghTC5VdGlsLmlzQXJyYXkobGF0bG5nc1swXSkpIHsgLy8gcG9seWxpbmVcbiAgICAgICAgbGF0bG5ncyA9IFtsYXRsbmdzXTtcbiAgICAgICAgZGVzdCAgICA9IFtkZXN0XTtcbiAgICAgIH1cbiAgICAgIGZvciAoaSA9IDAsIGxlbiA9IHJpbmdzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgIGRlc3RbaV0gPSBkZXN0W2ldIHx8IFtdO1xuICAgICAgICBmb3IgKHZhciBqID0gMCwgamogPSByaW5nc1tpXS5sZW5ndGg7IGogPCBqajsgaisrKSB7XG4gICAgICAgICAgbGF0bG5nICAgICA9IGxhdGxuZ3NbaV1bal07XG4gICAgICAgICAgZGVzdFtpXVtqXSA9IHByb2plY3Rpb25cbiAgICAgICAgICAgIC51bnByb2plY3QocHJvamVjdGlvbi5wcm9qZWN0KGxhdGxuZykuX2FkZChkaWZmKSk7XG4gICAgICAgICAgaWYgKGFwcGx5VHJhbnNmb3JtKSB7XG4gICAgICAgICAgICBwYXRoLl9ib3VuZHMuZXh0ZW5kKGxhdGxuZ3NbaV1bal0pO1xuICAgICAgICAgICAgcmluZ3NbaV1bal0uX2FkZChweCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBkZXN0O1xuICAgIC8vIGNvbnNvbGUudGltZUVuZCgndHJhbnNmb3JtJyk7XG4gIH0sXG5cblxuXG4gIC8qKlxuICAgKiBJZiB5b3Ugd2FudCB0byByZWFkIHRoZSBsYXRsbmdzIGR1cmluZyB0aGUgZHJhZyAtIHlvdXIgcmlnaHQsXG4gICAqIGJ1dCB0aGV5IGhhdmUgdG8gYmUgdHJhbnNmb3JtZWRcbiAgICovXG4gIF9yZXBsYWNlQ29vcmRHZXR0ZXJzOiBmdW5jdGlvbigpIHtcbiAgICBpZiAodGhpcy5fcGF0aC5nZXRMYXRMbmcpIHsgLy8gQ2lyY2xlLCBDaXJjbGVNYXJrZXJcbiAgICAgIHRoaXMuX3BhdGguZ2V0TGF0TG5nXyA9IHRoaXMuX3BhdGguZ2V0TGF0TG5nO1xuICAgICAgdGhpcy5fcGF0aC5nZXRMYXRMbmcgPSBMLlV0aWwuYmluZChmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZHJhZ2dpbmcuX3RyYW5zZm9ybVBvaW50cyh0aGlzLmRyYWdnaW5nLl9tYXRyaXgsIHt9KTtcbiAgICAgIH0sIHRoaXMuX3BhdGgpO1xuICAgIH0gZWxzZSBpZiAodGhpcy5fcGF0aC5nZXRMYXRMbmdzKSB7XG4gICAgICB0aGlzLl9wYXRoLmdldExhdExuZ3NfID0gdGhpcy5fcGF0aC5nZXRMYXRMbmdzO1xuICAgICAgdGhpcy5fcGF0aC5nZXRMYXRMbmdzID0gTC5VdGlsLmJpbmQoZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmRyYWdnaW5nLl90cmFuc2Zvcm1Qb2ludHModGhpcy5kcmFnZ2luZy5fbWF0cml4LCBbXSk7XG4gICAgICB9LCB0aGlzLl9wYXRoKTtcbiAgICB9XG4gIH0sXG5cblxuICAvKipcbiAgICogUHV0IGJhY2sgdGhlIGdldHRlcnNcbiAgICovXG4gIF9yZXN0b3JlQ29vcmRHZXR0ZXJzOiBmdW5jdGlvbigpIHtcbiAgICBpZiAodGhpcy5fcGF0aC5nZXRMYXRMbmdfKSB7XG4gICAgICB0aGlzLl9wYXRoLmdldExhdExuZyA9IHRoaXMuX3BhdGguZ2V0TGF0TG5nXztcbiAgICAgIGRlbGV0ZSB0aGlzLl9wYXRoLmdldExhdExuZ187XG4gICAgfSBlbHNlIGlmICh0aGlzLl9wYXRoLmdldExhdExuZ3NfKSB7XG4gICAgICB0aGlzLl9wYXRoLmdldExhdExuZ3MgPSB0aGlzLl9wYXRoLmdldExhdExuZ3NfO1xuICAgICAgZGVsZXRlIHRoaXMuX3BhdGguZ2V0TGF0TG5nc187XG4gICAgfVxuICB9XG5cbn0pO1xuXG5cbi8qKlxuICogQHBhcmFtICB7TC5QYXRofSBsYXllclxuICogQHJldHVybiB7TC5QYXRofVxuICovXG5MLkhhbmRsZXIuUGF0aERyYWcubWFrZURyYWdnYWJsZSA9IGZ1bmN0aW9uKGxheWVyKSB7XG4gIGxheWVyLmRyYWdnaW5nID0gbmV3IEwuSGFuZGxlci5QYXRoRHJhZyhsYXllcik7XG4gIHJldHVybiBsYXllcjtcbn07XG5cblxuLyoqXG4gKiBBbHNvIGV4cG9zZSBhcyBhIG1ldGhvZFxuICogQHJldHVybiB7TC5QYXRofVxuICovXG5MLlBhdGgucHJvdG90eXBlLm1ha2VEcmFnZ2FibGUgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIEwuSGFuZGxlci5QYXRoRHJhZy5tYWtlRHJhZ2dhYmxlKHRoaXMpO1xufTtcblxuXG5MLlBhdGguYWRkSW5pdEhvb2soZnVuY3Rpb24oKSB7XG4gIGlmICh0aGlzLm9wdGlvbnMuZHJhZ2dhYmxlKSB7XG4gICAgLy8gZW5zdXJlIGludGVyYWN0aXZlXG4gICAgdGhpcy5vcHRpb25zLmludGVyYWN0aXZlID0gdHJ1ZTtcblxuICAgIGlmICh0aGlzLmRyYWdnaW5nKSB7XG4gICAgICB0aGlzLmRyYWdnaW5nLmVuYWJsZSgpO1xuICAgIH0gZWxzZSB7XG4gICAgICBMLkhhbmRsZXIuUGF0aERyYWcubWFrZURyYWdnYWJsZSh0aGlzKTtcbiAgICAgIHRoaXMuZHJhZ2dpbmcuZW5hYmxlKCk7XG4gICAgfVxuICB9IGVsc2UgaWYgKHRoaXMuZHJhZ2dpbmcpIHtcbiAgICB0aGlzLmRyYWdnaW5nLmRpc2FibGUoKTtcbiAgfVxufSk7XG4iLCIvKipcbiAqIExlYWZsZXQgdmVjdG9yIGZlYXR1cmVzIGRyYWcgZnVuY3Rpb25hbGl0eVxuICogQGF1dGhvciBBbGV4YW5kZXIgTWlsZXZza2kgPGluZm9AdzhyLm5hbWU+XG4gKiBAcHJlc2VydmVcbiAqL1xuXG4vKipcbiAqIE1hdHJpeCB0cmFuc2Zvcm0gcGF0aCBmb3IgU1ZHL1ZNTFxuICogUmVuZGVyZXItaW5kZXBlbmRlbnRcbiAqL1xuTC5QYXRoLmluY2x1ZGUoe1xuXG5cdC8qKlxuXHQgKiBBcHBsaWVzIG1hdHJpeCB0cmFuc2Zvcm1hdGlvbiB0byBTVkdcblx0ICogQHBhcmFtIHtBcnJheS48TnVtYmVyPj99IG1hdHJpeFxuXHQgKi9cblx0X3RyYW5zZm9ybTogZnVuY3Rpb24obWF0cml4KSB7XG5cdFx0aWYgKHRoaXMuX3JlbmRlcmVyKSB7XG5cdFx0XHRpZiAobWF0cml4KSB7XG5cdFx0XHRcdHRoaXMuX3JlbmRlcmVyLnRyYW5zZm9ybVBhdGgodGhpcywgbWF0cml4KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIHJlc2V0IHRyYW5zZm9ybSBtYXRyaXhcblx0XHRcdFx0dGhpcy5fcmVuZGVyZXIuX3Jlc2V0VHJhbnNmb3JtUGF0aCh0aGlzKTtcblx0XHRcdFx0dGhpcy5fdXBkYXRlKCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBDaGVjayBpZiB0aGUgZmVhdHVyZSB3YXMgZHJhZ2dlZCwgdGhhdCdsbCBzdXByZXNzIHRoZSBjbGljayBldmVudFxuXHQgKiBvbiBtb3VzZXVwLiBUaGF0IGZpeGVzIHBvcHVwcyBmb3IgZXhhbXBsZVxuXHQgKlxuXHQgKiBAcGFyYW0gIHtNb3VzZUV2ZW50fSBlXG5cdCAqL1xuXHRfb25Nb3VzZUNsaWNrOiBmdW5jdGlvbihlKSB7XG5cdFx0aWYgKCh0aGlzLmRyYWdnaW5nICYmIHRoaXMuZHJhZ2dpbmcubW92ZWQoKSkgfHxcblx0XHRcdCh0aGlzLl9tYXAuZHJhZ2dpbmcgJiYgdGhpcy5fbWFwLmRyYWdnaW5nLm1vdmVkKCkpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fZmlyZU1vdXNlRXZlbnQoZSk7XG5cdH1cblxufSk7XG4iLCJMLlNWRy5pbmNsdWRlKCFMLkJyb3dzZXIudm1sID8ge30gOiB7XG5cblx0LyoqXG5cdCAqIFJlc2V0IHRyYW5zZm9ybSBtYXRyaXhcblx0ICovXG5cdF9yZXNldFRyYW5zZm9ybVBhdGg6IGZ1bmN0aW9uKGxheWVyKSB7XG5cdFx0aWYgKGxheWVyLl9za2V3KSB7XG5cdFx0XHQvLyBzdXBlciBpbXBvcnRhbnQhIHdvcmthcm91bmQgZm9yIGEgJ2p1bXBpbmcnIGdsaXRjaDpcblx0XHRcdC8vIGRpc2FibGUgdHJhbnNmb3JtIGJlZm9yZSByZW1vdmluZyBpdFxuXHRcdFx0bGF5ZXIuX3NrZXcub24gPSBmYWxzZTtcblx0XHRcdGxheWVyLl9wYXRoLnJlbW92ZUNoaWxkKGxheWVyLl9za2V3KTtcblx0XHRcdGxheWVyLl9za2V3ID0gbnVsbDtcblx0XHR9XG5cdH0sXG5cblx0LyoqXG5cdCAqIEFwcGxpZXMgbWF0cml4IHRyYW5zZm9ybWF0aW9uIHRvIFZNTFxuXHQgKiBAcGFyYW0ge0wuUGF0aH0gICAgICAgICBsYXllclxuXHQgKiBAcGFyYW0ge0FycmF5LjxOdW1iZXI+fSBtYXRyaXhcblx0ICovXG5cdHRyYW5zZm9ybVBhdGg6IGZ1bmN0aW9uKGxheWVyLCBtYXRyaXgpIHtcblx0XHR2YXIgc2tldyA9IGxheWVyLl9za2V3O1xuXG5cdFx0aWYgKCFza2V3KSB7XG5cdFx0XHRza2V3ID0gTC5TVkcuY3JlYXRlKCdza2V3Jyk7XG5cdFx0XHRsYXllci5fcGF0aC5hcHBlbmRDaGlsZChza2V3KTtcblx0XHRcdHNrZXcuc3R5bGUuYmVoYXZpb3IgPSAndXJsKCNkZWZhdWx0I1ZNTCknO1xuXHRcdFx0bGF5ZXIuX3NrZXcgPSBza2V3O1xuXHRcdH1cblxuXHRcdC8vIGhhbmRsZSBza2V3L3RyYW5zbGF0ZSBzZXBhcmF0ZWx5LCBjYXVzZSBpdCdzIGJyb2tlblxuXHRcdHZhciBtdCA9IG1hdHJpeFswXS50b0ZpeGVkKDgpICsgJyAnICsgbWF0cml4WzFdLnRvRml4ZWQoOCkgKyAnICcgK1xuXHRcdFx0bWF0cml4WzJdLnRvRml4ZWQoOCkgKyAnICcgKyBtYXRyaXhbM10udG9GaXhlZCg4KSArICcgMCAwJztcblx0XHR2YXIgb2Zmc2V0ID0gTWF0aC5mbG9vcihtYXRyaXhbNF0pLnRvRml4ZWQoKSArICcsICcgK1xuXHRcdFx0TWF0aC5mbG9vcihtYXRyaXhbNV0pLnRvRml4ZWQoKSArICcnO1xuXG5cdFx0dmFyIHMgPSB0aGlzLl9wYXRoLnN0eWxlO1xuXHRcdHZhciBsID0gcGFyc2VGbG9hdChzLmxlZnQpO1xuXHRcdHZhciB0ID0gcGFyc2VGbG9hdChzLnRvcCk7XG5cdFx0dmFyIHcgPSBwYXJzZUZsb2F0KHMud2lkdGgpO1xuXHRcdHZhciBoID0gcGFyc2VGbG9hdChzLmhlaWdodCk7XG5cblx0XHRpZiAoaXNOYU4obCkpICAgICAgIGwgPSAwO1xuXHRcdGlmIChpc05hTih0KSkgICAgICAgdCA9IDA7XG5cdFx0aWYgKGlzTmFOKHcpIHx8ICF3KSB3ID0gMTtcblx0XHRpZiAoaXNOYU4oaCkgfHwgIWgpIGggPSAxO1xuXG5cdFx0dmFyIG9yaWdpbiA9ICgtbCAvIHcgLSAwLjUpLnRvRml4ZWQoOCkgKyAnICcgKyAoLXQgLyBoIC0gMC41KS50b0ZpeGVkKDgpO1xuXG5cdFx0c2tldy5vbiA9ICdmJztcblx0XHRza2V3Lm1hdHJpeCA9IG10O1xuXHRcdHNrZXcub3JpZ2luID0gb3JpZ2luO1xuXHRcdHNrZXcub2Zmc2V0ID0gb2Zmc2V0O1xuXHRcdHNrZXcub24gPSB0cnVlO1xuXHR9XG5cbn0pO1xuIiwiTC5TVkcuaW5jbHVkZSh7XG5cblx0LyoqXG5cdCAqIFJlc2V0IHRyYW5zZm9ybSBtYXRyaXhcblx0ICovXG5cdF9yZXNldFRyYW5zZm9ybVBhdGg6IGZ1bmN0aW9uKGxheWVyKSB7XG5cdFx0bGF5ZXIuX3BhdGguc2V0QXR0cmlidXRlTlMobnVsbCwgJ3RyYW5zZm9ybScsICcnKTtcblx0fSxcblxuXHQvKipcblx0ICogQXBwbGllcyBtYXRyaXggdHJhbnNmb3JtYXRpb24gdG8gU1ZHXG5cdCAqIEBwYXJhbSB7TC5QYXRofSAgICAgICAgIGxheWVyXG5cdCAqIEBwYXJhbSB7QXJyYXkuPE51bWJlcj59IG1hdHJpeFxuXHQgKi9cblx0dHJhbnNmb3JtUGF0aDogZnVuY3Rpb24obGF5ZXIsIG1hdHJpeCkge1xuXHRcdGxheWVyLl9wYXRoLnNldEF0dHJpYnV0ZU5TKG51bGwsICd0cmFuc2Zvcm0nLFxuXHRcdFx0J21hdHJpeCgnICsgbWF0cml4LmpvaW4oJyAnKSArICcpJyk7XG5cdH1cblxufSk7XG4iLCJyZXF1aXJlKCdsZWFmbGV0LXBhdGgtZHJhZycpO1xuXG5jb25zdCBNaW5pbWFwID0gTC5NYXAuZXh0ZW5kKHt9KTtcblxuLyoqXG4gKiBAY2xhc3MgTC5Db250cm9sLk92ZXJ2aWV3XG4gKiBAZXh0ZW5kcyB7TC5Db250cm9sfVxuICovXG5MLkNvbnRyb2wuT3ZlcnZpZXcgPSBMLkNvbnRyb2wuZXh0ZW5kKHtcblxuICBvcHRpb25zOiB7XG4gICAgcG9zaXRpb246ICdib3R0b21yaWdodCcsXG5cbiAgICByZWFjdGFuZ2xlOiAgICAgICB0cnVlLFxuICAgIHJlY3RhbmdsZUNsYXNzOiAgIEwuUmVjdGFuZ2xlLFxuICAgIHJlY3RhbmdsZU9wdGlvbnM6IHtcbiAgICAgIGRyYWdnYWJsZTogdHJ1ZSxcbiAgICAgIHdlaWdodDogICAgMlxuICAgIH0sXG5cbiAgICBtYXBPcHRpb25zOiAgICAgICB7XG4gICAgICBhdHRyaWJ1dGlvbkNvbnRyb2w6IGZhbHNlLFxuICAgICAgem9vbUNvbnRyb2w6ICAgICAgICBmYWxzZSxcbiAgICAgIGJveFpvb206ICAgICAgICAgICAgZmFsc2VcbiAgICB9LFxuICAgIHpvb21PZmZzZXQ6ICAgICAgIDMsXG4gICAgYXV0b0RldGVjdExheWVyczogdHJ1ZSxcbiAgICBmaWx0ZXJMYXllcnM6ICAgICBsYXllciA9PiAoXG4gICAgICBsYXllciBpbnN0YW5jZW9mIEwuVGlsZUxheWVyICAgIHx8XG4gICAgICBsYXllciBpbnN0YW5jZW9mIEwuSW1hZ2VPdmVybGF5IHx8XG4gICAgICBsYXllciBpbnN0YW5jZW9mIEwuRGl2T3ZlcmxheVxuICAgICksXG5cbiAgICBtaW5pbWFwQ2xhc3M6IE1pbmltYXAsXG5cbiAgICBjbGFzc05hbWU6ICAgICAgICAgICdsZWFmbGV0LWJhciBsZWFmbGV0LW92ZXJ2aWV3JyxcbiAgICBtYXBDbGFzc05hbWU6ICAgICAgICdsZWFmbGV0LW92ZXJ2aWV3LS1tYXAnLFxuICAgIHJlY3RhbmdsZUNsYXNzTmFtZTogJ2xlYWZsZXQtb3ZlcnZpZXctLXJlY3RhbmdsZScsXG4gIH0sXG5cbiAgLyoqXG4gICAqIEBjb25zdHJ1Y3RvclxuICAgKiBAcGFyYW0ge09iamVjdH1cbiAgICovXG4gIGluaXRpYWxpemUgKGxheWVycywgb3B0aW9ucykge1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0wuTWFwfVxuICAgICAqL1xuICAgIHRoaXMuX292ZXJ2aWV3bWFwID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtMLlJlY3RhbmdsZX1cbiAgICAgKi9cbiAgICB0aGlzLl9yZWN0YW5nbGUgICA9IG51bGw7XG5cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtCb29sZWFufVxuICAgICAqL1xuICAgIHRoaXMuX3NraXBVcGRhdGUgID0gZmFsc2U7XG5cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtBcnJheS48TC5MYXllcj59XG4gICAgICovXG4gICAgdGhpcy5fbGF5ZXJzICAgICAgPSBMLlV0aWwuaXNBcnJheShsYXllcnMpID8gbGF5ZXJzIDogW2xheWVyc107XG5cbiAgICBMLkNvbnRyb2wucHJvdG90eXBlLmluaXRpYWxpemUuY2FsbCh0aGlzLCBvcHRpb25zKTtcbiAgfSxcblxuXG4gIG9uQWRkIChtYXApIHtcbiAgICB0aGlzLl9jb250YWluZXIgPSBMLkRvbVV0aWwuY3JlYXRlKCdkaXYnLCB0aGlzLm9wdGlvbnMuY2xhc3NOYW1lKTtcbiAgICBMLkRvbUV2ZW50XG4gICAgICAuZGlzYWJsZVNjcm9sbFByb3BhZ2F0aW9uKHRoaXMuX2NvbnRhaW5lcilcbiAgICAgIC5kaXNhYmxlQ2xpY2tQcm9wYWdhdGlvbih0aGlzLl9jb250YWluZXIpO1xuXG4gICAgdGhpcy5fbWFwQ29udGFpbmVyID0gTC5Eb21VdGlsLmNyZWF0ZSgnZGl2JyxcbiAgICAgIHRoaXMub3B0aW9ucy5tYXBDbGFzc05hbWUsIHRoaXMuX2NvbnRhaW5lcik7XG5cbiAgICBtYXBcbiAgICAgIC5vbignbW92ZWVuZCB6b29tZW5kIHZpZXdyZXNldCcsIHRoaXMuX3VwZGF0ZSwgdGhpcylcbiAgICAgIC5vbignbGF5ZXJhZGQnLCB0aGlzLl9vbkxheWVyQWRkZWQsIHRoaXMpO1xuXG4gICAgdGhpcy5fY3JlYXRlTWFwKCk7XG5cbiAgICByZXR1cm4gdGhpcy5fY29udGFpbmVyO1xuICB9LFxuXG5cbiAgb25SZW1vdmUgKG1hcCkge1xuICAgIHRoaXMuX292ZXJ2aWV3bWFwLnJlbW92ZUxheWVyKHRoaXMuX3JlY3RhbmdsZSk7XG4gICAgdGhpcy5fb3ZlcnZpZXdtYXAucmVtb3ZlKCk7XG4gICAgdGhpcy5fb3ZlcnZpZXdtYXAgPSB0aGlzLl9yZWN0YW5nbGUgPSBudWxsO1xuXG4gICAgbWFwXG4gICAgICAub2ZmKCdtb3ZlZW5kIHpvb21lbmQgdmlld3Jlc2V0JywgdGhpcy5fdXBkYXRlLCB0aGlzKVxuICAgICAgLm9mZignbGF5ZXJhZGQnLCB0aGlzLl9vbkxheWVyQWRkZWQsIHRoaXMpO1xuICB9LFxuXG5cbiAgZ2V0IHJlY3RhbmdsZSAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX3JlY3Q7XG4gIH0sXG5cblxuICBnZXQgb3ZlcnZpZXcgKCkge1xuICAgIHJldHVybiB0aGlzLl9vdmVydmlld21hcDtcbiAgfSxcblxuXG4gIF9jcmVhdGVNYXAgKCkge1xuICAgIEwuVXRpbC5yZXF1ZXN0QW5pbUZyYW1lKCgpID0+IHtcbiAgICAgIGNvbnN0IE92ZXJ2aWV3TWFwID0gdGhpcy5vcHRpb25zLm1pbmltYXBDbGFzcztcbiAgICAgIHRoaXMuX292ZXJ2aWV3bWFwID0gbmV3IE92ZXJ2aWV3TWFwKFxuICAgICAgICB0aGlzLl9tYXBDb250YWluZXIsXG4gICAgICAgIHRoaXMub3B0aW9ucy5tYXBPcHRpb25zKVxuICAgICAgICAuc2V0Vmlldyh0aGlzLl9tYXAuZ2V0Q2VudGVyKCksXG4gICAgICAgICAgdGhpcy5fbWFwLmdldFpvb20oKSAtIHRoaXMub3B0aW9ucy56b29tT2Zmc2V0KTtcblxuICAgICAgdGhpcy5fb3ZlcnZpZXdtYXAub24oJ21vdmVlbmQnLCB0aGlzLl9vbk1vdmVlbmQsIHRoaXMpO1xuICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHRoaXMuX2xheWVycy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICB0aGlzLl9vdmVydmlld21hcC5hZGRMYXllcih0aGlzLl9sYXllcnNbaV0pO1xuICAgICAgfVxuICAgICAgdGhpcy5fY3JlYXRlUmVjdCgpO1xuICAgIH0pO1xuICB9LFxuXG5cbiAgX2NyZWF0ZVJlY3QgKCkge1xuICAgIGNvbnN0IFJlY3RhbmdsZSA9IHRoaXMub3B0aW9ucy5yZWN0YW5nbGVDbGFzcztcbiAgICB0aGlzLl9yZWN0ID0gbmV3IFJlY3RhbmdsZSh0aGlzLl9tYXAuZ2V0Qm91bmRzKCksXG4gICAgICBMLlV0aWwuZXh0ZW5kKHsgY2xhc3NOYW1lOiB0aGlzLm9wdGlvbnMucmVjdGFuZ2xlQ2xhc3NOYW1lIH0sXG4gICAgICAgIHRoaXMub3B0aW9ucy5yZWN0YW5nbGVPcHRpb25zKSk7XG4gICAgdGhpcy5fcmVjdC5vbignZHJhZ2VuZCcsIHRoaXMuX29uUmVjdERyYWdlbmQsIHRoaXMpO1xuICAgIHRoaXMuX292ZXJ2aWV3bWFwLmFkZExheWVyKHRoaXMuX3JlY3QpO1xuICB9LFxuXG5cbiAgX29uTGF5ZXJBZGRlZCAoZXZ0KSB7XG4gICAgY29uc29sZS5sb2coZXZ0KTtcbiAgfSxcblxuXG4gIF9vbk1vdmVlbmQgKCkge1xuICAgIGlmICh0aGlzLl9za2lwVXBkYXRlKSB7XG4gICAgICB0aGlzLl9za2lwVXBkYXRlID0gZmFsc2U7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX21hcC5zZXRWaWV3KHRoaXMuX292ZXJ2aWV3bWFwLmdldENlbnRlcigpKTtcbiAgICB9XG4gIH0sXG5cblxuICBfdXBkYXRlICgpIHtcbiAgICB0aGlzLl9za2lwVXBkYXRlID0gdHJ1ZTtcbiAgICB0aGlzLl9vdmVydmlld21hcC5zZXRWaWV3KHRoaXMuX21hcC5nZXRDZW50ZXIoKSxcbiAgICAgIHRoaXMuX21hcC5nZXRab29tKCkgLSB0aGlzLm9wdGlvbnMuem9vbU9mZnNldCk7XG4gICAgdGhpcy5fcmVjdC5zZXRMYXRMbmdzKHRoaXMuX3JlY3QuX2JvdW5kc1RvTGF0TG5ncyh0aGlzLl9tYXAuZ2V0Qm91bmRzKCkpKTtcbiAgfSxcblxuXG4gIF9vblJlY3REcmFnZW5kICgpIHtcbiAgICB0aGlzLl9vdmVydmlld21hcC5zZXRWaWV3KHRoaXMuX3JlY3QuZ2V0Qm91bmRzKCkuZ2V0Q2VudGVyKCkpO1xuICB9XG5cbn0pO1xuXG5MLkNvbnRyb2wuT3ZlcnZpZXcuTWFwID0gTWluaW1hcDtcblxuLy8gZmFjdG9yeVxuTC5jb250cm9sLm92ZXJ2aWV3ID0gKG9wdGlvbnMpID0+IG5ldyBMLkNvbnRyb2wuT3ZlcnZpZXcob3B0aW9ucyk7XG5cbkwuTWFwLm1lcmdlT3B0aW9ucyh7XG4gIG92ZXJ2aWV3Q29udHJvbDogZmFsc2Vcbn0pO1xuXG5MLk1hcC5hZGRJbml0SG9vayhmdW5jdGlvbiAoKSB7XG5cdGlmICh0aGlzLm9wdGlvbnMub3ZlcnZpZXdDb250cm9sKSB7XG5cdFx0dGhpcy5vdmVydmlld0NvbnRyb2wgPSBuZXcgTC5Db250cm9sLk92ZXJ2aWV3KCk7XG5cdFx0dGhpcy5hZGRDb250cm9sKHRoaXMub3ZlcnZpZXdDb250cm9sKTtcblx0fVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gTC5Db250cm9sLk92ZXJ2aWV3O1xuIl19
