!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.Tangram=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
var Point = _dereq_('../point.js');
var Geo = _dereq_('../geo.js');
var VectorRenderer = _dereq_('../vector_renderer.js');

VectorRenderer.CanvasRenderer = CanvasRenderer;
CanvasRenderer.prototype = Object.create(VectorRenderer.prototype);

function CanvasRenderer (tile_source, layers, styles, options)
{
    VectorRenderer.call(this, 'CanvasRenderer', tile_source, layers, styles, options);

    // Selection info shown on hover
    this.selection_info = document.createElement('div');
    this.selection_info.setAttribute('class', 'label');
    this.selection_info.style.display = 'none';

    // For drawing multipolygons w/canvas composite operations
    this.cutout_context = document.createElement('canvas').getContext('2d');
}

// CanvasRenderer.prototype.addTile = function CanvasRendererAddTile (tile, tileDiv)
CanvasRenderer.prototype._tileWorkerCompleted = function (tile)
{
    var canvas = document.createElement('canvas');
    var context = canvas.getContext('2d');

    canvas.style.width = Geo.tile_size + 'px';
    canvas.style.width = Geo.tile_size + 'px';
    canvas.width = Math.round(Geo.tile_size * this.device_pixel_ratio);
    canvas.height = Math.round(Geo.tile_size * this.device_pixel_ratio);
    canvas.style.background = this.colorToString(this.styles.default);

    this.renderTile(tile, context);

    var tileDiv = document.querySelector("div[data-tile-key='" + tile.key + "']");
    tileDiv.appendChild(canvas);
};

// Scale a GeoJSON coordinate (2-element array) from [min, max] to tile pixels
// returns a copy of geometry.coordinates transformed into Points
CanvasRenderer.prototype.scaleGeometryToPixels = function scaleGeometryToPixels (geometry)
{
    var renderer = this;
    return Geo.transformGeometry(geometry, function (coordinates) {
        return Point(
            // Math.round((coordinates[0] - min.x) * Geo.tile_size / (max.x - min.x)), // rounding removes seams but causes aliasing
            // Math.round((coordinates[1] - min.y) * Geo.tile_size / (max.y - min.y))
            coordinates[0] * Geo.tile_size * renderer.device_pixel_ratio / VectorRenderer.tile_scale,
            coordinates[1] * Geo.tile_size * renderer.device_pixel_ratio / VectorRenderer.tile_scale * -1 // adjust for flipped y-coord
        );
    });
};

// Renders a line given as an array of Points
// line = [Point, Point, ...]
CanvasRenderer.prototype.renderLine = function renderLine (line, style, context)
{
    var segments = line;
    var color = style.color;
    var width = style.width;
    var dash = style.dash;

    var c = context;
    c.beginPath();
    c.strokeStyle = this.colorToString(color);
    c.lineCap = 'round';
    c.lineWidth = width;
    if (c.setLineDash) {
        if (dash) {
            c.setLineDash(dash.map(function (d) { return d * width; }));
        }
        else {
            c.setLineDash([]);
        }
    }

    for (var r=0; r < segments.length - 1; r ++) {
        var segment = [
            segments[r].x, segments[r].y,
            segments[r + 1].x, segments[r + 1].y
        ];

        c.moveTo(segment[0], segment[1]);
        c.lineTo(segment[2], segment[3]);
    };

    c.closePath();
    c.stroke();
};

// Renders a polygon given as an array of Points
// polygon = [Point, Point, ...]
CanvasRenderer.prototype.renderPolygon = function renderPolygon (polygon, style, context)
{
    var segments = polygon;
    var color = style.color;
    var width = style.width;
    var outline_color = style.outline && style.outline.color;
    var outline_width = style.outline && style.outline.width;
    var outline_dash = style.outline && style.outline.dash;

    var c = context;
    c.beginPath();
    c.fillStyle = this.colorToString(color);
    c.moveTo(segments[0].x, segments[0].y);

    for (var r=1; r < segments.length; r ++) {
        c.lineTo(segments[r].x, segments[r].y);
    };

    c.closePath();
    c.fill();

    // Outline
    if (outline_color && outline_width) {
        c.strokeStyle = this.colorToString(outline_color);
        c.lineCap = 'round';
        c.lineWidth = outline_width;
        if (c.setLineDash) {
            if (outline_dash) {
                c.setLineDash(outline_dash.map(function (d) { return d * outline_width; }));
            }
            else {
                c.setLineDash([]);
            }
        }
        c.stroke();
    }
};

// Renders a point given as a Point object
CanvasRenderer.prototype.renderPoint = function renderPoint (point, style, context)
{
    var color = style.color;
    var size = style.size;
    var outline_color = style.outline && style.outline.color;
    var outline_width = style.outline && style.outline.width;
    var outline_dash = style.outline && style.outline.dash;

    var c = context;
    c.fillStyle = this.colorToString(color);

    c.beginPath();
    c.arc(point.x, point.y, size, 0, 2 * Math.PI);
    c.closePath();
    c.fill();

    // Outline
    if (outline_color && outline_width) {
        c.strokeStyle = this.colorToString(outline_color);
        c.lineWidth = outline_width;
        if (c.setLineDash) {
            if (outline_dash) {
                c.setLineDash(outline_dash.map(function (d) { return d * outline_width; }));
            }
            else {
                c.setLineDash([]);
            }
        }
        c.stroke();
    }
};

CanvasRenderer.prototype.renderFeature = function renderFeature (feature, style, context)
{
    var g, h, polys;
    var geometry = feature.geometry;

    if (geometry.type == 'LineString') {
        this.renderLine(geometry.pixels, style, context);
    }
    else if (geometry.type == 'MultiLineString') {
        for (g=0; g < geometry.pixels.length; g++) {
            this.renderLine(geometry.pixels[g], style, context);
        }
    }
    else if (geometry.type == 'Polygon' || geometry.type == 'MultiPolygon') {
        if (geometry.type == 'Polygon') {
            polys = [geometry.pixels]; // treat Polygon as a degenerate MultiPolygon to avoid duplicating code
        }
        else {
            polys = geometry.pixels;
        }

        for (g=0; g < polys.length; g++) {
            // Polygons with holes:
            // Render to a separate canvas, using composite operations to cut holes out of polygon, then copy back to the main canvas
            if (polys[g].length > 1) {
                if (this.cutout_context.canvas.width != context.canvas.width || this.cutout_context.canvas.height != context.canvas.height) {
                    this.cutout_context.canvas.width = context.canvas.width;
                    this.cutout_context.canvas.height = context.canvas.height;
                }
                this.cutout_context.clearRect(0, 0, this.cutout_context.canvas.width, this.cutout_context.canvas.height);

                this.cutout_context.globalCompositeOperation = 'source-over';
                this.renderPolygon(polys[g][0], style, this.cutout_context);

                this.cutout_context.globalCompositeOperation = 'destination-out';
                for (h=1; h < polys[g].length; h++) {
                    this.renderPolygon(polys[g][h], style, this.cutout_context);
                }
                context.drawImage(this.cutout_context.canvas, 0, 0);

                // After compositing back to main canvas, draw outlines on holes
                if (style.outline && style.outline.color) {
                    for (h=1; h < polys[g].length; h++) {
                        this.renderLine(polys[g][h], style.outline, context);
                    }
                }
            }
            // Regular closed polygons
            else {
                this.renderPolygon(polys[g][0], style, context);
            }
        }
    }
    else if (geometry.type == 'Point') {
        this.renderPoint(geometry.pixels, style, context);
    }
    else if (geometry.type == 'MultiPoint') {
        for (g=0; g < geometry.pixels.length; g++) {
            this.renderPoint(geometry.pixels[g], style, context);
        }
    }
};

// Render a GeoJSON tile onto canvas
CanvasRenderer.prototype.renderTile = function renderTile (tile, context)
{
    var renderer = this;
    var style;

    // Selection rendering - off-screen canvas to render a collision map for feature selection
    var selection = { colors: {} };
    var selection_canvas = document.createElement('canvas');
    selection_canvas.style.width = Geo.tile_size + 'px';
    selection_canvas.style.width = Geo.tile_size + 'px';
    selection_canvas.width = Math.round(Geo.tile_size * this.device_pixel_ratio);
    selection_canvas.height = Math.round(Geo.tile_size * this.device_pixel_ratio);

    var selection_context = selection_canvas.getContext('2d');
    var selection_color;
    var selection_count = 0;

    // Render layers
    for (var t in renderer.layers) {
        var layer = renderer.layers[t];
        tile.layers[layer.name].features.forEach(function(feature) {
            // Scale local coords to tile pixels
            feature.geometry.pixels = this.scaleGeometryToPixels(feature.geometry, renderer.tile_min, renderer.tile_max);
            style = VectorRenderer.parseStyleForFeature(feature, this.styles[layer.name], tile);

            // Draw visible geometry
            if (layer.visible != false) {
                this.renderFeature(feature, style, context);
            }

            // Draw mask for interactivity
            // TODO: move selection filter logic to stylesheet
            // TODO: only alter styles that are explicitly different, don't manually copy style values by property name
            if (layer.selection == true && feature.properties.name != null && feature.properties.name != '') {
                selection_color = this.generateColor(selection.colors);
                selection_color.properties = feature.properties;
                selection_count++;
                this.renderFeature(feature, { color: selection_color.color, width: style.width, size: style.size }, selection_context);
            }
            else {
                // If this geometry isn't interactive, mask it out so geometry under it doesn't appear to pop through
                this.renderFeature(feature, { color: [0, 0, 0], width: style.width, size: style.size }, selection_context);
            }

        }, this);
    }

    // Selection events
    var selection_info = this.selection_info;
    if (selection_count > 0) {
        this.tiles[tile.key].selection = selection;

        selection.pixels = new Uint32Array(selection_context.getImageData(0, 0, selection_canvas.width, selection_canvas.height).data.buffer);

        // TODO: fire events on selection to enable custom behavior
        context.canvas.onmousemove = function (event) {
            var hit = { x: event.offsetX, y: event.offsetY }; // layerX/Y
            var off = (hit.y * renderer.device_pixel_ratio) * (Geo.tile_size * renderer.device_pixel_ratio) + (hit.x * renderer.device_pixel_ratio);
            var color = selection.pixels[off];
            var feature = selection.colors[color];
            if (feature != null) {
                context.canvas.style.cursor = 'crosshair';
                selection_info.style.left = (hit.x + 5) + 'px';
                selection_info.style.top = (hit.y + 5) + 'px';
                selection_info.innerHTML = '<span class="labelInner">' + feature.properties.name + /*' [' + feature.properties.kind + ']*/'</span>';
                selection_info.style.display = 'block';
                context.canvas.parentNode.appendChild(selection_info);
            }
            else {
                context.canvas.style.cursor = null;
                selection_info.style.display = 'none';
                if (selection_info.parentNode == context.canvas.parentNode) {
                    context.canvas.parentNode.removeChild(selection_info);
                }
            }
        };
    }
    else {
        context.canvas.onmousemove = function (event) {
            context.canvas.style.cursor = null;
            selection_info.style.display = 'none';
            if (selection_info.parentNode == context.canvas.parentNode) {
                context.canvas.parentNode.removeChild(selection_info);
            }
        };
    }
};

/* Color helpers */

// Transform color components in 0-1 range to html RGB string for canvas
CanvasRenderer.prototype.colorToString = function (color)
{
    return 'rgb(' + color.map(function(c) { return ~~(c * 256); }).join(',') + ')';
};

// Generates a random color not yet present in the provided hash of colors
CanvasRenderer.prototype.generateColor = function generateColor (color_map)
{
    var r, g, b, ir, ig, ib, key;
    color_map = color_map || {};
    while (true) {
        r = Math.random();
        g = Math.random();
        b = Math.random();

        ir = ~~(r * 256);
        ig = ~~(g * 256);
        ib = ~~(b * 256);
        key = (ir + (ig << 8) + (ib << 16) + (255 << 24)) >>> 0; // need unsigned right shift to convert to positive #

        if (color_map[key] === undefined) {
            color_map[key] = { color: [r, g, b] };
            break;
        }
    }
    return color_map[key];
};

if (module !== undefined) {
    module.exports = CanvasRenderer;
}

},{"../geo.js":2,"../point.js":10,"../vector_renderer.js":13}],2:[function(_dereq_,module,exports){
// Miscellaneous geo functions
var Point = _dereq_('./point.js');

var Geo = {};

// Projection constants
Geo.tile_size = 256;
Geo.half_circumference_meters = 20037508.342789244;
Geo.map_origin_meters = Point(-Geo.half_circumference_meters, Geo.half_circumference_meters);
Geo.min_zoom_meters_per_pixel = Geo.half_circumference_meters * 2 / Geo.tile_size; // min zoom draws world as 2 tiles wide
Geo.meters_per_pixel = [];
Geo.max_zoom = 20;
for (var z=0; z <= Geo.max_zoom; z++) {
    Geo.meters_per_pixel[z] = Geo.min_zoom_meters_per_pixel / Math.pow(2, z);
}

// Convert tile location to mercator meters - multiply by pixels per tile, then by meters per pixel, adjust for map origin
Geo.metersForTile = function (tile)
{
    return Point(
        (tile.x * Geo.tile_size * Geo.meters_per_pixel[tile.z]) + Geo.map_origin_meters.x,
        ((tile.y * Geo.tile_size * Geo.meters_per_pixel[tile.z]) * -1) + Geo.map_origin_meters.y
    );
};

// Convert mercator meters to lat-lng
Geo.metersToLatLng = function (meters)
{
    var c = Point.copy(meters);

    c.x /= Geo.half_circumference_meters;
    c.y /= Geo.half_circumference_meters;

    c.y = (2 * Math.atan(Math.exp(c.y * Math.PI)) - (Math.PI / 2)) / Math.PI;

    c.x *= 180;
    c.y *= 180;

    return c;
};

// Convert lat-lng to mercator meters
Geo.latLngToMeters = function(latlng)
{
    var c = Point.copy(latlng);

    // Latitude
    c.y = Math.log(Math.tan((c.y + 90) * Math.PI / 360)) / (Math.PI / 180);
    c.y = c.y * Geo.half_circumference_meters / 180;

    // Longitude
    c.x = c.x * Geo.half_circumference_meters / 180;

    return c;
};

// Run a transform function on each cooordinate in a GeoJSON geometry
Geo.transformGeometry = function (geometry, transform)
{
    if (geometry.type == 'Point') {
        return transform(geometry.coordinates);
    }
    else if (geometry.type == 'LineString' || geometry.type == 'MultiPoint') {
        return geometry.coordinates.map(transform);
    }
    else if (geometry.type == 'Polygon' || geometry.type == 'MultiLineString') {
        return geometry.coordinates.map(function (coordinates) {
            return coordinates.map(transform);
        });
    }
    else if (geometry.type == 'MultiPolygon') {
        return geometry.coordinates.map(function (polygon) {
            return polygon.map(function (coordinates) {
                return coordinates.map(transform);
            });
        });
    }
    // TODO: support GeometryCollection
    return {};
};

Geo.boxIntersect = function (b1, b2)
{
    return !(
        b2.sw.x > b1.ne.x ||
        b2.ne.x < b1.sw.x ||
        b2.sw.y > b1.ne.y ||
        b2.ne.y < b1.sw.y
    );
};

// Split the lines of a feature wherever two points are farther apart than a given tolerance
Geo.splitFeatureLines  = function (feature, tolerance) {
    var tolerance = tolerance || 0.001;
    var tolerance_sq = tolerance * tolerance;
    var geom = feature.geometry;
    var lines;

    if (geom.type == 'MultiLineString') {
        lines = geom.coordinates;
    }
    else if (geom.type =='LineString') {
        lines = [geom.coordinates];
    }
    else {
        return feature;
    }

    var split_lines = [];

    for (var s=0; s < lines.length; s++) {
        var seg = lines[s];
        var split_seg = [];
        var last_coord = null;
        var keep;

        for (var c=0; c < seg.length; c++) {
            var coord = seg[c];
            keep = true;

            if (last_coord != null) {
                var dist = (coord[0] - last_coord[0]) * (coord[0] - last_coord[0]) + (coord[1] - last_coord[1]) * (coord[1] - last_coord[1]);
                if (dist > tolerance_sq) {
                    // console.log("split lines at (" + coord[0] + ", " + coord[1] + "), " + Math.sqrt(dist) + " apart");
                    keep = false;
                }
            }

            if (keep == false) {
                split_lines.push(split_seg);
                split_seg = [];
            }
            split_seg.push(coord);

            last_coord = coord;
        }

        split_lines.push(split_seg);
        split_seg = [];
    }

    if (split_lines.length == 1) {
        geom.type = 'LineString';
        geom.coordinates = split_lines[0];
    }
    else {
        geom.type = 'MultiLineString';
        geom.coordinates = split_lines;
    }

    return feature;
};

if (module !== undefined) {
    module.exports = Geo;
}

},{"./point.js":10}],3:[function(_dereq_,module,exports){
// WebGL management and rendering functions
var GL = {};

// Setup a WebGL context
// If no canvas element is provided, one is created and added to the document body
GL.getContext = function getContext (canvas)
{
    var canvas = canvas;
    var fullscreen = false;
    if (canvas == null) {
        canvas = document.createElement('canvas');
        canvas.style.position = 'absolute';
        canvas.style.top = 0;
        canvas.style.left = 0;
        canvas.style.zIndex = -1;
        document.body.appendChild(canvas);
        fullscreen = true;
    }

    gl = canvas.getContext('experimental-webgl', { /*preserveDrawingBuffer: true*/ }); // preserveDrawingBuffer needed for gl.readPixels (could be used for feature selection)
    if (!gl) {
        alert("Couldn't create WebGL context. Your browser probably doesn't support WebGL or it's turned off?");
        throw "Couldn't create WebGL context";
    }

    GL.resizeCanvas(gl, window.innerWidth, window.innerHeight);
    if (fullscreen == true) {
        window.addEventListener('resize', function () {
            GL.resizeCanvas(gl, window.innerWidth, window.innerHeight);
        });
    }

    GL.VertexArrayObject.init(gl); // TODO: this pattern doesn't support multiple active GL contexts, should that even be supported?

    return gl;
};

GL.resizeCanvas = function (gl, width, height)
{
    var device_pixel_ratio = window.devicePixelRatio || 1;
    gl.canvas.style.width = width + 'px';
    gl.canvas.style.height = height + 'px';
    gl.canvas.width = Math.round(gl.canvas.style.width * device_pixel_ratio);
    gl.canvas.height = Math.round(gl.canvas.style.width * device_pixel_ratio);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
};

// Compile & link a WebGL program from provided vertex and shader source elements
GL.createProgramFromElements = function GLcreateProgramFromElements (gl, vertex_shader_id, fragment_shader_id)
{
    var vertex_shader_source = document.getElementById(vertex_shader_id).textContent;
    var fragment_shader_source = document.getElementById(fragment_shader_id).textContent;
    var program = gl.createProgram();
    return GL.updateProgram(gl, program, vertex_shader_source, fragment_shader_source);
};

// Compile & link a WebGL program from provided vertex and shader source URLs
// NOTE: loads via synchronous XHR for simplicity, could be made async
GL.createProgramFromURLs = function GLcreateProgramFromURLs (gl, vertex_shader_url, fragment_shader_url)
{
    var program = gl.createProgram();
    return GL.updateProgramFromURLs(gl, program, vertex_shader_url, fragment_shader_url);
};

GL.updateProgramFromURLs = function GLUpdateProgramFromURLs (gl, program, vertex_shader_url, fragment_shader_url)
{
    var vertex_shader_source, fragment_shader_source;
    var req = new XMLHttpRequest();

    req.onload = function () { vertex_shader_source = req.response; };
    req.open('GET', vertex_shader_url + '?' + (+new Date()), false /* async flag */);
    req.send();

    req.onload = function () { fragment_shader_source = req.response; };
    req.open('GET', fragment_shader_url + '?' + (+new Date()), false /* async flag */);
    req.send();

    return GL.updateProgram(gl, program, vertex_shader_source, fragment_shader_source);
};

// Compile & link a WebGL program from provided vertex and fragment shader sources
// update a program if one is passed in. Create one if not. Alert and don't update anything if the shaders don't compile.
GL.updateProgram = function GLupdateProgram (gl, program, vertex_shader_source, fragment_shader_source)
{
    try {
        var vertex_shader = GL.createShader(gl, vertex_shader_source, gl.VERTEX_SHADER);
        var fragment_shader = GL.createShader(gl, '#ifdef GL_ES\nprecision highp float;\n#endif\n\n' + fragment_shader_source, gl.FRAGMENT_SHADER);
    }
    catch(err)
    {
        alert(err);
        return program;
    }

    gl.useProgram(null);
    if (program != null) {
        var old_shaders = gl.getAttachedShaders(program);
        for(var i = 0; i < old_shaders.length; i++) {
            gl.detachShader(program, old_shaders[i]);
        }
    } else {
        program = gl.createProgram();
    }

    if (vertex_shader == null || fragment_shader == null) {
        return program;
    }

    gl.attachShader(program, vertex_shader);
    gl.attachShader(program, fragment_shader);

    gl.deleteShader(vertex_shader);
    gl.deleteShader(fragment_shader);

    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        var program_error =
            "WebGL program error:\n" +
            "VALIDATE_STATUS: " + gl.getProgramParameter(program, gl.VALIDATE_STATUS) + "\n" +
            "ERROR: " + gl.getError() + "\n\n" +
            "--- Vertex Shader ---\n" + vertex_shader_source + "\n\n" +
            "--- Fragment Shader ---\n" + fragment_shader_source;
        throw program_error;
    }

    return program;
};

// Compile a vertex or fragment shader from provided source
GL.createShader = function GLcreateShader (gl, source, type)
{
    var shader = gl.createShader(type);

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        var shader_error =
            "WebGL shader error:\n" +
            (type == gl.VERTEX_SHADER ? "VERTEX" : "FRAGMENT") + " SHADER:\n" +
            gl.getShaderInfoLog(shader);
        throw shader_error;
    }

    return shader;
};

// Thin GL program layer to cache uniform locations/values, do compile-time pre-processing (injecting #defines into shaders), etc.
GL.Program = function (gl, vertex_shader_source, fragment_shader_source, options)
{
    options = options || {};

    this.gl = gl;
    this.program = null;
    this.defines = options.defines || {}; // key/values inserted into shaders at compile-time
    this.uniforms = {}; // program locations of uniforms, set/updated at compile-time
    this.attribs = {}; // program locations of vertex attributes
    this.vertex_shader_source = vertex_shader_source;
    this.fragment_shader_source = fragment_shader_source;
    this.compile();
};

// Creates a program that will refresh from source URLs each time it is compiled
GL.Program.createProgramFromURLs = function (gl, vertex_shader_url, fragment_shader_url, options)
{
    var program = Object.create(GL.Program.prototype);

    program.vertex_shader_url = vertex_shader_url;
    program.fragment_shader_url = fragment_shader_url;

    program.updateVertexShaderSource = function () {
        var source;
        var req = new XMLHttpRequest();
        req.onload = function () { source = req.response; };
        req.open('GET', this.vertex_shader_url + '?' + (+new Date()), false /* async flag */);
        req.send();
        return source;
    };

    program.updateFragmentShaderSource = function () {
        var source;
        var req = new XMLHttpRequest();
        req.onload = function () { source = req.response; };
        req.open('GET', this.fragment_shader_url + '?' + (+new Date()), false /* async flag */);
        req.send();
        return source;
    };

    GL.Program.call(program, gl, null, null, options);
    return program;
};

// Global defines applied to all programs (duplicate properties for a specific program will take precedence)
GL.Program.defines = {};

GL.Program.prototype.compile = function ()
{
    // Optionally update sources
    if (typeof this.updateVertexShaderSource == 'function') {
        this.vertex_shader_source = this.updateVertexShaderSource();
    }
    if (typeof this.updateFragmentShaderSource == 'function') {
        this.fragment_shader_source = this.updateFragmentShaderSource();
    }

    // Inject defines (global, then program-specific)
    var defines = {};
    for (var d in GL.Program.defines) {
        defines[d] = GL.Program.defines[d];
    }
    for (var d in this.defines) {
        defines[d] = this.defines[d];
    }

    var define_str = "";
    for (var d in defines) {
        if (defines[d] == false) {
            continue;
        }
        else if (typeof defines[d] == 'boolean' && defines[d] == true) {
            define_str += "#define " + d + "\n";
        }
        else {
            define_str += "#define " + d + " " + defines[d] + "\n";
        }
    }
    this.processed_vertex_shader_source = define_str + this.vertex_shader_source;
    this.processed_fragment_shader_source = define_str + this.fragment_shader_source;

    // Compile & set uniforms to cached values
    this.program = GL.updateProgram(this.gl, this.program, this.processed_vertex_shader_source, this.processed_fragment_shader_source);
    this.gl.useProgram(this.program);
    this.refreshUniforms();
    this.refreshAttributes();
};

// ex: program.uniform('3f', 'position', x, y, z);
GL.Program.prototype.uniform = function (method, name) // method-appropriate arguments follow
{
    var uniform = (this.uniforms[name] = this.uniforms[name] || {});
    uniform.name = name;
    uniform.location = uniform.location || this.gl.getUniformLocation(this.program, name);
    uniform.method = 'uniform' + method;
    uniform.values = Array.prototype.slice.call(arguments, 2);
    this.updateUniform(name);
};

// Set a single uniform
GL.Program.prototype.updateUniform = function (name)
{
    var uniform = this.uniforms[name];
    if (uniform == null || uniform.location == null) {
        return;
    }
    this.gl[uniform.method].apply(this.gl, [uniform.location].concat(uniform.values)); // call appropriate GL uniform method and pass through arguments
};

// Refresh uniform locations and set to last cached values
GL.Program.prototype.refreshUniforms = function ()
{
    for (var u in this.uniforms) {
        this.uniforms[u].location = this.gl.getUniformLocation(this.program, u);
        this.updateUniform(u);
    }
};

GL.Program.prototype.refreshAttributes = function ()
{
    // var len = this.gl.getProgramParameter(this.program, this.gl.ACTIVE_ATTRIBUTES);
    // for (var i=0; i < len; i++) {
    //     var a = this.gl.getActiveAttrib(this.program, i);
    //     console.log(a);
    // }
    this.attribs = {};
};

// Get the location of a vertex attribute
GL.Program.prototype.attribute = function (name)
{
    var attrib = (this.attribs[name] = this.attribs[name] || {});
    if (attrib.location != null) {
        return attrib;
    }

    attrib.name = name;
    attrib.location = this.gl.getAttribLocation(this.program, name);

    // var info = this.gl.getActiveAttrib(this.program, attrib.location);
    // attrib.type = info.type;
    // attrib.size = info.size;

    return attrib;
};

// Triangulation using libtess.js port of gluTesselator
// https://github.com/brendankenny/libtess.js
try {
    GL.tesselator = (function initTesselator() {
        // Called for each vertex of tesselator output
        function vertexCallback(data, polyVertArray) {
            polyVertArray.push([data[0], data[1]]);
        }

        // Called when segments intersect and must be split
        function combineCallback(coords, data, weight) {
            return coords;
        }

        // Called when a vertex starts or stops a boundary edge of a polygon
        function edgeCallback(flag) {
            // No-op callback to force simple triangle primitives (no triangle strips or fans).
            // See: http://www.glprogramming.com/red/chapter11.html
            // "Since edge flags make no sense in a triangle fan or triangle strip, if there is a callback
            // associated with GLU_TESS_EDGE_FLAG that enables edge flags, the GLU_TESS_BEGIN callback is
            // called only with GL_TRIANGLES."
            // console.log('GL.tesselator: edge flag: ' + flag);
        }

        var tesselator = new libtess.GluTesselator();
        tesselator.gluTessCallback(libtess.gluEnum.GLU_TESS_VERTEX_DATA, vertexCallback);
        tesselator.gluTessCallback(libtess.gluEnum.GLU_TESS_COMBINE, combineCallback);
        tesselator.gluTessCallback(libtess.gluEnum.GLU_TESS_EDGE_FLAG, edgeCallback);

        // Brendan Kenny:
        // libtess will take 3d verts and flatten to a plane for tesselation
        // since only doing 2d tesselation here, provide z=1 normal to skip
        // iterating over verts only to get the same answer.
        // comment out to test normal-generation code
        tesselator.gluTessNormal(0, 0, 1);

        return tesselator;
    })();

    GL.triangulatePolygon = function GLTriangulate (contours)
    {
        var triangleVerts = [];
        GL.tesselator.gluTessBeginPolygon(triangleVerts);

        for (var i = 0; i < contours.length; i++) {
            GL.tesselator.gluTessBeginContour();
            var contour = contours[i];
            for (var j = 0; j < contour.length; j ++) {
                var coords = [contour[j][0], contour[j][1], 0];
                GL.tesselator.gluTessVertex(coords, coords);
            }
            GL.tesselator.gluTessEndContour();
        }

        GL.tesselator.gluTessEndPolygon();
        return triangleVerts;
    };
}
catch (e) {
    // console.log("libtess not defined!");
    // skip if libtess not defined
}

// Add one or more vertices to an array (destined to be used as a GL buffer), 'striping' each vertex with constant data
// Used for adding values that are often constant per geometry or polygon, like colors, normals (for polys sitting flat on map), layer and material info, etc.
GL.addVertices = function (vertices, vertex_data, vertex_constants)
{
    if (vertices != null && vertices.length > 0) {
        // Array of vertices
        if (typeof vertices[0] == 'object') {
            for (var v=0; v < vertices.length; v++) {
                vertex_data.push.apply(vertex_data, vertices[v]);
                if (vertex_constants) {
                    vertex_data.push.apply(vertex_data, vertex_constants);
                }
            }
        }
        // Single vertex
        else {
            vertex_data.push.apply(vertex_data, vertices);
            if (vertex_constants) {
                vertex_data.push.apply(vertex_data, vertex_constants);
            }
        }
    }
    return vertex_data;
};

// Creates a Vertex Array Object if the extension is available, or falls back on standard attribute calls
GL.VertexArrayObject = {};
GL.VertexArrayObject.disabled = false; // set to true to disable VAOs even if extension is available
GL.VertexArrayObject.bound_vao = null; // currently bound VAO

GL.VertexArrayObject.init = function (gl)
{
    if (GL.VertexArrayObject.ext == null) {
        if (GL.VertexArrayObject.disabled != true) {
            GL.VertexArrayObject.ext = gl.getExtension("OES_vertex_array_object");
        }

        if (GL.VertexArrayObject.ext != null) {
            console.log("Vertex Array Object extension available");
        }
        else if (GL.VertexArrayObject.disabled != true) {
            console.log("Vertex Array Object extension NOT available");
        }
        else {
            console.log("Vertex Array Object extension force disabled");
        }
    }
};

GL.VertexArrayObject.create = function (setup, teardown)
{
    var vao = {};
    vao.setup = setup;
    vao.teardown = teardown;

    var ext = GL.VertexArrayObject.ext;
    if (ext != null) {
        vao._vao = ext.createVertexArrayOES();
        ext.bindVertexArrayOES(vao._vao);
        vao.setup();
        ext.bindVertexArrayOES(null);
        if (typeof vao.teardown == 'function') {
            vao.teardown();
        }
    }
    else {
        vao.setup();
    }

    return vao;
};

GL.VertexArrayObject.bind = function (vao)
{
    var ext = GL.VertexArrayObject.ext;
    if (vao != null) {
        if (ext != null && vao._vao != null) {
            ext.bindVertexArrayOES(vao._vao);
            GL.VertexArrayObject.bound_vao = vao;
        }
        else {
            vao.setup();
        }
    }
    else {
        if (ext != null) {
            ext.bindVertexArrayOES(null);
        }
        else if (GL.VertexArrayObject.bound_vao != null && typeof GL.VertexArrayObject.bound_vao.teardown == 'function') {
            GL.VertexArrayObject.bound_vao.teardown();
        }
        GL.VertexArrayObject.bound_vao = null;
    }
};

if (module !== undefined) {
    module.exports = GL;
}

},{}],4:[function(_dereq_,module,exports){
var Vector = _dereq_('../vector.js');
var Point = _dereq_('../point.js');
var GL = _dereq_('./gl.js');

var GLBuilders = {};

GLBuilders.debug = false;

// Tesselate a flat 2D polygon with fixed height and add to GL vertex buffer
GLBuilders.buildPolygons = function GLBuildersBuildPolygons (polygons, z, vertex_data, options)
{
    options = options || {};

    var vertex_constants = [z, 0, 0, 1]; // provided z, and upwards-facing normal
    if (options.vertex_constants) {
        vertex_constants.push.apply(vertex_constants, options.vertex_constants);
    }

    var num_polygons = polygons.length;
    for (var p=0; p < num_polygons; p++) {
        var vertices = GL.triangulatePolygon(polygons[p]);
        GL.addVertices(vertices, vertex_data, vertex_constants);
    }

    return vertex_data;
};

// Tesselate and extrude a flat 2D polygon into a simple 3D model with fixed height and add to GL vertex buffer
GLBuilders.buildExtrudedPolygons = function GLBuildersBuildExtrudedPolygon (polygons, z, height, min_height, vertex_data, options)
{
    options = options || {};
    var min_z = z + (min_height || 0);
    var max_z = z + height;

    // Top
    GLBuilders.buildPolygons(polygons, max_z, vertex_data, { vertex_constants: options.vertex_constants });

    // Walls
    var wall_vertex_constants = [null, null, null]; // normals will be calculated below
    if (options.vertex_constants) {
        wall_vertex_constants.push.apply(wall_vertex_constants, options.vertex_constants);
    }

    var num_polygons = polygons.length;
    for (var p=0; p < num_polygons; p++) {
        var polygon = polygons[p];

        for (var q=0; q < polygon.length; q++) {
            var contour = polygon[q];

            for (var w=0; w < contour.length - 1; w++) {
                var wall_vertices = [];

                // Two triangles for the quad formed by each vertex pair, going from bottom to top height
                wall_vertices.push(
                    // Triangle
                    [contour[w+1][0], contour[w+1][1], max_z],
                    [contour[w+1][0], contour[w+1][1], min_z],
                    [contour[w][0], contour[w][1], min_z],
                    // Triangle
                    [contour[w][0], contour[w][1], min_z],
                    [contour[w][0], contour[w][1], max_z],
                    [contour[w+1][0], contour[w+1][1], max_z]
                );

                // Calc the normal of the wall from up vector and one segment of the wall triangles
                var normal = Vector.cross(
                    [0, 0, 1],
                    Vector.normalize([contour[w+1][0] - contour[w][0], contour[w+1][1] - contour[w][1], 0])
                );

                wall_vertex_constants[0] = normal[0];
                wall_vertex_constants[1] = normal[1];
                wall_vertex_constants[2] = normal[2];

                GL.addVertices(wall_vertices, vertex_data, wall_vertex_constants);
            }
        }
    }

    return vertex_data;
};

// Build tessellated triangles for a polyline
// Basically following the method described here for miter joints:
// http://artgrammer.blogspot.co.uk/2011/07/drawing-polylines-by-tessellation.html
GLBuilders.buildPolylines = function GLBuildersBuildPolylines (lines, z, width, vertex_data, options)
{
    options = options || {};
    options.closed_polygon = options.closed_polygon || false;
    options.remove_tile_edges = options.remove_tile_edges || false;

    var vertex_constants = [z, 0, 0, 1]; // provided z, and upwards-facing normal
    if (options.vertex_constants) {
        vertex_constants.push.apply(vertex_constants, options.vertex_constants);
    }

    // Line center - debugging
    if (GLBuilders.debug && options.vertex_lines) {
        var num_lines = lines.length;
        for (var ln=0; ln < num_lines; ln++) {
            var line = lines[ln];

            for (var p=0; p < line.length - 1; p++) {
                // Point A to B
                var pa = line[p];
                var pb = line[p+1];

                options.vertex_lines.push(
                    pa[0], pa[1], z + 0.001, 0, 0, 1, 1.0, 0, 0,
                    pb[0], pb[1], z + 0.001, 0, 0, 1, 1.0, 0, 0
                );
            }
        };
    }

    // Build triangles
    var vertices = [];
    var num_lines = lines.length;
    for (var ln=0; ln < num_lines; ln++) {
        var line = lines[ln];
        // Multiple line segments
        if (line.length > 2) {
            // Build anchors for line segments:
            // anchors are 3 points, each connecting 2 line segments that share a joint (start point, joint point, end point)

            var anchors = [];

            if (line.length > 3) {
                // Find midpoints of each line segment
                // For closed polygons, calculate all midpoints since segments will wrap around to first midpoint
                var mid = [];
                var p, pmax;
                if (options.closed_polygon == true) {
                    p = 0; // start on first point
                    pmax = line.length - 1;
                }
                // For open polygons, skip first midpoint and use line start instead
                else {
                    p = 1; // start on second point
                    pmax = line.length - 2;
                    mid.push(line[0]); // use line start instead of first midpoint
                }

                // Calc midpoints
                for (; p < pmax; p++) {
                    var pa = line[p];
                    var pb = line[p+1];
                    mid.push([(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2]);
                }

                // Same closed/open polygon logic as above: keep last midpoint for closed, skip for open
                var mmax;
                if (options.closed_polygon == true) {
                    mmax = mid.length;
                }
                else {
                    mid.push(line[line.length-1]); // use line end instead of last midpoint
                    mmax = mid.length - 1;
                }

                // Make anchors by connecting midpoints to line joints
                for (p=0; p < mmax; p++)  {
                    anchors.push([mid[p], line[(p+1) % line.length], mid[(p+1) % mid.length]]);
                }
            }
            else {
                // Degenerate case, a 3-point line is just a single anchor
                anchors = [[line[0], line[1], line[2]]];
            }

            for (var p=0; p < anchors.length; p++) {
                if (!options.remove_tile_edges) {
                    buildAnchor(anchors[p][0], anchors[p][1], anchors[p][2]);
                    // buildSegment(anchors[p][0], anchors[p][1]); // use these to draw extruded segments w/o join, for debugging
                    // buildSegment(anchors[p][1], anchors[p][2]);
                }
                else {
                    var edge1 = GLBuilders.isOnTileEdge(anchors[p][0], anchors[p][1]);
                    var edge2 = GLBuilders.isOnTileEdge(anchors[p][1], anchors[p][2]);
                    if (!edge1 && !edge2) {
                        buildAnchor(anchors[p][0], anchors[p][1], anchors[p][2]);
                    }
                    else if (!edge1) {
                        buildSegment(anchors[p][0], anchors[p][1]);
                    }
                    else if (!edge2) {
                        buildSegment(anchors[p][1], anchors[p][2]);
                    }
                }
            }
        }
        // Single 2-point segment
        else if (line.length == 2) {
            buildSegment(line[0], line[1]); // TODO: replace buildSegment with a degenerate form of buildAnchor? buildSegment is still useful for debugging
        }
    };

    GL.addVertices(vertices, vertex_data, vertex_constants);

    // Build triangles for a single line segment, extruded by the provided width
    function buildSegment (pa, pb) {
        var slope = Vector.normalize([(pb[1] - pa[1]) * -1, pb[0] - pa[0]]);

        var pa_outer = [pa[0] + slope[0] * width/2, pa[1] + slope[1] * width/2];
        var pa_inner = [pa[0] - slope[0] * width/2, pa[1] - slope[1] * width/2];

        var pb_outer = [pb[0] + slope[0] * width/2, pb[1] + slope[1] * width/2];
        var pb_inner = [pb[0] - slope[0] * width/2, pb[1] - slope[1] * width/2];

        vertices.push(
            pb_inner, pb_outer, pa_inner,
            pa_inner, pb_outer, pa_outer
        );
    }

    // Build triangles for a 3-point 'anchor' shape, consisting of two line segments with a joint
    // TODO: move these functions out of closures?
    function buildAnchor (pa, joint, pb) {
        // Inner and outer line segments for [pa, joint] and [joint, pb]
        var pa_slope = Vector.normalize([(joint[1] - pa[1]) * -1, joint[0] - pa[0]]);
        var pa_outer = [
            [pa[0] + pa_slope[0] * width/2, pa[1] + pa_slope[1] * width/2],
            [joint[0] + pa_slope[0] * width/2, joint[1] + pa_slope[1] * width/2]
        ];
        var pa_inner = [
            [pa[0] - pa_slope[0] * width/2, pa[1] - pa_slope[1] * width/2],
            [joint[0] - pa_slope[0] * width/2, joint[1] - pa_slope[1] * width/2]
        ];

        var pb_slope = Vector.normalize([(pb[1] - joint[1]) * -1, pb[0] - joint[0]]);
        var pb_outer = [
            [joint[0] + pb_slope[0] * width/2, joint[1] + pb_slope[1] * width/2],
            [pb[0] + pb_slope[0] * width/2, pb[1] + pb_slope[1] * width/2]
        ];
        var pb_inner = [
            [joint[0] - pb_slope[0] * width/2, joint[1] - pb_slope[1] * width/2],
            [pb[0] - pb_slope[0] * width/2, pb[1] - pb_slope[1] * width/2]
        ];

        // Miter join - solve for the intersection between the two outer line segments
        var intersection = Vector.lineIntersection(pa_outer[0], pa_outer[1], pb_outer[0], pb_outer[1]);
        var line_debug = null;
        if (intersection != null) {
            var intersect_outer = intersection;

            // Cap the intersection point to a reasonable distance (as join angle becomes sharper, miter joint distance would approach infinity)
            var len_sq = Vector.lengthSq([intersect_outer[0] - joint[0], intersect_outer[1] - joint[1]]);
            var miter_len_max = 3; // multiplier on line width for max distance miter join can be from joint
            if (len_sq > (width * width * miter_len_max * miter_len_max)) {
                line_debug = 'distance';
                intersect_outer = Vector.normalize([intersect_outer[0] - joint[0], intersect_outer[1] - joint[1]]);
                intersect_outer = [
                    joint[0] + intersect_outer[0] * miter_len_max,
                    joint[1] + intersect_outer[1] * miter_len_max
                ]
            }

            var intersect_inner = [
                (joint[0] - intersect_outer[0]) + joint[0],
                (joint[1] - intersect_outer[1]) + joint[1]
            ];

            vertices.push(
                intersect_inner, intersect_outer, pa_inner[0],
                pa_inner[0], intersect_outer, pa_outer[0],

                pb_inner[1], pb_outer[1], intersect_inner,
                intersect_inner, pb_outer[1], intersect_outer
            );
        }
        else {
            // Line segments are parallel, use the first outer line segment as join instead
            line_debug = 'parallel';
            pa_inner[1] = pb_inner[0];
            pa_outer[1] = pb_outer[0];

            vertices.push(
                pa_inner[1], pa_outer[1], pa_inner[0],
                pa_inner[0], pa_outer[1], pa_outer[0],

                pb_inner[1], pb_outer[1], pb_inner[0],
                pb_inner[0], pb_outer[1], pb_outer[0]
            );
        }

        // Extruded inner/outer edges - debugging
        if (GLBuilders.debug && options.vertex_lines) {
            options.vertex_lines.push(
                pa_inner[0][0], pa_inner[0][1], z + 0.001, 0, 0, 1, 0, 1.0, 0,
                pa_inner[1][0], pa_inner[1][1], z + 0.001, 0, 0, 1, 0, 1.0, 0,

                pb_inner[0][0], pb_inner[0][1], z + 0.001, 0, 0, 1, 0, 1.0, 0,
                pb_inner[1][0], pb_inner[1][1], z + 0.001, 0, 0, 1, 0, 1.0, 0,

                pa_outer[0][0], pa_outer[0][1], z + 0.001, 0, 0, 1, 0, 1.0, 0,
                pa_outer[1][0], pa_outer[1][1], z + 0.001, 0, 0, 1, 0, 1.0, 0,

                pb_outer[0][0], pb_outer[0][1], z + 0.001, 0, 0, 1, 0, 1.0, 0,
                pb_outer[1][0], pb_outer[1][1], z + 0.001, 0, 0, 1, 0, 1.0, 0,

                pa_inner[0][0], pa_inner[0][1], z + 0.001, 0, 0, 1, 0, 1.0, 0,
                pa_outer[0][0], pa_outer[0][1], z + 0.001, 0, 0, 1, 0, 1.0, 0,

                pa_inner[1][0], pa_inner[1][1], z + 0.001, 0, 0, 1, 0, 1.0, 0,
                pa_outer[1][0], pa_outer[1][1], z + 0.001, 0, 0, 1, 0, 1.0, 0,

                pb_inner[0][0], pb_inner[0][1], z + 0.001, 0, 0, 1, 0, 1.0, 0,
                pb_outer[0][0], pb_outer[0][1], z + 0.001, 0, 0, 1, 0, 1.0, 0,

                pb_inner[1][0], pb_inner[1][1], z + 0.001, 0, 0, 1, 0, 1.0, 0,
                pb_outer[1][0], pb_outer[1][1], z + 0.001, 0, 0, 1, 0, 1.0, 0
            );
        }

        if (GLBuilders.debug && line_debug && options.vertex_lines) {
            var dcolor;
            if (line_debug == 'parallel') {
                // console.log("!!! lines are parallel !!!");
                dcolor = [0, 1, 0];
            }
            else if (line_debug == 'distance') {
                // console.log("!!! miter intersection point exceeded allowed distance from joint !!!");
                dcolor = [1, 0, 0];
            }
            // console.log('OSM id: ' + feature.id); // TODO: if this function is moved out of a closure, this feature debug info won't be available
            // console.log([pa, joint, pb]);
            // console.log(feature);
            options.vertex_lines.push(
                pa[0], pa[1], z + 0.002,
                0, 0, 1, dcolor[0], dcolor[1], dcolor[2],
                joint[0], joint[1], z + 0.002,
                0, 0, 1, dcolor[0], dcolor[1], dcolor[2],
                joint[0], joint[1], z + 0.002,
                0, 0, 1, dcolor[0], dcolor[1], dcolor[2],
                pb[0], pb[1], z + 0.002,
                0, 0, 1, dcolor[0], dcolor[1], dcolor[2]
            );

            var num_lines = lines.length;
            for (var ln=0; ln < num_lines; ln++) {
                var line2 = lines[ln];

                for (var p=0; p < line2.length - 1; p++) {
                    // Point A to B
                    var pa = line2[p];
                    var pb = line2[p+1];

                    options.vertex_lines.push(
                        pa[0], pa[1], z + 0.0005,
                        0, 0, 1, 0, 0, 1.0,
                        pb[0], pb[1], z + 0.0005,
                        0, 0, 1, 0, 0, 1.0
                    );
                }
            };
        }
    }

    return vertex_data;
};

// Build a quad centered on a point
GLBuilders.buildQuads = function GLBuildersBuildQuads (points, width, height, addGeometry, options)
{
    var options = options || {};

    var num_points = points.length;
    for (var p=0; p < num_points; p++) {
        var point = points[p];

        var positions = [
            [point[0] - width/2, point[1] - height/2],
            [point[0] + width/2, point[1] - height/2],
            [point[0] + width/2, point[1] + height/2],

            [point[0] - width/2, point[1] - height/2],
            [point[0] + width/2, point[1] + height/2],
            [point[0] - width/2, point[1] + height/2],
        ];

        if (options.texcoords == true) {
            var texcoords = [
                [-1, -1],
                [1, -1],
                [1, 1],

                [-1, -1],
                [1, 1],
                [-1, 1]
            ];
        }

        var vertices = {
            positions: positions,
            texcoords: (options.texcoords && texcoords)
        };
        addGeometry(vertices);
    }
};

// Build native GL lines for a polyline
GLBuilders.buildLines = function GLBuildersBuildLines (lines, feature, layer, style, tile, z, vertex_data, options)
{
    options = options || {};

    var color = style.color;
    var width = style.width;

    var num_lines = lines.length;
    for (var ln=0; ln < num_lines; ln++) {
        var line = lines[ln];

        for (var p=0; p < line.length - 1; p++) {
            // Point A to B
            var pa = line[p];
            var pb = line[p+1];

            vertex_data.push(
                // Point A
                pa[0], pa[1], z,
                0, 0, 1, // flat surfaces point straight up
                color[0], color[1], color[2],
                // Point B
                pb[0], pb[1], z,
                0, 0, 1, // flat surfaces point straight up
                color[0], color[1], color[2]
            );
        }
    };

    return vertex_data;
};

/* Utility functions */

// Tests if a line segment (from point A to B) is nearly coincident with the edge of a tile
GLBuilders.isOnTileEdge = function (pa, pb, options)
{
    options = options || {};

    var tolerance_function = options.tolerance_function || GLBuilders.valuesWithinTolerance;
    var tolerance = options.tolerance || 1; // tweak this adjust if catching too few/many line segments near tile edges
    var tile_min = GLBuilders.tile_bounds[0];
    var tile_max = GLBuilders.tile_bounds[1];
    var edge = null;

    if (tolerance_function(pa[0], tile_min.x, tolerance) && tolerance_function(pb[0], tile_min.x, tolerance)) {
        edge = 'left';
    }
    else if (tolerance_function(pa[0], tile_max.x, tolerance) && tolerance_function(pb[0], tile_max.x, tolerance)) {
        edge = 'right';
    }
    else if (tolerance_function(pa[1], tile_min.y, tolerance) && tolerance_function(pb[1], tile_min.y, tolerance)) {
        edge = 'top';
    }
    else if (tolerance_function(pa[1], tile_max.y, tolerance) && tolerance_function(pb[1], tile_max.y, tolerance)) {
        edge = 'bottom';
    }
    return edge;
};

GLBuilders.setTileScale = function (scale)
{
    GLBuilders.tile_bounds = [
        Point(0, 0),
        Point(scale, -scale) // TODO: correct for flipped y-axis?
    ];
};

GLBuilders.valuesWithinTolerance = function (a, b, tolerance)
{
    tolerance = tolerance || 1;
    return (Math.abs(a - b) < tolerance);
};

// Build a zigzag line pattern for testing joins and caps
GLBuilders.buildZigzagLineTestPattern = function ()
{
    var min = Point(0, 0); // tile.min;
    var max = Point(4096, 4096); // tile.max;
    var g = {
        id: 123,
        geometry: {
            type: 'LineString',
            coordinates: [
                [min.x * 0.75 + max.x * 0.25, min.y * 0.75 + max.y * 0.25],
                [min.x * 0.75 + max.x * 0.25, min.y * 0.5 + max.y * 0.5],
                [min.x * 0.25 + max.x * 0.75, min.y * 0.75 + max.y * 0.25],
                [min.x * 0.25 + max.x * 0.75, min.y * 0.25 + max.y * 0.75],
                [min.x * 0.4 + max.x * 0.6, min.y * 0.5 + max.y * 0.5],
                [min.x * 0.5 + max.x * 0.5, min.y * 0.25 + max.y * 0.75],
                [min.x * 0.75 + max.x * 0.25, min.y * 0.25 + max.y * 0.75],
                [min.x * 0.75 + max.x * 0.25, min.y * 0.4 + max.y * 0.6]
            ]
        },
        properties: {
            kind: 'debug'
        }
    };
    // console.log(g.geometry.coordinates);
    return g;
};

if (module !== undefined) {
    module.exports = GLBuilders;
}

},{"../point.js":10,"../vector.js":12,"./gl.js":3}],5:[function(_dereq_,module,exports){
/*** Manage rendering for primitives ***/
var GL = _dereq_('./gl.js');

// Attribs are an array, in layout order, of: name, size, type, normalized
// ex: { name: 'position', size: 3, type: gl.FLOAT, normalized: false }
function GLGeometry (gl, gl_program, vertex_data, attribs, options)
{
    options = options || {};

    this.gl = gl;
    this.gl_program = gl_program;
    this.attribs = attribs;
    this.vertex_data = vertex_data; // Float32Array
    this.buffer = this.gl.createBuffer();
    this.draw_mode = options.draw_mode || this.gl.TRIANGLES;
    this.data_usage = options.data_usage || this.gl.STATIC_DRAW;

    // Calc vertex stride
    this.vertex_stride = 0;
    for (var a=0; a < this.attribs.length; a++) {
        var attrib = this.attribs[a];

        attrib.location = this.gl_program.attribute(attrib.name).location;
        attrib.byte_size = attrib.size;

        switch (attrib.type) {
            case this.gl.FLOAT:
            case this.gl.INT:
            case this.gl.UNSIGNED_INT:
                attrib.byte_size *= 4;
                break;
            case this.gl.SHORT:
            case this.gl.UNSIGNED_SHORT:
                attrib.byte_size *= 2;
                break;
        }

        attrib.offset = this.vertex_stride;
        this.vertex_stride += attrib.byte_size;
    }

    this.vertex_count = this.vertex_data.byteLength / this.vertex_stride;

    this.vao = GL.VertexArrayObject.create(function() {
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);
        this.setup();
    }.bind(this));

    this.gl.bufferData(this.gl.ARRAY_BUFFER, this.vertex_data, this.data_usage);
}

GLGeometry.prototype.setup = function ()
{
    for (var a=0; a < this.attribs.length; a++) {
        var attrib = this.attribs[a];
        this.gl.enableVertexAttribArray(attrib.location);
        this.gl.vertexAttribPointer(attrib.location, attrib.size, attrib.type, attrib.normalized, this.vertex_stride, attrib.offset);
    }
};

GLGeometry.prototype.render = function ()
{
    this.gl.useProgram(this.gl_program.program);
    GL.VertexArrayObject.bind(this.vao);

    if (typeof this._render == 'function') {
        this._render();
    }

    // TODO: support element array mode
    this.gl.drawArrays(this.draw_mode, 0, this.vertex_count);
    GL.VertexArrayObject.bind(null);
};

GLGeometry.prototype.destroy = function ()
{
    console.log("GLGeometry.destroy: delete buffer of size " + this.vertex_data.byteLength);
    this.gl.deleteBuffer(this.buffer);
    delete this.vertex_data;
};

// Draws a set of triangles
GLTriangles.prototype = Object.create(GLGeometry.prototype);

function GLTriangles (gl, gl_program, vertex_data)
{
    GLGeometry.call(this, gl, gl_program, vertex_data, [
        { name: 'position', size: 3, type: gl.FLOAT, normalized: false },
        { name: 'normal', size: 3, type: gl.FLOAT, normalized: false },
        { name: 'color', size: 3, type: gl.FLOAT, normalized: false },
        { name: 'layer', size: 1, type: gl.FLOAT, normalized: false }
    ]);
    this.geometry_count = this.vertex_count / 3;
}

// Draws a set of points as quads, intended to be rendered as distance fields
GLPolyPoints.prototype = Object.create(GLGeometry.prototype);

function GLPolyPoints (gl, gl_program, vertex_data)
{
    GLGeometry.call(this, gl, gl_program, vertex_data, [
        { name: 'position', size: 3, type: gl.FLOAT, normalized: false },
        { name: 'texcoord', size: 2, type: gl.FLOAT, normalized: false },
        { name: 'color', size: 3, type: gl.FLOAT, normalized: false },
        { name: 'layer', size: 1, type: gl.FLOAT, normalized: false }
    ]);
    this.geometry_count = this.vertex_count / 3;
}

// Draws a set of lines
// Shares all characteristics with triangles except for draw mode
GLLines.prototype = Object.create(GLTriangles.prototype);

function GLLines (gl, gl_program, vertex_data, options)
{
    options = options || {};
    GLTriangles.call(this, gl, program, vertex_data);
    this.draw_mode = this.gl.LINES;
    this.line_width = options.line_width || 2;
    this.geometry_count = this.vertex_count / 2;
}

GLLines.prototype._render = function ()
{
    this.gl.lineWidth(this.line_width);
    if (typeof GLTriangles.prototype._render == 'function') {
        GLTriangles.prototype._render.call(this);
    }
};

if (module !== undefined) {
    module.exports = {
        GLGeometry: GLGeometry,
        GLTriangles: GLTriangles,
        GLPolyPoints: GLPolyPoints,
        GLLines: GLLines
    };
}

},{"./gl.js":3}],6:[function(_dereq_,module,exports){
var Point = _dereq_('../point.js');
var Geo = _dereq_('../geo.js');
var VectorRenderer = _dereq_('../vector_renderer.js');

var GL = _dereq_('./gl.js');
var GLBuilders = _dereq_('./gl_builders.js');
var GLGeometry = _dereq_('./gl_geom.js').GLGeometry;
var GLTriangles = _dereq_('./gl_geom.js').GLTriangles;
var GLPolyPoints = _dereq_('./gl_geom.js').GLPolyPoints;
var GLLines = _dereq_('./gl_geom.js').GLLines;

VectorRenderer.GLRenderer = GLRenderer;
GLRenderer.prototype = Object.create(VectorRenderer.prototype);
GLRenderer.debug = false;

GLRenderer.shader_sources = _dereq_('./gl_shaders.js');

function GLRenderer (tile_source, layers, styles, options)
{
    var options = options || {};

    VectorRenderer.call(this, 'GLRenderer', tile_source, layers, styles, options);

    GLBuilders.setTileScale(VectorRenderer.tile_scale);
    GL.Program.defines.TILE_SCALE = VectorRenderer.tile_scale + '.0';

    this.container = options.container;
    this.continuous_animation = false; // request redraw every frame
}

GLRenderer.prototype._init = function GLRendererInit ()
{
    this.container = this.container || document.body;
    this.canvas = document.createElement('canvas');
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = 0;
    this.canvas.style.left = 0;
    this.canvas.style.zIndex = -1;
    this.container.appendChild(this.canvas);

    this.gl = GL.getContext(this.canvas);

    var renderer = this;

    this.render_modes = {
        'polygons': {
            gl_program: new GL.Program(this.gl, GLRenderer.shader_sources['polygon_vertex'], GLRenderer.shader_sources['polygon_fragment']),
            makeGLGeometry: function (vertex_data) {
                return new GLTriangles(renderer.gl, this.gl_program, vertex_data);
            }
        },
        'polygons_noise': {
            gl_program: new GL.Program(this.gl, GLRenderer.shader_sources['polygon_vertex'], GLRenderer.shader_sources['polygon_fragment'], { defines: { 'EFFECT_NOISE_TEXTURE': true, 'EFFECT_NOISE_ANIMATABLE': true } }),
            makeGLGeometry: function (vertex_data) {
                return new GLTriangles(renderer.gl, this.gl_program, vertex_data);
            }
        },
        'points': {
            // TODO: replace relative shader paths with a better auto-pathing system
            // gl_program: new GL.Program.createProgramFromURLs(this.gl, VectorRenderer.library_base_url + '../shaders/point_vertex.glsl', VectorRenderer.library_base_url + '../shaders/point_fragment.glsl', { defines: { 'EFFECT_SCREEN_COLOR': true } }),
            gl_program: new GL.Program(this.gl, GLRenderer.shader_sources['point_vertex'], GLRenderer.shader_sources['point_fragment'], { defines: { 'EFFECT_SCREEN_COLOR': true } }),
            makeGLGeometry: function (vertex_data) {
                return new GLPolyPoints(renderer.gl, this.gl_program, vertex_data);
            }
        }
    };

    this.resizeMap(this.container.clientWidth, this.container.clientHeight);

    // this.zoom_step = 0.02; // for fractional zoom user adjustment
    this.start_time = +new Date();
    this.last_render_count = null;
    this.initInputHandlers();
};

// Determine a Z value that will stack features in a "painter's algorithm" style, first by layer, then by draw order within layer
// Features are assumed to be already sorted in desired draw order by the layer pre-processor
GLRenderer.calculateZ = function (layer, tile, layer_offset, feature_offset)
{
    // var layer_offset = layer_offset || 0;
    // var feature_offset = feature_offset || 0;
    var z = 0; // TODO: made this a no-op until revisiting where it should live - one-time calc here, in vertex layout/shader, etc.
    return z;
};

// Process geometry for tile - called by web worker
GLRenderer.addTile = function (tile, layers, styles)
{
    var layer, style, feature, z, mode;
    var vertex_data = {};

    // Join line test pattern
    // if (GLRenderer.debug) {
    //     tile.layers['roads'].features.push(GLRenderer.buildZigzagLineTestPattern());
    // }

    // Build raw geometry arrays
    tile.debug.features = 0;
    for (var ln=0; ln < layers.length; ln++) {
        layer = layers[ln];

        // Skip layers with no styles defined
        if (styles[layer.name] == null) {
            continue;
        }

        if (tile.layers[layer.name] != null) {
            var num_features = tile.layers[layer.name].features.length;

            // Rendering reverse order aka top to bottom
            for (var f = num_features-1; f >= 0; f--) {
                feature = tile.layers[layer.name].features[f];
                z = GLRenderer.calculateZ(layer, tile);
                style = VectorRenderer.parseStyleForFeature(feature, styles[layer.name], tile);

                // Skip feature?
                if (style == null) {
                    continue;
                }

                // First feature in this render mode?
                mode = style.render_mode;
                if (vertex_data[mode] == null) {
                    vertex_data[mode] = [];
                }

                // DEBUGGING line/tile intersections returned as points
                // #mapzen,40.74733011589617,-73.97535145282747,17
                // if (feature.id == 157964813 && feature.geometry.type == 'Point') {
                //     style.color = [1, 1, 0];
                //     style.size = Style.width.pixels(10, tile);
                // }

                var vertex_constants = [
                    style.color[0], style.color[1], style.color[2],
                    ln
                    // TODO: add material info, etc.
                ];

                if (style.outline.color) {
                    var outline_vertex_constants = [
                        style.outline.color[0], style.outline.color[1], style.outline.color[2],
                        ln - 0.5 // outlines sit between layers, underneath current layer but above the one below
                    ];
                }

                var points = null,
                    lines = null,
                    polygons = null;

                if (feature.geometry.type == 'Polygon') {
                    polygons = [feature.geometry.coordinates];
                }
                else if (feature.geometry.type == 'MultiPolygon') {
                    polygons = feature.geometry.coordinates;
                }
                else if (feature.geometry.type == 'LineString') {
                    lines = [feature.geometry.coordinates];
                }
                else if (feature.geometry.type == 'MultiLineString') {
                    lines = feature.geometry.coordinates;
                }
                else if (feature.geometry.type == 'Point') {
                    points = [feature.geometry.coordinates];
                }
                else if (feature.geometry.type == 'MultiPoint') {
                    points = feature.geometry.coordinates;
                }

                if (polygons != null) {
                    // Extruded polygons (e.g. 3D buildings)
                    if (style.extrude && style.height) {
                        GLBuilders.buildExtrudedPolygons(polygons, z, style.height, style.min_height, vertex_data[mode], { vertex_constants: vertex_constants });
                    }
                    // Regular polygons
                    else {
                        GLBuilders.buildPolygons(polygons, z, vertex_data[mode], { vertex_constants: vertex_constants });

                        // var polygon_vertex_constants = [z, 0, 0, 1].concat(vertex_constants); // upwards-facing normal
                        // GLBuilders.buildPolygons2(
                        //     polygons,
                        //     function (vertices) {
                        //         GL.addVertices(vertices.positions, vertex_data[mode], polygon_vertex_constants);
                        //     }
                        // );
                    }

                    // Polygon outlines
                    if (style.outline.color && style.outline.width) {
                        for (var mpc=0; mpc < polygons.length; mpc++) {
                            GLBuilders.buildPolylines(polygons[mpc], GLRenderer.calculateZ(layer, tile, -0.5), style.outline.width, vertex_data[mode], { closed_polygon: true, remove_tile_edges: true, vertex_constants: outline_vertex_constants });
                        }
                    }
                }

                if (lines != null) {
                    GLBuilders.buildPolylines(lines, z, style.width, vertex_data[mode], { vertex_constants: vertex_constants });

                    // Line outlines
                    if (style.outline.color && style.outline.width) {
                        GLBuilders.buildPolylines(lines, GLRenderer.calculateZ(layer, tile, -0.5), style.width + 2 * style.outline.width, vertex_data[mode], { vertex_constants: outline_vertex_constants });
                    }
                }

                if (points != null) {
                    // console.log(JSON.stringify(feature));
                    // NOTE: adding to z to experiment with "floating" POIs
                    var point_vertex_constants = [z + 1, 0, 0, 1].concat(vertex_constants); // upwards-facing normal
                    GLBuilders.buildQuads(
                        points, style.size * 2, style.size * 2,
                        function (vertices) {
                            var vs = vertices.positions;

                            // Alternate vertex layout for 'points' shader
                            if (mode == 'points') {
                                point_vertex_constants = vertex_constants;

                                for (var v in vertices.positions) {
                                    vs[v] = vertices.positions[v].concat(z+ 1, vertices.texcoords[v]);
                                }
                            }

                            // GL.addVertices(vertices.positions, vertex_data[mode], point_vertex_constants);
                            GL.addVertices(vs, vertex_data[mode], point_vertex_constants);
                        },
                        { texcoords: (mode == 'points') }
                    );
                }

                tile.debug.features++;
            }
        }
    }

    tile.vertex_data = {};
    for (var s in vertex_data) {
        tile.vertex_data[s] = new Float32Array(vertex_data[s]);
    }

    return tile;
};

// Called on main thread when a web worker completes processing for a single tile
GLRenderer.prototype._tileWorkerCompleted = function (tile)
{
    var vertex_data = tile.vertex_data;

    // Create GL geometry objects
    tile.gl_geometry = {};

    for (var s in vertex_data) {
        tile.gl_geometry[s] = this.render_modes[s].makeGLGeometry(vertex_data[s]);
    }

    tile.debug.geometries = 0;
    tile.debug.buffer_size = 0;
    for (var p in tile.gl_geometry) {
        tile.debug.geometries += tile.gl_geometry[p].geometry_count;
        tile.debug.buffer_size += tile.gl_geometry[p].vertex_data.byteLength;
    }

    tile.debug.geom_ratio = (tile.debug.geometries / tile.debug.features).toFixed(1);

    // Selection - experimental/future
    // var gl_renderer = this;
    // var pixel = new Uint8Array(4);
    // tileDiv.onmousemove = function (event) {
    //     // console.log(event.offsetX + ', ' + event.offsetY + ' | ' + parseInt(tileDiv.style.left) + ', ' + parseInt
    //     var p = Point(
    //         event.offsetX + parseInt(tileDiv.style.left),
    //         event.offsetY + parseInt(tileDiv.style.top)
    //     );
    //     gl_renderer.gl.readPixels(p.x, p.y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    //     console.log(p.x + ', ' + p.y + ': (' + pixel[0] + ', ' + pixel[1] + ', ' + pixel[2] + ', ' + pixel[3] + ')')
    // };

    delete tile.vertex_data; // TODO: might want to preserve this for rebuilding geometries when styles/etc. change?
};

GLRenderer.prototype.removeTile = function GLRendererRemoveTile (key)
{
    if (this.map_zooming == true) {
        return; // short circuit tile removal, GL renderer will sweep out tiles by zoom level when zoom ends
    }

    var tile = this.tiles[key];

    if (tile != null && tile.gl_geometry != null) {
        for (var p in tile.gl_geometry) {
            tile.gl_geometry[p].destroy();
        }
        tile.gl_geometry = null;
    }
    VectorRenderer.prototype.removeTile.apply(this, arguments);
};

GLRenderer.prototype.preserve_tiles_within_zoom = 2;
GLRenderer.prototype.setZoom = function (zoom)
{
    // Schedule GL tiles for removal on zoom
    console.log("renderer.map_last_zoom: " + this.map_last_zoom);

    this.map_zooming = false;
    this.zoom = zoom;
    var below = this.zoom;
    var above = this.zoom;
    if (Math.abs(this.zoom - this.map_last_zoom) <= this.preserve_tiles_within_zoom) {
        if (this.zoom > this.map_last_zoom) {
            below = this.zoom - this.preserve_tiles_within_zoom;
        }
        else {
            above = this.zoom + this.preserve_tiles_within_zoom;
        }
    }
    this.removeTilesOutsideZoomRange(below, above);
    this.map_last_zoom = this.zoom;
    this.dirty = true; // calling because this is a full override of the parent class
};

GLRenderer.prototype.removeTilesOutsideZoomRange = function (below, above)
{
    below = Math.min(below, this.tile_source.max_zoom || below);
    above = Math.min(above, this.tile_source.max_zoom || above);

    console.log("removeTilesOutsideZoomRange [" + below + ", " + above + "])");
    var remove_tiles = [];
    for (var t in this.tiles) {
        var tile = this.tiles[t];
        if (tile.coords.z < below || tile.coords.z > above) {
            remove_tiles.push(t);
        }
    }
    for (var r=0; r < remove_tiles.length; r++) {
        var key = remove_tiles[r];
        console.log("removed " + key + " (outside range [" + below + ", " + above + "])");
        this.removeTile(key);
    }
};

// Overrides base class method (a no op)
GLRenderer.prototype.resizeMap = function (width, height)
{
    VectorRenderer.prototype.resizeMap.apply(this, arguments);

    this.css_size = { width: width, height: height };
    this.device_size = { width: Math.round(this.css_size.width * this.device_pixel_ratio), height: Math.round(this.css_size.height * this.device_pixel_ratio) };

    this.canvas.style.width = this.css_size.width + 'px';
    this.canvas.style.height = this.css_size.height + 'px';
    this.canvas.width = this.device_size.width;
    this.canvas.height = this.device_size.height;
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
};

GLRenderer.prototype._render = function GLRendererRender ()
{
    var gl = this.gl;

    this.input();

    // Reset frame state
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);

    // Render tiles grouped by renderg mode (GL program)
    var render_count = 0;
    for (var mode in this.render_modes) {
        var gl_program = this.render_modes[mode].gl_program;

        gl.useProgram(gl_program.program);

        // TODO: set these once per program, don't set when they haven't changed
        gl_program.uniform('2f', 'resolution', this.css_size.width, this.css_size.height);
        gl_program.uniform('1f', 'time', ((+new Date()) - this.start_time) / 1000);

        var center = Geo.latLngToMeters(Point(this.center.lng, this.center.lat));
        gl_program.uniform('2f', 'map_center', center.x, center.y);
        gl_program.uniform('1f', 'map_zoom', this.zoom); // Math.floor(this.zoom) + (Math.log((this.zoom % 1) + 1) / Math.LN2 // scale fractional zoom by log
        gl_program.uniform('1f', 'num_layers', this.layers.length);

        var meters_per_pixel = Geo.min_zoom_meters_per_pixel / Math.pow(2, this.zoom);
        var meter_zoom = Point(this.css_size.width / 2 * meters_per_pixel, this.css_size.height / 2 * meters_per_pixel);
        gl_program.uniform('2f', 'meter_zoom', meter_zoom.x, meter_zoom.y);

        // TODO: make a list of renderable tiles once per frame, outside this loop
        // Render tile GL geometries
        var capped_zoom = Math.min(~~this.zoom, this.tile_source.max_zoom || ~~this.zoom);
        for (var t in this.tiles) {
            var tile = this.tiles[t];
            if (tile.loaded == true &&
                tile.visible == true &&
                Math.min(tile.coords.z, this.tile_source.max_zoom || tile.coords.z) == capped_zoom) {

                if (tile.gl_geometry[mode] != null) {
                    gl_program.uniform('2f', 'tile_min', tile.min.x, tile.min.y);
                    gl_program.uniform('2f', 'tile_max', tile.max.x, tile.max.y);

                    tile.gl_geometry[mode].render();
                    render_count += tile.gl_geometry[mode].geometry_count;
                }
            }
        }
    }

    if (render_count != this.last_render_count && tiles_debug) {
        console.log("rendered " + render_count + " primitives");
    }
    this.last_render_count = render_count;

    if (this.continuous_animation == true) {
        this.dirty = true;
    }

    return true;
};

// Sum of a debug property across tiles
GLRenderer.prototype.getDebugSum = function (prop, filter)
{
    var sum = 0;
    for (var t in this.tiles) {
        if (this.tiles[t].debug[prop] != null && (typeof filter != 'function' || filter(this.tiles[t]) == true)) {
            sum += this.tiles[t].debug[prop];
        }
    }
    return sum;
};

// Average of a debug property across tiles
GLRenderer.prototype.getDebugAverage = function (prop, filter)
{
    return this.getDebugSum(prop, filter) / Object.keys(this.tiles).length;
};

// User input
// TODO: restore fractional zoom support once leaflet animation refactor pull request is merged

GLRenderer.prototype.initInputHandlers = function GLRendererInitInputHandlers ()
{
    var gl_renderer = this;
    gl_renderer.key = null;

    document.addEventListener('keydown', function (event) {
        if (event.keyCode == 37) {
            gl_renderer.key = 'left';
        }
        else if (event.keyCode == 39) {
            gl_renderer.key = 'right';
        }
        else if (event.keyCode == 38) {
            gl_renderer.key = 'up';
        }
        else if (event.keyCode == 40) {
            gl_renderer.key = 'down';
        }
        else if (event.keyCode == 83) { // s
            console.log("reloading shaders");
            for (var mode in this.render_modes) {
                this.render_modes[mode].gl_program.compile();
            }
            gl_renderer.dirty = true;
        }
    });

    document.addEventListener('keyup', function (event) {
        gl_renderer.key = null;
    });
};

GLRenderer.prototype.input = function GLRendererInput ()
{
    // // Fractional zoom scaling
    // if (this.key == 'up') {
    //     this.setZoom(this.zoom + this.zoom_step);
    // }
    // else if (this.key == 'down') {
    //     this.setZoom(this.zoom - this.zoom_step);
    // }
};

if (module !== undefined) {
    module.exports = GLRenderer;
}

},{"../geo.js":2,"../point.js":10,"../vector_renderer.js":13,"./gl.js":3,"./gl_builders.js":4,"./gl_geom.js":5,"./gl_shaders.js":7}],7:[function(_dereq_,module,exports){
// Generated from GLSL files, don't edit!
var shader_sources = {};

shader_sources['point_fragment'] =
"uniform vec2 resolution;\n" +
"\n" +
"varying vec3 fcolor;\n" +
"varying vec2 ftexcoord;\n" +
"\n" +
"void main (void) {\n" +
"    vec4 color = vec4(fcolor, 1.);\n" +
"\n" +
"    // if (length(ftexcoord.xy) > 10.) {\n" +
"    //     // color = vec4(0., 0., 0., 0.);\n" +
"    //     discard;\n" +
"    // }\n" +
"\n" +
"    float len = length(ftexcoord);\n" +
"    if (len > 1.) {\n" +
"        discard;\n" +
"    }\n" +
"    color.rgb *= (1. - smoothstep(.25, 1., len)) + 0.5;\n" +
"    // color.a = (1. - smoothstep(2.5, 10., len)) + 0.25;\n" +
"\n" +
"    #if defined(EFFECT_SCREEN_COLOR)\n" +
"        // Mutate colors by screen position\n" +
"        color.rgb += vec3(gl_FragCoord.x / resolution.x, 0.0, gl_FragCoord.y / resolution.y);\n" +
"    #endif\n" +
"\n" +
"    gl_FragColor = color;\n" +
"}\n" +
"";

shader_sources['point_vertex'] =
"uniform vec2 map_center;\n" +
"uniform float map_zoom;\n" +
"uniform vec2 meter_zoom;\n" +
"uniform vec2 tile_min;\n" +
"uniform vec2 tile_max;\n" +
"uniform float num_layers;\n" +
"// uniform float time;\n" +
"\n" +
"attribute vec3 position;\n" +
"// attribute vec3 normal;\n" +
"attribute vec2 texcoord;\n" +
"attribute vec3 color;\n" +
"attribute float layer;\n" +
"\n" +
"varying vec3 fcolor;\n" +
"varying vec2 ftexcoord;\n" +
"\n" +
"// vec3 light = normalize(vec3(0.2, 0.7, -0.5)); // vec3(0.1, 0.2, -0.4)\n" +
"// const float ambient = 0.45;\n" +
"\n" +
"void main() {\n" +
"    vec3 vposition = position;\n" +
"    // vec3 vnormal = normal;\n" +
"    // vec2 vtexcoord = texcoord;\n" +
"\n" +
"    // Calc position of vertex in meters, relative to center of screen\n" +
"    vposition.y *= -1.0; // adjust for flipped y-coords\n" +
"    vposition.xy *= (tile_max - tile_min) / TILE_SCALE; // adjust for vertex location within tile (scaled from local coords to meters)\n" +
"    vposition.xy += tile_min.xy - map_center; // adjust for corner of tile relative to map center\n" +
"    vposition.xy /= meter_zoom; // adjust for zoom in meters to get clip space coords\n" +
"\n" +
"    // Shading & texture\n" +
"    fcolor = color;\n" +
"    ftexcoord = texcoord;\n" +
"\n" +
"    // #if defined(PROJECTION_PERSPECTIVE)\n" +
"    //     // Perspective-style projection\n" +
"    //     vec2 perspective_offset = vec2(-0.25, -0.25);\n" +
"    //     vec2 perspective_factor = vec2(0.8, 0.8); // vec2(-0.25, 0.75);\n" +
"    //     vposition.xy += vposition.z * perspective_factor * (vposition.xy - perspective_offset) / meter_zoom.xy; // perspective from offset center screen\n" +
"    // #elif defined(PROJECTION_ISOMETRIC) || defined(PROJECTION_POPUP)\n" +
"    //     // Pop-up effect - 3d in center of viewport, fading to 2d at edges\n" +
"    //     #if defined(PROJECTION_POPUP)\n" +
"    //         if (vposition.z > 1.0) {\n" +
"    //             float cd = distance(vposition.xy * (resolution.xy / resolution.yy), vec2(0.0, 0.0));\n" +
"    //             const float popup_fade_inner = 0.5;\n" +
"    //             const float popup_fade_outer = 0.75;\n" +
"    //             if (cd > popup_fade_inner) {\n" +
"    //                 vposition.z *= 1.0 - smoothstep(popup_fade_inner, popup_fade_outer, cd);\n" +
"    //             }\n" +
"    //             const float zoom_boost_start = 15.0;\n" +
"    //             const float zoom_boost_end = 17.0;\n" +
"    //             const float zoom_boost_magnitude = 0.75;\n" +
"    //             vposition.z *= 1.0 + (1.0 - smoothstep(zoom_boost_start, zoom_boost_end, map_zoom)) * zoom_boost_magnitude;\n" +
"    //         }\n" +
"    //     #endif\n" +
"\n" +
"    //     // Isometric-style projection\n" +
"    //     vposition.y += vposition.z / meter_zoom.y; // z coordinate is a simple translation up along y axis, ala isometric\n" +
"    //     // vposition.y += vposition.z * 0.5; // closer to Ultima 7-style axonometric\n" +
"    //     // vposition.x -= vposition.z * 0.5;\n" +
"    // #endif\n" +
"\n" +
"    // Reverse and scale to 0-1 for GL depth buffer\n" +
"    // Layers are force-ordered (higher layers guaranteed to render on top of lower), then by height/depth\n" +
"    float z_layer_scale = 4096.;\n" +
"    float z_layer_range = (num_layers + 1.) * z_layer_scale;\n" +
"    float z_layer = (layer + 1.) * z_layer_scale;\n" +
"    // float z_layer = (layer + 1.);\n" +
"\n" +
"    vposition.z = z_layer + clamp(vposition.z, 1., z_layer_scale);\n" +
"    vposition.z = (z_layer_range - vposition.z) / z_layer_range;\n" +
"\n" +
"    gl_Position = vec4(vposition, 1.0);\n" +
"}\n" +
"";

shader_sources['polygon_fragment'] =
"uniform vec2 resolution;\n" +
"uniform float time;\n" +
"\n" +
"varying vec3 fcolor;\n" +
"\n" +
"#if defined(EFFECT_NOISE_TEXTURE)\n" +
"    varying vec3 fposition;\n" +
"\n" +
"    // http://stackoverflow.com/questions/4200224/random-noise-functions-for-glsl\n" +
"    // float rand (vec2 co) {\n" +
"    //    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);\n" +
"    // }\n" +
"\n" +
"    // Noise functions from: https://github.com/ashima/webgl-noise\n" +
"    vec3 mod289(vec3 x) {\n" +
"        return x - floor(x * (1.0 / 289.0)) * 289.0;\n" +
"    }\n" +
"\n" +
"    vec4 mod289(vec4 x) {\n" +
"        return x - floor(x * (1.0 / 289.0)) * 289.0;\n" +
"    }\n" +
"\n" +
"    vec4 permute(vec4 x) {\n" +
"        return mod289(((x*34.0)+1.0)*x);\n" +
"    }\n" +
"\n" +
"    vec4 taylorInvSqrt(vec4 r) {\n" +
"        return 1.79284291400159 - 0.85373472095314 * r;\n" +
"    }\n" +
"\n" +
"    vec3 fade(vec3 t) {\n" +
"        return t*t*t*(t*(t*6.0-15.0)+10.0);\n" +
"    }\n" +
"\n" +
"    float snoise(vec3 v) {\n" +
"        const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;\n" +
"        const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);\n" +
"\n" +
"        // First corner\n" +
"        vec3 i  = floor(v + dot(v, C.yyy) );\n" +
"        vec3 x0 =   v - i + dot(i, C.xxx) ;\n" +
"\n" +
"        // Other corners\n" +
"        vec3 g = step(x0.yzx, x0.xyz);\n" +
"        vec3 l = 1.0 - g;\n" +
"        vec3 i1 = min( g.xyz, l.zxy );\n" +
"        vec3 i2 = max( g.xyz, l.zxy );\n" +
"\n" +
"        //   x0 = x0 - 0.0 + 0.0 * C.xxx;\n" +
"        //   x1 = x0 - i1  + 1.0 * C.xxx;\n" +
"        //   x2 = x0 - i2  + 2.0 * C.xxx;\n" +
"        //   x3 = x0 - 1.0 + 3.0 * C.xxx;\n" +
"        vec3 x1 = x0 - i1 + C.xxx;\n" +
"        vec3 x2 = x0 - i2 + C.yyy; // 2.0*C.x = 1/3 = C.y\n" +
"        vec3 x3 = x0 - D.yyy;      // -1.0+3.0*C.x = -0.5 = -D.y\n" +
"\n" +
"        // Permutations\n" +
"        i = mod289(i);\n" +
"        vec4 p = permute( permute( permute(\n" +
"        i.z + vec4(0.0, i1.z, i2.z, 1.0 ))\n" +
"        + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))\n" +
"        + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));\n" +
"\n" +
"        // Gradients: 7x7 points over a square, mapped onto an octahedron.\n" +
"        // The ring size 17*17 = 289 is close to a multiple of 49 (49*6 = 294)\n" +
"        float n_ = 0.142857142857; // 1.0/7.0\n" +
"        vec3  ns = n_ * D.wyz - D.xzx;\n" +
"\n" +
"        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);  //  mod(p,7*7)\n" +
"\n" +
"        vec4 x_ = floor(j * ns.z);\n" +
"        vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)\n" +
"\n" +
"        vec4 x = x_ *ns.x + ns.yyyy;\n" +
"        vec4 y = y_ *ns.x + ns.yyyy;\n" +
"        vec4 h = 1.0 - abs(x) - abs(y);\n" +
"\n" +
"        vec4 b0 = vec4( x.xy, y.xy );\n" +
"        vec4 b1 = vec4( x.zw, y.zw );\n" +
"\n" +
"        //vec4 s0 = vec4(lessThan(b0,0.0))*2.0 - 1.0;\n" +
"        //vec4 s1 = vec4(lessThan(b1,0.0))*2.0 - 1.0;\n" +
"        vec4 s0 = floor(b0)*2.0 + 1.0;\n" +
"        vec4 s1 = floor(b1)*2.0 + 1.0;\n" +
"        vec4 sh = -step(h, vec4(0.0));\n" +
"\n" +
"        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;\n" +
"        vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;\n" +
"\n" +
"        vec3 p0 = vec3(a0.xy,h.x);\n" +
"        vec3 p1 = vec3(a0.zw,h.y);\n" +
"        vec3 p2 = vec3(a1.xy,h.z);\n" +
"        vec3 p3 = vec3(a1.zw,h.w);\n" +
"\n" +
"        //Normalise gradients\n" +
"        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));\n" +
"        p0 *= norm.x;\n" +
"        p1 *= norm.y;\n" +
"        p2 *= norm.z;\n" +
"        p3 *= norm.w;\n" +
"\n" +
"        // Mix final noise value\n" +
"        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);\n" +
"        m = m * m;\n" +
"        return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );\n" +
"    }\n" +
"\n" +
"    // Classic Perlin noise\n" +
"    float cnoise(vec3 P) {\n" +
"        vec3 Pi0 = floor(P); // Integer part for indexing\n" +
"        vec3 Pi1 = Pi0 + vec3(1.0); // Integer part + 1\n" +
"        Pi0 = mod289(Pi0);\n" +
"        Pi1 = mod289(Pi1);\n" +
"        vec3 Pf0 = fract(P); // Fractional part for interpolation\n" +
"        vec3 Pf1 = Pf0 - vec3(1.0); // Fractional part - 1.0\n" +
"        vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);\n" +
"        vec4 iy = vec4(Pi0.yy, Pi1.yy);\n" +
"        vec4 iz0 = Pi0.zzzz;\n" +
"        vec4 iz1 = Pi1.zzzz;\n" +
"\n" +
"        vec4 ixy = permute(permute(ix) + iy);\n" +
"        vec4 ixy0 = permute(ixy + iz0);\n" +
"        vec4 ixy1 = permute(ixy + iz1);\n" +
"\n" +
"        vec4 gx0 = ixy0 * (1.0 / 7.0);\n" +
"        vec4 gy0 = fract(floor(gx0) * (1.0 / 7.0)) - 0.5;\n" +
"        gx0 = fract(gx0);\n" +
"        vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);\n" +
"        vec4 sz0 = step(gz0, vec4(0.0));\n" +
"        gx0 -= sz0 * (step(0.0, gx0) - 0.5);\n" +
"        gy0 -= sz0 * (step(0.0, gy0) - 0.5);\n" +
"\n" +
"        vec4 gx1 = ixy1 * (1.0 / 7.0);\n" +
"        vec4 gy1 = fract(floor(gx1) * (1.0 / 7.0)) - 0.5;\n" +
"        gx1 = fract(gx1);\n" +
"        vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);\n" +
"        vec4 sz1 = step(gz1, vec4(0.0));\n" +
"        gx1 -= sz1 * (step(0.0, gx1) - 0.5);\n" +
"        gy1 -= sz1 * (step(0.0, gy1) - 0.5);\n" +
"\n" +
"        vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);\n" +
"        vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);\n" +
"        vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);\n" +
"        vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);\n" +
"        vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);\n" +
"        vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);\n" +
"        vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);\n" +
"        vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);\n" +
"\n" +
"        vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));\n" +
"        g000 *= norm0.x;\n" +
"        g010 *= norm0.y;\n" +
"        g100 *= norm0.z;\n" +
"        g110 *= norm0.w;\n" +
"        vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));\n" +
"        g001 *= norm1.x;\n" +
"        g011 *= norm1.y;\n" +
"        g101 *= norm1.z;\n" +
"        g111 *= norm1.w;\n" +
"\n" +
"        float n000 = dot(g000, Pf0);\n" +
"        float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));\n" +
"        float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));\n" +
"        float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));\n" +
"        float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));\n" +
"        float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));\n" +
"        float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));\n" +
"        float n111 = dot(g111, Pf1);\n" +
"\n" +
"        vec3 fade_xyz = fade(Pf0);\n" +
"        vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);\n" +
"        vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);\n" +
"        float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);\n" +
"        return 2.2 * n_xyz;\n" +
"    }\n" +
"\n" +
"    // Classic Perlin noise, periodic variant\n" +
"    float pnoise(vec3 P, vec3 rep) {\n" +
"        vec3 Pi0 = mod(floor(P), rep); // Integer part, modulo period\n" +
"        vec3 Pi1 = mod(Pi0 + vec3(1.0), rep); // Integer part + 1, mod period\n" +
"        Pi0 = mod289(Pi0);\n" +
"        Pi1 = mod289(Pi1);\n" +
"        vec3 Pf0 = fract(P); // Fractional part for interpolation\n" +
"        vec3 Pf1 = Pf0 - vec3(1.0); // Fractional part - 1.0\n" +
"        vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);\n" +
"        vec4 iy = vec4(Pi0.yy, Pi1.yy);\n" +
"        vec4 iz0 = Pi0.zzzz;\n" +
"        vec4 iz1 = Pi1.zzzz;\n" +
"\n" +
"        vec4 ixy = permute(permute(ix) + iy);\n" +
"        vec4 ixy0 = permute(ixy + iz0);\n" +
"        vec4 ixy1 = permute(ixy + iz1);\n" +
"\n" +
"        vec4 gx0 = ixy0 * (1.0 / 7.0);\n" +
"        vec4 gy0 = fract(floor(gx0) * (1.0 / 7.0)) - 0.5;\n" +
"        gx0 = fract(gx0);\n" +
"        vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);\n" +
"        vec4 sz0 = step(gz0, vec4(0.0));\n" +
"        gx0 -= sz0 * (step(0.0, gx0) - 0.5);\n" +
"        gy0 -= sz0 * (step(0.0, gy0) - 0.5);\n" +
"\n" +
"        vec4 gx1 = ixy1 * (1.0 / 7.0);\n" +
"        vec4 gy1 = fract(floor(gx1) * (1.0 / 7.0)) - 0.5;\n" +
"        gx1 = fract(gx1);\n" +
"        vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);\n" +
"        vec4 sz1 = step(gz1, vec4(0.0));\n" +
"        gx1 -= sz1 * (step(0.0, gx1) - 0.5);\n" +
"        gy1 -= sz1 * (step(0.0, gy1) - 0.5);\n" +
"\n" +
"        vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);\n" +
"        vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);\n" +
"        vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);\n" +
"        vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);\n" +
"        vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);\n" +
"        vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);\n" +
"        vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);\n" +
"        vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);\n" +
"\n" +
"        vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));\n" +
"        g000 *= norm0.x;\n" +
"        g010 *= norm0.y;\n" +
"        g100 *= norm0.z;\n" +
"        g110 *= norm0.w;\n" +
"        vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));\n" +
"        g001 *= norm1.x;\n" +
"        g011 *= norm1.y;\n" +
"        g101 *= norm1.z;\n" +
"        g111 *= norm1.w;\n" +
"\n" +
"        float n000 = dot(g000, Pf0);\n" +
"        float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));\n" +
"        float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));\n" +
"        float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));\n" +
"        float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));\n" +
"        float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));\n" +
"        float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));\n" +
"        float n111 = dot(g111, Pf1);\n" +
"\n" +
"        vec3 fade_xyz = fade(Pf0);\n" +
"        vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);\n" +
"        vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);\n" +
"        float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);\n" +
"        return 2.2 * n_xyz;\n" +
"    }\n" +
"#endif\n" +
"\n" +
"void main (void) {\n" +
"\n" +
"    #if defined(EFFECT_SPOTLIGHT)\n" +
"    // Spotlight effect\n" +
"        vec2 position = gl_FragCoord.xy / resolution.xy;    // scale coords to [0.0, 1.0]\n" +
"        position = position * 2.0 - 1.0;                    // scale coords to [-1.0, 1.0]\n" +
"        position.y *= resolution.y / resolution.x;          // correct aspect ratio\n" +
"\n" +
"        vec3 color = fcolor * max(1.0 - distance(position, vec2(0.0, 0.0)), 0.2);\n" +
"        // vec3 color = fcolor * (1.0 - dot(normalize(vec3(rand(gl_FragCoord.xy * 0.01) * 10.0, 0.0, -1.0)), vec3(0, 0, 1.0)));\n" +
"    #else\n" +
"        vec3 color = fcolor;\n" +
"    #endif\n" +
"\n" +
"    #if defined(EFFECT_COLOR_BLEED)\n" +
"        // Mutate colors by screen position or time\n" +
"        color += vec3(gl_FragCoord.x / resolution.x, 0.0, gl_FragCoord.y / resolution.y);\n" +
"        color.r += sin(time / 3.0);\n" +
"    #endif\n" +
"\n" +
"    // Mutate color by 3d noise\n" +
"    #if defined (EFFECT_NOISE_TEXTURE)\n" +
"        #if defined(EFFECT_NOISE_ANIMATABLE) && defined(EFFECT_NOISE_ANIMATED)\n" +
"            color *= (abs(cnoise((fposition + vec3(time * 5., time * 7.5, time * 10.)) / 10.0)) / 4.0) + 0.75;\n" +
"        #endif\n" +
"        #ifndef EFFECT_NOISE_ANIMATABLE\n" +
"            color *= (abs(cnoise(fposition / 10.0)) / 4.0) + 0.75;\n" +
"        #endif\n" +
"    #endif\n" +
"\n" +
"    gl_FragColor = vec4(color, 1.0);\n" +
"    // gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);\n" +
"}\n" +
"";

shader_sources['polygon_vertex'] =
"// #define PROJECTION_PERSPECTIVE\n" +
"// #define PROJECTION_ISOMETRIC\n" +
"// #define PROJECTION_POPUP\n" +
"\n" +
"// #define LIGHTING_POINT\n" +
"// #define LIGHTING_DIRECTION\n" +
"\n" +
"// #define ANIMATION_ELEVATOR\n" +
"// #define ANIMATION_WAVE\n" +
"\n" +
"uniform vec2 resolution;\n" +
"uniform vec2 map_center;\n" +
"uniform float map_zoom;\n" +
"uniform vec2 meter_zoom;\n" +
"uniform vec2 tile_min;\n" +
"uniform vec2 tile_max;\n" +
"uniform float num_layers;\n" +
"uniform float time;\n" +
"uniform float u_heightVar;\n" +
"uniform float u_layerVar;\n" +
"uniform float u_lightAzimuth;\n" +
"uniform float u_lightElevation;\n" +
"uniform float u_lightRadius;\n" +
"uniform float u_lightx;\n" +
"uniform float u_lighty;\n" +
"uniform float u_lightz;\n" +
"uniform float u_lightIntensity;\n" +
"uniform float u_lightAmbient;\n" +
"uniform float u_lightHeight;\n" +
"uniform float u_heightLimit;\n" +
"uniform vec3 u_lightPosition;\n" +
"uniform vec3 testUniformColor0;\n" +
"uniform vec3 testUniformColor1;\n" +
"uniform vec3 testUniformColor2;\n" +
"uniform vec3 testUniformColor3;\n" +
"uniform vec3 testUniformColor4;\n" +
"uniform vec3 testUniformColor5;\n" +
"uniform vec3 testUniformColor6;\n" +
"uniform vec3 testUniformColor7;\n" +
"uniform vec3 testUniformColor8;\n" +
"uniform vec3 testUniformColor9;\n" +
"\n" +
"attribute vec3 position;\n" +
"attribute vec3 normal;\n" +
"attribute vec3 color;\n" +
"attribute float layer;\n" +
"\n" +
"varying vec3 fcolor;\n" +
"\n" +
"#if defined(EFFECT_NOISE_TEXTURE)\n" +
"    varying vec3 fposition;\n" +
"#endif\n" +
"\n" +
"vec3 light = normalize(vec3(0.2, 0.7, -0.5)); // vec3(0.1, 0.2, -0.4)\n" +
"const float ambient = .45;\n" +
"\n" +
"// Project lat-lng to mercator\n" +
"// vec2 latLngToMeters (vec2 coordinate) {\n" +
"//     const float pi = 3.1415926;\n" +
"//     const float half_circumference_meters = 20037508.342789244;\n" +
"//     vec2 projected;\n" +
"\n" +
"//     // Latitude\n" +
"//     projected.y = log(tan((coordinate.y + 90.0) * pi / 360.0)) / (pi / 180.0);\n" +
"//     projected.y = projected.y * half_circumference_meters / 180.0;\n" +
"\n" +
"//     // Longitude\n" +
"//     projected.x = coordinate.x * half_circumference_meters / 180.0;\n" +
"\n" +
"//     return projected;\n" +
"// }\n" +
"\n" +
"vec3 sphericalToCartesian( float azimuth, float elevation, float radius ) {\n" +
"    // float z = sqrt(( pow(radius, 2.0) * pow(cos(azimuth), 2.0) )/(1.0 + pow(cos(azimuth), 2.0) * pow(tan(elevation), 2.0)));\n" +
"    // float z = 1.0;\n" +
"    float x = radius * sin(elevation) * cos(azimuth);\n" +
"    float y = radius * sin(elevation) * sin(azimuth);\n" +
"    float z = radius * cos(elevation);\n" +
"    return vec3(x, y, z);\n" +
"}\n" +
"\n" +
"void main() {\n" +
"    vec3 vposition = position;\n" +
"    vec3 vnormal = normal;\n" +
"\n" +
"    // Calc position of vertex in meters, relative to center of screen\n" +
"    vposition.y *= -1.0; // adjust for flipped y-coords\n" +
"    // vposition.y += TILE_SCALE; // alternate, to also adjust for force-positive y coords in tile\n" +
"    vposition.xy *= (tile_max - tile_min) / TILE_SCALE; // adjust for vertex location within tile (scaled from local coords to meters)\n" +
"\n" +
"    // vposition.z *= testUniform;\n" +
"\n" +
"    // Vertex displacement + procedural effects\n" +
"    #if defined(ANIMATION_ELEVATOR) || defined(ANIMATION_WAVE) || defined(EFFECT_NOISE_TEXTURE)\n" +
"        vec3 vposition_world = vposition + vec3(tile_min, 0.); // need vertex in world coords (before map center transform), hack to get around precision issues (see below)\n" +
"\n" +
"        #if defined(EFFECT_NOISE_TEXTURE)\n" +
"            fposition = vposition_world;\n" +
"        #endif\n" +
"\n" +
"        if (vposition_world.z > 1.0) {\n" +
"            // vposition.x += sin(vposition_world.z + time) * 10.0 * sin(position.x); // swaying buildings\n" +
"            // vposition.y += cos(vposition_world.z + time) * 10.0;\n" +
"\n" +
"            #if defined(ANIMATION_ELEVATOR)\n" +
"                // vposition.z *= (sin(vposition_world.z / 25.0 * time) + 1.0) / 2.0 + 0.1; // evelator buildings\n" +
"                vposition.z *= max((sin(vposition_world.z + time) + 1.0) / 2.0, 0.05); // evelator buildings\n" +
"            #elif defined(ANIMATION_WAVE)\n" +
"                vposition.z *= max((sin(vposition_world.x / 100.0 + time) + 1.0) / 2.0, 0.05); // wave\n" +
"            #endif\n" +
"        }\n" +
"    #endif\n" +
"\n" +
"    // NOTE: due to unresolved floating point precision issues, tile and map center adjustment need to happen in ONE operation, or artifcats are introduced\n" +
"    vposition.xy += tile_min.xy - map_center; // adjust for corner of tile relative to map center\n" +
"    vposition.xy /= meter_zoom; // adjust for zoom in meters to get clip space coords\n" +
"\n" +
"    // Shading\n" +
"    fcolor = color;\n" +
"    // if (color[0] == 0.5) {\n" +
"    //     fcolor = testUniformColor1;\n" +
"    // } \n" +
"    // if (color[0] == 0.6) {\n" +
"    //     fcolor = testUniformColor2;\n" +
"    // } \n" +
"    if (layer == 0.0) {\n" +
"        fcolor = testUniformColor0;\n" +
"    } \n" +
"    if (layer == 1.0) {\n" +
"        fcolor = testUniformColor1;\n" +
"    } \n" +
"    if (layer == 2.0) {\n" +
"        fcolor = testUniformColor2;\n" +
"    } \n" +
"    if (layer == 3.0) {\n" +
"        fcolor = testUniformColor3;\n" +
"    } \n" +
"    if (layer == 4.0) {\n" +
"        fcolor = testUniformColor4;\n" +
"    } \n" +
"    if (layer == 5.0) {\n" +
"        fcolor = testUniformColor5;\n" +
"    } \n" +
"    if (layer == 6.0) {\n" +
"        fcolor = testUniformColor6;\n" +
"    } \n" +
"    if (layer == 7.0) {\n" +
"        fcolor = testUniformColor7;\n" +
"    } \n" +
"    if (layer == 8.0) {\n" +
"        fcolor = testUniformColor8;\n" +
"    } \n" +
"    if (layer == 9.0) {\n" +
"        fcolor = testUniformColor9;\n" +
"    } \n" +
"    // if (layer == u_layerVar) {\n" +
"    //     fcolor = testUniformColor1;\n" +
"    // } \n" +
"\n" +
"    // fcolor += vec3(sin(position.z + time), 0.0, 0.0); // color change on height + time\n" +
"    // fcolor += vec3(position.z) * vec3(testUniform); // color change on height + time\n" +
"\n" +
"    float height_multiplier = u_lightHeight * 0.01;\n" +
"    float height_factor = clamp(vposition.z * height_multiplier, 0.0, u_heightLimit);\n" +
"\n" +
"    #if defined(LIGHTING_POINT) || defined(LIGHTING_NIGHT)\n" +
"        // Gouraud shading\n" +
"        // light = vec3(-0.25, -0.25, 0.50); // vec3(0.1, 0.1, 0.35); // point light location\n" +
"\n" +
"        // reverse azimuth rotation direction, rotate so 0 == north, and convert to raidans\n" +
"        float azimuth = ((360.0 - u_lightAzimuth + 90.0) * 3.14159) / 180.0;\n" +
"        // convert elevation range from 0..1 to pi/2..0 aka horizon to straight overhead\n" +
"        float elevation = (1.0 - u_lightElevation) * (3.14159 / 2.0);\n" +
"        // light = sphericalToCartesian(azimuth, elevation, u_lightRadius);\n" +
"        // fix light sphere radius so light is always offscreen\n" +
"        light = sphericalToCartesian(azimuth, elevation, 10.0);\n" +
"\n" +
"        #if defined(LIGHTING_NIGHT)\n" +
"            // \"Night\" effect by flipping vertex z\n" +
"            light = normalize(vec3(vposition.x, vposition.y, vposition.z) - light); // light angle from light point to vertex\n" +
"            fcolor *= dot(vnormal, light * -1.0); // + ambient + clamp(vposition.z * 2.0 / meter_zoom.x, 0.0, 0.25);\n" +
"            // fcolor *= dot(vnormal, light - u_lightAmbient * -1.0); // + ambient + clamp(vposition.z * 2.0 / meter_zoom.x, 0.0, 0.25);\n" +
"        #else\n" +
"            // Point light-based gradient\n" +
"            light = normalize(vec3(vposition.x, vposition.y, -vposition.z) - light); // light angle from light point to vertex\n" +
"            // fcolor *= dot(vnormal, light * -1.0) + ambient + clamp(vposition.z * testUniform / meter_zoom.x, 0.0, 0.25);\n" +
"            fcolor *= dot(vnormal, light * -1.0 * u_lightIntensity) + u_lightAmbient + height_factor;\n" +
"        #endif\n" +
"\n" +
"    #elif defined(LIGHTING_DIRECTION)\n" +
"        // Flat shading\n" +
"        light = normalize(vec3(0.2, 0.7, -0.5));\n" +
"        // fcolor *= max(dot(vnormal, light * -1.0), 0.1) + ambient;\n" +
"        fcolor *= dot(vnormal, light * -1.0) + u_lightAmbient + (height_factor);\n" +
"    #endif\n" +
"\n" +
"    #if defined(PROJECTION_PERSPECTIVE)\n" +
"        // // Perspective-style projection\n" +
"        vec2 perspective_offset = vec2(-0.5, -0.5);\n" +
"        // vec2 perspective_offset = vec2(0.0,0.0);\n" +
"        // vec2 perspective_offset = vec2(-0.25, -0.25) + vec2(testUniform);\n" +
"        // vec2 perspective_factor = vec2(0.8, 0.8); // vec2(-0.25, 0.75);\n" +
"        vec2 perspective_factor = vec2(0.8, 0.8) * vec2(u_heightVar); // vec2(-0.25, 0.75);\n" +
"        vposition.xy += vposition.z * perspective_factor * (vposition.xy - perspective_offset) / meter_zoom.xy; // perspective from offset center screen\n" +
"        // vposition.xy += vec2(vposition.z * testUniform/1000.0);\n" +
"    #elif defined(PROJECTION_ISOMETRIC) || defined(PROJECTION_POPUP)\n" +
"        // Pop-up effect - 3d in center of viewport, fading to 2d at edges\n" +
"        #if defined(PROJECTION_POPUP)\n" +
"            if (vposition.z > 1.0) {\n" +
"                float cd = distance(vposition.xy * (resolution.xy / resolution.yy), vec2(0.0, 0.0));\n" +
"                const float popup_fade_inner = 0.05;\n" +
"                const float popup_fade_outer = 0.75;\n" +
"                if (cd > popup_fade_inner) {\n" +
"                    vposition.z *= 1.0 - smoothstep(popup_fade_inner, popup_fade_outer, cd);\n" +
"                }\n" +
"                const float zoom_boost_start = 15.0;\n" +
"                const float zoom_boost_end = 17.0;\n" +
"                const float zoom_boost_magnitude = 0.75;\n" +
"                vposition.z *= 1.0 + (1.0 - smoothstep(zoom_boost_start, zoom_boost_end, map_zoom)) * zoom_boost_magnitude;\n" +
"            }\n" +
"        #endif\n" +
"\n" +
"        // Isometric-style projection\n" +
"        vposition.y += vposition.z * u_heightVar / meter_zoom.y; // z coordinate is a simple translation up along y axis, ala isometric\n" +
"        // vposition.y += vposition.z * 0.5; // closer to Ultima 7-style axonometric\n" +
"        // vposition.x -= vposition.z * 0.5;\n" +
"    #endif\n" +
"\n" +
"    // Rotation test\n" +
"    // float theta = 0;\n" +
"    // const float pi = 3.1415926;\n" +
"    // vec2 pr;\n" +
"    // pr.x = vposition.x * cos(theta * pi / 180.0) + vposition.y * -sin(theta * pi / 180.0);\n" +
"    // pr.y = vposition.x * sin(theta * pi / 180.0) + vposition.y * cos(theta * pi / 180.0);\n" +
"    // vposition.xy = pr;\n" +
"\n" +
"    // vposition.y *= max(abs(sin(vposition.x)), 0.1); // hourglass effect\n" +
"    // vposition.y *= abs(max(sin(vposition.x), 0.1)); // funnel effect\n" +
"\n" +
"    // Reverse and scale to 0-1 for GL depth buffer\n" +
"    // Layers are force-ordered (higher layers guaranteed to render on top of lower), then by height/depth\n" +
"    float z_layer_scale = 4096.;\n" +
"    float z_layer_range = (num_layers + 1.) * z_layer_scale;\n" +
"    float z_layer = (layer + 1.) * z_layer_scale;\n" +
"\n" +
"    vposition.z = z_layer + clamp(vposition.z, 1., z_layer_scale);\n" +
"    vposition.z = (z_layer_range - vposition.z) / z_layer_range;\n" +
"\n" +
"    gl_Position = vec4(vposition, 1.0);\n" +
"}\n" +
"";

if (module.exports !== undefined) { module.exports = shader_sources; }


},{}],8:[function(_dereq_,module,exports){
var VectorRenderer = _dereq_('./vector_renderer.js');

var LeafletLayer = L.GridLayer.extend({

    options: {
        vectorRenderer: 'canvas'
    },

    initialize: function (options) {
        L.setOptions(this, options);
        this.options.vectorRenderer = this.options.vectorRenderer || 'GLRenderer';
        this._renderer = VectorRenderer.create(this.options.vectorRenderer, this.options.vectorTileSource, this.options.vectorLayers, this.options.vectorStyles, { num_workers: this.options.numWorkers });
        this._renderer.debug = this.options.debug;
        this._renderer.continuous_animation = false; // set to true for animatinos, etc. (eventually will be automated)
    },

    // Finish initializing renderer and setup events when layer is added to map
    onAdd: function (map) {
        var layer = this;

        layer.on('tileunload', function (event) {
            var tile = event.tile;
            var key = tile.getAttribute('data-tile-key');
            layer._renderer.removeTile(key);
        });

        layer._map.on('resize', function () {
            var size = layer._map.getSize();
            layer._renderer.resizeMap(size.x, size.y);
            layer.updateBounds();
        });

        layer._map.on('move', function () {
            var center = layer._map.getCenter();
            layer._renderer.setCenter(center.lng, center.lat);
            layer.updateBounds();
        });

        layer._map.on('zoomstart', function () {
            console.log("map.zoomstart " + layer._map.getZoom());
            layer._renderer.startZoom();
        });

        layer._map.on('zoomend', function () {
            console.log("map.zoomend " + layer._map.getZoom());
            layer._renderer.setZoom(layer._map.getZoom());
        });

        // Canvas element will be inserted after map container (leaflet transforms shouldn't be applied to the GL canvas)
        // TODO: find a better way to deal with this? right now GL map only renders correctly as the bottom layer
        layer._renderer.container = layer._map.getContainer();

        var center = layer._map.getCenter();
        layer._renderer.setCenter(center.lng, center.lat);
        layer._renderer.setZoom(layer._map.getZoom());
        layer.updateBounds();

        L.GridLayer.prototype.onAdd.apply(this, arguments);
        layer._renderer.init();
    },

    onRemove: function (map) {
        L.GridLayer.prototype.onRemove.apply(this, arguments);
        // TODO: remove event handlers, destroy map
    },

    createTile: function (coords, done) {
        var div = document.createElement('div');
        this._renderer.loadTile(coords, div, done);
        return div;
    },

    updateBounds: function () {
        var layer = this;
        var bounds = layer._map.getBounds();
        layer._renderer.setBounds(bounds.getSouthWest(), bounds.getNorthEast());
    },

    render: function () {
        this._renderer.render();
    }

});

var leafletLayer = function (options) {
    return new LeafletLayer(options);
};

if (module !== undefined) {
    module.exports = {
        LeafletLayer: LeafletLayer,
        leafletLayer: leafletLayer
    };
}

},{"./vector_renderer.js":13}],9:[function(_dereq_,module,exports){
// Modules and dependencies to expose in the public Tangram module

// The leaflet layer plugin is currently the primary means of using the library
var Leaflet = _dereq_('./leaflet_layer.js');

// Renderer modules need to be explicitly included since they are not otherwise referenced
_dereq_('./gl/gl_renderer.js');
_dereq_('./canvas/canvas_renderer.js');

// GL functions included for easier debugging / direct access to setting global defines, reloading programs, etc.
var GL = _dereq_('./gl/gl.js');

if (module !== undefined) {
    module.exports = {
        LeafletLayer: Leaflet.LeafletLayer,
        leafletLayer: Leaflet.leafletLayer,
        GL: GL
    };
}

},{"./canvas/canvas_renderer.js":1,"./gl/gl.js":3,"./gl/gl_renderer.js":6,"./leaflet_layer.js":8}],10:[function(_dereq_,module,exports){
// Point
function Point (x, y)
{
    return { x: x, y: y };
}

Point.copy = function (p)
{
    if (p == null) {
        return null;
    }
    return { x: p.x, y: p.y };
};

if (module !== undefined) {
    module.exports = Point;
}

},{}],11:[function(_dereq_,module,exports){
/*** Style helpers ***/

var Style = {};

Style.color = {
    pseudoRandomGrayscale: function (f) { var c = Math.max((parseInt(f.id, 16) % 100) / 100, 0.4); return [0.7 * c, 0.7 * c, 0.7 * c]; }, // pseudo-random grayscale by geometry id
    pseudoRandomColor: function (f) { return [0.7 * (parseInt(f.id, 16) / 100 % 1), 0.7 * (parseInt(f.id, 16) / 10000 % 1), 0.7 * (parseInt(f.id, 16) / 1000000 % 1)]; }, // pseudo-random color by geometry id
    randomColor: function (f) { return [0.7 * Math.random(), 0.7 * Math.random(), 0.7 * Math.random()]; } // random color
};

Style.width = {
    pixels: function (p) { return function (f, t) { return (typeof p == 'function' ? p(f, t) : p) * t.units_per_pixel; }; }, // local tile units for a given pixel width
    meters: function (p) { return function (f, t) { return (typeof p == 'function' ? p(f, t) : p) * t.units_per_meter; }; }  // local tile units for a given meter width
};

if (module !== undefined) {
    module.exports = Style;
}

},{}],12:[function(_dereq_,module,exports){
/*** Vector functions - vectors provided as [x, y, z] arrays ***/

var Vector = {};

// Vector length squared
Vector.lengthSq = function (v)
{
    if (v.length == 2) {
        return (v[0]*v[0] + v[1]*v[1]);
    }
    else {
        return (v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
    }
};

// Vector length
Vector.length = function (v)
{
    return Math.sqrt(Vector.lengthSq(v));
};

// Normalize a vector
Vector.normalize = function (v)
{
    var d;
    if (v.length == 2) {
        d = v[0]*v[0] + v[1]*v[1];
        d = Math.sqrt(d);

        if (d != 0) {
            return [v[0] / d, v[1] / d];
        }
        return [0, 0];
    }
    else {
        var d = v[0]*v[0] + v[1]*v[1] + v[2]*v[2];
        d = Math.sqrt(d);

        if (d != 0) {
            return [v[0] / d, v[1] / d, v[2] / d];
        }
        return [0, 0, 0];
    }
};

// Cross product of two vectors
Vector.cross  = function (v1, v2)
{
    return [
        (v1[1] * v2[2]) - (v1[2] * v2[1]),
        (v1[2] * v2[0]) - (v1[0] * v2[2]),
        (v1[0] * v2[1]) - (v1[1] * v2[0])
    ];
};

// Find the intersection of two lines specified as segments from points (p1, p2) and (p3, p4)
// http://en.wikipedia.org/wiki/Line-line_intersection
// http://en.wikipedia.org/wiki/Cramer's_rule
Vector.lineIntersection = function (p1, p2, p3, p4, parallel_tolerance)
{
    var parallel_tolerance = parallel_tolerance || 0.01;

    // a1*x + b1*y = c1 for line (x1, y1) to (x2, y2)
    // a2*x + b2*y = c2 for line (x3, y3) to (x4, y4)
    var a1 = p1[1] - p2[1]; // y1 - y2
    var b1 = p1[0] - p2[0]; // x1 - x2
    var a2 = p3[1] - p4[1]; // y3 - y4
    var b2 = p3[0] - p4[0]; // x3 - x4
    var c1 = (p1[0] * p2[1]) - (p1[1] * p2[0]); // x1*y2 - y1*x2
    var c2 = (p3[0] * p4[1]) - (p3[1] * p4[0]); // x3*y4 - y3*x4
    var denom = (b1 * a2) - (a1 * b2);

    if (Math.abs(denom) > parallel_tolerance) {
        return [
            ((c1 * b2) - (b1 * c2)) / denom,
            ((c1 * a2) - (a1 * c2)) / denom
        ];
    }
    return null; // return null if lines are (close to) parallel
};

if (module !== undefined) {
    module.exports = Vector;
}

},{}],13:[function(_dereq_,module,exports){
var Point = _dereq_('./point.js');
var Geo = _dereq_('./geo.js');
var Style = _dereq_('./style.js');

// Get base URL from which the library was loaded
// Used to load additional resources like shaders, textures, etc. in cases where library was loaded from a relative path
(function() {
    try {
        VectorRenderer.library_base_url = '';
        var scripts = document.getElementsByTagName('script'); // document.querySelectorAll('script[src*=".js"]');
        for (var s=0; s < scripts.length; s++) {
            // var base_match = scripts[s].src.match(/(.*)vector-map.(debug|min).js/); // should match debug or minified versions
            // if (base_match != null && base_match.length > 1) {
            //     VectorRenderer.library_base_url = base_match[1];
            //     break;
            // }
            var match = scripts[s].src.indexOf('vector-map.debug.js');
            if (match == -1) {
                match = scripts[s].src.indexOf('vector-map.min.js');
            }
            if (match >= 0) {
                VectorRenderer.library_base_url = scripts[s].src.substr(0, match);
                break;
            }
        }
    }
    catch (e) {
        // skip in web worker
    }
}());

VectorRenderer.tile_scale = 4096; // coordinates are locally scaled to the range [0, tile_scale]
VectorRenderer.units_per_meter = [];
VectorRenderer.units_per_pixel = [];
(function() {
    for (var z=0; z <= Geo.max_zoom; z++) {
        VectorRenderer.units_per_meter[z] = VectorRenderer.tile_scale / (Geo.tile_size * Geo.meters_per_pixel[z]);
        VectorRenderer.units_per_pixel[z] = VectorRenderer.tile_scale / Geo.tile_size;
    }
}());

// Layers & styles: pass an object directly, or a URL as string to load remotely
function VectorRenderer (type, tile_source, layers, styles, options)
{
    var options = options || {};
    this.type = type;
    this.tile_source = tile_source;
    this.tiles = {};
    this.num_workers = options.num_workers || 1;

    this.layer_source = VectorRenderer.urlForPath(layers); // TODO: fix this for layers provided as objects, this assumes a URL is passed
    if (typeof(layers) == 'string') {
        this.layers = VectorRenderer.loadLayers(layers);
    }
    else {
        this.layers = layers;
    }

    this.style_source = VectorRenderer.urlForPath(styles); // TODO: fix this for styles provided as objects, this assumes a URL is passed
    if (typeof(styles) == 'string') {
        this.styles = VectorRenderer.loadStyles(styles);
    }
    else {
        this.styles = styles;
    }

    this.createWorkers();

    this.zoom = null;
    this.center = null;
    this.device_pixel_ratio = window.devicePixelRatio || 1;
    this.dirty = true; // request a redraw
    this.initialized = false;
}

VectorRenderer.create = function (type, tile_source, layers, styles, options)
{
    return new VectorRenderer[type](tile_source, layers, styles, options);
};

VectorRenderer.prototype.init = function ()
{
    // Child class-specific initialization (e.g. GL context creation)
    if (typeof(this._init) == 'function') {
        this._init.apply(this, arguments);
    }

    var renderer = this;
    this.workers.forEach(function(worker) {
        worker.addEventListener('message', renderer.tileWorkerCompleted.bind(renderer));
    });

    this.initialized = true;
};

// Web workers handle heavy duty geometry processing
VectorRenderer.prototype.createWorkers = function ()
{
    var renderer = this;
    var url = VectorRenderer.library_base_url + 'vector-map-worker.min.js';

    // To allow workers to be loaded cross-domain, first load worker source via XHR, then create a local URL via a blob
    var req = new XMLHttpRequest();
    req.onload = function () {
        var worker_local_url = window.URL.createObjectURL(new Blob([req.response], { type: 'application/javascript' }));

        renderer.workers = [];
        for (var w=0; w < renderer.num_workers; w++) {
            renderer.workers.push(new Worker(worker_local_url));
        }
    };
    req.open('GET', url, false /* async flag */);
    req.send();

    // Alternate for debugging - tradtional method of loading from remote URL instead of XHR-to-local-blob
    // renderer.workers = [];
    // for (var w=0; w < renderer.num_workers; w++) {
    //     renderer.workers.push(new Worker(url));
    // }

    this.next_worker = 0;
};

VectorRenderer.prototype.setCenter = function (lng, lat)
{
    this.center = { lng: lng, lat: lat };
    this.dirty = true;
};

VectorRenderer.prototype.setZoom = function (zoom)
{
    this.map_last_zoom = this.zoom;
    this.zoom = zoom;
    this.map_zooming = false;
    this.dirty = true;
};

VectorRenderer.prototype.startZoom = function ()
{
    this.map_last_zoom = this.zoom;
    this.map_zooming = true;
};

VectorRenderer.prototype.setBounds = function (sw, ne)
{
    this.bounds = {
        sw: { lng: sw.lng, lat: sw.lat },
        ne: { lng: ne.lng, lat: ne.lat }
    };

    var buffer = 200 * Geo.meters_per_pixel[~~this.zoom]; // pixels -> meters
    this.buffered_meter_bounds = {
        sw: Geo.latLngToMeters(Point(this.bounds.sw.lng, this.bounds.sw.lat)),
        ne: Geo.latLngToMeters(Point(this.bounds.ne.lng, this.bounds.ne.lat))
    };
    this.buffered_meter_bounds.sw.x -= buffer;
    this.buffered_meter_bounds.sw.y -= buffer;
    this.buffered_meter_bounds.ne.x += buffer;
    this.buffered_meter_bounds.ne.y += buffer;

    // console.log("set renderer bounds to " + JSON.stringify(this.bounds));

    // Mark tiles as visible/invisible
    for (var t in this.tiles) {
        this.updateVisibilityForTile(this.tiles[t]);
    }

    this.dirty = true;
};

VectorRenderer.prototype.updateVisibilityForTile = function (tile)
{
    tile.visible = Geo.boxIntersect(tile.bounds, this.buffered_meter_bounds);
    return tile.visible;
};

VectorRenderer.prototype.resizeMap = function (width, height)
{
    this.dirty = true;
};

VectorRenderer.prototype.requestRedraw = function ()
{
    this.dirty = true;
};

VectorRenderer.prototype.render = function ()
{
    if (this.dirty == false || this.initialized == false) {
        return false;
    }
    this.dirty = false; // subclasses can set this back to true when animation is needed

    // Child class-specific rendering (e.g. GL draw calls)
    if (typeof(this._render) == 'function') {
        this._render.apply(this, arguments);
    }

    // console.log("render map");
    return true;
};

VectorRenderer.prototype.loadTile = function (coords, div, callback)
{
    // Overzoom?
    if (coords.z > this.tile_source.max_zoom) {
        var zgap = coords.z - this.tile_source.max_zoom;
        // var original_tile = [coords.x, coords.y, coords.z].join('/');
        coords.x = ~~(coords.x / Math.pow(2, zgap));
        coords.y = ~~(coords.y / Math.pow(2, zgap));
        coords.display_z = coords.z; // z without overzoom
        coords.z -= zgap;
        // console.log("adjusted for overzoom, tile " + original_tile + " -> " + [coords.x, coords.y, coords.z].join('/'));
    }

    // Start tracking new tile set if no other tiles already loading
    if (this.tile_set_loading == null) {
        this.tile_set_loading = +new Date();
        console.log("tile set load START");
    }

    var key = [coords.x, coords.y, coords.z].join('/');

    // Already loading/loaded?
    if (this.tiles[key]) {
        // if (this.tiles[key].loaded == true) {
        //     console.log("use loaded tile " + key + " from cache");
        // }
        // if (this.tiles[key].loading == true) {
        //     console.log("already loading tile " + key + ", skip");
        // }

        if (callback) {
            callback(null, div);
        }
        return;
    }

    var tile = this.tiles[key] = {};
    tile.key = key;
    tile.coords = coords;
    tile.min = Geo.metersForTile(tile.coords);
    tile.max = Geo.metersForTile({ x: tile.coords.x + 1, y: tile.coords.y + 1, z: tile.coords.z });
    tile.bounds = { sw: { x: tile.min.x, y: tile.max.y }, ne: { x: tile.max.x, y: tile.min.y } };
    tile.units_per_meter = VectorRenderer.units_per_meter[tile.coords.z];
    tile.units_per_pixel = VectorRenderer.units_per_pixel[tile.coords.z];
    tile.debug = {};
    tile.loading = true;
    tile.loaded = false;
    this.updateVisibilityForTile(tile);

    this.workers[this.next_worker].postMessage({
        type: 'loadTile',
        tile: tile,
        renderer_type: this.type,
        tile_source: this.tile_source,
        layer_source: this.layer_source,
        style_source: this.style_source
    });
    tile.worker = this.workers[this.next_worker];
    this.next_worker = (this.next_worker + 1) % this.workers.length;

    // Debug info
    div.setAttribute('data-tile-key', tile.key);
    div.style.width = '256px';
    div.style.height = '256px';

    if (this.debug) {
        var debug_overlay = document.createElement('div');
        debug_overlay.textContent = tile.key;
        debug_overlay.style.position = 'absolute';
        debug_overlay.style.left = 0;
        debug_overlay.style.top = 0;
        debug_overlay.style.color = 'white';
        debug_overlay.style.fontSize = '16px';
        // debug_overlay.style.textOutline = '1px #000000';
        div.appendChild(debug_overlay);

        div.style.borderStyle = 'solid';
        div.style.borderColor = 'white';
        div.style.borderWidth = '1px';
    }

    if (callback) {
        callback(null, div);
    }
};

// Called on main thread when a web worker completes processing for a single tile
VectorRenderer.prototype.tileWorkerCompleted = function (event)
{
    if (event.data.type != 'loadTileCompleted') {
        return;
    }

    var tile = event.data.tile;

    // Removed this tile during load?
    if (this.tiles[tile.key] == null) {
        console.log("discarded tile " + tile.key + " in VectorRenderer.tileWorkerCompleted because previously removed");
        return;
    }

    this.tiles[tile.key] = tile; // TODO: OK to just wipe out the tile here? or could pass back a list of properties to replace? feeling the lack of underscore here...

    // Child class-specific tile processing
    if (typeof(this._tileWorkerCompleted) == 'function') {
        this._tileWorkerCompleted(tile);
    }

    delete tile.layers; // delete the source data in the tile to save memory

    // No more tiles actively loading?
    if (this.tile_set_loading != null) {
        var end_tile_set = true;
        for (var t in this.tiles) {
            if (this.tiles[t].loading == true) {
                end_tile_set = false;
                break;
            }
        }

        if (end_tile_set == true) {
            this.last_tile_set_load = (+new Date()) - this.tile_set_loading;
            this.tile_set_loading = null;
            console.log("tile set load FINISHED in: " + this.last_tile_set_load);
        }
    }

    this.dirty = true;
    if (tiles_debug) this.printDebugForTile(tile);
};

VectorRenderer.prototype.removeTile = function (key)
{
    console.log("tile unload for " + key);
    var tile = this.tiles[key];
    if (tile != null && tile.loading == true) {
        console.log("cancel tile load for " + key);

        // Web worker will cancel XHR requests
        if (tile.worker != null) {
            tile.worker.postMessage({
                type: 'removeTile',
                key: tile.key
            });
        }
    }

    delete this.tiles[key];
    this.dirty = true;
};

VectorRenderer.prototype.printDebugForTile = function (tile)
{
    console.log(
        "debug for " + tile.key + ': [ ' +
        Object.keys(tile.debug).map(function (t) { return t + ': ' + tile.debug[t]; }).join(', ') + ' ]'
    );
};


/*** Class methods (stateless) ***/

// Simplistic detection of relative paths, append base if necessary
VectorRenderer.urlForPath = function (path) {
    var protocol = path.toLowerCase().substr(0, 4);
    if (!(protocol == 'http' || protocol == 'file')) {
        path = window.location.origin + window.location.pathname + path;
    }
    return path;
};

VectorRenderer.loadLayers = function (url)
{
    var layers;
    var req = new XMLHttpRequest();
    req.onload = function () { eval('layers = ' + req.response); }; // TODO: security!
    req.open('GET', url, false /* async flag */);
    req.send();
    return layers;
};

VectorRenderer.loadStyles = function (url)
{
    var styles;
    var req = new XMLHttpRequest();
    req.onload = function () { eval('styles = ' + req.response); }; // TODO: security!
    req.open('GET', url, false /* async flag */);
    req.send();
    return styles;
};

// Processes the tile response to create layers as defined by this renderer
// Can include post-processing to partially filter or re-arrange data, e.g. only including POIs that have names
VectorRenderer.processLayersForTile = function (layers, tile)
{
    var tile_layers = {};
    for (var t=0; t < layers.length; t++) {
        layers[t].number = t;

        if (layers[t] != null) {
            // Just pass through data untouched if no data transform function defined
            if (layers[t].data == null) {
                tile_layers[layers[t].name] = tile.layers[layers[t].name];
            }
            // Pass through data but with different layer name in tile source data
            else if (typeof layers[t].data == 'string') {
                tile_layers[layers[t].name] = tile.layers[layers[t].data];
            }
            // Apply the transform function for post-processing
            else if (typeof layers[t].data == 'function') {
                tile_layers[layers[t].name] = layers[t].data(tile.layers);
            }
        }

        // Handle cases where no data was found in tile or returned by post-processor
        tile_layers[layers[t].name] = tile_layers[layers[t].name] || { type: 'FeatureCollection', features: [] };
    }
    tile.layers = tile_layers;
    return tile_layers;
};


/*** Style parsing & defaults ***/

// Determine final style properties (color, width, etc.)
VectorRenderer.style_defaults = {
    color: [1.0, 0, 0],
    width: Style.width.pixels(5),
    size: Style.width.pixels(5),
    extrude: false,
    height: 20,
    min_height: 0,
    outline: {
        // color: [1.0, 0, 0],
        // width: 1,
        // dash: null
    },
    // render_mode: {
    //     name: 'polygons'
    // }
    render_mode: 'polygons'
};

VectorRenderer.parseStyleForFeature = function (feature, layer_style, tile)
{
    var layer_style = layer_style || {};
    var style = {};

    // Test whether features should be rendered at all
    if (typeof layer_style.filter == 'function') {
        if (layer_style.filter(feature, tile) == false) {
            return null;
        }
    }

    // Parse styles
    style.color = (layer_style.color && (layer_style.color[feature.properties.kind] || layer_style.color.default)) || VectorRenderer.style_defaults.color;
    if (typeof style.color == 'function') {
        style.color = style.color(feature, tile);
    }

    style.width = (layer_style.width && (layer_style.width[feature.properties.kind] || layer_style.width.default)) || VectorRenderer.style_defaults.width;
    if (typeof style.width == 'function') {
        style.width = style.width(feature, tile);
    }

    style.size = (layer_style.size && (layer_style.size[feature.properties.kind] || layer_style.size.default)) || VectorRenderer.style_defaults.size;
    if (typeof style.size == 'function') {
        style.size = style.size(feature, tile);
    }

    style.extrude = (layer_style.extrude && (layer_style.extrude[feature.properties.kind] || layer_style.extrude.default)) || VectorRenderer.style_defaults.extrude;
    if (typeof style.extrude == 'function') {
        style.extrude = style.extrude(feature, tile); // returning a boolean will extrude with the feature's height, a number will override the feature height (see below)
    }

    style.height = (feature.properties && feature.properties.height) || VectorRenderer.style_defaults.height;
    style.min_height = (feature.properties && feature.properties.min_height) || VectorRenderer.style_defaults.min_height;

    // height defaults to feature height, but extrude style can dynamically adjust height by returning a number or array (instead of a boolean)
    if (style.extrude) {
        if (typeof style.extrude == 'number') {
            style.height = style.extrude;
        }
        else if (typeof style.extrude == 'object' && style.extrude.length >= 2) {
            style.min_height = style.extrude[0];
            style.height = style.extrude[1];
        }
    }

    style.outline = {};
    layer_style.outline = layer_style.outline || {};
    style.outline.color = (layer_style.outline.color && (layer_style.outline.color[feature.properties.kind] || layer_style.outline.color.default)) || VectorRenderer.style_defaults.outline.color;
    if (typeof style.outline.color == 'function') {
        style.outline.color = style.outline.color(feature, tile);
    }

    style.outline.width = (layer_style.outline.width && (layer_style.outline.width[feature.properties.kind] || layer_style.outline.width.default)) || VectorRenderer.style_defaults.outline.width;
    if (typeof style.outline.width == 'function') {
        style.outline.width = style.outline.width(feature, tile);
    }

    style.outline.dash = (layer_style.outline.dash && (layer_style.outline.dash[feature.properties.kind] || layer_style.outline.dash.default)) || VectorRenderer.style_defaults.outline.dash;
    if (typeof style.outline.dash == 'function') {
        style.outline.dash = style.outline.dash(feature, tile);
    }

    style.render_mode = layer_style.render_mode || VectorRenderer.style_defaults.render_mode;
    // style.render_mode = {};
    // style.render_mode.name = (layer_style.render_mode && layer_style.render_mode.name) || VectorRenderer.style_defaults.render_mode.name;

    return style;
};

if (module !== undefined) {
    module.exports = VectorRenderer;
}

},{"./geo.js":2,"./point.js":10,"./style.js":11}]},{},[9])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvVXNlcnMvcGV0ZXIvd29yay92ZWN0b3ItbWFwL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvcGV0ZXIvd29yay92ZWN0b3ItbWFwL3NyYy9jYW52YXMvY2FudmFzX3JlbmRlcmVyLmpzIiwiL1VzZXJzL3BldGVyL3dvcmsvdmVjdG9yLW1hcC9zcmMvZ2VvLmpzIiwiL1VzZXJzL3BldGVyL3dvcmsvdmVjdG9yLW1hcC9zcmMvZ2wvZ2wuanMiLCIvVXNlcnMvcGV0ZXIvd29yay92ZWN0b3ItbWFwL3NyYy9nbC9nbF9idWlsZGVycy5qcyIsIi9Vc2Vycy9wZXRlci93b3JrL3ZlY3Rvci1tYXAvc3JjL2dsL2dsX2dlb20uanMiLCIvVXNlcnMvcGV0ZXIvd29yay92ZWN0b3ItbWFwL3NyYy9nbC9nbF9yZW5kZXJlci5qcyIsIi9Vc2Vycy9wZXRlci93b3JrL3ZlY3Rvci1tYXAvc3JjL2dsL2dsX3NoYWRlcnMuanMiLCIvVXNlcnMvcGV0ZXIvd29yay92ZWN0b3ItbWFwL3NyYy9sZWFmbGV0X2xheWVyLmpzIiwiL1VzZXJzL3BldGVyL3dvcmsvdmVjdG9yLW1hcC9zcmMvbW9kdWxlLmpzIiwiL1VzZXJzL3BldGVyL3dvcmsvdmVjdG9yLW1hcC9zcmMvcG9pbnQuanMiLCIvVXNlcnMvcGV0ZXIvd29yay92ZWN0b3ItbWFwL3NyYy9zdHlsZS5qcyIsIi9Vc2Vycy9wZXRlci93b3JrL3ZlY3Rvci1tYXAvc3JjL3ZlY3Rvci5qcyIsIi9Vc2Vycy9wZXRlci93b3JrL3ZlY3Rvci1tYXAvc3JjL3ZlY3Rvcl9yZW5kZXJlci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN1ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4Y0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM2ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZlQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4b0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKX12YXIgZj1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwoZi5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxmLGYuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwidmFyIFBvaW50ID0gcmVxdWlyZSgnLi4vcG9pbnQuanMnKTtcbnZhciBHZW8gPSByZXF1aXJlKCcuLi9nZW8uanMnKTtcbnZhciBWZWN0b3JSZW5kZXJlciA9IHJlcXVpcmUoJy4uL3ZlY3Rvcl9yZW5kZXJlci5qcycpO1xuXG5WZWN0b3JSZW5kZXJlci5DYW52YXNSZW5kZXJlciA9IENhbnZhc1JlbmRlcmVyO1xuQ2FudmFzUmVuZGVyZXIucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShWZWN0b3JSZW5kZXJlci5wcm90b3R5cGUpO1xuXG5mdW5jdGlvbiBDYW52YXNSZW5kZXJlciAodGlsZV9zb3VyY2UsIGxheWVycywgc3R5bGVzLCBvcHRpb25zKVxue1xuICAgIFZlY3RvclJlbmRlcmVyLmNhbGwodGhpcywgJ0NhbnZhc1JlbmRlcmVyJywgdGlsZV9zb3VyY2UsIGxheWVycywgc3R5bGVzLCBvcHRpb25zKTtcblxuICAgIC8vIFNlbGVjdGlvbiBpbmZvIHNob3duIG9uIGhvdmVyXG4gICAgdGhpcy5zZWxlY3Rpb25faW5mbyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIHRoaXMuc2VsZWN0aW9uX2luZm8uc2V0QXR0cmlidXRlKCdjbGFzcycsICdsYWJlbCcpO1xuICAgIHRoaXMuc2VsZWN0aW9uX2luZm8uc3R5bGUuZGlzcGxheSA9ICdub25lJztcblxuICAgIC8vIEZvciBkcmF3aW5nIG11bHRpcG9seWdvbnMgdy9jYW52YXMgY29tcG9zaXRlIG9wZXJhdGlvbnNcbiAgICB0aGlzLmN1dG91dF9jb250ZXh0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnY2FudmFzJykuZ2V0Q29udGV4dCgnMmQnKTtcbn1cblxuLy8gQ2FudmFzUmVuZGVyZXIucHJvdG90eXBlLmFkZFRpbGUgPSBmdW5jdGlvbiBDYW52YXNSZW5kZXJlckFkZFRpbGUgKHRpbGUsIHRpbGVEaXYpXG5DYW52YXNSZW5kZXJlci5wcm90b3R5cGUuX3RpbGVXb3JrZXJDb21wbGV0ZWQgPSBmdW5jdGlvbiAodGlsZSlcbntcbiAgICB2YXIgY2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnY2FudmFzJyk7XG4gICAgdmFyIGNvbnRleHQgPSBjYW52YXMuZ2V0Q29udGV4dCgnMmQnKTtcblxuICAgIGNhbnZhcy5zdHlsZS53aWR0aCA9IEdlby50aWxlX3NpemUgKyAncHgnO1xuICAgIGNhbnZhcy5zdHlsZS53aWR0aCA9IEdlby50aWxlX3NpemUgKyAncHgnO1xuICAgIGNhbnZhcy53aWR0aCA9IE1hdGgucm91bmQoR2VvLnRpbGVfc2l6ZSAqIHRoaXMuZGV2aWNlX3BpeGVsX3JhdGlvKTtcbiAgICBjYW52YXMuaGVpZ2h0ID0gTWF0aC5yb3VuZChHZW8udGlsZV9zaXplICogdGhpcy5kZXZpY2VfcGl4ZWxfcmF0aW8pO1xuICAgIGNhbnZhcy5zdHlsZS5iYWNrZ3JvdW5kID0gdGhpcy5jb2xvclRvU3RyaW5nKHRoaXMuc3R5bGVzLmRlZmF1bHQpO1xuXG4gICAgdGhpcy5yZW5kZXJUaWxlKHRpbGUsIGNvbnRleHQpO1xuXG4gICAgdmFyIHRpbGVEaXYgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiZGl2W2RhdGEtdGlsZS1rZXk9J1wiICsgdGlsZS5rZXkgKyBcIiddXCIpO1xuICAgIHRpbGVEaXYuYXBwZW5kQ2hpbGQoY2FudmFzKTtcbn07XG5cbi8vIFNjYWxlIGEgR2VvSlNPTiBjb29yZGluYXRlICgyLWVsZW1lbnQgYXJyYXkpIGZyb20gW21pbiwgbWF4XSB0byB0aWxlIHBpeGVsc1xuLy8gcmV0dXJucyBhIGNvcHkgb2YgZ2VvbWV0cnkuY29vcmRpbmF0ZXMgdHJhbnNmb3JtZWQgaW50byBQb2ludHNcbkNhbnZhc1JlbmRlcmVyLnByb3RvdHlwZS5zY2FsZUdlb21ldHJ5VG9QaXhlbHMgPSBmdW5jdGlvbiBzY2FsZUdlb21ldHJ5VG9QaXhlbHMgKGdlb21ldHJ5KVxue1xuICAgIHZhciByZW5kZXJlciA9IHRoaXM7XG4gICAgcmV0dXJuIEdlby50cmFuc2Zvcm1HZW9tZXRyeShnZW9tZXRyeSwgZnVuY3Rpb24gKGNvb3JkaW5hdGVzKSB7XG4gICAgICAgIHJldHVybiBQb2ludChcbiAgICAgICAgICAgIC8vIE1hdGgucm91bmQoKGNvb3JkaW5hdGVzWzBdIC0gbWluLngpICogR2VvLnRpbGVfc2l6ZSAvIChtYXgueCAtIG1pbi54KSksIC8vIHJvdW5kaW5nIHJlbW92ZXMgc2VhbXMgYnV0IGNhdXNlcyBhbGlhc2luZ1xuICAgICAgICAgICAgLy8gTWF0aC5yb3VuZCgoY29vcmRpbmF0ZXNbMV0gLSBtaW4ueSkgKiBHZW8udGlsZV9zaXplIC8gKG1heC55IC0gbWluLnkpKVxuICAgICAgICAgICAgY29vcmRpbmF0ZXNbMF0gKiBHZW8udGlsZV9zaXplICogcmVuZGVyZXIuZGV2aWNlX3BpeGVsX3JhdGlvIC8gVmVjdG9yUmVuZGVyZXIudGlsZV9zY2FsZSxcbiAgICAgICAgICAgIGNvb3JkaW5hdGVzWzFdICogR2VvLnRpbGVfc2l6ZSAqIHJlbmRlcmVyLmRldmljZV9waXhlbF9yYXRpbyAvIFZlY3RvclJlbmRlcmVyLnRpbGVfc2NhbGUgKiAtMSAvLyBhZGp1c3QgZm9yIGZsaXBwZWQgeS1jb29yZFxuICAgICAgICApO1xuICAgIH0pO1xufTtcblxuLy8gUmVuZGVycyBhIGxpbmUgZ2l2ZW4gYXMgYW4gYXJyYXkgb2YgUG9pbnRzXG4vLyBsaW5lID0gW1BvaW50LCBQb2ludCwgLi4uXVxuQ2FudmFzUmVuZGVyZXIucHJvdG90eXBlLnJlbmRlckxpbmUgPSBmdW5jdGlvbiByZW5kZXJMaW5lIChsaW5lLCBzdHlsZSwgY29udGV4dClcbntcbiAgICB2YXIgc2VnbWVudHMgPSBsaW5lO1xuICAgIHZhciBjb2xvciA9IHN0eWxlLmNvbG9yO1xuICAgIHZhciB3aWR0aCA9IHN0eWxlLndpZHRoO1xuICAgIHZhciBkYXNoID0gc3R5bGUuZGFzaDtcblxuICAgIHZhciBjID0gY29udGV4dDtcbiAgICBjLmJlZ2luUGF0aCgpO1xuICAgIGMuc3Ryb2tlU3R5bGUgPSB0aGlzLmNvbG9yVG9TdHJpbmcoY29sb3IpO1xuICAgIGMubGluZUNhcCA9ICdyb3VuZCc7XG4gICAgYy5saW5lV2lkdGggPSB3aWR0aDtcbiAgICBpZiAoYy5zZXRMaW5lRGFzaCkge1xuICAgICAgICBpZiAoZGFzaCkge1xuICAgICAgICAgICAgYy5zZXRMaW5lRGFzaChkYXNoLm1hcChmdW5jdGlvbiAoZCkgeyByZXR1cm4gZCAqIHdpZHRoOyB9KSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBjLnNldExpbmVEYXNoKFtdKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZvciAodmFyIHI9MDsgciA8IHNlZ21lbnRzLmxlbmd0aCAtIDE7IHIgKyspIHtcbiAgICAgICAgdmFyIHNlZ21lbnQgPSBbXG4gICAgICAgICAgICBzZWdtZW50c1tyXS54LCBzZWdtZW50c1tyXS55LFxuICAgICAgICAgICAgc2VnbWVudHNbciArIDFdLngsIHNlZ21lbnRzW3IgKyAxXS55XG4gICAgICAgIF07XG5cbiAgICAgICAgYy5tb3ZlVG8oc2VnbWVudFswXSwgc2VnbWVudFsxXSk7XG4gICAgICAgIGMubGluZVRvKHNlZ21lbnRbMl0sIHNlZ21lbnRbM10pO1xuICAgIH07XG5cbiAgICBjLmNsb3NlUGF0aCgpO1xuICAgIGMuc3Ryb2tlKCk7XG59O1xuXG4vLyBSZW5kZXJzIGEgcG9seWdvbiBnaXZlbiBhcyBhbiBhcnJheSBvZiBQb2ludHNcbi8vIHBvbHlnb24gPSBbUG9pbnQsIFBvaW50LCAuLi5dXG5DYW52YXNSZW5kZXJlci5wcm90b3R5cGUucmVuZGVyUG9seWdvbiA9IGZ1bmN0aW9uIHJlbmRlclBvbHlnb24gKHBvbHlnb24sIHN0eWxlLCBjb250ZXh0KVxue1xuICAgIHZhciBzZWdtZW50cyA9IHBvbHlnb247XG4gICAgdmFyIGNvbG9yID0gc3R5bGUuY29sb3I7XG4gICAgdmFyIHdpZHRoID0gc3R5bGUud2lkdGg7XG4gICAgdmFyIG91dGxpbmVfY29sb3IgPSBzdHlsZS5vdXRsaW5lICYmIHN0eWxlLm91dGxpbmUuY29sb3I7XG4gICAgdmFyIG91dGxpbmVfd2lkdGggPSBzdHlsZS5vdXRsaW5lICYmIHN0eWxlLm91dGxpbmUud2lkdGg7XG4gICAgdmFyIG91dGxpbmVfZGFzaCA9IHN0eWxlLm91dGxpbmUgJiYgc3R5bGUub3V0bGluZS5kYXNoO1xuXG4gICAgdmFyIGMgPSBjb250ZXh0O1xuICAgIGMuYmVnaW5QYXRoKCk7XG4gICAgYy5maWxsU3R5bGUgPSB0aGlzLmNvbG9yVG9TdHJpbmcoY29sb3IpO1xuICAgIGMubW92ZVRvKHNlZ21lbnRzWzBdLngsIHNlZ21lbnRzWzBdLnkpO1xuXG4gICAgZm9yICh2YXIgcj0xOyByIDwgc2VnbWVudHMubGVuZ3RoOyByICsrKSB7XG4gICAgICAgIGMubGluZVRvKHNlZ21lbnRzW3JdLngsIHNlZ21lbnRzW3JdLnkpO1xuICAgIH07XG5cbiAgICBjLmNsb3NlUGF0aCgpO1xuICAgIGMuZmlsbCgpO1xuXG4gICAgLy8gT3V0bGluZVxuICAgIGlmIChvdXRsaW5lX2NvbG9yICYmIG91dGxpbmVfd2lkdGgpIHtcbiAgICAgICAgYy5zdHJva2VTdHlsZSA9IHRoaXMuY29sb3JUb1N0cmluZyhvdXRsaW5lX2NvbG9yKTtcbiAgICAgICAgYy5saW5lQ2FwID0gJ3JvdW5kJztcbiAgICAgICAgYy5saW5lV2lkdGggPSBvdXRsaW5lX3dpZHRoO1xuICAgICAgICBpZiAoYy5zZXRMaW5lRGFzaCkge1xuICAgICAgICAgICAgaWYgKG91dGxpbmVfZGFzaCkge1xuICAgICAgICAgICAgICAgIGMuc2V0TGluZURhc2gob3V0bGluZV9kYXNoLm1hcChmdW5jdGlvbiAoZCkgeyByZXR1cm4gZCAqIG91dGxpbmVfd2lkdGg7IH0pKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGMuc2V0TGluZURhc2goW10pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGMuc3Ryb2tlKCk7XG4gICAgfVxufTtcblxuLy8gUmVuZGVycyBhIHBvaW50IGdpdmVuIGFzIGEgUG9pbnQgb2JqZWN0XG5DYW52YXNSZW5kZXJlci5wcm90b3R5cGUucmVuZGVyUG9pbnQgPSBmdW5jdGlvbiByZW5kZXJQb2ludCAocG9pbnQsIHN0eWxlLCBjb250ZXh0KVxue1xuICAgIHZhciBjb2xvciA9IHN0eWxlLmNvbG9yO1xuICAgIHZhciBzaXplID0gc3R5bGUuc2l6ZTtcbiAgICB2YXIgb3V0bGluZV9jb2xvciA9IHN0eWxlLm91dGxpbmUgJiYgc3R5bGUub3V0bGluZS5jb2xvcjtcbiAgICB2YXIgb3V0bGluZV93aWR0aCA9IHN0eWxlLm91dGxpbmUgJiYgc3R5bGUub3V0bGluZS53aWR0aDtcbiAgICB2YXIgb3V0bGluZV9kYXNoID0gc3R5bGUub3V0bGluZSAmJiBzdHlsZS5vdXRsaW5lLmRhc2g7XG5cbiAgICB2YXIgYyA9IGNvbnRleHQ7XG4gICAgYy5maWxsU3R5bGUgPSB0aGlzLmNvbG9yVG9TdHJpbmcoY29sb3IpO1xuXG4gICAgYy5iZWdpblBhdGgoKTtcbiAgICBjLmFyYyhwb2ludC54LCBwb2ludC55LCBzaXplLCAwLCAyICogTWF0aC5QSSk7XG4gICAgYy5jbG9zZVBhdGgoKTtcbiAgICBjLmZpbGwoKTtcblxuICAgIC8vIE91dGxpbmVcbiAgICBpZiAob3V0bGluZV9jb2xvciAmJiBvdXRsaW5lX3dpZHRoKSB7XG4gICAgICAgIGMuc3Ryb2tlU3R5bGUgPSB0aGlzLmNvbG9yVG9TdHJpbmcob3V0bGluZV9jb2xvcik7XG4gICAgICAgIGMubGluZVdpZHRoID0gb3V0bGluZV93aWR0aDtcbiAgICAgICAgaWYgKGMuc2V0TGluZURhc2gpIHtcbiAgICAgICAgICAgIGlmIChvdXRsaW5lX2Rhc2gpIHtcbiAgICAgICAgICAgICAgICBjLnNldExpbmVEYXNoKG91dGxpbmVfZGFzaC5tYXAoZnVuY3Rpb24gKGQpIHsgcmV0dXJuIGQgKiBvdXRsaW5lX3dpZHRoOyB9KSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBjLnNldExpbmVEYXNoKFtdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBjLnN0cm9rZSgpO1xuICAgIH1cbn07XG5cbkNhbnZhc1JlbmRlcmVyLnByb3RvdHlwZS5yZW5kZXJGZWF0dXJlID0gZnVuY3Rpb24gcmVuZGVyRmVhdHVyZSAoZmVhdHVyZSwgc3R5bGUsIGNvbnRleHQpXG57XG4gICAgdmFyIGcsIGgsIHBvbHlzO1xuICAgIHZhciBnZW9tZXRyeSA9IGZlYXR1cmUuZ2VvbWV0cnk7XG5cbiAgICBpZiAoZ2VvbWV0cnkudHlwZSA9PSAnTGluZVN0cmluZycpIHtcbiAgICAgICAgdGhpcy5yZW5kZXJMaW5lKGdlb21ldHJ5LnBpeGVscywgc3R5bGUsIGNvbnRleHQpO1xuICAgIH1cbiAgICBlbHNlIGlmIChnZW9tZXRyeS50eXBlID09ICdNdWx0aUxpbmVTdHJpbmcnKSB7XG4gICAgICAgIGZvciAoZz0wOyBnIDwgZ2VvbWV0cnkucGl4ZWxzLmxlbmd0aDsgZysrKSB7XG4gICAgICAgICAgICB0aGlzLnJlbmRlckxpbmUoZ2VvbWV0cnkucGl4ZWxzW2ddLCBzdHlsZSwgY29udGV4dCk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgZWxzZSBpZiAoZ2VvbWV0cnkudHlwZSA9PSAnUG9seWdvbicgfHwgZ2VvbWV0cnkudHlwZSA9PSAnTXVsdGlQb2x5Z29uJykge1xuICAgICAgICBpZiAoZ2VvbWV0cnkudHlwZSA9PSAnUG9seWdvbicpIHtcbiAgICAgICAgICAgIHBvbHlzID0gW2dlb21ldHJ5LnBpeGVsc107IC8vIHRyZWF0IFBvbHlnb24gYXMgYSBkZWdlbmVyYXRlIE11bHRpUG9seWdvbiB0byBhdm9pZCBkdXBsaWNhdGluZyBjb2RlXG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBwb2x5cyA9IGdlb21ldHJ5LnBpeGVscztcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAoZz0wOyBnIDwgcG9seXMubGVuZ3RoOyBnKyspIHtcbiAgICAgICAgICAgIC8vIFBvbHlnb25zIHdpdGggaG9sZXM6XG4gICAgICAgICAgICAvLyBSZW5kZXIgdG8gYSBzZXBhcmF0ZSBjYW52YXMsIHVzaW5nIGNvbXBvc2l0ZSBvcGVyYXRpb25zIHRvIGN1dCBob2xlcyBvdXQgb2YgcG9seWdvbiwgdGhlbiBjb3B5IGJhY2sgdG8gdGhlIG1haW4gY2FudmFzXG4gICAgICAgICAgICBpZiAocG9seXNbZ10ubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmN1dG91dF9jb250ZXh0LmNhbnZhcy53aWR0aCAhPSBjb250ZXh0LmNhbnZhcy53aWR0aCB8fCB0aGlzLmN1dG91dF9jb250ZXh0LmNhbnZhcy5oZWlnaHQgIT0gY29udGV4dC5jYW52YXMuaGVpZ2h0KSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY3V0b3V0X2NvbnRleHQuY2FudmFzLndpZHRoID0gY29udGV4dC5jYW52YXMud2lkdGg7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY3V0b3V0X2NvbnRleHQuY2FudmFzLmhlaWdodCA9IGNvbnRleHQuY2FudmFzLmhlaWdodDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhpcy5jdXRvdXRfY29udGV4dC5jbGVhclJlY3QoMCwgMCwgdGhpcy5jdXRvdXRfY29udGV4dC5jYW52YXMud2lkdGgsIHRoaXMuY3V0b3V0X2NvbnRleHQuY2FudmFzLmhlaWdodCk7XG5cbiAgICAgICAgICAgICAgICB0aGlzLmN1dG91dF9jb250ZXh0Lmdsb2JhbENvbXBvc2l0ZU9wZXJhdGlvbiA9ICdzb3VyY2Utb3Zlcic7XG4gICAgICAgICAgICAgICAgdGhpcy5yZW5kZXJQb2x5Z29uKHBvbHlzW2ddWzBdLCBzdHlsZSwgdGhpcy5jdXRvdXRfY29udGV4dCk7XG5cbiAgICAgICAgICAgICAgICB0aGlzLmN1dG91dF9jb250ZXh0Lmdsb2JhbENvbXBvc2l0ZU9wZXJhdGlvbiA9ICdkZXN0aW5hdGlvbi1vdXQnO1xuICAgICAgICAgICAgICAgIGZvciAoaD0xOyBoIDwgcG9seXNbZ10ubGVuZ3RoOyBoKyspIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yZW5kZXJQb2x5Z29uKHBvbHlzW2ddW2hdLCBzdHlsZSwgdGhpcy5jdXRvdXRfY29udGV4dCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvbnRleHQuZHJhd0ltYWdlKHRoaXMuY3V0b3V0X2NvbnRleHQuY2FudmFzLCAwLCAwKTtcblxuICAgICAgICAgICAgICAgIC8vIEFmdGVyIGNvbXBvc2l0aW5nIGJhY2sgdG8gbWFpbiBjYW52YXMsIGRyYXcgb3V0bGluZXMgb24gaG9sZXNcbiAgICAgICAgICAgICAgICBpZiAoc3R5bGUub3V0bGluZSAmJiBzdHlsZS5vdXRsaW5lLmNvbG9yKSB7XG4gICAgICAgICAgICAgICAgICAgIGZvciAoaD0xOyBoIDwgcG9seXNbZ10ubGVuZ3RoOyBoKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyTGluZShwb2x5c1tnXVtoXSwgc3R5bGUub3V0bGluZSwgY29udGV4dCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBSZWd1bGFyIGNsb3NlZCBwb2x5Z29uc1xuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5yZW5kZXJQb2x5Z29uKHBvbHlzW2ddWzBdLCBzdHlsZSwgY29udGV4dCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgZWxzZSBpZiAoZ2VvbWV0cnkudHlwZSA9PSAnUG9pbnQnKSB7XG4gICAgICAgIHRoaXMucmVuZGVyUG9pbnQoZ2VvbWV0cnkucGl4ZWxzLCBzdHlsZSwgY29udGV4dCk7XG4gICAgfVxuICAgIGVsc2UgaWYgKGdlb21ldHJ5LnR5cGUgPT0gJ011bHRpUG9pbnQnKSB7XG4gICAgICAgIGZvciAoZz0wOyBnIDwgZ2VvbWV0cnkucGl4ZWxzLmxlbmd0aDsgZysrKSB7XG4gICAgICAgICAgICB0aGlzLnJlbmRlclBvaW50KGdlb21ldHJ5LnBpeGVsc1tnXSwgc3R5bGUsIGNvbnRleHQpO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuLy8gUmVuZGVyIGEgR2VvSlNPTiB0aWxlIG9udG8gY2FudmFzXG5DYW52YXNSZW5kZXJlci5wcm90b3R5cGUucmVuZGVyVGlsZSA9IGZ1bmN0aW9uIHJlbmRlclRpbGUgKHRpbGUsIGNvbnRleHQpXG57XG4gICAgdmFyIHJlbmRlcmVyID0gdGhpcztcbiAgICB2YXIgc3R5bGU7XG5cbiAgICAvLyBTZWxlY3Rpb24gcmVuZGVyaW5nIC0gb2ZmLXNjcmVlbiBjYW52YXMgdG8gcmVuZGVyIGEgY29sbGlzaW9uIG1hcCBmb3IgZmVhdHVyZSBzZWxlY3Rpb25cbiAgICB2YXIgc2VsZWN0aW9uID0geyBjb2xvcnM6IHt9IH07XG4gICAgdmFyIHNlbGVjdGlvbl9jYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKTtcbiAgICBzZWxlY3Rpb25fY2FudmFzLnN0eWxlLndpZHRoID0gR2VvLnRpbGVfc2l6ZSArICdweCc7XG4gICAgc2VsZWN0aW9uX2NhbnZhcy5zdHlsZS53aWR0aCA9IEdlby50aWxlX3NpemUgKyAncHgnO1xuICAgIHNlbGVjdGlvbl9jYW52YXMud2lkdGggPSBNYXRoLnJvdW5kKEdlby50aWxlX3NpemUgKiB0aGlzLmRldmljZV9waXhlbF9yYXRpbyk7XG4gICAgc2VsZWN0aW9uX2NhbnZhcy5oZWlnaHQgPSBNYXRoLnJvdW5kKEdlby50aWxlX3NpemUgKiB0aGlzLmRldmljZV9waXhlbF9yYXRpbyk7XG5cbiAgICB2YXIgc2VsZWN0aW9uX2NvbnRleHQgPSBzZWxlY3Rpb25fY2FudmFzLmdldENvbnRleHQoJzJkJyk7XG4gICAgdmFyIHNlbGVjdGlvbl9jb2xvcjtcbiAgICB2YXIgc2VsZWN0aW9uX2NvdW50ID0gMDtcblxuICAgIC8vIFJlbmRlciBsYXllcnNcbiAgICBmb3IgKHZhciB0IGluIHJlbmRlcmVyLmxheWVycykge1xuICAgICAgICB2YXIgbGF5ZXIgPSByZW5kZXJlci5sYXllcnNbdF07XG4gICAgICAgIHRpbGUubGF5ZXJzW2xheWVyLm5hbWVdLmZlYXR1cmVzLmZvckVhY2goZnVuY3Rpb24oZmVhdHVyZSkge1xuICAgICAgICAgICAgLy8gU2NhbGUgbG9jYWwgY29vcmRzIHRvIHRpbGUgcGl4ZWxzXG4gICAgICAgICAgICBmZWF0dXJlLmdlb21ldHJ5LnBpeGVscyA9IHRoaXMuc2NhbGVHZW9tZXRyeVRvUGl4ZWxzKGZlYXR1cmUuZ2VvbWV0cnksIHJlbmRlcmVyLnRpbGVfbWluLCByZW5kZXJlci50aWxlX21heCk7XG4gICAgICAgICAgICBzdHlsZSA9IFZlY3RvclJlbmRlcmVyLnBhcnNlU3R5bGVGb3JGZWF0dXJlKGZlYXR1cmUsIHRoaXMuc3R5bGVzW2xheWVyLm5hbWVdLCB0aWxlKTtcblxuICAgICAgICAgICAgLy8gRHJhdyB2aXNpYmxlIGdlb21ldHJ5XG4gICAgICAgICAgICBpZiAobGF5ZXIudmlzaWJsZSAhPSBmYWxzZSkge1xuICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyRmVhdHVyZShmZWF0dXJlLCBzdHlsZSwgY29udGV4dCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIERyYXcgbWFzayBmb3IgaW50ZXJhY3Rpdml0eVxuICAgICAgICAgICAgLy8gVE9ETzogbW92ZSBzZWxlY3Rpb24gZmlsdGVyIGxvZ2ljIHRvIHN0eWxlc2hlZXRcbiAgICAgICAgICAgIC8vIFRPRE86IG9ubHkgYWx0ZXIgc3R5bGVzIHRoYXQgYXJlIGV4cGxpY2l0bHkgZGlmZmVyZW50LCBkb24ndCBtYW51YWxseSBjb3B5IHN0eWxlIHZhbHVlcyBieSBwcm9wZXJ0eSBuYW1lXG4gICAgICAgICAgICBpZiAobGF5ZXIuc2VsZWN0aW9uID09IHRydWUgJiYgZmVhdHVyZS5wcm9wZXJ0aWVzLm5hbWUgIT0gbnVsbCAmJiBmZWF0dXJlLnByb3BlcnRpZXMubmFtZSAhPSAnJykge1xuICAgICAgICAgICAgICAgIHNlbGVjdGlvbl9jb2xvciA9IHRoaXMuZ2VuZXJhdGVDb2xvcihzZWxlY3Rpb24uY29sb3JzKTtcbiAgICAgICAgICAgICAgICBzZWxlY3Rpb25fY29sb3IucHJvcGVydGllcyA9IGZlYXR1cmUucHJvcGVydGllcztcbiAgICAgICAgICAgICAgICBzZWxlY3Rpb25fY291bnQrKztcbiAgICAgICAgICAgICAgICB0aGlzLnJlbmRlckZlYXR1cmUoZmVhdHVyZSwgeyBjb2xvcjogc2VsZWN0aW9uX2NvbG9yLmNvbG9yLCB3aWR0aDogc3R5bGUud2lkdGgsIHNpemU6IHN0eWxlLnNpemUgfSwgc2VsZWN0aW9uX2NvbnRleHQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gSWYgdGhpcyBnZW9tZXRyeSBpc24ndCBpbnRlcmFjdGl2ZSwgbWFzayBpdCBvdXQgc28gZ2VvbWV0cnkgdW5kZXIgaXQgZG9lc24ndCBhcHBlYXIgdG8gcG9wIHRocm91Z2hcbiAgICAgICAgICAgICAgICB0aGlzLnJlbmRlckZlYXR1cmUoZmVhdHVyZSwgeyBjb2xvcjogWzAsIDAsIDBdLCB3aWR0aDogc3R5bGUud2lkdGgsIHNpemU6IHN0eWxlLnNpemUgfSwgc2VsZWN0aW9uX2NvbnRleHQpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH0sIHRoaXMpO1xuICAgIH1cblxuICAgIC8vIFNlbGVjdGlvbiBldmVudHNcbiAgICB2YXIgc2VsZWN0aW9uX2luZm8gPSB0aGlzLnNlbGVjdGlvbl9pbmZvO1xuICAgIGlmIChzZWxlY3Rpb25fY291bnQgPiAwKSB7XG4gICAgICAgIHRoaXMudGlsZXNbdGlsZS5rZXldLnNlbGVjdGlvbiA9IHNlbGVjdGlvbjtcblxuICAgICAgICBzZWxlY3Rpb24ucGl4ZWxzID0gbmV3IFVpbnQzMkFycmF5KHNlbGVjdGlvbl9jb250ZXh0LmdldEltYWdlRGF0YSgwLCAwLCBzZWxlY3Rpb25fY2FudmFzLndpZHRoLCBzZWxlY3Rpb25fY2FudmFzLmhlaWdodCkuZGF0YS5idWZmZXIpO1xuXG4gICAgICAgIC8vIFRPRE86IGZpcmUgZXZlbnRzIG9uIHNlbGVjdGlvbiB0byBlbmFibGUgY3VzdG9tIGJlaGF2aW9yXG4gICAgICAgIGNvbnRleHQuY2FudmFzLm9ubW91c2Vtb3ZlID0gZnVuY3Rpb24gKGV2ZW50KSB7XG4gICAgICAgICAgICB2YXIgaGl0ID0geyB4OiBldmVudC5vZmZzZXRYLCB5OiBldmVudC5vZmZzZXRZIH07IC8vIGxheWVyWC9ZXG4gICAgICAgICAgICB2YXIgb2ZmID0gKGhpdC55ICogcmVuZGVyZXIuZGV2aWNlX3BpeGVsX3JhdGlvKSAqIChHZW8udGlsZV9zaXplICogcmVuZGVyZXIuZGV2aWNlX3BpeGVsX3JhdGlvKSArIChoaXQueCAqIHJlbmRlcmVyLmRldmljZV9waXhlbF9yYXRpbyk7XG4gICAgICAgICAgICB2YXIgY29sb3IgPSBzZWxlY3Rpb24ucGl4ZWxzW29mZl07XG4gICAgICAgICAgICB2YXIgZmVhdHVyZSA9IHNlbGVjdGlvbi5jb2xvcnNbY29sb3JdO1xuICAgICAgICAgICAgaWYgKGZlYXR1cmUgIT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGNvbnRleHQuY2FudmFzLnN0eWxlLmN1cnNvciA9ICdjcm9zc2hhaXInO1xuICAgICAgICAgICAgICAgIHNlbGVjdGlvbl9pbmZvLnN0eWxlLmxlZnQgPSAoaGl0LnggKyA1KSArICdweCc7XG4gICAgICAgICAgICAgICAgc2VsZWN0aW9uX2luZm8uc3R5bGUudG9wID0gKGhpdC55ICsgNSkgKyAncHgnO1xuICAgICAgICAgICAgICAgIHNlbGVjdGlvbl9pbmZvLmlubmVySFRNTCA9ICc8c3BhbiBjbGFzcz1cImxhYmVsSW5uZXJcIj4nICsgZmVhdHVyZS5wcm9wZXJ0aWVzLm5hbWUgKyAvKicgWycgKyBmZWF0dXJlLnByb3BlcnRpZXMua2luZCArICddKi8nPC9zcGFuPic7XG4gICAgICAgICAgICAgICAgc2VsZWN0aW9uX2luZm8uc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XG4gICAgICAgICAgICAgICAgY29udGV4dC5jYW52YXMucGFyZW50Tm9kZS5hcHBlbmRDaGlsZChzZWxlY3Rpb25faW5mbyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb250ZXh0LmNhbnZhcy5zdHlsZS5jdXJzb3IgPSBudWxsO1xuICAgICAgICAgICAgICAgIHNlbGVjdGlvbl9pbmZvLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICAgICAgICAgICAgaWYgKHNlbGVjdGlvbl9pbmZvLnBhcmVudE5vZGUgPT0gY29udGV4dC5jYW52YXMucGFyZW50Tm9kZSkge1xuICAgICAgICAgICAgICAgICAgICBjb250ZXh0LmNhbnZhcy5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKHNlbGVjdGlvbl9pbmZvKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICBjb250ZXh0LmNhbnZhcy5vbm1vdXNlbW92ZSA9IGZ1bmN0aW9uIChldmVudCkge1xuICAgICAgICAgICAgY29udGV4dC5jYW52YXMuc3R5bGUuY3Vyc29yID0gbnVsbDtcbiAgICAgICAgICAgIHNlbGVjdGlvbl9pbmZvLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICAgICAgICBpZiAoc2VsZWN0aW9uX2luZm8ucGFyZW50Tm9kZSA9PSBjb250ZXh0LmNhbnZhcy5wYXJlbnROb2RlKSB7XG4gICAgICAgICAgICAgICAgY29udGV4dC5jYW52YXMucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChzZWxlY3Rpb25faW5mbyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgfVxufTtcblxuLyogQ29sb3IgaGVscGVycyAqL1xuXG4vLyBUcmFuc2Zvcm0gY29sb3IgY29tcG9uZW50cyBpbiAwLTEgcmFuZ2UgdG8gaHRtbCBSR0Igc3RyaW5nIGZvciBjYW52YXNcbkNhbnZhc1JlbmRlcmVyLnByb3RvdHlwZS5jb2xvclRvU3RyaW5nID0gZnVuY3Rpb24gKGNvbG9yKVxue1xuICAgIHJldHVybiAncmdiKCcgKyBjb2xvci5tYXAoZnVuY3Rpb24oYykgeyByZXR1cm4gfn4oYyAqIDI1Nik7IH0pLmpvaW4oJywnKSArICcpJztcbn07XG5cbi8vIEdlbmVyYXRlcyBhIHJhbmRvbSBjb2xvciBub3QgeWV0IHByZXNlbnQgaW4gdGhlIHByb3ZpZGVkIGhhc2ggb2YgY29sb3JzXG5DYW52YXNSZW5kZXJlci5wcm90b3R5cGUuZ2VuZXJhdGVDb2xvciA9IGZ1bmN0aW9uIGdlbmVyYXRlQ29sb3IgKGNvbG9yX21hcClcbntcbiAgICB2YXIgciwgZywgYiwgaXIsIGlnLCBpYiwga2V5O1xuICAgIGNvbG9yX21hcCA9IGNvbG9yX21hcCB8fCB7fTtcbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgICByID0gTWF0aC5yYW5kb20oKTtcbiAgICAgICAgZyA9IE1hdGgucmFuZG9tKCk7XG4gICAgICAgIGIgPSBNYXRoLnJhbmRvbSgpO1xuXG4gICAgICAgIGlyID0gfn4ociAqIDI1Nik7XG4gICAgICAgIGlnID0gfn4oZyAqIDI1Nik7XG4gICAgICAgIGliID0gfn4oYiAqIDI1Nik7XG4gICAgICAgIGtleSA9IChpciArIChpZyA8PCA4KSArIChpYiA8PCAxNikgKyAoMjU1IDw8IDI0KSkgPj4+IDA7IC8vIG5lZWQgdW5zaWduZWQgcmlnaHQgc2hpZnQgdG8gY29udmVydCB0byBwb3NpdGl2ZSAjXG5cbiAgICAgICAgaWYgKGNvbG9yX21hcFtrZXldID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGNvbG9yX21hcFtrZXldID0geyBjb2xvcjogW3IsIGcsIGJdIH07XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gY29sb3JfbWFwW2tleV07XG59O1xuXG5pZiAobW9kdWxlICE9PSB1bmRlZmluZWQpIHtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IENhbnZhc1JlbmRlcmVyO1xufVxuIiwiLy8gTWlzY2VsbGFuZW91cyBnZW8gZnVuY3Rpb25zXG52YXIgUG9pbnQgPSByZXF1aXJlKCcuL3BvaW50LmpzJyk7XG5cbnZhciBHZW8gPSB7fTtcblxuLy8gUHJvamVjdGlvbiBjb25zdGFudHNcbkdlby50aWxlX3NpemUgPSAyNTY7XG5HZW8uaGFsZl9jaXJjdW1mZXJlbmNlX21ldGVycyA9IDIwMDM3NTA4LjM0Mjc4OTI0NDtcbkdlby5tYXBfb3JpZ2luX21ldGVycyA9IFBvaW50KC1HZW8uaGFsZl9jaXJjdW1mZXJlbmNlX21ldGVycywgR2VvLmhhbGZfY2lyY3VtZmVyZW5jZV9tZXRlcnMpO1xuR2VvLm1pbl96b29tX21ldGVyc19wZXJfcGl4ZWwgPSBHZW8uaGFsZl9jaXJjdW1mZXJlbmNlX21ldGVycyAqIDIgLyBHZW8udGlsZV9zaXplOyAvLyBtaW4gem9vbSBkcmF3cyB3b3JsZCBhcyAyIHRpbGVzIHdpZGVcbkdlby5tZXRlcnNfcGVyX3BpeGVsID0gW107XG5HZW8ubWF4X3pvb20gPSAyMDtcbmZvciAodmFyIHo9MDsgeiA8PSBHZW8ubWF4X3pvb207IHorKykge1xuICAgIEdlby5tZXRlcnNfcGVyX3BpeGVsW3pdID0gR2VvLm1pbl96b29tX21ldGVyc19wZXJfcGl4ZWwgLyBNYXRoLnBvdygyLCB6KTtcbn1cblxuLy8gQ29udmVydCB0aWxlIGxvY2F0aW9uIHRvIG1lcmNhdG9yIG1ldGVycyAtIG11bHRpcGx5IGJ5IHBpeGVscyBwZXIgdGlsZSwgdGhlbiBieSBtZXRlcnMgcGVyIHBpeGVsLCBhZGp1c3QgZm9yIG1hcCBvcmlnaW5cbkdlby5tZXRlcnNGb3JUaWxlID0gZnVuY3Rpb24gKHRpbGUpXG57XG4gICAgcmV0dXJuIFBvaW50KFxuICAgICAgICAodGlsZS54ICogR2VvLnRpbGVfc2l6ZSAqIEdlby5tZXRlcnNfcGVyX3BpeGVsW3RpbGUuel0pICsgR2VvLm1hcF9vcmlnaW5fbWV0ZXJzLngsXG4gICAgICAgICgodGlsZS55ICogR2VvLnRpbGVfc2l6ZSAqIEdlby5tZXRlcnNfcGVyX3BpeGVsW3RpbGUuel0pICogLTEpICsgR2VvLm1hcF9vcmlnaW5fbWV0ZXJzLnlcbiAgICApO1xufTtcblxuLy8gQ29udmVydCBtZXJjYXRvciBtZXRlcnMgdG8gbGF0LWxuZ1xuR2VvLm1ldGVyc1RvTGF0TG5nID0gZnVuY3Rpb24gKG1ldGVycylcbntcbiAgICB2YXIgYyA9IFBvaW50LmNvcHkobWV0ZXJzKTtcblxuICAgIGMueCAvPSBHZW8uaGFsZl9jaXJjdW1mZXJlbmNlX21ldGVycztcbiAgICBjLnkgLz0gR2VvLmhhbGZfY2lyY3VtZmVyZW5jZV9tZXRlcnM7XG5cbiAgICBjLnkgPSAoMiAqIE1hdGguYXRhbihNYXRoLmV4cChjLnkgKiBNYXRoLlBJKSkgLSAoTWF0aC5QSSAvIDIpKSAvIE1hdGguUEk7XG5cbiAgICBjLnggKj0gMTgwO1xuICAgIGMueSAqPSAxODA7XG5cbiAgICByZXR1cm4gYztcbn07XG5cbi8vIENvbnZlcnQgbGF0LWxuZyB0byBtZXJjYXRvciBtZXRlcnNcbkdlby5sYXRMbmdUb01ldGVycyA9IGZ1bmN0aW9uKGxhdGxuZylcbntcbiAgICB2YXIgYyA9IFBvaW50LmNvcHkobGF0bG5nKTtcblxuICAgIC8vIExhdGl0dWRlXG4gICAgYy55ID0gTWF0aC5sb2coTWF0aC50YW4oKGMueSArIDkwKSAqIE1hdGguUEkgLyAzNjApKSAvIChNYXRoLlBJIC8gMTgwKTtcbiAgICBjLnkgPSBjLnkgKiBHZW8uaGFsZl9jaXJjdW1mZXJlbmNlX21ldGVycyAvIDE4MDtcblxuICAgIC8vIExvbmdpdHVkZVxuICAgIGMueCA9IGMueCAqIEdlby5oYWxmX2NpcmN1bWZlcmVuY2VfbWV0ZXJzIC8gMTgwO1xuXG4gICAgcmV0dXJuIGM7XG59O1xuXG4vLyBSdW4gYSB0cmFuc2Zvcm0gZnVuY3Rpb24gb24gZWFjaCBjb29vcmRpbmF0ZSBpbiBhIEdlb0pTT04gZ2VvbWV0cnlcbkdlby50cmFuc2Zvcm1HZW9tZXRyeSA9IGZ1bmN0aW9uIChnZW9tZXRyeSwgdHJhbnNmb3JtKVxue1xuICAgIGlmIChnZW9tZXRyeS50eXBlID09ICdQb2ludCcpIHtcbiAgICAgICAgcmV0dXJuIHRyYW5zZm9ybShnZW9tZXRyeS5jb29yZGluYXRlcyk7XG4gICAgfVxuICAgIGVsc2UgaWYgKGdlb21ldHJ5LnR5cGUgPT0gJ0xpbmVTdHJpbmcnIHx8IGdlb21ldHJ5LnR5cGUgPT0gJ011bHRpUG9pbnQnKSB7XG4gICAgICAgIHJldHVybiBnZW9tZXRyeS5jb29yZGluYXRlcy5tYXAodHJhbnNmb3JtKTtcbiAgICB9XG4gICAgZWxzZSBpZiAoZ2VvbWV0cnkudHlwZSA9PSAnUG9seWdvbicgfHwgZ2VvbWV0cnkudHlwZSA9PSAnTXVsdGlMaW5lU3RyaW5nJykge1xuICAgICAgICByZXR1cm4gZ2VvbWV0cnkuY29vcmRpbmF0ZXMubWFwKGZ1bmN0aW9uIChjb29yZGluYXRlcykge1xuICAgICAgICAgICAgcmV0dXJuIGNvb3JkaW5hdGVzLm1hcCh0cmFuc2Zvcm0pO1xuICAgICAgICB9KTtcbiAgICB9XG4gICAgZWxzZSBpZiAoZ2VvbWV0cnkudHlwZSA9PSAnTXVsdGlQb2x5Z29uJykge1xuICAgICAgICByZXR1cm4gZ2VvbWV0cnkuY29vcmRpbmF0ZXMubWFwKGZ1bmN0aW9uIChwb2x5Z29uKSB7XG4gICAgICAgICAgICByZXR1cm4gcG9seWdvbi5tYXAoZnVuY3Rpb24gKGNvb3JkaW5hdGVzKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNvb3JkaW5hdGVzLm1hcCh0cmFuc2Zvcm0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH1cbiAgICAvLyBUT0RPOiBzdXBwb3J0IEdlb21ldHJ5Q29sbGVjdGlvblxuICAgIHJldHVybiB7fTtcbn07XG5cbkdlby5ib3hJbnRlcnNlY3QgPSBmdW5jdGlvbiAoYjEsIGIyKVxue1xuICAgIHJldHVybiAhKFxuICAgICAgICBiMi5zdy54ID4gYjEubmUueCB8fFxuICAgICAgICBiMi5uZS54IDwgYjEuc3cueCB8fFxuICAgICAgICBiMi5zdy55ID4gYjEubmUueSB8fFxuICAgICAgICBiMi5uZS55IDwgYjEuc3cueVxuICAgICk7XG59O1xuXG4vLyBTcGxpdCB0aGUgbGluZXMgb2YgYSBmZWF0dXJlIHdoZXJldmVyIHR3byBwb2ludHMgYXJlIGZhcnRoZXIgYXBhcnQgdGhhbiBhIGdpdmVuIHRvbGVyYW5jZVxuR2VvLnNwbGl0RmVhdHVyZUxpbmVzICA9IGZ1bmN0aW9uIChmZWF0dXJlLCB0b2xlcmFuY2UpIHtcbiAgICB2YXIgdG9sZXJhbmNlID0gdG9sZXJhbmNlIHx8IDAuMDAxO1xuICAgIHZhciB0b2xlcmFuY2Vfc3EgPSB0b2xlcmFuY2UgKiB0b2xlcmFuY2U7XG4gICAgdmFyIGdlb20gPSBmZWF0dXJlLmdlb21ldHJ5O1xuICAgIHZhciBsaW5lcztcblxuICAgIGlmIChnZW9tLnR5cGUgPT0gJ011bHRpTGluZVN0cmluZycpIHtcbiAgICAgICAgbGluZXMgPSBnZW9tLmNvb3JkaW5hdGVzO1xuICAgIH1cbiAgICBlbHNlIGlmIChnZW9tLnR5cGUgPT0nTGluZVN0cmluZycpIHtcbiAgICAgICAgbGluZXMgPSBbZ2VvbS5jb29yZGluYXRlc107XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICByZXR1cm4gZmVhdHVyZTtcbiAgICB9XG5cbiAgICB2YXIgc3BsaXRfbGluZXMgPSBbXTtcblxuICAgIGZvciAodmFyIHM9MDsgcyA8IGxpbmVzLmxlbmd0aDsgcysrKSB7XG4gICAgICAgIHZhciBzZWcgPSBsaW5lc1tzXTtcbiAgICAgICAgdmFyIHNwbGl0X3NlZyA9IFtdO1xuICAgICAgICB2YXIgbGFzdF9jb29yZCA9IG51bGw7XG4gICAgICAgIHZhciBrZWVwO1xuXG4gICAgICAgIGZvciAodmFyIGM9MDsgYyA8IHNlZy5sZW5ndGg7IGMrKykge1xuICAgICAgICAgICAgdmFyIGNvb3JkID0gc2VnW2NdO1xuICAgICAgICAgICAga2VlcCA9IHRydWU7XG5cbiAgICAgICAgICAgIGlmIChsYXN0X2Nvb3JkICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgICB2YXIgZGlzdCA9IChjb29yZFswXSAtIGxhc3RfY29vcmRbMF0pICogKGNvb3JkWzBdIC0gbGFzdF9jb29yZFswXSkgKyAoY29vcmRbMV0gLSBsYXN0X2Nvb3JkWzFdKSAqIChjb29yZFsxXSAtIGxhc3RfY29vcmRbMV0pO1xuICAgICAgICAgICAgICAgIGlmIChkaXN0ID4gdG9sZXJhbmNlX3NxKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKFwic3BsaXQgbGluZXMgYXQgKFwiICsgY29vcmRbMF0gKyBcIiwgXCIgKyBjb29yZFsxXSArIFwiKSwgXCIgKyBNYXRoLnNxcnQoZGlzdCkgKyBcIiBhcGFydFwiKTtcbiAgICAgICAgICAgICAgICAgICAga2VlcCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGtlZXAgPT0gZmFsc2UpIHtcbiAgICAgICAgICAgICAgICBzcGxpdF9saW5lcy5wdXNoKHNwbGl0X3NlZyk7XG4gICAgICAgICAgICAgICAgc3BsaXRfc2VnID0gW107XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzcGxpdF9zZWcucHVzaChjb29yZCk7XG5cbiAgICAgICAgICAgIGxhc3RfY29vcmQgPSBjb29yZDtcbiAgICAgICAgfVxuXG4gICAgICAgIHNwbGl0X2xpbmVzLnB1c2goc3BsaXRfc2VnKTtcbiAgICAgICAgc3BsaXRfc2VnID0gW107XG4gICAgfVxuXG4gICAgaWYgKHNwbGl0X2xpbmVzLmxlbmd0aCA9PSAxKSB7XG4gICAgICAgIGdlb20udHlwZSA9ICdMaW5lU3RyaW5nJztcbiAgICAgICAgZ2VvbS5jb29yZGluYXRlcyA9IHNwbGl0X2xpbmVzWzBdO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgZ2VvbS50eXBlID0gJ011bHRpTGluZVN0cmluZyc7XG4gICAgICAgIGdlb20uY29vcmRpbmF0ZXMgPSBzcGxpdF9saW5lcztcbiAgICB9XG5cbiAgICByZXR1cm4gZmVhdHVyZTtcbn07XG5cbmlmIChtb2R1bGUgIT09IHVuZGVmaW5lZCkge1xuICAgIG1vZHVsZS5leHBvcnRzID0gR2VvO1xufVxuIiwiLy8gV2ViR0wgbWFuYWdlbWVudCBhbmQgcmVuZGVyaW5nIGZ1bmN0aW9uc1xudmFyIEdMID0ge307XG5cbi8vIFNldHVwIGEgV2ViR0wgY29udGV4dFxuLy8gSWYgbm8gY2FudmFzIGVsZW1lbnQgaXMgcHJvdmlkZWQsIG9uZSBpcyBjcmVhdGVkIGFuZCBhZGRlZCB0byB0aGUgZG9jdW1lbnQgYm9keVxuR0wuZ2V0Q29udGV4dCA9IGZ1bmN0aW9uIGdldENvbnRleHQgKGNhbnZhcylcbntcbiAgICB2YXIgY2FudmFzID0gY2FudmFzO1xuICAgIHZhciBmdWxsc2NyZWVuID0gZmFsc2U7XG4gICAgaWYgKGNhbnZhcyA9PSBudWxsKSB7XG4gICAgICAgIGNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpO1xuICAgICAgICBjYW52YXMuc3R5bGUucG9zaXRpb24gPSAnYWJzb2x1dGUnO1xuICAgICAgICBjYW52YXMuc3R5bGUudG9wID0gMDtcbiAgICAgICAgY2FudmFzLnN0eWxlLmxlZnQgPSAwO1xuICAgICAgICBjYW52YXMuc3R5bGUuekluZGV4ID0gLTE7XG4gICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoY2FudmFzKTtcbiAgICAgICAgZnVsbHNjcmVlbiA9IHRydWU7XG4gICAgfVxuXG4gICAgZ2wgPSBjYW52YXMuZ2V0Q29udGV4dCgnZXhwZXJpbWVudGFsLXdlYmdsJywgeyAvKnByZXNlcnZlRHJhd2luZ0J1ZmZlcjogdHJ1ZSovIH0pOyAvLyBwcmVzZXJ2ZURyYXdpbmdCdWZmZXIgbmVlZGVkIGZvciBnbC5yZWFkUGl4ZWxzIChjb3VsZCBiZSB1c2VkIGZvciBmZWF0dXJlIHNlbGVjdGlvbilcbiAgICBpZiAoIWdsKSB7XG4gICAgICAgIGFsZXJ0KFwiQ291bGRuJ3QgY3JlYXRlIFdlYkdMIGNvbnRleHQuIFlvdXIgYnJvd3NlciBwcm9iYWJseSBkb2Vzbid0IHN1cHBvcnQgV2ViR0wgb3IgaXQncyB0dXJuZWQgb2ZmP1wiKTtcbiAgICAgICAgdGhyb3cgXCJDb3VsZG4ndCBjcmVhdGUgV2ViR0wgY29udGV4dFwiO1xuICAgIH1cblxuICAgIEdMLnJlc2l6ZUNhbnZhcyhnbCwgd2luZG93LmlubmVyV2lkdGgsIHdpbmRvdy5pbm5lckhlaWdodCk7XG4gICAgaWYgKGZ1bGxzY3JlZW4gPT0gdHJ1ZSkge1xuICAgICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigncmVzaXplJywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgR0wucmVzaXplQ2FudmFzKGdsLCB3aW5kb3cuaW5uZXJXaWR0aCwgd2luZG93LmlubmVySGVpZ2h0KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgR0wuVmVydGV4QXJyYXlPYmplY3QuaW5pdChnbCk7IC8vIFRPRE86IHRoaXMgcGF0dGVybiBkb2Vzbid0IHN1cHBvcnQgbXVsdGlwbGUgYWN0aXZlIEdMIGNvbnRleHRzLCBzaG91bGQgdGhhdCBldmVuIGJlIHN1cHBvcnRlZD9cblxuICAgIHJldHVybiBnbDtcbn07XG5cbkdMLnJlc2l6ZUNhbnZhcyA9IGZ1bmN0aW9uIChnbCwgd2lkdGgsIGhlaWdodClcbntcbiAgICB2YXIgZGV2aWNlX3BpeGVsX3JhdGlvID0gd2luZG93LmRldmljZVBpeGVsUmF0aW8gfHwgMTtcbiAgICBnbC5jYW52YXMuc3R5bGUud2lkdGggPSB3aWR0aCArICdweCc7XG4gICAgZ2wuY2FudmFzLnN0eWxlLmhlaWdodCA9IGhlaWdodCArICdweCc7XG4gICAgZ2wuY2FudmFzLndpZHRoID0gTWF0aC5yb3VuZChnbC5jYW52YXMuc3R5bGUud2lkdGggKiBkZXZpY2VfcGl4ZWxfcmF0aW8pO1xuICAgIGdsLmNhbnZhcy5oZWlnaHQgPSBNYXRoLnJvdW5kKGdsLmNhbnZhcy5zdHlsZS53aWR0aCAqIGRldmljZV9waXhlbF9yYXRpbyk7XG4gICAgZ2wudmlld3BvcnQoMCwgMCwgZ2wuY2FudmFzLndpZHRoLCBnbC5jYW52YXMuaGVpZ2h0KTtcbn07XG5cbi8vIENvbXBpbGUgJiBsaW5rIGEgV2ViR0wgcHJvZ3JhbSBmcm9tIHByb3ZpZGVkIHZlcnRleCBhbmQgc2hhZGVyIHNvdXJjZSBlbGVtZW50c1xuR0wuY3JlYXRlUHJvZ3JhbUZyb21FbGVtZW50cyA9IGZ1bmN0aW9uIEdMY3JlYXRlUHJvZ3JhbUZyb21FbGVtZW50cyAoZ2wsIHZlcnRleF9zaGFkZXJfaWQsIGZyYWdtZW50X3NoYWRlcl9pZClcbntcbiAgICB2YXIgdmVydGV4X3NoYWRlcl9zb3VyY2UgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCh2ZXJ0ZXhfc2hhZGVyX2lkKS50ZXh0Q29udGVudDtcbiAgICB2YXIgZnJhZ21lbnRfc2hhZGVyX3NvdXJjZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGZyYWdtZW50X3NoYWRlcl9pZCkudGV4dENvbnRlbnQ7XG4gICAgdmFyIHByb2dyYW0gPSBnbC5jcmVhdGVQcm9ncmFtKCk7XG4gICAgcmV0dXJuIEdMLnVwZGF0ZVByb2dyYW0oZ2wsIHByb2dyYW0sIHZlcnRleF9zaGFkZXJfc291cmNlLCBmcmFnbWVudF9zaGFkZXJfc291cmNlKTtcbn07XG5cbi8vIENvbXBpbGUgJiBsaW5rIGEgV2ViR0wgcHJvZ3JhbSBmcm9tIHByb3ZpZGVkIHZlcnRleCBhbmQgc2hhZGVyIHNvdXJjZSBVUkxzXG4vLyBOT1RFOiBsb2FkcyB2aWEgc3luY2hyb25vdXMgWEhSIGZvciBzaW1wbGljaXR5LCBjb3VsZCBiZSBtYWRlIGFzeW5jXG5HTC5jcmVhdGVQcm9ncmFtRnJvbVVSTHMgPSBmdW5jdGlvbiBHTGNyZWF0ZVByb2dyYW1Gcm9tVVJMcyAoZ2wsIHZlcnRleF9zaGFkZXJfdXJsLCBmcmFnbWVudF9zaGFkZXJfdXJsKVxue1xuICAgIHZhciBwcm9ncmFtID0gZ2wuY3JlYXRlUHJvZ3JhbSgpO1xuICAgIHJldHVybiBHTC51cGRhdGVQcm9ncmFtRnJvbVVSTHMoZ2wsIHByb2dyYW0sIHZlcnRleF9zaGFkZXJfdXJsLCBmcmFnbWVudF9zaGFkZXJfdXJsKTtcbn07XG5cbkdMLnVwZGF0ZVByb2dyYW1Gcm9tVVJMcyA9IGZ1bmN0aW9uIEdMVXBkYXRlUHJvZ3JhbUZyb21VUkxzIChnbCwgcHJvZ3JhbSwgdmVydGV4X3NoYWRlcl91cmwsIGZyYWdtZW50X3NoYWRlcl91cmwpXG57XG4gICAgdmFyIHZlcnRleF9zaGFkZXJfc291cmNlLCBmcmFnbWVudF9zaGFkZXJfc291cmNlO1xuICAgIHZhciByZXEgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcblxuICAgIHJlcS5vbmxvYWQgPSBmdW5jdGlvbiAoKSB7IHZlcnRleF9zaGFkZXJfc291cmNlID0gcmVxLnJlc3BvbnNlOyB9O1xuICAgIHJlcS5vcGVuKCdHRVQnLCB2ZXJ0ZXhfc2hhZGVyX3VybCArICc/JyArICgrbmV3IERhdGUoKSksIGZhbHNlIC8qIGFzeW5jIGZsYWcgKi8pO1xuICAgIHJlcS5zZW5kKCk7XG5cbiAgICByZXEub25sb2FkID0gZnVuY3Rpb24gKCkgeyBmcmFnbWVudF9zaGFkZXJfc291cmNlID0gcmVxLnJlc3BvbnNlOyB9O1xuICAgIHJlcS5vcGVuKCdHRVQnLCBmcmFnbWVudF9zaGFkZXJfdXJsICsgJz8nICsgKCtuZXcgRGF0ZSgpKSwgZmFsc2UgLyogYXN5bmMgZmxhZyAqLyk7XG4gICAgcmVxLnNlbmQoKTtcblxuICAgIHJldHVybiBHTC51cGRhdGVQcm9ncmFtKGdsLCBwcm9ncmFtLCB2ZXJ0ZXhfc2hhZGVyX3NvdXJjZSwgZnJhZ21lbnRfc2hhZGVyX3NvdXJjZSk7XG59O1xuXG4vLyBDb21waWxlICYgbGluayBhIFdlYkdMIHByb2dyYW0gZnJvbSBwcm92aWRlZCB2ZXJ0ZXggYW5kIGZyYWdtZW50IHNoYWRlciBzb3VyY2VzXG4vLyB1cGRhdGUgYSBwcm9ncmFtIGlmIG9uZSBpcyBwYXNzZWQgaW4uIENyZWF0ZSBvbmUgaWYgbm90LiBBbGVydCBhbmQgZG9uJ3QgdXBkYXRlIGFueXRoaW5nIGlmIHRoZSBzaGFkZXJzIGRvbid0IGNvbXBpbGUuXG5HTC51cGRhdGVQcm9ncmFtID0gZnVuY3Rpb24gR0x1cGRhdGVQcm9ncmFtIChnbCwgcHJvZ3JhbSwgdmVydGV4X3NoYWRlcl9zb3VyY2UsIGZyYWdtZW50X3NoYWRlcl9zb3VyY2UpXG57XG4gICAgdHJ5IHtcbiAgICAgICAgdmFyIHZlcnRleF9zaGFkZXIgPSBHTC5jcmVhdGVTaGFkZXIoZ2wsIHZlcnRleF9zaGFkZXJfc291cmNlLCBnbC5WRVJURVhfU0hBREVSKTtcbiAgICAgICAgdmFyIGZyYWdtZW50X3NoYWRlciA9IEdMLmNyZWF0ZVNoYWRlcihnbCwgJyNpZmRlZiBHTF9FU1xcbnByZWNpc2lvbiBoaWdocCBmbG9hdDtcXG4jZW5kaWZcXG5cXG4nICsgZnJhZ21lbnRfc2hhZGVyX3NvdXJjZSwgZ2wuRlJBR01FTlRfU0hBREVSKTtcbiAgICB9XG4gICAgY2F0Y2goZXJyKVxuICAgIHtcbiAgICAgICAgYWxlcnQoZXJyKTtcbiAgICAgICAgcmV0dXJuIHByb2dyYW07XG4gICAgfVxuXG4gICAgZ2wudXNlUHJvZ3JhbShudWxsKTtcbiAgICBpZiAocHJvZ3JhbSAhPSBudWxsKSB7XG4gICAgICAgIHZhciBvbGRfc2hhZGVycyA9IGdsLmdldEF0dGFjaGVkU2hhZGVycyhwcm9ncmFtKTtcbiAgICAgICAgZm9yKHZhciBpID0gMDsgaSA8IG9sZF9zaGFkZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBnbC5kZXRhY2hTaGFkZXIocHJvZ3JhbSwgb2xkX3NoYWRlcnNbaV0pO1xuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcHJvZ3JhbSA9IGdsLmNyZWF0ZVByb2dyYW0oKTtcbiAgICB9XG5cbiAgICBpZiAodmVydGV4X3NoYWRlciA9PSBudWxsIHx8IGZyYWdtZW50X3NoYWRlciA9PSBudWxsKSB7XG4gICAgICAgIHJldHVybiBwcm9ncmFtO1xuICAgIH1cblxuICAgIGdsLmF0dGFjaFNoYWRlcihwcm9ncmFtLCB2ZXJ0ZXhfc2hhZGVyKTtcbiAgICBnbC5hdHRhY2hTaGFkZXIocHJvZ3JhbSwgZnJhZ21lbnRfc2hhZGVyKTtcblxuICAgIGdsLmRlbGV0ZVNoYWRlcih2ZXJ0ZXhfc2hhZGVyKTtcbiAgICBnbC5kZWxldGVTaGFkZXIoZnJhZ21lbnRfc2hhZGVyKTtcblxuICAgIGdsLmxpbmtQcm9ncmFtKHByb2dyYW0pO1xuXG4gICAgaWYgKCFnbC5nZXRQcm9ncmFtUGFyYW1ldGVyKHByb2dyYW0sIGdsLkxJTktfU1RBVFVTKSkge1xuICAgICAgICB2YXIgcHJvZ3JhbV9lcnJvciA9XG4gICAgICAgICAgICBcIldlYkdMIHByb2dyYW0gZXJyb3I6XFxuXCIgK1xuICAgICAgICAgICAgXCJWQUxJREFURV9TVEFUVVM6IFwiICsgZ2wuZ2V0UHJvZ3JhbVBhcmFtZXRlcihwcm9ncmFtLCBnbC5WQUxJREFURV9TVEFUVVMpICsgXCJcXG5cIiArXG4gICAgICAgICAgICBcIkVSUk9SOiBcIiArIGdsLmdldEVycm9yKCkgKyBcIlxcblxcblwiICtcbiAgICAgICAgICAgIFwiLS0tIFZlcnRleCBTaGFkZXIgLS0tXFxuXCIgKyB2ZXJ0ZXhfc2hhZGVyX3NvdXJjZSArIFwiXFxuXFxuXCIgK1xuICAgICAgICAgICAgXCItLS0gRnJhZ21lbnQgU2hhZGVyIC0tLVxcblwiICsgZnJhZ21lbnRfc2hhZGVyX3NvdXJjZTtcbiAgICAgICAgdGhyb3cgcHJvZ3JhbV9lcnJvcjtcbiAgICB9XG5cbiAgICByZXR1cm4gcHJvZ3JhbTtcbn07XG5cbi8vIENvbXBpbGUgYSB2ZXJ0ZXggb3IgZnJhZ21lbnQgc2hhZGVyIGZyb20gcHJvdmlkZWQgc291cmNlXG5HTC5jcmVhdGVTaGFkZXIgPSBmdW5jdGlvbiBHTGNyZWF0ZVNoYWRlciAoZ2wsIHNvdXJjZSwgdHlwZSlcbntcbiAgICB2YXIgc2hhZGVyID0gZ2wuY3JlYXRlU2hhZGVyKHR5cGUpO1xuXG4gICAgZ2wuc2hhZGVyU291cmNlKHNoYWRlciwgc291cmNlKTtcbiAgICBnbC5jb21waWxlU2hhZGVyKHNoYWRlcik7XG5cbiAgICBpZiAoIWdsLmdldFNoYWRlclBhcmFtZXRlcihzaGFkZXIsIGdsLkNPTVBJTEVfU1RBVFVTKSkge1xuICAgICAgICB2YXIgc2hhZGVyX2Vycm9yID1cbiAgICAgICAgICAgIFwiV2ViR0wgc2hhZGVyIGVycm9yOlxcblwiICtcbiAgICAgICAgICAgICh0eXBlID09IGdsLlZFUlRFWF9TSEFERVIgPyBcIlZFUlRFWFwiIDogXCJGUkFHTUVOVFwiKSArIFwiIFNIQURFUjpcXG5cIiArXG4gICAgICAgICAgICBnbC5nZXRTaGFkZXJJbmZvTG9nKHNoYWRlcik7XG4gICAgICAgIHRocm93IHNoYWRlcl9lcnJvcjtcbiAgICB9XG5cbiAgICByZXR1cm4gc2hhZGVyO1xufTtcblxuLy8gVGhpbiBHTCBwcm9ncmFtIGxheWVyIHRvIGNhY2hlIHVuaWZvcm0gbG9jYXRpb25zL3ZhbHVlcywgZG8gY29tcGlsZS10aW1lIHByZS1wcm9jZXNzaW5nIChpbmplY3RpbmcgI2RlZmluZXMgaW50byBzaGFkZXJzKSwgZXRjLlxuR0wuUHJvZ3JhbSA9IGZ1bmN0aW9uIChnbCwgdmVydGV4X3NoYWRlcl9zb3VyY2UsIGZyYWdtZW50X3NoYWRlcl9zb3VyY2UsIG9wdGlvbnMpXG57XG4gICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cbiAgICB0aGlzLmdsID0gZ2w7XG4gICAgdGhpcy5wcm9ncmFtID0gbnVsbDtcbiAgICB0aGlzLmRlZmluZXMgPSBvcHRpb25zLmRlZmluZXMgfHwge307IC8vIGtleS92YWx1ZXMgaW5zZXJ0ZWQgaW50byBzaGFkZXJzIGF0IGNvbXBpbGUtdGltZVxuICAgIHRoaXMudW5pZm9ybXMgPSB7fTsgLy8gcHJvZ3JhbSBsb2NhdGlvbnMgb2YgdW5pZm9ybXMsIHNldC91cGRhdGVkIGF0IGNvbXBpbGUtdGltZVxuICAgIHRoaXMuYXR0cmlicyA9IHt9OyAvLyBwcm9ncmFtIGxvY2F0aW9ucyBvZiB2ZXJ0ZXggYXR0cmlidXRlc1xuICAgIHRoaXMudmVydGV4X3NoYWRlcl9zb3VyY2UgPSB2ZXJ0ZXhfc2hhZGVyX3NvdXJjZTtcbiAgICB0aGlzLmZyYWdtZW50X3NoYWRlcl9zb3VyY2UgPSBmcmFnbWVudF9zaGFkZXJfc291cmNlO1xuICAgIHRoaXMuY29tcGlsZSgpO1xufTtcblxuLy8gQ3JlYXRlcyBhIHByb2dyYW0gdGhhdCB3aWxsIHJlZnJlc2ggZnJvbSBzb3VyY2UgVVJMcyBlYWNoIHRpbWUgaXQgaXMgY29tcGlsZWRcbkdMLlByb2dyYW0uY3JlYXRlUHJvZ3JhbUZyb21VUkxzID0gZnVuY3Rpb24gKGdsLCB2ZXJ0ZXhfc2hhZGVyX3VybCwgZnJhZ21lbnRfc2hhZGVyX3VybCwgb3B0aW9ucylcbntcbiAgICB2YXIgcHJvZ3JhbSA9IE9iamVjdC5jcmVhdGUoR0wuUHJvZ3JhbS5wcm90b3R5cGUpO1xuXG4gICAgcHJvZ3JhbS52ZXJ0ZXhfc2hhZGVyX3VybCA9IHZlcnRleF9zaGFkZXJfdXJsO1xuICAgIHByb2dyYW0uZnJhZ21lbnRfc2hhZGVyX3VybCA9IGZyYWdtZW50X3NoYWRlcl91cmw7XG5cbiAgICBwcm9ncmFtLnVwZGF0ZVZlcnRleFNoYWRlclNvdXJjZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIHNvdXJjZTtcbiAgICAgICAgdmFyIHJlcSA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgICAgICByZXEub25sb2FkID0gZnVuY3Rpb24gKCkgeyBzb3VyY2UgPSByZXEucmVzcG9uc2U7IH07XG4gICAgICAgIHJlcS5vcGVuKCdHRVQnLCB0aGlzLnZlcnRleF9zaGFkZXJfdXJsICsgJz8nICsgKCtuZXcgRGF0ZSgpKSwgZmFsc2UgLyogYXN5bmMgZmxhZyAqLyk7XG4gICAgICAgIHJlcS5zZW5kKCk7XG4gICAgICAgIHJldHVybiBzb3VyY2U7XG4gICAgfTtcblxuICAgIHByb2dyYW0udXBkYXRlRnJhZ21lbnRTaGFkZXJTb3VyY2UgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBzb3VyY2U7XG4gICAgICAgIHZhciByZXEgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICAgICAgcmVxLm9ubG9hZCA9IGZ1bmN0aW9uICgpIHsgc291cmNlID0gcmVxLnJlc3BvbnNlOyB9O1xuICAgICAgICByZXEub3BlbignR0VUJywgdGhpcy5mcmFnbWVudF9zaGFkZXJfdXJsICsgJz8nICsgKCtuZXcgRGF0ZSgpKSwgZmFsc2UgLyogYXN5bmMgZmxhZyAqLyk7XG4gICAgICAgIHJlcS5zZW5kKCk7XG4gICAgICAgIHJldHVybiBzb3VyY2U7XG4gICAgfTtcblxuICAgIEdMLlByb2dyYW0uY2FsbChwcm9ncmFtLCBnbCwgbnVsbCwgbnVsbCwgb3B0aW9ucyk7XG4gICAgcmV0dXJuIHByb2dyYW07XG59O1xuXG4vLyBHbG9iYWwgZGVmaW5lcyBhcHBsaWVkIHRvIGFsbCBwcm9ncmFtcyAoZHVwbGljYXRlIHByb3BlcnRpZXMgZm9yIGEgc3BlY2lmaWMgcHJvZ3JhbSB3aWxsIHRha2UgcHJlY2VkZW5jZSlcbkdMLlByb2dyYW0uZGVmaW5lcyA9IHt9O1xuXG5HTC5Qcm9ncmFtLnByb3RvdHlwZS5jb21waWxlID0gZnVuY3Rpb24gKClcbntcbiAgICAvLyBPcHRpb25hbGx5IHVwZGF0ZSBzb3VyY2VzXG4gICAgaWYgKHR5cGVvZiB0aGlzLnVwZGF0ZVZlcnRleFNoYWRlclNvdXJjZSA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHRoaXMudmVydGV4X3NoYWRlcl9zb3VyY2UgPSB0aGlzLnVwZGF0ZVZlcnRleFNoYWRlclNvdXJjZSgpO1xuICAgIH1cbiAgICBpZiAodHlwZW9mIHRoaXMudXBkYXRlRnJhZ21lbnRTaGFkZXJTb3VyY2UgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICB0aGlzLmZyYWdtZW50X3NoYWRlcl9zb3VyY2UgPSB0aGlzLnVwZGF0ZUZyYWdtZW50U2hhZGVyU291cmNlKCk7XG4gICAgfVxuXG4gICAgLy8gSW5qZWN0IGRlZmluZXMgKGdsb2JhbCwgdGhlbiBwcm9ncmFtLXNwZWNpZmljKVxuICAgIHZhciBkZWZpbmVzID0ge307XG4gICAgZm9yICh2YXIgZCBpbiBHTC5Qcm9ncmFtLmRlZmluZXMpIHtcbiAgICAgICAgZGVmaW5lc1tkXSA9IEdMLlByb2dyYW0uZGVmaW5lc1tkXTtcbiAgICB9XG4gICAgZm9yICh2YXIgZCBpbiB0aGlzLmRlZmluZXMpIHtcbiAgICAgICAgZGVmaW5lc1tkXSA9IHRoaXMuZGVmaW5lc1tkXTtcbiAgICB9XG5cbiAgICB2YXIgZGVmaW5lX3N0ciA9IFwiXCI7XG4gICAgZm9yICh2YXIgZCBpbiBkZWZpbmVzKSB7XG4gICAgICAgIGlmIChkZWZpbmVzW2RdID09IGZhbHNlKSB7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICh0eXBlb2YgZGVmaW5lc1tkXSA9PSAnYm9vbGVhbicgJiYgZGVmaW5lc1tkXSA9PSB0cnVlKSB7XG4gICAgICAgICAgICBkZWZpbmVfc3RyICs9IFwiI2RlZmluZSBcIiArIGQgKyBcIlxcblwiO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgZGVmaW5lX3N0ciArPSBcIiNkZWZpbmUgXCIgKyBkICsgXCIgXCIgKyBkZWZpbmVzW2RdICsgXCJcXG5cIjtcbiAgICAgICAgfVxuICAgIH1cbiAgICB0aGlzLnByb2Nlc3NlZF92ZXJ0ZXhfc2hhZGVyX3NvdXJjZSA9IGRlZmluZV9zdHIgKyB0aGlzLnZlcnRleF9zaGFkZXJfc291cmNlO1xuICAgIHRoaXMucHJvY2Vzc2VkX2ZyYWdtZW50X3NoYWRlcl9zb3VyY2UgPSBkZWZpbmVfc3RyICsgdGhpcy5mcmFnbWVudF9zaGFkZXJfc291cmNlO1xuXG4gICAgLy8gQ29tcGlsZSAmIHNldCB1bmlmb3JtcyB0byBjYWNoZWQgdmFsdWVzXG4gICAgdGhpcy5wcm9ncmFtID0gR0wudXBkYXRlUHJvZ3JhbSh0aGlzLmdsLCB0aGlzLnByb2dyYW0sIHRoaXMucHJvY2Vzc2VkX3ZlcnRleF9zaGFkZXJfc291cmNlLCB0aGlzLnByb2Nlc3NlZF9mcmFnbWVudF9zaGFkZXJfc291cmNlKTtcbiAgICB0aGlzLmdsLnVzZVByb2dyYW0odGhpcy5wcm9ncmFtKTtcbiAgICB0aGlzLnJlZnJlc2hVbmlmb3JtcygpO1xuICAgIHRoaXMucmVmcmVzaEF0dHJpYnV0ZXMoKTtcbn07XG5cbi8vIGV4OiBwcm9ncmFtLnVuaWZvcm0oJzNmJywgJ3Bvc2l0aW9uJywgeCwgeSwgeik7XG5HTC5Qcm9ncmFtLnByb3RvdHlwZS51bmlmb3JtID0gZnVuY3Rpb24gKG1ldGhvZCwgbmFtZSkgLy8gbWV0aG9kLWFwcHJvcHJpYXRlIGFyZ3VtZW50cyBmb2xsb3dcbntcbiAgICB2YXIgdW5pZm9ybSA9ICh0aGlzLnVuaWZvcm1zW25hbWVdID0gdGhpcy51bmlmb3Jtc1tuYW1lXSB8fCB7fSk7XG4gICAgdW5pZm9ybS5uYW1lID0gbmFtZTtcbiAgICB1bmlmb3JtLmxvY2F0aW9uID0gdW5pZm9ybS5sb2NhdGlvbiB8fCB0aGlzLmdsLmdldFVuaWZvcm1Mb2NhdGlvbih0aGlzLnByb2dyYW0sIG5hbWUpO1xuICAgIHVuaWZvcm0ubWV0aG9kID0gJ3VuaWZvcm0nICsgbWV0aG9kO1xuICAgIHVuaWZvcm0udmFsdWVzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKTtcbiAgICB0aGlzLnVwZGF0ZVVuaWZvcm0obmFtZSk7XG59O1xuXG4vLyBTZXQgYSBzaW5nbGUgdW5pZm9ybVxuR0wuUHJvZ3JhbS5wcm90b3R5cGUudXBkYXRlVW5pZm9ybSA9IGZ1bmN0aW9uIChuYW1lKVxue1xuICAgIHZhciB1bmlmb3JtID0gdGhpcy51bmlmb3Jtc1tuYW1lXTtcbiAgICBpZiAodW5pZm9ybSA9PSBudWxsIHx8IHVuaWZvcm0ubG9jYXRpb24gPT0gbnVsbCkge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIHRoaXMuZ2xbdW5pZm9ybS5tZXRob2RdLmFwcGx5KHRoaXMuZ2wsIFt1bmlmb3JtLmxvY2F0aW9uXS5jb25jYXQodW5pZm9ybS52YWx1ZXMpKTsgLy8gY2FsbCBhcHByb3ByaWF0ZSBHTCB1bmlmb3JtIG1ldGhvZCBhbmQgcGFzcyB0aHJvdWdoIGFyZ3VtZW50c1xufTtcblxuLy8gUmVmcmVzaCB1bmlmb3JtIGxvY2F0aW9ucyBhbmQgc2V0IHRvIGxhc3QgY2FjaGVkIHZhbHVlc1xuR0wuUHJvZ3JhbS5wcm90b3R5cGUucmVmcmVzaFVuaWZvcm1zID0gZnVuY3Rpb24gKClcbntcbiAgICBmb3IgKHZhciB1IGluIHRoaXMudW5pZm9ybXMpIHtcbiAgICAgICAgdGhpcy51bmlmb3Jtc1t1XS5sb2NhdGlvbiA9IHRoaXMuZ2wuZ2V0VW5pZm9ybUxvY2F0aW9uKHRoaXMucHJvZ3JhbSwgdSk7XG4gICAgICAgIHRoaXMudXBkYXRlVW5pZm9ybSh1KTtcbiAgICB9XG59O1xuXG5HTC5Qcm9ncmFtLnByb3RvdHlwZS5yZWZyZXNoQXR0cmlidXRlcyA9IGZ1bmN0aW9uICgpXG57XG4gICAgLy8gdmFyIGxlbiA9IHRoaXMuZ2wuZ2V0UHJvZ3JhbVBhcmFtZXRlcih0aGlzLnByb2dyYW0sIHRoaXMuZ2wuQUNUSVZFX0FUVFJJQlVURVMpO1xuICAgIC8vIGZvciAodmFyIGk9MDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgLy8gICAgIHZhciBhID0gdGhpcy5nbC5nZXRBY3RpdmVBdHRyaWIodGhpcy5wcm9ncmFtLCBpKTtcbiAgICAvLyAgICAgY29uc29sZS5sb2coYSk7XG4gICAgLy8gfVxuICAgIHRoaXMuYXR0cmlicyA9IHt9O1xufTtcblxuLy8gR2V0IHRoZSBsb2NhdGlvbiBvZiBhIHZlcnRleCBhdHRyaWJ1dGVcbkdMLlByb2dyYW0ucHJvdG90eXBlLmF0dHJpYnV0ZSA9IGZ1bmN0aW9uIChuYW1lKVxue1xuICAgIHZhciBhdHRyaWIgPSAodGhpcy5hdHRyaWJzW25hbWVdID0gdGhpcy5hdHRyaWJzW25hbWVdIHx8IHt9KTtcbiAgICBpZiAoYXR0cmliLmxvY2F0aW9uICE9IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIGF0dHJpYjtcbiAgICB9XG5cbiAgICBhdHRyaWIubmFtZSA9IG5hbWU7XG4gICAgYXR0cmliLmxvY2F0aW9uID0gdGhpcy5nbC5nZXRBdHRyaWJMb2NhdGlvbih0aGlzLnByb2dyYW0sIG5hbWUpO1xuXG4gICAgLy8gdmFyIGluZm8gPSB0aGlzLmdsLmdldEFjdGl2ZUF0dHJpYih0aGlzLnByb2dyYW0sIGF0dHJpYi5sb2NhdGlvbik7XG4gICAgLy8gYXR0cmliLnR5cGUgPSBpbmZvLnR5cGU7XG4gICAgLy8gYXR0cmliLnNpemUgPSBpbmZvLnNpemU7XG5cbiAgICByZXR1cm4gYXR0cmliO1xufTtcblxuLy8gVHJpYW5ndWxhdGlvbiB1c2luZyBsaWJ0ZXNzLmpzIHBvcnQgb2YgZ2x1VGVzc2VsYXRvclxuLy8gaHR0cHM6Ly9naXRodWIuY29tL2JyZW5kYW5rZW5ueS9saWJ0ZXNzLmpzXG50cnkge1xuICAgIEdMLnRlc3NlbGF0b3IgPSAoZnVuY3Rpb24gaW5pdFRlc3NlbGF0b3IoKSB7XG4gICAgICAgIC8vIENhbGxlZCBmb3IgZWFjaCB2ZXJ0ZXggb2YgdGVzc2VsYXRvciBvdXRwdXRcbiAgICAgICAgZnVuY3Rpb24gdmVydGV4Q2FsbGJhY2soZGF0YSwgcG9seVZlcnRBcnJheSkge1xuICAgICAgICAgICAgcG9seVZlcnRBcnJheS5wdXNoKFtkYXRhWzBdLCBkYXRhWzFdXSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDYWxsZWQgd2hlbiBzZWdtZW50cyBpbnRlcnNlY3QgYW5kIG11c3QgYmUgc3BsaXRcbiAgICAgICAgZnVuY3Rpb24gY29tYmluZUNhbGxiYWNrKGNvb3JkcywgZGF0YSwgd2VpZ2h0KSB7XG4gICAgICAgICAgICByZXR1cm4gY29vcmRzO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQ2FsbGVkIHdoZW4gYSB2ZXJ0ZXggc3RhcnRzIG9yIHN0b3BzIGEgYm91bmRhcnkgZWRnZSBvZiBhIHBvbHlnb25cbiAgICAgICAgZnVuY3Rpb24gZWRnZUNhbGxiYWNrKGZsYWcpIHtcbiAgICAgICAgICAgIC8vIE5vLW9wIGNhbGxiYWNrIHRvIGZvcmNlIHNpbXBsZSB0cmlhbmdsZSBwcmltaXRpdmVzIChubyB0cmlhbmdsZSBzdHJpcHMgb3IgZmFucykuXG4gICAgICAgICAgICAvLyBTZWU6IGh0dHA6Ly93d3cuZ2xwcm9ncmFtbWluZy5jb20vcmVkL2NoYXB0ZXIxMS5odG1sXG4gICAgICAgICAgICAvLyBcIlNpbmNlIGVkZ2UgZmxhZ3MgbWFrZSBubyBzZW5zZSBpbiBhIHRyaWFuZ2xlIGZhbiBvciB0cmlhbmdsZSBzdHJpcCwgaWYgdGhlcmUgaXMgYSBjYWxsYmFja1xuICAgICAgICAgICAgLy8gYXNzb2NpYXRlZCB3aXRoIEdMVV9URVNTX0VER0VfRkxBRyB0aGF0IGVuYWJsZXMgZWRnZSBmbGFncywgdGhlIEdMVV9URVNTX0JFR0lOIGNhbGxiYWNrIGlzXG4gICAgICAgICAgICAvLyBjYWxsZWQgb25seSB3aXRoIEdMX1RSSUFOR0xFUy5cIlxuICAgICAgICAgICAgLy8gY29uc29sZS5sb2coJ0dMLnRlc3NlbGF0b3I6IGVkZ2UgZmxhZzogJyArIGZsYWcpO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIHRlc3NlbGF0b3IgPSBuZXcgbGlidGVzcy5HbHVUZXNzZWxhdG9yKCk7XG4gICAgICAgIHRlc3NlbGF0b3IuZ2x1VGVzc0NhbGxiYWNrKGxpYnRlc3MuZ2x1RW51bS5HTFVfVEVTU19WRVJURVhfREFUQSwgdmVydGV4Q2FsbGJhY2spO1xuICAgICAgICB0ZXNzZWxhdG9yLmdsdVRlc3NDYWxsYmFjayhsaWJ0ZXNzLmdsdUVudW0uR0xVX1RFU1NfQ09NQklORSwgY29tYmluZUNhbGxiYWNrKTtcbiAgICAgICAgdGVzc2VsYXRvci5nbHVUZXNzQ2FsbGJhY2sobGlidGVzcy5nbHVFbnVtLkdMVV9URVNTX0VER0VfRkxBRywgZWRnZUNhbGxiYWNrKTtcblxuICAgICAgICAvLyBCcmVuZGFuIEtlbm55OlxuICAgICAgICAvLyBsaWJ0ZXNzIHdpbGwgdGFrZSAzZCB2ZXJ0cyBhbmQgZmxhdHRlbiB0byBhIHBsYW5lIGZvciB0ZXNzZWxhdGlvblxuICAgICAgICAvLyBzaW5jZSBvbmx5IGRvaW5nIDJkIHRlc3NlbGF0aW9uIGhlcmUsIHByb3ZpZGUgej0xIG5vcm1hbCB0byBza2lwXG4gICAgICAgIC8vIGl0ZXJhdGluZyBvdmVyIHZlcnRzIG9ubHkgdG8gZ2V0IHRoZSBzYW1lIGFuc3dlci5cbiAgICAgICAgLy8gY29tbWVudCBvdXQgdG8gdGVzdCBub3JtYWwtZ2VuZXJhdGlvbiBjb2RlXG4gICAgICAgIHRlc3NlbGF0b3IuZ2x1VGVzc05vcm1hbCgwLCAwLCAxKTtcblxuICAgICAgICByZXR1cm4gdGVzc2VsYXRvcjtcbiAgICB9KSgpO1xuXG4gICAgR0wudHJpYW5ndWxhdGVQb2x5Z29uID0gZnVuY3Rpb24gR0xUcmlhbmd1bGF0ZSAoY29udG91cnMpXG4gICAge1xuICAgICAgICB2YXIgdHJpYW5nbGVWZXJ0cyA9IFtdO1xuICAgICAgICBHTC50ZXNzZWxhdG9yLmdsdVRlc3NCZWdpblBvbHlnb24odHJpYW5nbGVWZXJ0cyk7XG5cbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjb250b3Vycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgR0wudGVzc2VsYXRvci5nbHVUZXNzQmVnaW5Db250b3VyKCk7XG4gICAgICAgICAgICB2YXIgY29udG91ciA9IGNvbnRvdXJzW2ldO1xuICAgICAgICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBjb250b3VyLmxlbmd0aDsgaiArKykge1xuICAgICAgICAgICAgICAgIHZhciBjb29yZHMgPSBbY29udG91cltqXVswXSwgY29udG91cltqXVsxXSwgMF07XG4gICAgICAgICAgICAgICAgR0wudGVzc2VsYXRvci5nbHVUZXNzVmVydGV4KGNvb3JkcywgY29vcmRzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIEdMLnRlc3NlbGF0b3IuZ2x1VGVzc0VuZENvbnRvdXIoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIEdMLnRlc3NlbGF0b3IuZ2x1VGVzc0VuZFBvbHlnb24oKTtcbiAgICAgICAgcmV0dXJuIHRyaWFuZ2xlVmVydHM7XG4gICAgfTtcbn1cbmNhdGNoIChlKSB7XG4gICAgLy8gY29uc29sZS5sb2coXCJsaWJ0ZXNzIG5vdCBkZWZpbmVkIVwiKTtcbiAgICAvLyBza2lwIGlmIGxpYnRlc3Mgbm90IGRlZmluZWRcbn1cblxuLy8gQWRkIG9uZSBvciBtb3JlIHZlcnRpY2VzIHRvIGFuIGFycmF5IChkZXN0aW5lZCB0byBiZSB1c2VkIGFzIGEgR0wgYnVmZmVyKSwgJ3N0cmlwaW5nJyBlYWNoIHZlcnRleCB3aXRoIGNvbnN0YW50IGRhdGFcbi8vIFVzZWQgZm9yIGFkZGluZyB2YWx1ZXMgdGhhdCBhcmUgb2Z0ZW4gY29uc3RhbnQgcGVyIGdlb21ldHJ5IG9yIHBvbHlnb24sIGxpa2UgY29sb3JzLCBub3JtYWxzIChmb3IgcG9seXMgc2l0dGluZyBmbGF0IG9uIG1hcCksIGxheWVyIGFuZCBtYXRlcmlhbCBpbmZvLCBldGMuXG5HTC5hZGRWZXJ0aWNlcyA9IGZ1bmN0aW9uICh2ZXJ0aWNlcywgdmVydGV4X2RhdGEsIHZlcnRleF9jb25zdGFudHMpXG57XG4gICAgaWYgKHZlcnRpY2VzICE9IG51bGwgJiYgdmVydGljZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAvLyBBcnJheSBvZiB2ZXJ0aWNlc1xuICAgICAgICBpZiAodHlwZW9mIHZlcnRpY2VzWzBdID09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICBmb3IgKHZhciB2PTA7IHYgPCB2ZXJ0aWNlcy5sZW5ndGg7IHYrKykge1xuICAgICAgICAgICAgICAgIHZlcnRleF9kYXRhLnB1c2guYXBwbHkodmVydGV4X2RhdGEsIHZlcnRpY2VzW3ZdKTtcbiAgICAgICAgICAgICAgICBpZiAodmVydGV4X2NvbnN0YW50cykge1xuICAgICAgICAgICAgICAgICAgICB2ZXJ0ZXhfZGF0YS5wdXNoLmFwcGx5KHZlcnRleF9kYXRhLCB2ZXJ0ZXhfY29uc3RhbnRzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gU2luZ2xlIHZlcnRleFxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHZlcnRleF9kYXRhLnB1c2guYXBwbHkodmVydGV4X2RhdGEsIHZlcnRpY2VzKTtcbiAgICAgICAgICAgIGlmICh2ZXJ0ZXhfY29uc3RhbnRzKSB7XG4gICAgICAgICAgICAgICAgdmVydGV4X2RhdGEucHVzaC5hcHBseSh2ZXJ0ZXhfZGF0YSwgdmVydGV4X2NvbnN0YW50cyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHZlcnRleF9kYXRhO1xufTtcblxuLy8gQ3JlYXRlcyBhIFZlcnRleCBBcnJheSBPYmplY3QgaWYgdGhlIGV4dGVuc2lvbiBpcyBhdmFpbGFibGUsIG9yIGZhbGxzIGJhY2sgb24gc3RhbmRhcmQgYXR0cmlidXRlIGNhbGxzXG5HTC5WZXJ0ZXhBcnJheU9iamVjdCA9IHt9O1xuR0wuVmVydGV4QXJyYXlPYmplY3QuZGlzYWJsZWQgPSBmYWxzZTsgLy8gc2V0IHRvIHRydWUgdG8gZGlzYWJsZSBWQU9zIGV2ZW4gaWYgZXh0ZW5zaW9uIGlzIGF2YWlsYWJsZVxuR0wuVmVydGV4QXJyYXlPYmplY3QuYm91bmRfdmFvID0gbnVsbDsgLy8gY3VycmVudGx5IGJvdW5kIFZBT1xuXG5HTC5WZXJ0ZXhBcnJheU9iamVjdC5pbml0ID0gZnVuY3Rpb24gKGdsKVxue1xuICAgIGlmIChHTC5WZXJ0ZXhBcnJheU9iamVjdC5leHQgPT0gbnVsbCkge1xuICAgICAgICBpZiAoR0wuVmVydGV4QXJyYXlPYmplY3QuZGlzYWJsZWQgIT0gdHJ1ZSkge1xuICAgICAgICAgICAgR0wuVmVydGV4QXJyYXlPYmplY3QuZXh0ID0gZ2wuZ2V0RXh0ZW5zaW9uKFwiT0VTX3ZlcnRleF9hcnJheV9vYmplY3RcIik7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoR0wuVmVydGV4QXJyYXlPYmplY3QuZXh0ICE9IG51bGwpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiVmVydGV4IEFycmF5IE9iamVjdCBleHRlbnNpb24gYXZhaWxhYmxlXCIpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKEdMLlZlcnRleEFycmF5T2JqZWN0LmRpc2FibGVkICE9IHRydWUpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiVmVydGV4IEFycmF5IE9iamVjdCBleHRlbnNpb24gTk9UIGF2YWlsYWJsZVwiKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiVmVydGV4IEFycmF5IE9iamVjdCBleHRlbnNpb24gZm9yY2UgZGlzYWJsZWRcIik7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5HTC5WZXJ0ZXhBcnJheU9iamVjdC5jcmVhdGUgPSBmdW5jdGlvbiAoc2V0dXAsIHRlYXJkb3duKVxue1xuICAgIHZhciB2YW8gPSB7fTtcbiAgICB2YW8uc2V0dXAgPSBzZXR1cDtcbiAgICB2YW8udGVhcmRvd24gPSB0ZWFyZG93bjtcblxuICAgIHZhciBleHQgPSBHTC5WZXJ0ZXhBcnJheU9iamVjdC5leHQ7XG4gICAgaWYgKGV4dCAhPSBudWxsKSB7XG4gICAgICAgIHZhby5fdmFvID0gZXh0LmNyZWF0ZVZlcnRleEFycmF5T0VTKCk7XG4gICAgICAgIGV4dC5iaW5kVmVydGV4QXJyYXlPRVModmFvLl92YW8pO1xuICAgICAgICB2YW8uc2V0dXAoKTtcbiAgICAgICAgZXh0LmJpbmRWZXJ0ZXhBcnJheU9FUyhudWxsKTtcbiAgICAgICAgaWYgKHR5cGVvZiB2YW8udGVhcmRvd24gPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgdmFvLnRlYXJkb3duKCk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHZhby5zZXR1cCgpO1xuICAgIH1cblxuICAgIHJldHVybiB2YW87XG59O1xuXG5HTC5WZXJ0ZXhBcnJheU9iamVjdC5iaW5kID0gZnVuY3Rpb24gKHZhbylcbntcbiAgICB2YXIgZXh0ID0gR0wuVmVydGV4QXJyYXlPYmplY3QuZXh0O1xuICAgIGlmICh2YW8gIT0gbnVsbCkge1xuICAgICAgICBpZiAoZXh0ICE9IG51bGwgJiYgdmFvLl92YW8gIT0gbnVsbCkge1xuICAgICAgICAgICAgZXh0LmJpbmRWZXJ0ZXhBcnJheU9FUyh2YW8uX3Zhbyk7XG4gICAgICAgICAgICBHTC5WZXJ0ZXhBcnJheU9iamVjdC5ib3VuZF92YW8gPSB2YW87XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB2YW8uc2V0dXAoKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgaWYgKGV4dCAhPSBudWxsKSB7XG4gICAgICAgICAgICBleHQuYmluZFZlcnRleEFycmF5T0VTKG51bGwpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKEdMLlZlcnRleEFycmF5T2JqZWN0LmJvdW5kX3ZhbyAhPSBudWxsICYmIHR5cGVvZiBHTC5WZXJ0ZXhBcnJheU9iamVjdC5ib3VuZF92YW8udGVhcmRvd24gPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgR0wuVmVydGV4QXJyYXlPYmplY3QuYm91bmRfdmFvLnRlYXJkb3duKCk7XG4gICAgICAgIH1cbiAgICAgICAgR0wuVmVydGV4QXJyYXlPYmplY3QuYm91bmRfdmFvID0gbnVsbDtcbiAgICB9XG59O1xuXG5pZiAobW9kdWxlICE9PSB1bmRlZmluZWQpIHtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IEdMO1xufVxuIiwidmFyIFZlY3RvciA9IHJlcXVpcmUoJy4uL3ZlY3Rvci5qcycpO1xudmFyIFBvaW50ID0gcmVxdWlyZSgnLi4vcG9pbnQuanMnKTtcbnZhciBHTCA9IHJlcXVpcmUoJy4vZ2wuanMnKTtcblxudmFyIEdMQnVpbGRlcnMgPSB7fTtcblxuR0xCdWlsZGVycy5kZWJ1ZyA9IGZhbHNlO1xuXG4vLyBUZXNzZWxhdGUgYSBmbGF0IDJEIHBvbHlnb24gd2l0aCBmaXhlZCBoZWlnaHQgYW5kIGFkZCB0byBHTCB2ZXJ0ZXggYnVmZmVyXG5HTEJ1aWxkZXJzLmJ1aWxkUG9seWdvbnMgPSBmdW5jdGlvbiBHTEJ1aWxkZXJzQnVpbGRQb2x5Z29ucyAocG9seWdvbnMsIHosIHZlcnRleF9kYXRhLCBvcHRpb25zKVxue1xuICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXG4gICAgdmFyIHZlcnRleF9jb25zdGFudHMgPSBbeiwgMCwgMCwgMV07IC8vIHByb3ZpZGVkIHosIGFuZCB1cHdhcmRzLWZhY2luZyBub3JtYWxcbiAgICBpZiAob3B0aW9ucy52ZXJ0ZXhfY29uc3RhbnRzKSB7XG4gICAgICAgIHZlcnRleF9jb25zdGFudHMucHVzaC5hcHBseSh2ZXJ0ZXhfY29uc3RhbnRzLCBvcHRpb25zLnZlcnRleF9jb25zdGFudHMpO1xuICAgIH1cblxuICAgIHZhciBudW1fcG9seWdvbnMgPSBwb2x5Z29ucy5sZW5ndGg7XG4gICAgZm9yICh2YXIgcD0wOyBwIDwgbnVtX3BvbHlnb25zOyBwKyspIHtcbiAgICAgICAgdmFyIHZlcnRpY2VzID0gR0wudHJpYW5ndWxhdGVQb2x5Z29uKHBvbHlnb25zW3BdKTtcbiAgICAgICAgR0wuYWRkVmVydGljZXModmVydGljZXMsIHZlcnRleF9kYXRhLCB2ZXJ0ZXhfY29uc3RhbnRzKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdmVydGV4X2RhdGE7XG59O1xuXG4vLyBUZXNzZWxhdGUgYW5kIGV4dHJ1ZGUgYSBmbGF0IDJEIHBvbHlnb24gaW50byBhIHNpbXBsZSAzRCBtb2RlbCB3aXRoIGZpeGVkIGhlaWdodCBhbmQgYWRkIHRvIEdMIHZlcnRleCBidWZmZXJcbkdMQnVpbGRlcnMuYnVpbGRFeHRydWRlZFBvbHlnb25zID0gZnVuY3Rpb24gR0xCdWlsZGVyc0J1aWxkRXh0cnVkZWRQb2x5Z29uIChwb2x5Z29ucywgeiwgaGVpZ2h0LCBtaW5faGVpZ2h0LCB2ZXJ0ZXhfZGF0YSwgb3B0aW9ucylcbntcbiAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgICB2YXIgbWluX3ogPSB6ICsgKG1pbl9oZWlnaHQgfHwgMCk7XG4gICAgdmFyIG1heF96ID0geiArIGhlaWdodDtcblxuICAgIC8vIFRvcFxuICAgIEdMQnVpbGRlcnMuYnVpbGRQb2x5Z29ucyhwb2x5Z29ucywgbWF4X3osIHZlcnRleF9kYXRhLCB7IHZlcnRleF9jb25zdGFudHM6IG9wdGlvbnMudmVydGV4X2NvbnN0YW50cyB9KTtcblxuICAgIC8vIFdhbGxzXG4gICAgdmFyIHdhbGxfdmVydGV4X2NvbnN0YW50cyA9IFtudWxsLCBudWxsLCBudWxsXTsgLy8gbm9ybWFscyB3aWxsIGJlIGNhbGN1bGF0ZWQgYmVsb3dcbiAgICBpZiAob3B0aW9ucy52ZXJ0ZXhfY29uc3RhbnRzKSB7XG4gICAgICAgIHdhbGxfdmVydGV4X2NvbnN0YW50cy5wdXNoLmFwcGx5KHdhbGxfdmVydGV4X2NvbnN0YW50cywgb3B0aW9ucy52ZXJ0ZXhfY29uc3RhbnRzKTtcbiAgICB9XG5cbiAgICB2YXIgbnVtX3BvbHlnb25zID0gcG9seWdvbnMubGVuZ3RoO1xuICAgIGZvciAodmFyIHA9MDsgcCA8IG51bV9wb2x5Z29uczsgcCsrKSB7XG4gICAgICAgIHZhciBwb2x5Z29uID0gcG9seWdvbnNbcF07XG5cbiAgICAgICAgZm9yICh2YXIgcT0wOyBxIDwgcG9seWdvbi5sZW5ndGg7IHErKykge1xuICAgICAgICAgICAgdmFyIGNvbnRvdXIgPSBwb2x5Z29uW3FdO1xuXG4gICAgICAgICAgICBmb3IgKHZhciB3PTA7IHcgPCBjb250b3VyLmxlbmd0aCAtIDE7IHcrKykge1xuICAgICAgICAgICAgICAgIHZhciB3YWxsX3ZlcnRpY2VzID0gW107XG5cbiAgICAgICAgICAgICAgICAvLyBUd28gdHJpYW5nbGVzIGZvciB0aGUgcXVhZCBmb3JtZWQgYnkgZWFjaCB2ZXJ0ZXggcGFpciwgZ29pbmcgZnJvbSBib3R0b20gdG8gdG9wIGhlaWdodFxuICAgICAgICAgICAgICAgIHdhbGxfdmVydGljZXMucHVzaChcbiAgICAgICAgICAgICAgICAgICAgLy8gVHJpYW5nbGVcbiAgICAgICAgICAgICAgICAgICAgW2NvbnRvdXJbdysxXVswXSwgY29udG91clt3KzFdWzFdLCBtYXhfel0sXG4gICAgICAgICAgICAgICAgICAgIFtjb250b3VyW3crMV1bMF0sIGNvbnRvdXJbdysxXVsxXSwgbWluX3pdLFxuICAgICAgICAgICAgICAgICAgICBbY29udG91clt3XVswXSwgY29udG91clt3XVsxXSwgbWluX3pdLFxuICAgICAgICAgICAgICAgICAgICAvLyBUcmlhbmdsZVxuICAgICAgICAgICAgICAgICAgICBbY29udG91clt3XVswXSwgY29udG91clt3XVsxXSwgbWluX3pdLFxuICAgICAgICAgICAgICAgICAgICBbY29udG91clt3XVswXSwgY29udG91clt3XVsxXSwgbWF4X3pdLFxuICAgICAgICAgICAgICAgICAgICBbY29udG91clt3KzFdWzBdLCBjb250b3VyW3crMV1bMV0sIG1heF96XVxuICAgICAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgICAgICAvLyBDYWxjIHRoZSBub3JtYWwgb2YgdGhlIHdhbGwgZnJvbSB1cCB2ZWN0b3IgYW5kIG9uZSBzZWdtZW50IG9mIHRoZSB3YWxsIHRyaWFuZ2xlc1xuICAgICAgICAgICAgICAgIHZhciBub3JtYWwgPSBWZWN0b3IuY3Jvc3MoXG4gICAgICAgICAgICAgICAgICAgIFswLCAwLCAxXSxcbiAgICAgICAgICAgICAgICAgICAgVmVjdG9yLm5vcm1hbGl6ZShbY29udG91clt3KzFdWzBdIC0gY29udG91clt3XVswXSwgY29udG91clt3KzFdWzFdIC0gY29udG91clt3XVsxXSwgMF0pXG4gICAgICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgICAgIHdhbGxfdmVydGV4X2NvbnN0YW50c1swXSA9IG5vcm1hbFswXTtcbiAgICAgICAgICAgICAgICB3YWxsX3ZlcnRleF9jb25zdGFudHNbMV0gPSBub3JtYWxbMV07XG4gICAgICAgICAgICAgICAgd2FsbF92ZXJ0ZXhfY29uc3RhbnRzWzJdID0gbm9ybWFsWzJdO1xuXG4gICAgICAgICAgICAgICAgR0wuYWRkVmVydGljZXMod2FsbF92ZXJ0aWNlcywgdmVydGV4X2RhdGEsIHdhbGxfdmVydGV4X2NvbnN0YW50cyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdmVydGV4X2RhdGE7XG59O1xuXG4vLyBCdWlsZCB0ZXNzZWxsYXRlZCB0cmlhbmdsZXMgZm9yIGEgcG9seWxpbmVcbi8vIEJhc2ljYWxseSBmb2xsb3dpbmcgdGhlIG1ldGhvZCBkZXNjcmliZWQgaGVyZSBmb3IgbWl0ZXIgam9pbnRzOlxuLy8gaHR0cDovL2FydGdyYW1tZXIuYmxvZ3Nwb3QuY28udWsvMjAxMS8wNy9kcmF3aW5nLXBvbHlsaW5lcy1ieS10ZXNzZWxsYXRpb24uaHRtbFxuR0xCdWlsZGVycy5idWlsZFBvbHlsaW5lcyA9IGZ1bmN0aW9uIEdMQnVpbGRlcnNCdWlsZFBvbHlsaW5lcyAobGluZXMsIHosIHdpZHRoLCB2ZXJ0ZXhfZGF0YSwgb3B0aW9ucylcbntcbiAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgICBvcHRpb25zLmNsb3NlZF9wb2x5Z29uID0gb3B0aW9ucy5jbG9zZWRfcG9seWdvbiB8fCBmYWxzZTtcbiAgICBvcHRpb25zLnJlbW92ZV90aWxlX2VkZ2VzID0gb3B0aW9ucy5yZW1vdmVfdGlsZV9lZGdlcyB8fCBmYWxzZTtcblxuICAgIHZhciB2ZXJ0ZXhfY29uc3RhbnRzID0gW3osIDAsIDAsIDFdOyAvLyBwcm92aWRlZCB6LCBhbmQgdXB3YXJkcy1mYWNpbmcgbm9ybWFsXG4gICAgaWYgKG9wdGlvbnMudmVydGV4X2NvbnN0YW50cykge1xuICAgICAgICB2ZXJ0ZXhfY29uc3RhbnRzLnB1c2guYXBwbHkodmVydGV4X2NvbnN0YW50cywgb3B0aW9ucy52ZXJ0ZXhfY29uc3RhbnRzKTtcbiAgICB9XG5cbiAgICAvLyBMaW5lIGNlbnRlciAtIGRlYnVnZ2luZ1xuICAgIGlmIChHTEJ1aWxkZXJzLmRlYnVnICYmIG9wdGlvbnMudmVydGV4X2xpbmVzKSB7XG4gICAgICAgIHZhciBudW1fbGluZXMgPSBsaW5lcy5sZW5ndGg7XG4gICAgICAgIGZvciAodmFyIGxuPTA7IGxuIDwgbnVtX2xpbmVzOyBsbisrKSB7XG4gICAgICAgICAgICB2YXIgbGluZSA9IGxpbmVzW2xuXTtcblxuICAgICAgICAgICAgZm9yICh2YXIgcD0wOyBwIDwgbGluZS5sZW5ndGggLSAxOyBwKyspIHtcbiAgICAgICAgICAgICAgICAvLyBQb2ludCBBIHRvIEJcbiAgICAgICAgICAgICAgICB2YXIgcGEgPSBsaW5lW3BdO1xuICAgICAgICAgICAgICAgIHZhciBwYiA9IGxpbmVbcCsxXTtcblxuICAgICAgICAgICAgICAgIG9wdGlvbnMudmVydGV4X2xpbmVzLnB1c2goXG4gICAgICAgICAgICAgICAgICAgIHBhWzBdLCBwYVsxXSwgeiArIDAuMDAxLCAwLCAwLCAxLCAxLjAsIDAsIDAsXG4gICAgICAgICAgICAgICAgICAgIHBiWzBdLCBwYlsxXSwgeiArIDAuMDAxLCAwLCAwLCAxLCAxLjAsIDAsIDBcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIC8vIEJ1aWxkIHRyaWFuZ2xlc1xuICAgIHZhciB2ZXJ0aWNlcyA9IFtdO1xuICAgIHZhciBudW1fbGluZXMgPSBsaW5lcy5sZW5ndGg7XG4gICAgZm9yICh2YXIgbG49MDsgbG4gPCBudW1fbGluZXM7IGxuKyspIHtcbiAgICAgICAgdmFyIGxpbmUgPSBsaW5lc1tsbl07XG4gICAgICAgIC8vIE11bHRpcGxlIGxpbmUgc2VnbWVudHNcbiAgICAgICAgaWYgKGxpbmUubGVuZ3RoID4gMikge1xuICAgICAgICAgICAgLy8gQnVpbGQgYW5jaG9ycyBmb3IgbGluZSBzZWdtZW50czpcbiAgICAgICAgICAgIC8vIGFuY2hvcnMgYXJlIDMgcG9pbnRzLCBlYWNoIGNvbm5lY3RpbmcgMiBsaW5lIHNlZ21lbnRzIHRoYXQgc2hhcmUgYSBqb2ludCAoc3RhcnQgcG9pbnQsIGpvaW50IHBvaW50LCBlbmQgcG9pbnQpXG5cbiAgICAgICAgICAgIHZhciBhbmNob3JzID0gW107XG5cbiAgICAgICAgICAgIGlmIChsaW5lLmxlbmd0aCA+IDMpIHtcbiAgICAgICAgICAgICAgICAvLyBGaW5kIG1pZHBvaW50cyBvZiBlYWNoIGxpbmUgc2VnbWVudFxuICAgICAgICAgICAgICAgIC8vIEZvciBjbG9zZWQgcG9seWdvbnMsIGNhbGN1bGF0ZSBhbGwgbWlkcG9pbnRzIHNpbmNlIHNlZ21lbnRzIHdpbGwgd3JhcCBhcm91bmQgdG8gZmlyc3QgbWlkcG9pbnRcbiAgICAgICAgICAgICAgICB2YXIgbWlkID0gW107XG4gICAgICAgICAgICAgICAgdmFyIHAsIHBtYXg7XG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMuY2xvc2VkX3BvbHlnb24gPT0gdHJ1ZSkge1xuICAgICAgICAgICAgICAgICAgICBwID0gMDsgLy8gc3RhcnQgb24gZmlyc3QgcG9pbnRcbiAgICAgICAgICAgICAgICAgICAgcG1heCA9IGxpbmUubGVuZ3RoIC0gMTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gRm9yIG9wZW4gcG9seWdvbnMsIHNraXAgZmlyc3QgbWlkcG9pbnQgYW5kIHVzZSBsaW5lIHN0YXJ0IGluc3RlYWRcbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcCA9IDE7IC8vIHN0YXJ0IG9uIHNlY29uZCBwb2ludFxuICAgICAgICAgICAgICAgICAgICBwbWF4ID0gbGluZS5sZW5ndGggLSAyO1xuICAgICAgICAgICAgICAgICAgICBtaWQucHVzaChsaW5lWzBdKTsgLy8gdXNlIGxpbmUgc3RhcnQgaW5zdGVhZCBvZiBmaXJzdCBtaWRwb2ludFxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIENhbGMgbWlkcG9pbnRzXG4gICAgICAgICAgICAgICAgZm9yICg7IHAgPCBwbWF4OyBwKyspIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHBhID0gbGluZVtwXTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHBiID0gbGluZVtwKzFdO1xuICAgICAgICAgICAgICAgICAgICBtaWQucHVzaChbKHBhWzBdICsgcGJbMF0pIC8gMiwgKHBhWzFdICsgcGJbMV0pIC8gMl0pO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIFNhbWUgY2xvc2VkL29wZW4gcG9seWdvbiBsb2dpYyBhcyBhYm92ZToga2VlcCBsYXN0IG1pZHBvaW50IGZvciBjbG9zZWQsIHNraXAgZm9yIG9wZW5cbiAgICAgICAgICAgICAgICB2YXIgbW1heDtcbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy5jbG9zZWRfcG9seWdvbiA9PSB0cnVlKSB7XG4gICAgICAgICAgICAgICAgICAgIG1tYXggPSBtaWQubGVuZ3RoO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbWlkLnB1c2gobGluZVtsaW5lLmxlbmd0aC0xXSk7IC8vIHVzZSBsaW5lIGVuZCBpbnN0ZWFkIG9mIGxhc3QgbWlkcG9pbnRcbiAgICAgICAgICAgICAgICAgICAgbW1heCA9IG1pZC5sZW5ndGggLSAxO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIE1ha2UgYW5jaG9ycyBieSBjb25uZWN0aW5nIG1pZHBvaW50cyB0byBsaW5lIGpvaW50c1xuICAgICAgICAgICAgICAgIGZvciAocD0wOyBwIDwgbW1heDsgcCsrKSAge1xuICAgICAgICAgICAgICAgICAgICBhbmNob3JzLnB1c2goW21pZFtwXSwgbGluZVsocCsxKSAlIGxpbmUubGVuZ3RoXSwgbWlkWyhwKzEpICUgbWlkLmxlbmd0aF1dKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBEZWdlbmVyYXRlIGNhc2UsIGEgMy1wb2ludCBsaW5lIGlzIGp1c3QgYSBzaW5nbGUgYW5jaG9yXG4gICAgICAgICAgICAgICAgYW5jaG9ycyA9IFtbbGluZVswXSwgbGluZVsxXSwgbGluZVsyXV1dO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBmb3IgKHZhciBwPTA7IHAgPCBhbmNob3JzLmxlbmd0aDsgcCsrKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFvcHRpb25zLnJlbW92ZV90aWxlX2VkZ2VzKSB7XG4gICAgICAgICAgICAgICAgICAgIGJ1aWxkQW5jaG9yKGFuY2hvcnNbcF1bMF0sIGFuY2hvcnNbcF1bMV0sIGFuY2hvcnNbcF1bMl0pO1xuICAgICAgICAgICAgICAgICAgICAvLyBidWlsZFNlZ21lbnQoYW5jaG9yc1twXVswXSwgYW5jaG9yc1twXVsxXSk7IC8vIHVzZSB0aGVzZSB0byBkcmF3IGV4dHJ1ZGVkIHNlZ21lbnRzIHcvbyBqb2luLCBmb3IgZGVidWdnaW5nXG4gICAgICAgICAgICAgICAgICAgIC8vIGJ1aWxkU2VnbWVudChhbmNob3JzW3BdWzFdLCBhbmNob3JzW3BdWzJdKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBlZGdlMSA9IEdMQnVpbGRlcnMuaXNPblRpbGVFZGdlKGFuY2hvcnNbcF1bMF0sIGFuY2hvcnNbcF1bMV0pO1xuICAgICAgICAgICAgICAgICAgICB2YXIgZWRnZTIgPSBHTEJ1aWxkZXJzLmlzT25UaWxlRWRnZShhbmNob3JzW3BdWzFdLCBhbmNob3JzW3BdWzJdKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFlZGdlMSAmJiAhZWRnZTIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJ1aWxkQW5jaG9yKGFuY2hvcnNbcF1bMF0sIGFuY2hvcnNbcF1bMV0sIGFuY2hvcnNbcF1bMl0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgKCFlZGdlMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgYnVpbGRTZWdtZW50KGFuY2hvcnNbcF1bMF0sIGFuY2hvcnNbcF1bMV0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2UgaWYgKCFlZGdlMikge1xuICAgICAgICAgICAgICAgICAgICAgICAgYnVpbGRTZWdtZW50KGFuY2hvcnNbcF1bMV0sIGFuY2hvcnNbcF1bMl0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIFNpbmdsZSAyLXBvaW50IHNlZ21lbnRcbiAgICAgICAgZWxzZSBpZiAobGluZS5sZW5ndGggPT0gMikge1xuICAgICAgICAgICAgYnVpbGRTZWdtZW50KGxpbmVbMF0sIGxpbmVbMV0pOyAvLyBUT0RPOiByZXBsYWNlIGJ1aWxkU2VnbWVudCB3aXRoIGEgZGVnZW5lcmF0ZSBmb3JtIG9mIGJ1aWxkQW5jaG9yPyBidWlsZFNlZ21lbnQgaXMgc3RpbGwgdXNlZnVsIGZvciBkZWJ1Z2dpbmdcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBHTC5hZGRWZXJ0aWNlcyh2ZXJ0aWNlcywgdmVydGV4X2RhdGEsIHZlcnRleF9jb25zdGFudHMpO1xuXG4gICAgLy8gQnVpbGQgdHJpYW5nbGVzIGZvciBhIHNpbmdsZSBsaW5lIHNlZ21lbnQsIGV4dHJ1ZGVkIGJ5IHRoZSBwcm92aWRlZCB3aWR0aFxuICAgIGZ1bmN0aW9uIGJ1aWxkU2VnbWVudCAocGEsIHBiKSB7XG4gICAgICAgIHZhciBzbG9wZSA9IFZlY3Rvci5ub3JtYWxpemUoWyhwYlsxXSAtIHBhWzFdKSAqIC0xLCBwYlswXSAtIHBhWzBdXSk7XG5cbiAgICAgICAgdmFyIHBhX291dGVyID0gW3BhWzBdICsgc2xvcGVbMF0gKiB3aWR0aC8yLCBwYVsxXSArIHNsb3BlWzFdICogd2lkdGgvMl07XG4gICAgICAgIHZhciBwYV9pbm5lciA9IFtwYVswXSAtIHNsb3BlWzBdICogd2lkdGgvMiwgcGFbMV0gLSBzbG9wZVsxXSAqIHdpZHRoLzJdO1xuXG4gICAgICAgIHZhciBwYl9vdXRlciA9IFtwYlswXSArIHNsb3BlWzBdICogd2lkdGgvMiwgcGJbMV0gKyBzbG9wZVsxXSAqIHdpZHRoLzJdO1xuICAgICAgICB2YXIgcGJfaW5uZXIgPSBbcGJbMF0gLSBzbG9wZVswXSAqIHdpZHRoLzIsIHBiWzFdIC0gc2xvcGVbMV0gKiB3aWR0aC8yXTtcblxuICAgICAgICB2ZXJ0aWNlcy5wdXNoKFxuICAgICAgICAgICAgcGJfaW5uZXIsIHBiX291dGVyLCBwYV9pbm5lcixcbiAgICAgICAgICAgIHBhX2lubmVyLCBwYl9vdXRlciwgcGFfb3V0ZXJcbiAgICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyBCdWlsZCB0cmlhbmdsZXMgZm9yIGEgMy1wb2ludCAnYW5jaG9yJyBzaGFwZSwgY29uc2lzdGluZyBvZiB0d28gbGluZSBzZWdtZW50cyB3aXRoIGEgam9pbnRcbiAgICAvLyBUT0RPOiBtb3ZlIHRoZXNlIGZ1bmN0aW9ucyBvdXQgb2YgY2xvc3VyZXM/XG4gICAgZnVuY3Rpb24gYnVpbGRBbmNob3IgKHBhLCBqb2ludCwgcGIpIHtcbiAgICAgICAgLy8gSW5uZXIgYW5kIG91dGVyIGxpbmUgc2VnbWVudHMgZm9yIFtwYSwgam9pbnRdIGFuZCBbam9pbnQsIHBiXVxuICAgICAgICB2YXIgcGFfc2xvcGUgPSBWZWN0b3Iubm9ybWFsaXplKFsoam9pbnRbMV0gLSBwYVsxXSkgKiAtMSwgam9pbnRbMF0gLSBwYVswXV0pO1xuICAgICAgICB2YXIgcGFfb3V0ZXIgPSBbXG4gICAgICAgICAgICBbcGFbMF0gKyBwYV9zbG9wZVswXSAqIHdpZHRoLzIsIHBhWzFdICsgcGFfc2xvcGVbMV0gKiB3aWR0aC8yXSxcbiAgICAgICAgICAgIFtqb2ludFswXSArIHBhX3Nsb3BlWzBdICogd2lkdGgvMiwgam9pbnRbMV0gKyBwYV9zbG9wZVsxXSAqIHdpZHRoLzJdXG4gICAgICAgIF07XG4gICAgICAgIHZhciBwYV9pbm5lciA9IFtcbiAgICAgICAgICAgIFtwYVswXSAtIHBhX3Nsb3BlWzBdICogd2lkdGgvMiwgcGFbMV0gLSBwYV9zbG9wZVsxXSAqIHdpZHRoLzJdLFxuICAgICAgICAgICAgW2pvaW50WzBdIC0gcGFfc2xvcGVbMF0gKiB3aWR0aC8yLCBqb2ludFsxXSAtIHBhX3Nsb3BlWzFdICogd2lkdGgvMl1cbiAgICAgICAgXTtcblxuICAgICAgICB2YXIgcGJfc2xvcGUgPSBWZWN0b3Iubm9ybWFsaXplKFsocGJbMV0gLSBqb2ludFsxXSkgKiAtMSwgcGJbMF0gLSBqb2ludFswXV0pO1xuICAgICAgICB2YXIgcGJfb3V0ZXIgPSBbXG4gICAgICAgICAgICBbam9pbnRbMF0gKyBwYl9zbG9wZVswXSAqIHdpZHRoLzIsIGpvaW50WzFdICsgcGJfc2xvcGVbMV0gKiB3aWR0aC8yXSxcbiAgICAgICAgICAgIFtwYlswXSArIHBiX3Nsb3BlWzBdICogd2lkdGgvMiwgcGJbMV0gKyBwYl9zbG9wZVsxXSAqIHdpZHRoLzJdXG4gICAgICAgIF07XG4gICAgICAgIHZhciBwYl9pbm5lciA9IFtcbiAgICAgICAgICAgIFtqb2ludFswXSAtIHBiX3Nsb3BlWzBdICogd2lkdGgvMiwgam9pbnRbMV0gLSBwYl9zbG9wZVsxXSAqIHdpZHRoLzJdLFxuICAgICAgICAgICAgW3BiWzBdIC0gcGJfc2xvcGVbMF0gKiB3aWR0aC8yLCBwYlsxXSAtIHBiX3Nsb3BlWzFdICogd2lkdGgvMl1cbiAgICAgICAgXTtcblxuICAgICAgICAvLyBNaXRlciBqb2luIC0gc29sdmUgZm9yIHRoZSBpbnRlcnNlY3Rpb24gYmV0d2VlbiB0aGUgdHdvIG91dGVyIGxpbmUgc2VnbWVudHNcbiAgICAgICAgdmFyIGludGVyc2VjdGlvbiA9IFZlY3Rvci5saW5lSW50ZXJzZWN0aW9uKHBhX291dGVyWzBdLCBwYV9vdXRlclsxXSwgcGJfb3V0ZXJbMF0sIHBiX291dGVyWzFdKTtcbiAgICAgICAgdmFyIGxpbmVfZGVidWcgPSBudWxsO1xuICAgICAgICBpZiAoaW50ZXJzZWN0aW9uICE9IG51bGwpIHtcbiAgICAgICAgICAgIHZhciBpbnRlcnNlY3Rfb3V0ZXIgPSBpbnRlcnNlY3Rpb247XG5cbiAgICAgICAgICAgIC8vIENhcCB0aGUgaW50ZXJzZWN0aW9uIHBvaW50IHRvIGEgcmVhc29uYWJsZSBkaXN0YW5jZSAoYXMgam9pbiBhbmdsZSBiZWNvbWVzIHNoYXJwZXIsIG1pdGVyIGpvaW50IGRpc3RhbmNlIHdvdWxkIGFwcHJvYWNoIGluZmluaXR5KVxuICAgICAgICAgICAgdmFyIGxlbl9zcSA9IFZlY3Rvci5sZW5ndGhTcShbaW50ZXJzZWN0X291dGVyWzBdIC0gam9pbnRbMF0sIGludGVyc2VjdF9vdXRlclsxXSAtIGpvaW50WzFdXSk7XG4gICAgICAgICAgICB2YXIgbWl0ZXJfbGVuX21heCA9IDM7IC8vIG11bHRpcGxpZXIgb24gbGluZSB3aWR0aCBmb3IgbWF4IGRpc3RhbmNlIG1pdGVyIGpvaW4gY2FuIGJlIGZyb20gam9pbnRcbiAgICAgICAgICAgIGlmIChsZW5fc3EgPiAod2lkdGggKiB3aWR0aCAqIG1pdGVyX2xlbl9tYXggKiBtaXRlcl9sZW5fbWF4KSkge1xuICAgICAgICAgICAgICAgIGxpbmVfZGVidWcgPSAnZGlzdGFuY2UnO1xuICAgICAgICAgICAgICAgIGludGVyc2VjdF9vdXRlciA9IFZlY3Rvci5ub3JtYWxpemUoW2ludGVyc2VjdF9vdXRlclswXSAtIGpvaW50WzBdLCBpbnRlcnNlY3Rfb3V0ZXJbMV0gLSBqb2ludFsxXV0pO1xuICAgICAgICAgICAgICAgIGludGVyc2VjdF9vdXRlciA9IFtcbiAgICAgICAgICAgICAgICAgICAgam9pbnRbMF0gKyBpbnRlcnNlY3Rfb3V0ZXJbMF0gKiBtaXRlcl9sZW5fbWF4LFxuICAgICAgICAgICAgICAgICAgICBqb2ludFsxXSArIGludGVyc2VjdF9vdXRlclsxXSAqIG1pdGVyX2xlbl9tYXhcbiAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBpbnRlcnNlY3RfaW5uZXIgPSBbXG4gICAgICAgICAgICAgICAgKGpvaW50WzBdIC0gaW50ZXJzZWN0X291dGVyWzBdKSArIGpvaW50WzBdLFxuICAgICAgICAgICAgICAgIChqb2ludFsxXSAtIGludGVyc2VjdF9vdXRlclsxXSkgKyBqb2ludFsxXVxuICAgICAgICAgICAgXTtcblxuICAgICAgICAgICAgdmVydGljZXMucHVzaChcbiAgICAgICAgICAgICAgICBpbnRlcnNlY3RfaW5uZXIsIGludGVyc2VjdF9vdXRlciwgcGFfaW5uZXJbMF0sXG4gICAgICAgICAgICAgICAgcGFfaW5uZXJbMF0sIGludGVyc2VjdF9vdXRlciwgcGFfb3V0ZXJbMF0sXG5cbiAgICAgICAgICAgICAgICBwYl9pbm5lclsxXSwgcGJfb3V0ZXJbMV0sIGludGVyc2VjdF9pbm5lcixcbiAgICAgICAgICAgICAgICBpbnRlcnNlY3RfaW5uZXIsIHBiX291dGVyWzFdLCBpbnRlcnNlY3Rfb3V0ZXJcbiAgICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAvLyBMaW5lIHNlZ21lbnRzIGFyZSBwYXJhbGxlbCwgdXNlIHRoZSBmaXJzdCBvdXRlciBsaW5lIHNlZ21lbnQgYXMgam9pbiBpbnN0ZWFkXG4gICAgICAgICAgICBsaW5lX2RlYnVnID0gJ3BhcmFsbGVsJztcbiAgICAgICAgICAgIHBhX2lubmVyWzFdID0gcGJfaW5uZXJbMF07XG4gICAgICAgICAgICBwYV9vdXRlclsxXSA9IHBiX291dGVyWzBdO1xuXG4gICAgICAgICAgICB2ZXJ0aWNlcy5wdXNoKFxuICAgICAgICAgICAgICAgIHBhX2lubmVyWzFdLCBwYV9vdXRlclsxXSwgcGFfaW5uZXJbMF0sXG4gICAgICAgICAgICAgICAgcGFfaW5uZXJbMF0sIHBhX291dGVyWzFdLCBwYV9vdXRlclswXSxcblxuICAgICAgICAgICAgICAgIHBiX2lubmVyWzFdLCBwYl9vdXRlclsxXSwgcGJfaW5uZXJbMF0sXG4gICAgICAgICAgICAgICAgcGJfaW5uZXJbMF0sIHBiX291dGVyWzFdLCBwYl9vdXRlclswXVxuICAgICAgICAgICAgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEV4dHJ1ZGVkIGlubmVyL291dGVyIGVkZ2VzIC0gZGVidWdnaW5nXG4gICAgICAgIGlmIChHTEJ1aWxkZXJzLmRlYnVnICYmIG9wdGlvbnMudmVydGV4X2xpbmVzKSB7XG4gICAgICAgICAgICBvcHRpb25zLnZlcnRleF9saW5lcy5wdXNoKFxuICAgICAgICAgICAgICAgIHBhX2lubmVyWzBdWzBdLCBwYV9pbm5lclswXVsxXSwgeiArIDAuMDAxLCAwLCAwLCAxLCAwLCAxLjAsIDAsXG4gICAgICAgICAgICAgICAgcGFfaW5uZXJbMV1bMF0sIHBhX2lubmVyWzFdWzFdLCB6ICsgMC4wMDEsIDAsIDAsIDEsIDAsIDEuMCwgMCxcblxuICAgICAgICAgICAgICAgIHBiX2lubmVyWzBdWzBdLCBwYl9pbm5lclswXVsxXSwgeiArIDAuMDAxLCAwLCAwLCAxLCAwLCAxLjAsIDAsXG4gICAgICAgICAgICAgICAgcGJfaW5uZXJbMV1bMF0sIHBiX2lubmVyWzFdWzFdLCB6ICsgMC4wMDEsIDAsIDAsIDEsIDAsIDEuMCwgMCxcblxuICAgICAgICAgICAgICAgIHBhX291dGVyWzBdWzBdLCBwYV9vdXRlclswXVsxXSwgeiArIDAuMDAxLCAwLCAwLCAxLCAwLCAxLjAsIDAsXG4gICAgICAgICAgICAgICAgcGFfb3V0ZXJbMV1bMF0sIHBhX291dGVyWzFdWzFdLCB6ICsgMC4wMDEsIDAsIDAsIDEsIDAsIDEuMCwgMCxcblxuICAgICAgICAgICAgICAgIHBiX291dGVyWzBdWzBdLCBwYl9vdXRlclswXVsxXSwgeiArIDAuMDAxLCAwLCAwLCAxLCAwLCAxLjAsIDAsXG4gICAgICAgICAgICAgICAgcGJfb3V0ZXJbMV1bMF0sIHBiX291dGVyWzFdWzFdLCB6ICsgMC4wMDEsIDAsIDAsIDEsIDAsIDEuMCwgMCxcblxuICAgICAgICAgICAgICAgIHBhX2lubmVyWzBdWzBdLCBwYV9pbm5lclswXVsxXSwgeiArIDAuMDAxLCAwLCAwLCAxLCAwLCAxLjAsIDAsXG4gICAgICAgICAgICAgICAgcGFfb3V0ZXJbMF1bMF0sIHBhX291dGVyWzBdWzFdLCB6ICsgMC4wMDEsIDAsIDAsIDEsIDAsIDEuMCwgMCxcblxuICAgICAgICAgICAgICAgIHBhX2lubmVyWzFdWzBdLCBwYV9pbm5lclsxXVsxXSwgeiArIDAuMDAxLCAwLCAwLCAxLCAwLCAxLjAsIDAsXG4gICAgICAgICAgICAgICAgcGFfb3V0ZXJbMV1bMF0sIHBhX291dGVyWzFdWzFdLCB6ICsgMC4wMDEsIDAsIDAsIDEsIDAsIDEuMCwgMCxcblxuICAgICAgICAgICAgICAgIHBiX2lubmVyWzBdWzBdLCBwYl9pbm5lclswXVsxXSwgeiArIDAuMDAxLCAwLCAwLCAxLCAwLCAxLjAsIDAsXG4gICAgICAgICAgICAgICAgcGJfb3V0ZXJbMF1bMF0sIHBiX291dGVyWzBdWzFdLCB6ICsgMC4wMDEsIDAsIDAsIDEsIDAsIDEuMCwgMCxcblxuICAgICAgICAgICAgICAgIHBiX2lubmVyWzFdWzBdLCBwYl9pbm5lclsxXVsxXSwgeiArIDAuMDAxLCAwLCAwLCAxLCAwLCAxLjAsIDAsXG4gICAgICAgICAgICAgICAgcGJfb3V0ZXJbMV1bMF0sIHBiX291dGVyWzFdWzFdLCB6ICsgMC4wMDEsIDAsIDAsIDEsIDAsIDEuMCwgMFxuICAgICAgICAgICAgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChHTEJ1aWxkZXJzLmRlYnVnICYmIGxpbmVfZGVidWcgJiYgb3B0aW9ucy52ZXJ0ZXhfbGluZXMpIHtcbiAgICAgICAgICAgIHZhciBkY29sb3I7XG4gICAgICAgICAgICBpZiAobGluZV9kZWJ1ZyA9PSAncGFyYWxsZWwnKSB7XG4gICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coXCIhISEgbGluZXMgYXJlIHBhcmFsbGVsICEhIVwiKTtcbiAgICAgICAgICAgICAgICBkY29sb3IgPSBbMCwgMSwgMF07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChsaW5lX2RlYnVnID09ICdkaXN0YW5jZScpIHtcbiAgICAgICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhcIiEhISBtaXRlciBpbnRlcnNlY3Rpb24gcG9pbnQgZXhjZWVkZWQgYWxsb3dlZCBkaXN0YW5jZSBmcm9tIGpvaW50ICEhIVwiKTtcbiAgICAgICAgICAgICAgICBkY29sb3IgPSBbMSwgMCwgMF07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBjb25zb2xlLmxvZygnT1NNIGlkOiAnICsgZmVhdHVyZS5pZCk7IC8vIFRPRE86IGlmIHRoaXMgZnVuY3Rpb24gaXMgbW92ZWQgb3V0IG9mIGEgY2xvc3VyZSwgdGhpcyBmZWF0dXJlIGRlYnVnIGluZm8gd29uJ3QgYmUgYXZhaWxhYmxlXG4gICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhbcGEsIGpvaW50LCBwYl0pO1xuICAgICAgICAgICAgLy8gY29uc29sZS5sb2coZmVhdHVyZSk7XG4gICAgICAgICAgICBvcHRpb25zLnZlcnRleF9saW5lcy5wdXNoKFxuICAgICAgICAgICAgICAgIHBhWzBdLCBwYVsxXSwgeiArIDAuMDAyLFxuICAgICAgICAgICAgICAgIDAsIDAsIDEsIGRjb2xvclswXSwgZGNvbG9yWzFdLCBkY29sb3JbMl0sXG4gICAgICAgICAgICAgICAgam9pbnRbMF0sIGpvaW50WzFdLCB6ICsgMC4wMDIsXG4gICAgICAgICAgICAgICAgMCwgMCwgMSwgZGNvbG9yWzBdLCBkY29sb3JbMV0sIGRjb2xvclsyXSxcbiAgICAgICAgICAgICAgICBqb2ludFswXSwgam9pbnRbMV0sIHogKyAwLjAwMixcbiAgICAgICAgICAgICAgICAwLCAwLCAxLCBkY29sb3JbMF0sIGRjb2xvclsxXSwgZGNvbG9yWzJdLFxuICAgICAgICAgICAgICAgIHBiWzBdLCBwYlsxXSwgeiArIDAuMDAyLFxuICAgICAgICAgICAgICAgIDAsIDAsIDEsIGRjb2xvclswXSwgZGNvbG9yWzFdLCBkY29sb3JbMl1cbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgIHZhciBudW1fbGluZXMgPSBsaW5lcy5sZW5ndGg7XG4gICAgICAgICAgICBmb3IgKHZhciBsbj0wOyBsbiA8IG51bV9saW5lczsgbG4rKykge1xuICAgICAgICAgICAgICAgIHZhciBsaW5lMiA9IGxpbmVzW2xuXTtcblxuICAgICAgICAgICAgICAgIGZvciAodmFyIHA9MDsgcCA8IGxpbmUyLmxlbmd0aCAtIDE7IHArKykge1xuICAgICAgICAgICAgICAgICAgICAvLyBQb2ludCBBIHRvIEJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHBhID0gbGluZTJbcF07XG4gICAgICAgICAgICAgICAgICAgIHZhciBwYiA9IGxpbmUyW3ArMV07XG5cbiAgICAgICAgICAgICAgICAgICAgb3B0aW9ucy52ZXJ0ZXhfbGluZXMucHVzaChcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhWzBdLCBwYVsxXSwgeiArIDAuMDAwNSxcbiAgICAgICAgICAgICAgICAgICAgICAgIDAsIDAsIDEsIDAsIDAsIDEuMCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHBiWzBdLCBwYlsxXSwgeiArIDAuMDAwNSxcbiAgICAgICAgICAgICAgICAgICAgICAgIDAsIDAsIDEsIDAsIDAsIDEuMFxuICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdmVydGV4X2RhdGE7XG59O1xuXG4vLyBCdWlsZCBhIHF1YWQgY2VudGVyZWQgb24gYSBwb2ludFxuR0xCdWlsZGVycy5idWlsZFF1YWRzID0gZnVuY3Rpb24gR0xCdWlsZGVyc0J1aWxkUXVhZHMgKHBvaW50cywgd2lkdGgsIGhlaWdodCwgYWRkR2VvbWV0cnksIG9wdGlvbnMpXG57XG4gICAgdmFyIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXG4gICAgdmFyIG51bV9wb2ludHMgPSBwb2ludHMubGVuZ3RoO1xuICAgIGZvciAodmFyIHA9MDsgcCA8IG51bV9wb2ludHM7IHArKykge1xuICAgICAgICB2YXIgcG9pbnQgPSBwb2ludHNbcF07XG5cbiAgICAgICAgdmFyIHBvc2l0aW9ucyA9IFtcbiAgICAgICAgICAgIFtwb2ludFswXSAtIHdpZHRoLzIsIHBvaW50WzFdIC0gaGVpZ2h0LzJdLFxuICAgICAgICAgICAgW3BvaW50WzBdICsgd2lkdGgvMiwgcG9pbnRbMV0gLSBoZWlnaHQvMl0sXG4gICAgICAgICAgICBbcG9pbnRbMF0gKyB3aWR0aC8yLCBwb2ludFsxXSArIGhlaWdodC8yXSxcblxuICAgICAgICAgICAgW3BvaW50WzBdIC0gd2lkdGgvMiwgcG9pbnRbMV0gLSBoZWlnaHQvMl0sXG4gICAgICAgICAgICBbcG9pbnRbMF0gKyB3aWR0aC8yLCBwb2ludFsxXSArIGhlaWdodC8yXSxcbiAgICAgICAgICAgIFtwb2ludFswXSAtIHdpZHRoLzIsIHBvaW50WzFdICsgaGVpZ2h0LzJdLFxuICAgICAgICBdO1xuXG4gICAgICAgIGlmIChvcHRpb25zLnRleGNvb3JkcyA9PSB0cnVlKSB7XG4gICAgICAgICAgICB2YXIgdGV4Y29vcmRzID0gW1xuICAgICAgICAgICAgICAgIFstMSwgLTFdLFxuICAgICAgICAgICAgICAgIFsxLCAtMV0sXG4gICAgICAgICAgICAgICAgWzEsIDFdLFxuXG4gICAgICAgICAgICAgICAgWy0xLCAtMV0sXG4gICAgICAgICAgICAgICAgWzEsIDFdLFxuICAgICAgICAgICAgICAgIFstMSwgMV1cbiAgICAgICAgICAgIF07XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgdmVydGljZXMgPSB7XG4gICAgICAgICAgICBwb3NpdGlvbnM6IHBvc2l0aW9ucyxcbiAgICAgICAgICAgIHRleGNvb3JkczogKG9wdGlvbnMudGV4Y29vcmRzICYmIHRleGNvb3JkcylcbiAgICAgICAgfTtcbiAgICAgICAgYWRkR2VvbWV0cnkodmVydGljZXMpO1xuICAgIH1cbn07XG5cbi8vIEJ1aWxkIG5hdGl2ZSBHTCBsaW5lcyBmb3IgYSBwb2x5bGluZVxuR0xCdWlsZGVycy5idWlsZExpbmVzID0gZnVuY3Rpb24gR0xCdWlsZGVyc0J1aWxkTGluZXMgKGxpbmVzLCBmZWF0dXJlLCBsYXllciwgc3R5bGUsIHRpbGUsIHosIHZlcnRleF9kYXRhLCBvcHRpb25zKVxue1xuICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXG4gICAgdmFyIGNvbG9yID0gc3R5bGUuY29sb3I7XG4gICAgdmFyIHdpZHRoID0gc3R5bGUud2lkdGg7XG5cbiAgICB2YXIgbnVtX2xpbmVzID0gbGluZXMubGVuZ3RoO1xuICAgIGZvciAodmFyIGxuPTA7IGxuIDwgbnVtX2xpbmVzOyBsbisrKSB7XG4gICAgICAgIHZhciBsaW5lID0gbGluZXNbbG5dO1xuXG4gICAgICAgIGZvciAodmFyIHA9MDsgcCA8IGxpbmUubGVuZ3RoIC0gMTsgcCsrKSB7XG4gICAgICAgICAgICAvLyBQb2ludCBBIHRvIEJcbiAgICAgICAgICAgIHZhciBwYSA9IGxpbmVbcF07XG4gICAgICAgICAgICB2YXIgcGIgPSBsaW5lW3ArMV07XG5cbiAgICAgICAgICAgIHZlcnRleF9kYXRhLnB1c2goXG4gICAgICAgICAgICAgICAgLy8gUG9pbnQgQVxuICAgICAgICAgICAgICAgIHBhWzBdLCBwYVsxXSwgeixcbiAgICAgICAgICAgICAgICAwLCAwLCAxLCAvLyBmbGF0IHN1cmZhY2VzIHBvaW50IHN0cmFpZ2h0IHVwXG4gICAgICAgICAgICAgICAgY29sb3JbMF0sIGNvbG9yWzFdLCBjb2xvclsyXSxcbiAgICAgICAgICAgICAgICAvLyBQb2ludCBCXG4gICAgICAgICAgICAgICAgcGJbMF0sIHBiWzFdLCB6LFxuICAgICAgICAgICAgICAgIDAsIDAsIDEsIC8vIGZsYXQgc3VyZmFjZXMgcG9pbnQgc3RyYWlnaHQgdXBcbiAgICAgICAgICAgICAgICBjb2xvclswXSwgY29sb3JbMV0sIGNvbG9yWzJdXG4gICAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIHJldHVybiB2ZXJ0ZXhfZGF0YTtcbn07XG5cbi8qIFV0aWxpdHkgZnVuY3Rpb25zICovXG5cbi8vIFRlc3RzIGlmIGEgbGluZSBzZWdtZW50IChmcm9tIHBvaW50IEEgdG8gQikgaXMgbmVhcmx5IGNvaW5jaWRlbnQgd2l0aCB0aGUgZWRnZSBvZiBhIHRpbGVcbkdMQnVpbGRlcnMuaXNPblRpbGVFZGdlID0gZnVuY3Rpb24gKHBhLCBwYiwgb3B0aW9ucylcbntcbiAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcblxuICAgIHZhciB0b2xlcmFuY2VfZnVuY3Rpb24gPSBvcHRpb25zLnRvbGVyYW5jZV9mdW5jdGlvbiB8fCBHTEJ1aWxkZXJzLnZhbHVlc1dpdGhpblRvbGVyYW5jZTtcbiAgICB2YXIgdG9sZXJhbmNlID0gb3B0aW9ucy50b2xlcmFuY2UgfHwgMTsgLy8gdHdlYWsgdGhpcyBhZGp1c3QgaWYgY2F0Y2hpbmcgdG9vIGZldy9tYW55IGxpbmUgc2VnbWVudHMgbmVhciB0aWxlIGVkZ2VzXG4gICAgdmFyIHRpbGVfbWluID0gR0xCdWlsZGVycy50aWxlX2JvdW5kc1swXTtcbiAgICB2YXIgdGlsZV9tYXggPSBHTEJ1aWxkZXJzLnRpbGVfYm91bmRzWzFdO1xuICAgIHZhciBlZGdlID0gbnVsbDtcblxuICAgIGlmICh0b2xlcmFuY2VfZnVuY3Rpb24ocGFbMF0sIHRpbGVfbWluLngsIHRvbGVyYW5jZSkgJiYgdG9sZXJhbmNlX2Z1bmN0aW9uKHBiWzBdLCB0aWxlX21pbi54LCB0b2xlcmFuY2UpKSB7XG4gICAgICAgIGVkZ2UgPSAnbGVmdCc7XG4gICAgfVxuICAgIGVsc2UgaWYgKHRvbGVyYW5jZV9mdW5jdGlvbihwYVswXSwgdGlsZV9tYXgueCwgdG9sZXJhbmNlKSAmJiB0b2xlcmFuY2VfZnVuY3Rpb24ocGJbMF0sIHRpbGVfbWF4LngsIHRvbGVyYW5jZSkpIHtcbiAgICAgICAgZWRnZSA9ICdyaWdodCc7XG4gICAgfVxuICAgIGVsc2UgaWYgKHRvbGVyYW5jZV9mdW5jdGlvbihwYVsxXSwgdGlsZV9taW4ueSwgdG9sZXJhbmNlKSAmJiB0b2xlcmFuY2VfZnVuY3Rpb24ocGJbMV0sIHRpbGVfbWluLnksIHRvbGVyYW5jZSkpIHtcbiAgICAgICAgZWRnZSA9ICd0b3AnO1xuICAgIH1cbiAgICBlbHNlIGlmICh0b2xlcmFuY2VfZnVuY3Rpb24ocGFbMV0sIHRpbGVfbWF4LnksIHRvbGVyYW5jZSkgJiYgdG9sZXJhbmNlX2Z1bmN0aW9uKHBiWzFdLCB0aWxlX21heC55LCB0b2xlcmFuY2UpKSB7XG4gICAgICAgIGVkZ2UgPSAnYm90dG9tJztcbiAgICB9XG4gICAgcmV0dXJuIGVkZ2U7XG59O1xuXG5HTEJ1aWxkZXJzLnNldFRpbGVTY2FsZSA9IGZ1bmN0aW9uIChzY2FsZSlcbntcbiAgICBHTEJ1aWxkZXJzLnRpbGVfYm91bmRzID0gW1xuICAgICAgICBQb2ludCgwLCAwKSxcbiAgICAgICAgUG9pbnQoc2NhbGUsIC1zY2FsZSkgLy8gVE9ETzogY29ycmVjdCBmb3IgZmxpcHBlZCB5LWF4aXM/XG4gICAgXTtcbn07XG5cbkdMQnVpbGRlcnMudmFsdWVzV2l0aGluVG9sZXJhbmNlID0gZnVuY3Rpb24gKGEsIGIsIHRvbGVyYW5jZSlcbntcbiAgICB0b2xlcmFuY2UgPSB0b2xlcmFuY2UgfHwgMTtcbiAgICByZXR1cm4gKE1hdGguYWJzKGEgLSBiKSA8IHRvbGVyYW5jZSk7XG59O1xuXG4vLyBCdWlsZCBhIHppZ3phZyBsaW5lIHBhdHRlcm4gZm9yIHRlc3Rpbmcgam9pbnMgYW5kIGNhcHNcbkdMQnVpbGRlcnMuYnVpbGRaaWd6YWdMaW5lVGVzdFBhdHRlcm4gPSBmdW5jdGlvbiAoKVxue1xuICAgIHZhciBtaW4gPSBQb2ludCgwLCAwKTsgLy8gdGlsZS5taW47XG4gICAgdmFyIG1heCA9IFBvaW50KDQwOTYsIDQwOTYpOyAvLyB0aWxlLm1heDtcbiAgICB2YXIgZyA9IHtcbiAgICAgICAgaWQ6IDEyMyxcbiAgICAgICAgZ2VvbWV0cnk6IHtcbiAgICAgICAgICAgIHR5cGU6ICdMaW5lU3RyaW5nJyxcbiAgICAgICAgICAgIGNvb3JkaW5hdGVzOiBbXG4gICAgICAgICAgICAgICAgW21pbi54ICogMC43NSArIG1heC54ICogMC4yNSwgbWluLnkgKiAwLjc1ICsgbWF4LnkgKiAwLjI1XSxcbiAgICAgICAgICAgICAgICBbbWluLnggKiAwLjc1ICsgbWF4LnggKiAwLjI1LCBtaW4ueSAqIDAuNSArIG1heC55ICogMC41XSxcbiAgICAgICAgICAgICAgICBbbWluLnggKiAwLjI1ICsgbWF4LnggKiAwLjc1LCBtaW4ueSAqIDAuNzUgKyBtYXgueSAqIDAuMjVdLFxuICAgICAgICAgICAgICAgIFttaW4ueCAqIDAuMjUgKyBtYXgueCAqIDAuNzUsIG1pbi55ICogMC4yNSArIG1heC55ICogMC43NV0sXG4gICAgICAgICAgICAgICAgW21pbi54ICogMC40ICsgbWF4LnggKiAwLjYsIG1pbi55ICogMC41ICsgbWF4LnkgKiAwLjVdLFxuICAgICAgICAgICAgICAgIFttaW4ueCAqIDAuNSArIG1heC54ICogMC41LCBtaW4ueSAqIDAuMjUgKyBtYXgueSAqIDAuNzVdLFxuICAgICAgICAgICAgICAgIFttaW4ueCAqIDAuNzUgKyBtYXgueCAqIDAuMjUsIG1pbi55ICogMC4yNSArIG1heC55ICogMC43NV0sXG4gICAgICAgICAgICAgICAgW21pbi54ICogMC43NSArIG1heC54ICogMC4yNSwgbWluLnkgKiAwLjQgKyBtYXgueSAqIDAuNl1cbiAgICAgICAgICAgIF1cbiAgICAgICAgfSxcbiAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAga2luZDogJ2RlYnVnJ1xuICAgICAgICB9XG4gICAgfTtcbiAgICAvLyBjb25zb2xlLmxvZyhnLmdlb21ldHJ5LmNvb3JkaW5hdGVzKTtcbiAgICByZXR1cm4gZztcbn07XG5cbmlmIChtb2R1bGUgIT09IHVuZGVmaW5lZCkge1xuICAgIG1vZHVsZS5leHBvcnRzID0gR0xCdWlsZGVycztcbn1cbiIsIi8qKiogTWFuYWdlIHJlbmRlcmluZyBmb3IgcHJpbWl0aXZlcyAqKiovXG52YXIgR0wgPSByZXF1aXJlKCcuL2dsLmpzJyk7XG5cbi8vIEF0dHJpYnMgYXJlIGFuIGFycmF5LCBpbiBsYXlvdXQgb3JkZXIsIG9mOiBuYW1lLCBzaXplLCB0eXBlLCBub3JtYWxpemVkXG4vLyBleDogeyBuYW1lOiAncG9zaXRpb24nLCBzaXplOiAzLCB0eXBlOiBnbC5GTE9BVCwgbm9ybWFsaXplZDogZmFsc2UgfVxuZnVuY3Rpb24gR0xHZW9tZXRyeSAoZ2wsIGdsX3Byb2dyYW0sIHZlcnRleF9kYXRhLCBhdHRyaWJzLCBvcHRpb25zKVxue1xuICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXG4gICAgdGhpcy5nbCA9IGdsO1xuICAgIHRoaXMuZ2xfcHJvZ3JhbSA9IGdsX3Byb2dyYW07XG4gICAgdGhpcy5hdHRyaWJzID0gYXR0cmlicztcbiAgICB0aGlzLnZlcnRleF9kYXRhID0gdmVydGV4X2RhdGE7IC8vIEZsb2F0MzJBcnJheVxuICAgIHRoaXMuYnVmZmVyID0gdGhpcy5nbC5jcmVhdGVCdWZmZXIoKTtcbiAgICB0aGlzLmRyYXdfbW9kZSA9IG9wdGlvbnMuZHJhd19tb2RlIHx8IHRoaXMuZ2wuVFJJQU5HTEVTO1xuICAgIHRoaXMuZGF0YV91c2FnZSA9IG9wdGlvbnMuZGF0YV91c2FnZSB8fCB0aGlzLmdsLlNUQVRJQ19EUkFXO1xuXG4gICAgLy8gQ2FsYyB2ZXJ0ZXggc3RyaWRlXG4gICAgdGhpcy52ZXJ0ZXhfc3RyaWRlID0gMDtcbiAgICBmb3IgKHZhciBhPTA7IGEgPCB0aGlzLmF0dHJpYnMubGVuZ3RoOyBhKyspIHtcbiAgICAgICAgdmFyIGF0dHJpYiA9IHRoaXMuYXR0cmlic1thXTtcblxuICAgICAgICBhdHRyaWIubG9jYXRpb24gPSB0aGlzLmdsX3Byb2dyYW0uYXR0cmlidXRlKGF0dHJpYi5uYW1lKS5sb2NhdGlvbjtcbiAgICAgICAgYXR0cmliLmJ5dGVfc2l6ZSA9IGF0dHJpYi5zaXplO1xuXG4gICAgICAgIHN3aXRjaCAoYXR0cmliLnR5cGUpIHtcbiAgICAgICAgICAgIGNhc2UgdGhpcy5nbC5GTE9BVDpcbiAgICAgICAgICAgIGNhc2UgdGhpcy5nbC5JTlQ6XG4gICAgICAgICAgICBjYXNlIHRoaXMuZ2wuVU5TSUdORURfSU5UOlxuICAgICAgICAgICAgICAgIGF0dHJpYi5ieXRlX3NpemUgKj0gNDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgdGhpcy5nbC5TSE9SVDpcbiAgICAgICAgICAgIGNhc2UgdGhpcy5nbC5VTlNJR05FRF9TSE9SVDpcbiAgICAgICAgICAgICAgICBhdHRyaWIuYnl0ZV9zaXplICo9IDI7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cblxuICAgICAgICBhdHRyaWIub2Zmc2V0ID0gdGhpcy52ZXJ0ZXhfc3RyaWRlO1xuICAgICAgICB0aGlzLnZlcnRleF9zdHJpZGUgKz0gYXR0cmliLmJ5dGVfc2l6ZTtcbiAgICB9XG5cbiAgICB0aGlzLnZlcnRleF9jb3VudCA9IHRoaXMudmVydGV4X2RhdGEuYnl0ZUxlbmd0aCAvIHRoaXMudmVydGV4X3N0cmlkZTtcblxuICAgIHRoaXMudmFvID0gR0wuVmVydGV4QXJyYXlPYmplY3QuY3JlYXRlKGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLmdsLmJpbmRCdWZmZXIodGhpcy5nbC5BUlJBWV9CVUZGRVIsIHRoaXMuYnVmZmVyKTtcbiAgICAgICAgdGhpcy5zZXR1cCgpO1xuICAgIH0uYmluZCh0aGlzKSk7XG5cbiAgICB0aGlzLmdsLmJ1ZmZlckRhdGEodGhpcy5nbC5BUlJBWV9CVUZGRVIsIHRoaXMudmVydGV4X2RhdGEsIHRoaXMuZGF0YV91c2FnZSk7XG59XG5cbkdMR2VvbWV0cnkucHJvdG90eXBlLnNldHVwID0gZnVuY3Rpb24gKClcbntcbiAgICBmb3IgKHZhciBhPTA7IGEgPCB0aGlzLmF0dHJpYnMubGVuZ3RoOyBhKyspIHtcbiAgICAgICAgdmFyIGF0dHJpYiA9IHRoaXMuYXR0cmlic1thXTtcbiAgICAgICAgdGhpcy5nbC5lbmFibGVWZXJ0ZXhBdHRyaWJBcnJheShhdHRyaWIubG9jYXRpb24pO1xuICAgICAgICB0aGlzLmdsLnZlcnRleEF0dHJpYlBvaW50ZXIoYXR0cmliLmxvY2F0aW9uLCBhdHRyaWIuc2l6ZSwgYXR0cmliLnR5cGUsIGF0dHJpYi5ub3JtYWxpemVkLCB0aGlzLnZlcnRleF9zdHJpZGUsIGF0dHJpYi5vZmZzZXQpO1xuICAgIH1cbn07XG5cbkdMR2VvbWV0cnkucHJvdG90eXBlLnJlbmRlciA9IGZ1bmN0aW9uICgpXG57XG4gICAgdGhpcy5nbC51c2VQcm9ncmFtKHRoaXMuZ2xfcHJvZ3JhbS5wcm9ncmFtKTtcbiAgICBHTC5WZXJ0ZXhBcnJheU9iamVjdC5iaW5kKHRoaXMudmFvKTtcblxuICAgIGlmICh0eXBlb2YgdGhpcy5fcmVuZGVyID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgdGhpcy5fcmVuZGVyKCk7XG4gICAgfVxuXG4gICAgLy8gVE9ETzogc3VwcG9ydCBlbGVtZW50IGFycmF5IG1vZGVcbiAgICB0aGlzLmdsLmRyYXdBcnJheXModGhpcy5kcmF3X21vZGUsIDAsIHRoaXMudmVydGV4X2NvdW50KTtcbiAgICBHTC5WZXJ0ZXhBcnJheU9iamVjdC5iaW5kKG51bGwpO1xufTtcblxuR0xHZW9tZXRyeS5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uICgpXG57XG4gICAgY29uc29sZS5sb2coXCJHTEdlb21ldHJ5LmRlc3Ryb3k6IGRlbGV0ZSBidWZmZXIgb2Ygc2l6ZSBcIiArIHRoaXMudmVydGV4X2RhdGEuYnl0ZUxlbmd0aCk7XG4gICAgdGhpcy5nbC5kZWxldGVCdWZmZXIodGhpcy5idWZmZXIpO1xuICAgIGRlbGV0ZSB0aGlzLnZlcnRleF9kYXRhO1xufTtcblxuLy8gRHJhd3MgYSBzZXQgb2YgdHJpYW5nbGVzXG5HTFRyaWFuZ2xlcy5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKEdMR2VvbWV0cnkucHJvdG90eXBlKTtcblxuZnVuY3Rpb24gR0xUcmlhbmdsZXMgKGdsLCBnbF9wcm9ncmFtLCB2ZXJ0ZXhfZGF0YSlcbntcbiAgICBHTEdlb21ldHJ5LmNhbGwodGhpcywgZ2wsIGdsX3Byb2dyYW0sIHZlcnRleF9kYXRhLCBbXG4gICAgICAgIHsgbmFtZTogJ3Bvc2l0aW9uJywgc2l6ZTogMywgdHlwZTogZ2wuRkxPQVQsIG5vcm1hbGl6ZWQ6IGZhbHNlIH0sXG4gICAgICAgIHsgbmFtZTogJ25vcm1hbCcsIHNpemU6IDMsIHR5cGU6IGdsLkZMT0FULCBub3JtYWxpemVkOiBmYWxzZSB9LFxuICAgICAgICB7IG5hbWU6ICdjb2xvcicsIHNpemU6IDMsIHR5cGU6IGdsLkZMT0FULCBub3JtYWxpemVkOiBmYWxzZSB9LFxuICAgICAgICB7IG5hbWU6ICdsYXllcicsIHNpemU6IDEsIHR5cGU6IGdsLkZMT0FULCBub3JtYWxpemVkOiBmYWxzZSB9XG4gICAgXSk7XG4gICAgdGhpcy5nZW9tZXRyeV9jb3VudCA9IHRoaXMudmVydGV4X2NvdW50IC8gMztcbn1cblxuLy8gRHJhd3MgYSBzZXQgb2YgcG9pbnRzIGFzIHF1YWRzLCBpbnRlbmRlZCB0byBiZSByZW5kZXJlZCBhcyBkaXN0YW5jZSBmaWVsZHNcbkdMUG9seVBvaW50cy5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKEdMR2VvbWV0cnkucHJvdG90eXBlKTtcblxuZnVuY3Rpb24gR0xQb2x5UG9pbnRzIChnbCwgZ2xfcHJvZ3JhbSwgdmVydGV4X2RhdGEpXG57XG4gICAgR0xHZW9tZXRyeS5jYWxsKHRoaXMsIGdsLCBnbF9wcm9ncmFtLCB2ZXJ0ZXhfZGF0YSwgW1xuICAgICAgICB7IG5hbWU6ICdwb3NpdGlvbicsIHNpemU6IDMsIHR5cGU6IGdsLkZMT0FULCBub3JtYWxpemVkOiBmYWxzZSB9LFxuICAgICAgICB7IG5hbWU6ICd0ZXhjb29yZCcsIHNpemU6IDIsIHR5cGU6IGdsLkZMT0FULCBub3JtYWxpemVkOiBmYWxzZSB9LFxuICAgICAgICB7IG5hbWU6ICdjb2xvcicsIHNpemU6IDMsIHR5cGU6IGdsLkZMT0FULCBub3JtYWxpemVkOiBmYWxzZSB9LFxuICAgICAgICB7IG5hbWU6ICdsYXllcicsIHNpemU6IDEsIHR5cGU6IGdsLkZMT0FULCBub3JtYWxpemVkOiBmYWxzZSB9XG4gICAgXSk7XG4gICAgdGhpcy5nZW9tZXRyeV9jb3VudCA9IHRoaXMudmVydGV4X2NvdW50IC8gMztcbn1cblxuLy8gRHJhd3MgYSBzZXQgb2YgbGluZXNcbi8vIFNoYXJlcyBhbGwgY2hhcmFjdGVyaXN0aWNzIHdpdGggdHJpYW5nbGVzIGV4Y2VwdCBmb3IgZHJhdyBtb2RlXG5HTExpbmVzLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoR0xUcmlhbmdsZXMucHJvdG90eXBlKTtcblxuZnVuY3Rpb24gR0xMaW5lcyAoZ2wsIGdsX3Byb2dyYW0sIHZlcnRleF9kYXRhLCBvcHRpb25zKVxue1xuICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICAgIEdMVHJpYW5nbGVzLmNhbGwodGhpcywgZ2wsIHByb2dyYW0sIHZlcnRleF9kYXRhKTtcbiAgICB0aGlzLmRyYXdfbW9kZSA9IHRoaXMuZ2wuTElORVM7XG4gICAgdGhpcy5saW5lX3dpZHRoID0gb3B0aW9ucy5saW5lX3dpZHRoIHx8IDI7XG4gICAgdGhpcy5nZW9tZXRyeV9jb3VudCA9IHRoaXMudmVydGV4X2NvdW50IC8gMjtcbn1cblxuR0xMaW5lcy5wcm90b3R5cGUuX3JlbmRlciA9IGZ1bmN0aW9uICgpXG57XG4gICAgdGhpcy5nbC5saW5lV2lkdGgodGhpcy5saW5lX3dpZHRoKTtcbiAgICBpZiAodHlwZW9mIEdMVHJpYW5nbGVzLnByb3RvdHlwZS5fcmVuZGVyID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgR0xUcmlhbmdsZXMucHJvdG90eXBlLl9yZW5kZXIuY2FsbCh0aGlzKTtcbiAgICB9XG59O1xuXG5pZiAobW9kdWxlICE9PSB1bmRlZmluZWQpIHtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IHtcbiAgICAgICAgR0xHZW9tZXRyeTogR0xHZW9tZXRyeSxcbiAgICAgICAgR0xUcmlhbmdsZXM6IEdMVHJpYW5nbGVzLFxuICAgICAgICBHTFBvbHlQb2ludHM6IEdMUG9seVBvaW50cyxcbiAgICAgICAgR0xMaW5lczogR0xMaW5lc1xuICAgIH07XG59XG4iLCJ2YXIgUG9pbnQgPSByZXF1aXJlKCcuLi9wb2ludC5qcycpO1xudmFyIEdlbyA9IHJlcXVpcmUoJy4uL2dlby5qcycpO1xudmFyIFZlY3RvclJlbmRlcmVyID0gcmVxdWlyZSgnLi4vdmVjdG9yX3JlbmRlcmVyLmpzJyk7XG5cbnZhciBHTCA9IHJlcXVpcmUoJy4vZ2wuanMnKTtcbnZhciBHTEJ1aWxkZXJzID0gcmVxdWlyZSgnLi9nbF9idWlsZGVycy5qcycpO1xudmFyIEdMR2VvbWV0cnkgPSByZXF1aXJlKCcuL2dsX2dlb20uanMnKS5HTEdlb21ldHJ5O1xudmFyIEdMVHJpYW5nbGVzID0gcmVxdWlyZSgnLi9nbF9nZW9tLmpzJykuR0xUcmlhbmdsZXM7XG52YXIgR0xQb2x5UG9pbnRzID0gcmVxdWlyZSgnLi9nbF9nZW9tLmpzJykuR0xQb2x5UG9pbnRzO1xudmFyIEdMTGluZXMgPSByZXF1aXJlKCcuL2dsX2dlb20uanMnKS5HTExpbmVzO1xuXG5WZWN0b3JSZW5kZXJlci5HTFJlbmRlcmVyID0gR0xSZW5kZXJlcjtcbkdMUmVuZGVyZXIucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShWZWN0b3JSZW5kZXJlci5wcm90b3R5cGUpO1xuR0xSZW5kZXJlci5kZWJ1ZyA9IGZhbHNlO1xuXG5HTFJlbmRlcmVyLnNoYWRlcl9zb3VyY2VzID0gcmVxdWlyZSgnLi9nbF9zaGFkZXJzLmpzJyk7XG5cbmZ1bmN0aW9uIEdMUmVuZGVyZXIgKHRpbGVfc291cmNlLCBsYXllcnMsIHN0eWxlcywgb3B0aW9ucylcbntcbiAgICB2YXIgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cbiAgICBWZWN0b3JSZW5kZXJlci5jYWxsKHRoaXMsICdHTFJlbmRlcmVyJywgdGlsZV9zb3VyY2UsIGxheWVycywgc3R5bGVzLCBvcHRpb25zKTtcblxuICAgIEdMQnVpbGRlcnMuc2V0VGlsZVNjYWxlKFZlY3RvclJlbmRlcmVyLnRpbGVfc2NhbGUpO1xuICAgIEdMLlByb2dyYW0uZGVmaW5lcy5USUxFX1NDQUxFID0gVmVjdG9yUmVuZGVyZXIudGlsZV9zY2FsZSArICcuMCc7XG5cbiAgICB0aGlzLmNvbnRhaW5lciA9IG9wdGlvbnMuY29udGFpbmVyO1xuICAgIHRoaXMuY29udGludW91c19hbmltYXRpb24gPSBmYWxzZTsgLy8gcmVxdWVzdCByZWRyYXcgZXZlcnkgZnJhbWVcbn1cblxuR0xSZW5kZXJlci5wcm90b3R5cGUuX2luaXQgPSBmdW5jdGlvbiBHTFJlbmRlcmVySW5pdCAoKVxue1xuICAgIHRoaXMuY29udGFpbmVyID0gdGhpcy5jb250YWluZXIgfHwgZG9jdW1lbnQuYm9keTtcbiAgICB0aGlzLmNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpO1xuICAgIHRoaXMuY2FudmFzLnN0eWxlLnBvc2l0aW9uID0gJ2Fic29sdXRlJztcbiAgICB0aGlzLmNhbnZhcy5zdHlsZS50b3AgPSAwO1xuICAgIHRoaXMuY2FudmFzLnN0eWxlLmxlZnQgPSAwO1xuICAgIHRoaXMuY2FudmFzLnN0eWxlLnpJbmRleCA9IC0xO1xuICAgIHRoaXMuY29udGFpbmVyLmFwcGVuZENoaWxkKHRoaXMuY2FudmFzKTtcblxuICAgIHRoaXMuZ2wgPSBHTC5nZXRDb250ZXh0KHRoaXMuY2FudmFzKTtcblxuICAgIHZhciByZW5kZXJlciA9IHRoaXM7XG5cbiAgICB0aGlzLnJlbmRlcl9tb2RlcyA9IHtcbiAgICAgICAgJ3BvbHlnb25zJzoge1xuICAgICAgICAgICAgZ2xfcHJvZ3JhbTogbmV3IEdMLlByb2dyYW0odGhpcy5nbCwgR0xSZW5kZXJlci5zaGFkZXJfc291cmNlc1sncG9seWdvbl92ZXJ0ZXgnXSwgR0xSZW5kZXJlci5zaGFkZXJfc291cmNlc1sncG9seWdvbl9mcmFnbWVudCddKSxcbiAgICAgICAgICAgIG1ha2VHTEdlb21ldHJ5OiBmdW5jdGlvbiAodmVydGV4X2RhdGEpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IEdMVHJpYW5nbGVzKHJlbmRlcmVyLmdsLCB0aGlzLmdsX3Byb2dyYW0sIHZlcnRleF9kYXRhKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgJ3BvbHlnb25zX25vaXNlJzoge1xuICAgICAgICAgICAgZ2xfcHJvZ3JhbTogbmV3IEdMLlByb2dyYW0odGhpcy5nbCwgR0xSZW5kZXJlci5zaGFkZXJfc291cmNlc1sncG9seWdvbl92ZXJ0ZXgnXSwgR0xSZW5kZXJlci5zaGFkZXJfc291cmNlc1sncG9seWdvbl9mcmFnbWVudCddLCB7IGRlZmluZXM6IHsgJ0VGRkVDVF9OT0lTRV9URVhUVVJFJzogdHJ1ZSwgJ0VGRkVDVF9OT0lTRV9BTklNQVRBQkxFJzogdHJ1ZSB9IH0pLFxuICAgICAgICAgICAgbWFrZUdMR2VvbWV0cnk6IGZ1bmN0aW9uICh2ZXJ0ZXhfZGF0YSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBuZXcgR0xUcmlhbmdsZXMocmVuZGVyZXIuZ2wsIHRoaXMuZ2xfcHJvZ3JhbSwgdmVydGV4X2RhdGEpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICAncG9pbnRzJzoge1xuICAgICAgICAgICAgLy8gVE9ETzogcmVwbGFjZSByZWxhdGl2ZSBzaGFkZXIgcGF0aHMgd2l0aCBhIGJldHRlciBhdXRvLXBhdGhpbmcgc3lzdGVtXG4gICAgICAgICAgICAvLyBnbF9wcm9ncmFtOiBuZXcgR0wuUHJvZ3JhbS5jcmVhdGVQcm9ncmFtRnJvbVVSTHModGhpcy5nbCwgVmVjdG9yUmVuZGVyZXIubGlicmFyeV9iYXNlX3VybCArICcuLi9zaGFkZXJzL3BvaW50X3ZlcnRleC5nbHNsJywgVmVjdG9yUmVuZGVyZXIubGlicmFyeV9iYXNlX3VybCArICcuLi9zaGFkZXJzL3BvaW50X2ZyYWdtZW50Lmdsc2wnLCB7IGRlZmluZXM6IHsgJ0VGRkVDVF9TQ1JFRU5fQ09MT1InOiB0cnVlIH0gfSksXG4gICAgICAgICAgICBnbF9wcm9ncmFtOiBuZXcgR0wuUHJvZ3JhbSh0aGlzLmdsLCBHTFJlbmRlcmVyLnNoYWRlcl9zb3VyY2VzWydwb2ludF92ZXJ0ZXgnXSwgR0xSZW5kZXJlci5zaGFkZXJfc291cmNlc1sncG9pbnRfZnJhZ21lbnQnXSwgeyBkZWZpbmVzOiB7ICdFRkZFQ1RfU0NSRUVOX0NPTE9SJzogdHJ1ZSB9IH0pLFxuICAgICAgICAgICAgbWFrZUdMR2VvbWV0cnk6IGZ1bmN0aW9uICh2ZXJ0ZXhfZGF0YSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBuZXcgR0xQb2x5UG9pbnRzKHJlbmRlcmVyLmdsLCB0aGlzLmdsX3Byb2dyYW0sIHZlcnRleF9kYXRhKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG5cbiAgICB0aGlzLnJlc2l6ZU1hcCh0aGlzLmNvbnRhaW5lci5jbGllbnRXaWR0aCwgdGhpcy5jb250YWluZXIuY2xpZW50SGVpZ2h0KTtcblxuICAgIC8vIHRoaXMuem9vbV9zdGVwID0gMC4wMjsgLy8gZm9yIGZyYWN0aW9uYWwgem9vbSB1c2VyIGFkanVzdG1lbnRcbiAgICB0aGlzLnN0YXJ0X3RpbWUgPSArbmV3IERhdGUoKTtcbiAgICB0aGlzLmxhc3RfcmVuZGVyX2NvdW50ID0gbnVsbDtcbiAgICB0aGlzLmluaXRJbnB1dEhhbmRsZXJzKCk7XG59O1xuXG4vLyBEZXRlcm1pbmUgYSBaIHZhbHVlIHRoYXQgd2lsbCBzdGFjayBmZWF0dXJlcyBpbiBhIFwicGFpbnRlcidzIGFsZ29yaXRobVwiIHN0eWxlLCBmaXJzdCBieSBsYXllciwgdGhlbiBieSBkcmF3IG9yZGVyIHdpdGhpbiBsYXllclxuLy8gRmVhdHVyZXMgYXJlIGFzc3VtZWQgdG8gYmUgYWxyZWFkeSBzb3J0ZWQgaW4gZGVzaXJlZCBkcmF3IG9yZGVyIGJ5IHRoZSBsYXllciBwcmUtcHJvY2Vzc29yXG5HTFJlbmRlcmVyLmNhbGN1bGF0ZVogPSBmdW5jdGlvbiAobGF5ZXIsIHRpbGUsIGxheWVyX29mZnNldCwgZmVhdHVyZV9vZmZzZXQpXG57XG4gICAgLy8gdmFyIGxheWVyX29mZnNldCA9IGxheWVyX29mZnNldCB8fCAwO1xuICAgIC8vIHZhciBmZWF0dXJlX29mZnNldCA9IGZlYXR1cmVfb2Zmc2V0IHx8IDA7XG4gICAgdmFyIHogPSAwOyAvLyBUT0RPOiBtYWRlIHRoaXMgYSBuby1vcCB1bnRpbCByZXZpc2l0aW5nIHdoZXJlIGl0IHNob3VsZCBsaXZlIC0gb25lLXRpbWUgY2FsYyBoZXJlLCBpbiB2ZXJ0ZXggbGF5b3V0L3NoYWRlciwgZXRjLlxuICAgIHJldHVybiB6O1xufTtcblxuLy8gUHJvY2VzcyBnZW9tZXRyeSBmb3IgdGlsZSAtIGNhbGxlZCBieSB3ZWIgd29ya2VyXG5HTFJlbmRlcmVyLmFkZFRpbGUgPSBmdW5jdGlvbiAodGlsZSwgbGF5ZXJzLCBzdHlsZXMpXG57XG4gICAgdmFyIGxheWVyLCBzdHlsZSwgZmVhdHVyZSwgeiwgbW9kZTtcbiAgICB2YXIgdmVydGV4X2RhdGEgPSB7fTtcblxuICAgIC8vIEpvaW4gbGluZSB0ZXN0IHBhdHRlcm5cbiAgICAvLyBpZiAoR0xSZW5kZXJlci5kZWJ1Zykge1xuICAgIC8vICAgICB0aWxlLmxheWVyc1sncm9hZHMnXS5mZWF0dXJlcy5wdXNoKEdMUmVuZGVyZXIuYnVpbGRaaWd6YWdMaW5lVGVzdFBhdHRlcm4oKSk7XG4gICAgLy8gfVxuXG4gICAgLy8gQnVpbGQgcmF3IGdlb21ldHJ5IGFycmF5c1xuICAgIHRpbGUuZGVidWcuZmVhdHVyZXMgPSAwO1xuICAgIGZvciAodmFyIGxuPTA7IGxuIDwgbGF5ZXJzLmxlbmd0aDsgbG4rKykge1xuICAgICAgICBsYXllciA9IGxheWVyc1tsbl07XG5cbiAgICAgICAgLy8gU2tpcCBsYXllcnMgd2l0aCBubyBzdHlsZXMgZGVmaW5lZFxuICAgICAgICBpZiAoc3R5bGVzW2xheWVyLm5hbWVdID09IG51bGwpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRpbGUubGF5ZXJzW2xheWVyLm5hbWVdICE9IG51bGwpIHtcbiAgICAgICAgICAgIHZhciBudW1fZmVhdHVyZXMgPSB0aWxlLmxheWVyc1tsYXllci5uYW1lXS5mZWF0dXJlcy5sZW5ndGg7XG5cbiAgICAgICAgICAgIC8vIFJlbmRlcmluZyByZXZlcnNlIG9yZGVyIGFrYSB0b3AgdG8gYm90dG9tXG4gICAgICAgICAgICBmb3IgKHZhciBmID0gbnVtX2ZlYXR1cmVzLTE7IGYgPj0gMDsgZi0tKSB7XG4gICAgICAgICAgICAgICAgZmVhdHVyZSA9IHRpbGUubGF5ZXJzW2xheWVyLm5hbWVdLmZlYXR1cmVzW2ZdO1xuICAgICAgICAgICAgICAgIHogPSBHTFJlbmRlcmVyLmNhbGN1bGF0ZVoobGF5ZXIsIHRpbGUpO1xuICAgICAgICAgICAgICAgIHN0eWxlID0gVmVjdG9yUmVuZGVyZXIucGFyc2VTdHlsZUZvckZlYXR1cmUoZmVhdHVyZSwgc3R5bGVzW2xheWVyLm5hbWVdLCB0aWxlKTtcblxuICAgICAgICAgICAgICAgIC8vIFNraXAgZmVhdHVyZT9cbiAgICAgICAgICAgICAgICBpZiAoc3R5bGUgPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBGaXJzdCBmZWF0dXJlIGluIHRoaXMgcmVuZGVyIG1vZGU/XG4gICAgICAgICAgICAgICAgbW9kZSA9IHN0eWxlLnJlbmRlcl9tb2RlO1xuICAgICAgICAgICAgICAgIGlmICh2ZXJ0ZXhfZGF0YVttb2RlXSA9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgIHZlcnRleF9kYXRhW21vZGVdID0gW107XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gREVCVUdHSU5HIGxpbmUvdGlsZSBpbnRlcnNlY3Rpb25zIHJldHVybmVkIGFzIHBvaW50c1xuICAgICAgICAgICAgICAgIC8vICNtYXB6ZW4sNDAuNzQ3MzMwMTE1ODk2MTcsLTczLjk3NTM1MTQ1MjgyNzQ3LDE3XG4gICAgICAgICAgICAgICAgLy8gaWYgKGZlYXR1cmUuaWQgPT0gMTU3OTY0ODEzICYmIGZlYXR1cmUuZ2VvbWV0cnkudHlwZSA9PSAnUG9pbnQnKSB7XG4gICAgICAgICAgICAgICAgLy8gICAgIHN0eWxlLmNvbG9yID0gWzEsIDEsIDBdO1xuICAgICAgICAgICAgICAgIC8vICAgICBzdHlsZS5zaXplID0gU3R5bGUud2lkdGgucGl4ZWxzKDEwLCB0aWxlKTtcbiAgICAgICAgICAgICAgICAvLyB9XG5cbiAgICAgICAgICAgICAgICB2YXIgdmVydGV4X2NvbnN0YW50cyA9IFtcbiAgICAgICAgICAgICAgICAgICAgc3R5bGUuY29sb3JbMF0sIHN0eWxlLmNvbG9yWzFdLCBzdHlsZS5jb2xvclsyXSxcbiAgICAgICAgICAgICAgICAgICAgbG5cbiAgICAgICAgICAgICAgICAgICAgLy8gVE9ETzogYWRkIG1hdGVyaWFsIGluZm8sIGV0Yy5cbiAgICAgICAgICAgICAgICBdO1xuXG4gICAgICAgICAgICAgICAgaWYgKHN0eWxlLm91dGxpbmUuY29sb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG91dGxpbmVfdmVydGV4X2NvbnN0YW50cyA9IFtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0eWxlLm91dGxpbmUuY29sb3JbMF0sIHN0eWxlLm91dGxpbmUuY29sb3JbMV0sIHN0eWxlLm91dGxpbmUuY29sb3JbMl0sXG4gICAgICAgICAgICAgICAgICAgICAgICBsbiAtIDAuNSAvLyBvdXRsaW5lcyBzaXQgYmV0d2VlbiBsYXllcnMsIHVuZGVybmVhdGggY3VycmVudCBsYXllciBidXQgYWJvdmUgdGhlIG9uZSBiZWxvd1xuICAgICAgICAgICAgICAgICAgICBdO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHZhciBwb2ludHMgPSBudWxsLFxuICAgICAgICAgICAgICAgICAgICBsaW5lcyA9IG51bGwsXG4gICAgICAgICAgICAgICAgICAgIHBvbHlnb25zID0gbnVsbDtcblxuICAgICAgICAgICAgICAgIGlmIChmZWF0dXJlLmdlb21ldHJ5LnR5cGUgPT0gJ1BvbHlnb24nKSB7XG4gICAgICAgICAgICAgICAgICAgIHBvbHlnb25zID0gW2ZlYXR1cmUuZ2VvbWV0cnkuY29vcmRpbmF0ZXNdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIGlmIChmZWF0dXJlLmdlb21ldHJ5LnR5cGUgPT0gJ011bHRpUG9seWdvbicpIHtcbiAgICAgICAgICAgICAgICAgICAgcG9seWdvbnMgPSBmZWF0dXJlLmdlb21ldHJ5LmNvb3JkaW5hdGVzO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIGlmIChmZWF0dXJlLmdlb21ldHJ5LnR5cGUgPT0gJ0xpbmVTdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgICAgIGxpbmVzID0gW2ZlYXR1cmUuZ2VvbWV0cnkuY29vcmRpbmF0ZXNdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIGlmIChmZWF0dXJlLmdlb21ldHJ5LnR5cGUgPT0gJ011bHRpTGluZVN0cmluZycpIHtcbiAgICAgICAgICAgICAgICAgICAgbGluZXMgPSBmZWF0dXJlLmdlb21ldHJ5LmNvb3JkaW5hdGVzO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIGlmIChmZWF0dXJlLmdlb21ldHJ5LnR5cGUgPT0gJ1BvaW50Jykge1xuICAgICAgICAgICAgICAgICAgICBwb2ludHMgPSBbZmVhdHVyZS5nZW9tZXRyeS5jb29yZGluYXRlc107XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgaWYgKGZlYXR1cmUuZ2VvbWV0cnkudHlwZSA9PSAnTXVsdGlQb2ludCcpIHtcbiAgICAgICAgICAgICAgICAgICAgcG9pbnRzID0gZmVhdHVyZS5nZW9tZXRyeS5jb29yZGluYXRlcztcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAocG9seWdvbnMgIT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICAvLyBFeHRydWRlZCBwb2x5Z29ucyAoZS5nLiAzRCBidWlsZGluZ3MpXG4gICAgICAgICAgICAgICAgICAgIGlmIChzdHlsZS5leHRydWRlICYmIHN0eWxlLmhlaWdodCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgR0xCdWlsZGVycy5idWlsZEV4dHJ1ZGVkUG9seWdvbnMocG9seWdvbnMsIHosIHN0eWxlLmhlaWdodCwgc3R5bGUubWluX2hlaWdodCwgdmVydGV4X2RhdGFbbW9kZV0sIHsgdmVydGV4X2NvbnN0YW50czogdmVydGV4X2NvbnN0YW50cyB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAvLyBSZWd1bGFyIHBvbHlnb25zXG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgR0xCdWlsZGVycy5idWlsZFBvbHlnb25zKHBvbHlnb25zLCB6LCB2ZXJ0ZXhfZGF0YVttb2RlXSwgeyB2ZXJ0ZXhfY29uc3RhbnRzOiB2ZXJ0ZXhfY29uc3RhbnRzIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyB2YXIgcG9seWdvbl92ZXJ0ZXhfY29uc3RhbnRzID0gW3osIDAsIDAsIDFdLmNvbmNhdCh2ZXJ0ZXhfY29uc3RhbnRzKTsgLy8gdXB3YXJkcy1mYWNpbmcgbm9ybWFsXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBHTEJ1aWxkZXJzLmJ1aWxkUG9seWdvbnMyKFxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gICAgIHBvbHlnb25zLFxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gICAgIGZ1bmN0aW9uICh2ZXJ0aWNlcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gICAgICAgICBHTC5hZGRWZXJ0aWNlcyh2ZXJ0aWNlcy5wb3NpdGlvbnMsIHZlcnRleF9kYXRhW21vZGVdLCBwb2x5Z29uX3ZlcnRleF9jb25zdGFudHMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vICk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBQb2x5Z29uIG91dGxpbmVzXG4gICAgICAgICAgICAgICAgICAgIGlmIChzdHlsZS5vdXRsaW5lLmNvbG9yICYmIHN0eWxlLm91dGxpbmUud2lkdGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAodmFyIG1wYz0wOyBtcGMgPCBwb2x5Z29ucy5sZW5ndGg7IG1wYysrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgR0xCdWlsZGVycy5idWlsZFBvbHlsaW5lcyhwb2x5Z29uc1ttcGNdLCBHTFJlbmRlcmVyLmNhbGN1bGF0ZVoobGF5ZXIsIHRpbGUsIC0wLjUpLCBzdHlsZS5vdXRsaW5lLndpZHRoLCB2ZXJ0ZXhfZGF0YVttb2RlXSwgeyBjbG9zZWRfcG9seWdvbjogdHJ1ZSwgcmVtb3ZlX3RpbGVfZWRnZXM6IHRydWUsIHZlcnRleF9jb25zdGFudHM6IG91dGxpbmVfdmVydGV4X2NvbnN0YW50cyB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChsaW5lcyAhPSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgIEdMQnVpbGRlcnMuYnVpbGRQb2x5bGluZXMobGluZXMsIHosIHN0eWxlLndpZHRoLCB2ZXJ0ZXhfZGF0YVttb2RlXSwgeyB2ZXJ0ZXhfY29uc3RhbnRzOiB2ZXJ0ZXhfY29uc3RhbnRzIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIExpbmUgb3V0bGluZXNcbiAgICAgICAgICAgICAgICAgICAgaWYgKHN0eWxlLm91dGxpbmUuY29sb3IgJiYgc3R5bGUub3V0bGluZS53aWR0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgR0xCdWlsZGVycy5idWlsZFBvbHlsaW5lcyhsaW5lcywgR0xSZW5kZXJlci5jYWxjdWxhdGVaKGxheWVyLCB0aWxlLCAtMC41KSwgc3R5bGUud2lkdGggKyAyICogc3R5bGUub3V0bGluZS53aWR0aCwgdmVydGV4X2RhdGFbbW9kZV0sIHsgdmVydGV4X2NvbnN0YW50czogb3V0bGluZV92ZXJ0ZXhfY29uc3RhbnRzIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKHBvaW50cyAhPSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKEpTT04uc3RyaW5naWZ5KGZlYXR1cmUpKTtcbiAgICAgICAgICAgICAgICAgICAgLy8gTk9URTogYWRkaW5nIHRvIHogdG8gZXhwZXJpbWVudCB3aXRoIFwiZmxvYXRpbmdcIiBQT0lzXG4gICAgICAgICAgICAgICAgICAgIHZhciBwb2ludF92ZXJ0ZXhfY29uc3RhbnRzID0gW3ogKyAxLCAwLCAwLCAxXS5jb25jYXQodmVydGV4X2NvbnN0YW50cyk7IC8vIHVwd2FyZHMtZmFjaW5nIG5vcm1hbFxuICAgICAgICAgICAgICAgICAgICBHTEJ1aWxkZXJzLmJ1aWxkUXVhZHMoXG4gICAgICAgICAgICAgICAgICAgICAgICBwb2ludHMsIHN0eWxlLnNpemUgKiAyLCBzdHlsZS5zaXplICogMixcbiAgICAgICAgICAgICAgICAgICAgICAgIGZ1bmN0aW9uICh2ZXJ0aWNlcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciB2cyA9IHZlcnRpY2VzLnBvc2l0aW9ucztcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEFsdGVybmF0ZSB2ZXJ0ZXggbGF5b3V0IGZvciAncG9pbnRzJyBzaGFkZXJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobW9kZSA9PSAncG9pbnRzJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwb2ludF92ZXJ0ZXhfY29uc3RhbnRzID0gdmVydGV4X2NvbnN0YW50cztcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciB2IGluIHZlcnRpY2VzLnBvc2l0aW9ucykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdnNbdl0gPSB2ZXJ0aWNlcy5wb3NpdGlvbnNbdl0uY29uY2F0KHorIDEsIHZlcnRpY2VzLnRleGNvb3Jkc1t2XSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBHTC5hZGRWZXJ0aWNlcyh2ZXJ0aWNlcy5wb3NpdGlvbnMsIHZlcnRleF9kYXRhW21vZGVdLCBwb2ludF92ZXJ0ZXhfY29uc3RhbnRzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBHTC5hZGRWZXJ0aWNlcyh2cywgdmVydGV4X2RhdGFbbW9kZV0sIHBvaW50X3ZlcnRleF9jb25zdGFudHMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHsgdGV4Y29vcmRzOiAobW9kZSA9PSAncG9pbnRzJykgfVxuICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRpbGUuZGVidWcuZmVhdHVyZXMrKztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHRpbGUudmVydGV4X2RhdGEgPSB7fTtcbiAgICBmb3IgKHZhciBzIGluIHZlcnRleF9kYXRhKSB7XG4gICAgICAgIHRpbGUudmVydGV4X2RhdGFbc10gPSBuZXcgRmxvYXQzMkFycmF5KHZlcnRleF9kYXRhW3NdKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGlsZTtcbn07XG5cbi8vIENhbGxlZCBvbiBtYWluIHRocmVhZCB3aGVuIGEgd2ViIHdvcmtlciBjb21wbGV0ZXMgcHJvY2Vzc2luZyBmb3IgYSBzaW5nbGUgdGlsZVxuR0xSZW5kZXJlci5wcm90b3R5cGUuX3RpbGVXb3JrZXJDb21wbGV0ZWQgPSBmdW5jdGlvbiAodGlsZSlcbntcbiAgICB2YXIgdmVydGV4X2RhdGEgPSB0aWxlLnZlcnRleF9kYXRhO1xuXG4gICAgLy8gQ3JlYXRlIEdMIGdlb21ldHJ5IG9iamVjdHNcbiAgICB0aWxlLmdsX2dlb21ldHJ5ID0ge307XG5cbiAgICBmb3IgKHZhciBzIGluIHZlcnRleF9kYXRhKSB7XG4gICAgICAgIHRpbGUuZ2xfZ2VvbWV0cnlbc10gPSB0aGlzLnJlbmRlcl9tb2Rlc1tzXS5tYWtlR0xHZW9tZXRyeSh2ZXJ0ZXhfZGF0YVtzXSk7XG4gICAgfVxuXG4gICAgdGlsZS5kZWJ1Zy5nZW9tZXRyaWVzID0gMDtcbiAgICB0aWxlLmRlYnVnLmJ1ZmZlcl9zaXplID0gMDtcbiAgICBmb3IgKHZhciBwIGluIHRpbGUuZ2xfZ2VvbWV0cnkpIHtcbiAgICAgICAgdGlsZS5kZWJ1Zy5nZW9tZXRyaWVzICs9IHRpbGUuZ2xfZ2VvbWV0cnlbcF0uZ2VvbWV0cnlfY291bnQ7XG4gICAgICAgIHRpbGUuZGVidWcuYnVmZmVyX3NpemUgKz0gdGlsZS5nbF9nZW9tZXRyeVtwXS52ZXJ0ZXhfZGF0YS5ieXRlTGVuZ3RoO1xuICAgIH1cblxuICAgIHRpbGUuZGVidWcuZ2VvbV9yYXRpbyA9ICh0aWxlLmRlYnVnLmdlb21ldHJpZXMgLyB0aWxlLmRlYnVnLmZlYXR1cmVzKS50b0ZpeGVkKDEpO1xuXG4gICAgLy8gU2VsZWN0aW9uIC0gZXhwZXJpbWVudGFsL2Z1dHVyZVxuICAgIC8vIHZhciBnbF9yZW5kZXJlciA9IHRoaXM7XG4gICAgLy8gdmFyIHBpeGVsID0gbmV3IFVpbnQ4QXJyYXkoNCk7XG4gICAgLy8gdGlsZURpdi5vbm1vdXNlbW92ZSA9IGZ1bmN0aW9uIChldmVudCkge1xuICAgIC8vICAgICAvLyBjb25zb2xlLmxvZyhldmVudC5vZmZzZXRYICsgJywgJyArIGV2ZW50Lm9mZnNldFkgKyAnIHwgJyArIHBhcnNlSW50KHRpbGVEaXYuc3R5bGUubGVmdCkgKyAnLCAnICsgcGFyc2VJbnRcbiAgICAvLyAgICAgdmFyIHAgPSBQb2ludChcbiAgICAvLyAgICAgICAgIGV2ZW50Lm9mZnNldFggKyBwYXJzZUludCh0aWxlRGl2LnN0eWxlLmxlZnQpLFxuICAgIC8vICAgICAgICAgZXZlbnQub2Zmc2V0WSArIHBhcnNlSW50KHRpbGVEaXYuc3R5bGUudG9wKVxuICAgIC8vICAgICApO1xuICAgIC8vICAgICBnbF9yZW5kZXJlci5nbC5yZWFkUGl4ZWxzKHAueCwgcC55LCAxLCAxLCBnbC5SR0JBLCBnbC5VTlNJR05FRF9CWVRFLCBwaXhlbCk7XG4gICAgLy8gICAgIGNvbnNvbGUubG9nKHAueCArICcsICcgKyBwLnkgKyAnOiAoJyArIHBpeGVsWzBdICsgJywgJyArIHBpeGVsWzFdICsgJywgJyArIHBpeGVsWzJdICsgJywgJyArIHBpeGVsWzNdICsgJyknKVxuICAgIC8vIH07XG5cbiAgICBkZWxldGUgdGlsZS52ZXJ0ZXhfZGF0YTsgLy8gVE9ETzogbWlnaHQgd2FudCB0byBwcmVzZXJ2ZSB0aGlzIGZvciByZWJ1aWxkaW5nIGdlb21ldHJpZXMgd2hlbiBzdHlsZXMvZXRjLiBjaGFuZ2U/XG59O1xuXG5HTFJlbmRlcmVyLnByb3RvdHlwZS5yZW1vdmVUaWxlID0gZnVuY3Rpb24gR0xSZW5kZXJlclJlbW92ZVRpbGUgKGtleSlcbntcbiAgICBpZiAodGhpcy5tYXBfem9vbWluZyA9PSB0cnVlKSB7XG4gICAgICAgIHJldHVybjsgLy8gc2hvcnQgY2lyY3VpdCB0aWxlIHJlbW92YWwsIEdMIHJlbmRlcmVyIHdpbGwgc3dlZXAgb3V0IHRpbGVzIGJ5IHpvb20gbGV2ZWwgd2hlbiB6b29tIGVuZHNcbiAgICB9XG5cbiAgICB2YXIgdGlsZSA9IHRoaXMudGlsZXNba2V5XTtcblxuICAgIGlmICh0aWxlICE9IG51bGwgJiYgdGlsZS5nbF9nZW9tZXRyeSAhPSBudWxsKSB7XG4gICAgICAgIGZvciAodmFyIHAgaW4gdGlsZS5nbF9nZW9tZXRyeSkge1xuICAgICAgICAgICAgdGlsZS5nbF9nZW9tZXRyeVtwXS5kZXN0cm95KCk7XG4gICAgICAgIH1cbiAgICAgICAgdGlsZS5nbF9nZW9tZXRyeSA9IG51bGw7XG4gICAgfVxuICAgIFZlY3RvclJlbmRlcmVyLnByb3RvdHlwZS5yZW1vdmVUaWxlLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG59O1xuXG5HTFJlbmRlcmVyLnByb3RvdHlwZS5wcmVzZXJ2ZV90aWxlc193aXRoaW5fem9vbSA9IDI7XG5HTFJlbmRlcmVyLnByb3RvdHlwZS5zZXRab29tID0gZnVuY3Rpb24gKHpvb20pXG57XG4gICAgLy8gU2NoZWR1bGUgR0wgdGlsZXMgZm9yIHJlbW92YWwgb24gem9vbVxuICAgIGNvbnNvbGUubG9nKFwicmVuZGVyZXIubWFwX2xhc3Rfem9vbTogXCIgKyB0aGlzLm1hcF9sYXN0X3pvb20pO1xuXG4gICAgdGhpcy5tYXBfem9vbWluZyA9IGZhbHNlO1xuICAgIHRoaXMuem9vbSA9IHpvb207XG4gICAgdmFyIGJlbG93ID0gdGhpcy56b29tO1xuICAgIHZhciBhYm92ZSA9IHRoaXMuem9vbTtcbiAgICBpZiAoTWF0aC5hYnModGhpcy56b29tIC0gdGhpcy5tYXBfbGFzdF96b29tKSA8PSB0aGlzLnByZXNlcnZlX3RpbGVzX3dpdGhpbl96b29tKSB7XG4gICAgICAgIGlmICh0aGlzLnpvb20gPiB0aGlzLm1hcF9sYXN0X3pvb20pIHtcbiAgICAgICAgICAgIGJlbG93ID0gdGhpcy56b29tIC0gdGhpcy5wcmVzZXJ2ZV90aWxlc193aXRoaW5fem9vbTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGFib3ZlID0gdGhpcy56b29tICsgdGhpcy5wcmVzZXJ2ZV90aWxlc193aXRoaW5fem9vbTtcbiAgICAgICAgfVxuICAgIH1cbiAgICB0aGlzLnJlbW92ZVRpbGVzT3V0c2lkZVpvb21SYW5nZShiZWxvdywgYWJvdmUpO1xuICAgIHRoaXMubWFwX2xhc3Rfem9vbSA9IHRoaXMuem9vbTtcbiAgICB0aGlzLmRpcnR5ID0gdHJ1ZTsgLy8gY2FsbGluZyBiZWNhdXNlIHRoaXMgaXMgYSBmdWxsIG92ZXJyaWRlIG9mIHRoZSBwYXJlbnQgY2xhc3Ncbn07XG5cbkdMUmVuZGVyZXIucHJvdG90eXBlLnJlbW92ZVRpbGVzT3V0c2lkZVpvb21SYW5nZSA9IGZ1bmN0aW9uIChiZWxvdywgYWJvdmUpXG57XG4gICAgYmVsb3cgPSBNYXRoLm1pbihiZWxvdywgdGhpcy50aWxlX3NvdXJjZS5tYXhfem9vbSB8fCBiZWxvdyk7XG4gICAgYWJvdmUgPSBNYXRoLm1pbihhYm92ZSwgdGhpcy50aWxlX3NvdXJjZS5tYXhfem9vbSB8fCBhYm92ZSk7XG5cbiAgICBjb25zb2xlLmxvZyhcInJlbW92ZVRpbGVzT3V0c2lkZVpvb21SYW5nZSBbXCIgKyBiZWxvdyArIFwiLCBcIiArIGFib3ZlICsgXCJdKVwiKTtcbiAgICB2YXIgcmVtb3ZlX3RpbGVzID0gW107XG4gICAgZm9yICh2YXIgdCBpbiB0aGlzLnRpbGVzKSB7XG4gICAgICAgIHZhciB0aWxlID0gdGhpcy50aWxlc1t0XTtcbiAgICAgICAgaWYgKHRpbGUuY29vcmRzLnogPCBiZWxvdyB8fCB0aWxlLmNvb3Jkcy56ID4gYWJvdmUpIHtcbiAgICAgICAgICAgIHJlbW92ZV90aWxlcy5wdXNoKHQpO1xuICAgICAgICB9XG4gICAgfVxuICAgIGZvciAodmFyIHI9MDsgciA8IHJlbW92ZV90aWxlcy5sZW5ndGg7IHIrKykge1xuICAgICAgICB2YXIga2V5ID0gcmVtb3ZlX3RpbGVzW3JdO1xuICAgICAgICBjb25zb2xlLmxvZyhcInJlbW92ZWQgXCIgKyBrZXkgKyBcIiAob3V0c2lkZSByYW5nZSBbXCIgKyBiZWxvdyArIFwiLCBcIiArIGFib3ZlICsgXCJdKVwiKTtcbiAgICAgICAgdGhpcy5yZW1vdmVUaWxlKGtleSk7XG4gICAgfVxufTtcblxuLy8gT3ZlcnJpZGVzIGJhc2UgY2xhc3MgbWV0aG9kIChhIG5vIG9wKVxuR0xSZW5kZXJlci5wcm90b3R5cGUucmVzaXplTWFwID0gZnVuY3Rpb24gKHdpZHRoLCBoZWlnaHQpXG57XG4gICAgVmVjdG9yUmVuZGVyZXIucHJvdG90eXBlLnJlc2l6ZU1hcC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuXG4gICAgdGhpcy5jc3Nfc2l6ZSA9IHsgd2lkdGg6IHdpZHRoLCBoZWlnaHQ6IGhlaWdodCB9O1xuICAgIHRoaXMuZGV2aWNlX3NpemUgPSB7IHdpZHRoOiBNYXRoLnJvdW5kKHRoaXMuY3NzX3NpemUud2lkdGggKiB0aGlzLmRldmljZV9waXhlbF9yYXRpbyksIGhlaWdodDogTWF0aC5yb3VuZCh0aGlzLmNzc19zaXplLmhlaWdodCAqIHRoaXMuZGV2aWNlX3BpeGVsX3JhdGlvKSB9O1xuXG4gICAgdGhpcy5jYW52YXMuc3R5bGUud2lkdGggPSB0aGlzLmNzc19zaXplLndpZHRoICsgJ3B4JztcbiAgICB0aGlzLmNhbnZhcy5zdHlsZS5oZWlnaHQgPSB0aGlzLmNzc19zaXplLmhlaWdodCArICdweCc7XG4gICAgdGhpcy5jYW52YXMud2lkdGggPSB0aGlzLmRldmljZV9zaXplLndpZHRoO1xuICAgIHRoaXMuY2FudmFzLmhlaWdodCA9IHRoaXMuZGV2aWNlX3NpemUuaGVpZ2h0O1xuICAgIHRoaXMuZ2wudmlld3BvcnQoMCwgMCwgdGhpcy5jYW52YXMud2lkdGgsIHRoaXMuY2FudmFzLmhlaWdodCk7XG59O1xuXG5HTFJlbmRlcmVyLnByb3RvdHlwZS5fcmVuZGVyID0gZnVuY3Rpb24gR0xSZW5kZXJlclJlbmRlciAoKVxue1xuICAgIHZhciBnbCA9IHRoaXMuZ2w7XG5cbiAgICB0aGlzLmlucHV0KCk7XG5cbiAgICAvLyBSZXNldCBmcmFtZSBzdGF0ZVxuICAgIGdsLmNsZWFyQ29sb3IoMC4wLCAwLjAsIDAuMCwgMS4wKTtcbiAgICBnbC5jbGVhcihnbC5DT0xPUl9CVUZGRVJfQklUIHwgZ2wuREVQVEhfQlVGRkVSX0JJVCk7XG4gICAgZ2wuZW5hYmxlKGdsLkRFUFRIX1RFU1QpO1xuICAgIGdsLmRlcHRoRnVuYyhnbC5MRVNTKTtcbiAgICBnbC5lbmFibGUoZ2wuQ1VMTF9GQUNFKTtcbiAgICBnbC5jdWxsRmFjZShnbC5CQUNLKTtcblxuICAgIC8vIFJlbmRlciB0aWxlcyBncm91cGVkIGJ5IHJlbmRlcmcgbW9kZSAoR0wgcHJvZ3JhbSlcbiAgICB2YXIgcmVuZGVyX2NvdW50ID0gMDtcbiAgICBmb3IgKHZhciBtb2RlIGluIHRoaXMucmVuZGVyX21vZGVzKSB7XG4gICAgICAgIHZhciBnbF9wcm9ncmFtID0gdGhpcy5yZW5kZXJfbW9kZXNbbW9kZV0uZ2xfcHJvZ3JhbTtcblxuICAgICAgICBnbC51c2VQcm9ncmFtKGdsX3Byb2dyYW0ucHJvZ3JhbSk7XG5cbiAgICAgICAgLy8gVE9ETzogc2V0IHRoZXNlIG9uY2UgcGVyIHByb2dyYW0sIGRvbid0IHNldCB3aGVuIHRoZXkgaGF2ZW4ndCBjaGFuZ2VkXG4gICAgICAgIGdsX3Byb2dyYW0udW5pZm9ybSgnMmYnLCAncmVzb2x1dGlvbicsIHRoaXMuY3NzX3NpemUud2lkdGgsIHRoaXMuY3NzX3NpemUuaGVpZ2h0KTtcbiAgICAgICAgZ2xfcHJvZ3JhbS51bmlmb3JtKCcxZicsICd0aW1lJywgKCgrbmV3IERhdGUoKSkgLSB0aGlzLnN0YXJ0X3RpbWUpIC8gMTAwMCk7XG5cbiAgICAgICAgdmFyIGNlbnRlciA9IEdlby5sYXRMbmdUb01ldGVycyhQb2ludCh0aGlzLmNlbnRlci5sbmcsIHRoaXMuY2VudGVyLmxhdCkpO1xuICAgICAgICBnbF9wcm9ncmFtLnVuaWZvcm0oJzJmJywgJ21hcF9jZW50ZXInLCBjZW50ZXIueCwgY2VudGVyLnkpO1xuICAgICAgICBnbF9wcm9ncmFtLnVuaWZvcm0oJzFmJywgJ21hcF96b29tJywgdGhpcy56b29tKTsgLy8gTWF0aC5mbG9vcih0aGlzLnpvb20pICsgKE1hdGgubG9nKCh0aGlzLnpvb20gJSAxKSArIDEpIC8gTWF0aC5MTjIgLy8gc2NhbGUgZnJhY3Rpb25hbCB6b29tIGJ5IGxvZ1xuICAgICAgICBnbF9wcm9ncmFtLnVuaWZvcm0oJzFmJywgJ251bV9sYXllcnMnLCB0aGlzLmxheWVycy5sZW5ndGgpO1xuXG4gICAgICAgIHZhciBtZXRlcnNfcGVyX3BpeGVsID0gR2VvLm1pbl96b29tX21ldGVyc19wZXJfcGl4ZWwgLyBNYXRoLnBvdygyLCB0aGlzLnpvb20pO1xuICAgICAgICB2YXIgbWV0ZXJfem9vbSA9IFBvaW50KHRoaXMuY3NzX3NpemUud2lkdGggLyAyICogbWV0ZXJzX3Blcl9waXhlbCwgdGhpcy5jc3Nfc2l6ZS5oZWlnaHQgLyAyICogbWV0ZXJzX3Blcl9waXhlbCk7XG4gICAgICAgIGdsX3Byb2dyYW0udW5pZm9ybSgnMmYnLCAnbWV0ZXJfem9vbScsIG1ldGVyX3pvb20ueCwgbWV0ZXJfem9vbS55KTtcblxuICAgICAgICAvLyBUT0RPOiBtYWtlIGEgbGlzdCBvZiByZW5kZXJhYmxlIHRpbGVzIG9uY2UgcGVyIGZyYW1lLCBvdXRzaWRlIHRoaXMgbG9vcFxuICAgICAgICAvLyBSZW5kZXIgdGlsZSBHTCBnZW9tZXRyaWVzXG4gICAgICAgIHZhciBjYXBwZWRfem9vbSA9IE1hdGgubWluKH5+dGhpcy56b29tLCB0aGlzLnRpbGVfc291cmNlLm1heF96b29tIHx8IH5+dGhpcy56b29tKTtcbiAgICAgICAgZm9yICh2YXIgdCBpbiB0aGlzLnRpbGVzKSB7XG4gICAgICAgICAgICB2YXIgdGlsZSA9IHRoaXMudGlsZXNbdF07XG4gICAgICAgICAgICBpZiAodGlsZS5sb2FkZWQgPT0gdHJ1ZSAmJlxuICAgICAgICAgICAgICAgIHRpbGUudmlzaWJsZSA9PSB0cnVlICYmXG4gICAgICAgICAgICAgICAgTWF0aC5taW4odGlsZS5jb29yZHMueiwgdGhpcy50aWxlX3NvdXJjZS5tYXhfem9vbSB8fCB0aWxlLmNvb3Jkcy56KSA9PSBjYXBwZWRfem9vbSkge1xuXG4gICAgICAgICAgICAgICAgaWYgKHRpbGUuZ2xfZ2VvbWV0cnlbbW9kZV0gIT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICBnbF9wcm9ncmFtLnVuaWZvcm0oJzJmJywgJ3RpbGVfbWluJywgdGlsZS5taW4ueCwgdGlsZS5taW4ueSk7XG4gICAgICAgICAgICAgICAgICAgIGdsX3Byb2dyYW0udW5pZm9ybSgnMmYnLCAndGlsZV9tYXgnLCB0aWxlLm1heC54LCB0aWxlLm1heC55KTtcblxuICAgICAgICAgICAgICAgICAgICB0aWxlLmdsX2dlb21ldHJ5W21vZGVdLnJlbmRlcigpO1xuICAgICAgICAgICAgICAgICAgICByZW5kZXJfY291bnQgKz0gdGlsZS5nbF9nZW9tZXRyeVttb2RlXS5nZW9tZXRyeV9jb3VudDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocmVuZGVyX2NvdW50ICE9IHRoaXMubGFzdF9yZW5kZXJfY291bnQgJiYgdGlsZXNfZGVidWcpIHtcbiAgICAgICAgY29uc29sZS5sb2coXCJyZW5kZXJlZCBcIiArIHJlbmRlcl9jb3VudCArIFwiIHByaW1pdGl2ZXNcIik7XG4gICAgfVxuICAgIHRoaXMubGFzdF9yZW5kZXJfY291bnQgPSByZW5kZXJfY291bnQ7XG5cbiAgICBpZiAodGhpcy5jb250aW51b3VzX2FuaW1hdGlvbiA9PSB0cnVlKSB7XG4gICAgICAgIHRoaXMuZGlydHkgPSB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xufTtcblxuLy8gU3VtIG9mIGEgZGVidWcgcHJvcGVydHkgYWNyb3NzIHRpbGVzXG5HTFJlbmRlcmVyLnByb3RvdHlwZS5nZXREZWJ1Z1N1bSA9IGZ1bmN0aW9uIChwcm9wLCBmaWx0ZXIpXG57XG4gICAgdmFyIHN1bSA9IDA7XG4gICAgZm9yICh2YXIgdCBpbiB0aGlzLnRpbGVzKSB7XG4gICAgICAgIGlmICh0aGlzLnRpbGVzW3RdLmRlYnVnW3Byb3BdICE9IG51bGwgJiYgKHR5cGVvZiBmaWx0ZXIgIT0gJ2Z1bmN0aW9uJyB8fCBmaWx0ZXIodGhpcy50aWxlc1t0XSkgPT0gdHJ1ZSkpIHtcbiAgICAgICAgICAgIHN1bSArPSB0aGlzLnRpbGVzW3RdLmRlYnVnW3Byb3BdO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBzdW07XG59O1xuXG4vLyBBdmVyYWdlIG9mIGEgZGVidWcgcHJvcGVydHkgYWNyb3NzIHRpbGVzXG5HTFJlbmRlcmVyLnByb3RvdHlwZS5nZXREZWJ1Z0F2ZXJhZ2UgPSBmdW5jdGlvbiAocHJvcCwgZmlsdGVyKVxue1xuICAgIHJldHVybiB0aGlzLmdldERlYnVnU3VtKHByb3AsIGZpbHRlcikgLyBPYmplY3Qua2V5cyh0aGlzLnRpbGVzKS5sZW5ndGg7XG59O1xuXG4vLyBVc2VyIGlucHV0XG4vLyBUT0RPOiByZXN0b3JlIGZyYWN0aW9uYWwgem9vbSBzdXBwb3J0IG9uY2UgbGVhZmxldCBhbmltYXRpb24gcmVmYWN0b3IgcHVsbCByZXF1ZXN0IGlzIG1lcmdlZFxuXG5HTFJlbmRlcmVyLnByb3RvdHlwZS5pbml0SW5wdXRIYW5kbGVycyA9IGZ1bmN0aW9uIEdMUmVuZGVyZXJJbml0SW5wdXRIYW5kbGVycyAoKVxue1xuICAgIHZhciBnbF9yZW5kZXJlciA9IHRoaXM7XG4gICAgZ2xfcmVuZGVyZXIua2V5ID0gbnVsbDtcblxuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBmdW5jdGlvbiAoZXZlbnQpIHtcbiAgICAgICAgaWYgKGV2ZW50LmtleUNvZGUgPT0gMzcpIHtcbiAgICAgICAgICAgIGdsX3JlbmRlcmVyLmtleSA9ICdsZWZ0JztcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChldmVudC5rZXlDb2RlID09IDM5KSB7XG4gICAgICAgICAgICBnbF9yZW5kZXJlci5rZXkgPSAncmlnaHQnO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKGV2ZW50LmtleUNvZGUgPT0gMzgpIHtcbiAgICAgICAgICAgIGdsX3JlbmRlcmVyLmtleSA9ICd1cCc7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoZXZlbnQua2V5Q29kZSA9PSA0MCkge1xuICAgICAgICAgICAgZ2xfcmVuZGVyZXIua2V5ID0gJ2Rvd24nO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKGV2ZW50LmtleUNvZGUgPT0gODMpIHsgLy8gc1xuICAgICAgICAgICAgY29uc29sZS5sb2coXCJyZWxvYWRpbmcgc2hhZGVyc1wiKTtcbiAgICAgICAgICAgIGZvciAodmFyIG1vZGUgaW4gdGhpcy5yZW5kZXJfbW9kZXMpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnJlbmRlcl9tb2Rlc1ttb2RlXS5nbF9wcm9ncmFtLmNvbXBpbGUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGdsX3JlbmRlcmVyLmRpcnR5ID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigna2V5dXAnLCBmdW5jdGlvbiAoZXZlbnQpIHtcbiAgICAgICAgZ2xfcmVuZGVyZXIua2V5ID0gbnVsbDtcbiAgICB9KTtcbn07XG5cbkdMUmVuZGVyZXIucHJvdG90eXBlLmlucHV0ID0gZnVuY3Rpb24gR0xSZW5kZXJlcklucHV0ICgpXG57XG4gICAgLy8gLy8gRnJhY3Rpb25hbCB6b29tIHNjYWxpbmdcbiAgICAvLyBpZiAodGhpcy5rZXkgPT0gJ3VwJykge1xuICAgIC8vICAgICB0aGlzLnNldFpvb20odGhpcy56b29tICsgdGhpcy56b29tX3N0ZXApO1xuICAgIC8vIH1cbiAgICAvLyBlbHNlIGlmICh0aGlzLmtleSA9PSAnZG93bicpIHtcbiAgICAvLyAgICAgdGhpcy5zZXRab29tKHRoaXMuem9vbSAtIHRoaXMuem9vbV9zdGVwKTtcbiAgICAvLyB9XG59O1xuXG5pZiAobW9kdWxlICE9PSB1bmRlZmluZWQpIHtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IEdMUmVuZGVyZXI7XG59XG4iLCIvLyBHZW5lcmF0ZWQgZnJvbSBHTFNMIGZpbGVzLCBkb24ndCBlZGl0IVxudmFyIHNoYWRlcl9zb3VyY2VzID0ge307XG5cbnNoYWRlcl9zb3VyY2VzWydwb2ludF9mcmFnbWVudCddID1cblwidW5pZm9ybSB2ZWMyIHJlc29sdXRpb247XFxuXCIgK1xuXCJcXG5cIiArXG5cInZhcnlpbmcgdmVjMyBmY29sb3I7XFxuXCIgK1xuXCJ2YXJ5aW5nIHZlYzIgZnRleGNvb3JkO1xcblwiICtcblwiXFxuXCIgK1xuXCJ2b2lkIG1haW4gKHZvaWQpIHtcXG5cIiArXG5cIiAgICB2ZWM0IGNvbG9yID0gdmVjNChmY29sb3IsIDEuKTtcXG5cIiArXG5cIlxcblwiICtcblwiICAgIC8vIGlmIChsZW5ndGgoZnRleGNvb3JkLnh5KSA+IDEwLikge1xcblwiICtcblwiICAgIC8vICAgICAvLyBjb2xvciA9IHZlYzQoMC4sIDAuLCAwLiwgMC4pO1xcblwiICtcblwiICAgIC8vICAgICBkaXNjYXJkO1xcblwiICtcblwiICAgIC8vIH1cXG5cIiArXG5cIlxcblwiICtcblwiICAgIGZsb2F0IGxlbiA9IGxlbmd0aChmdGV4Y29vcmQpO1xcblwiICtcblwiICAgIGlmIChsZW4gPiAxLikge1xcblwiICtcblwiICAgICAgICBkaXNjYXJkO1xcblwiICtcblwiICAgIH1cXG5cIiArXG5cIiAgICBjb2xvci5yZ2IgKj0gKDEuIC0gc21vb3Roc3RlcCguMjUsIDEuLCBsZW4pKSArIDAuNTtcXG5cIiArXG5cIiAgICAvLyBjb2xvci5hID0gKDEuIC0gc21vb3Roc3RlcCgyLjUsIDEwLiwgbGVuKSkgKyAwLjI1O1xcblwiICtcblwiXFxuXCIgK1xuXCIgICAgI2lmIGRlZmluZWQoRUZGRUNUX1NDUkVFTl9DT0xPUilcXG5cIiArXG5cIiAgICAgICAgLy8gTXV0YXRlIGNvbG9ycyBieSBzY3JlZW4gcG9zaXRpb25cXG5cIiArXG5cIiAgICAgICAgY29sb3IucmdiICs9IHZlYzMoZ2xfRnJhZ0Nvb3JkLnggLyByZXNvbHV0aW9uLngsIDAuMCwgZ2xfRnJhZ0Nvb3JkLnkgLyByZXNvbHV0aW9uLnkpO1xcblwiICtcblwiICAgICNlbmRpZlxcblwiICtcblwiXFxuXCIgK1xuXCIgICAgZ2xfRnJhZ0NvbG9yID0gY29sb3I7XFxuXCIgK1xuXCJ9XFxuXCIgK1xuXCJcIjtcblxuc2hhZGVyX3NvdXJjZXNbJ3BvaW50X3ZlcnRleCddID1cblwidW5pZm9ybSB2ZWMyIG1hcF9jZW50ZXI7XFxuXCIgK1xuXCJ1bmlmb3JtIGZsb2F0IG1hcF96b29tO1xcblwiICtcblwidW5pZm9ybSB2ZWMyIG1ldGVyX3pvb207XFxuXCIgK1xuXCJ1bmlmb3JtIHZlYzIgdGlsZV9taW47XFxuXCIgK1xuXCJ1bmlmb3JtIHZlYzIgdGlsZV9tYXg7XFxuXCIgK1xuXCJ1bmlmb3JtIGZsb2F0IG51bV9sYXllcnM7XFxuXCIgK1xuXCIvLyB1bmlmb3JtIGZsb2F0IHRpbWU7XFxuXCIgK1xuXCJcXG5cIiArXG5cImF0dHJpYnV0ZSB2ZWMzIHBvc2l0aW9uO1xcblwiICtcblwiLy8gYXR0cmlidXRlIHZlYzMgbm9ybWFsO1xcblwiICtcblwiYXR0cmlidXRlIHZlYzIgdGV4Y29vcmQ7XFxuXCIgK1xuXCJhdHRyaWJ1dGUgdmVjMyBjb2xvcjtcXG5cIiArXG5cImF0dHJpYnV0ZSBmbG9hdCBsYXllcjtcXG5cIiArXG5cIlxcblwiICtcblwidmFyeWluZyB2ZWMzIGZjb2xvcjtcXG5cIiArXG5cInZhcnlpbmcgdmVjMiBmdGV4Y29vcmQ7XFxuXCIgK1xuXCJcXG5cIiArXG5cIi8vIHZlYzMgbGlnaHQgPSBub3JtYWxpemUodmVjMygwLjIsIDAuNywgLTAuNSkpOyAvLyB2ZWMzKDAuMSwgMC4yLCAtMC40KVxcblwiICtcblwiLy8gY29uc3QgZmxvYXQgYW1iaWVudCA9IDAuNDU7XFxuXCIgK1xuXCJcXG5cIiArXG5cInZvaWQgbWFpbigpIHtcXG5cIiArXG5cIiAgICB2ZWMzIHZwb3NpdGlvbiA9IHBvc2l0aW9uO1xcblwiICtcblwiICAgIC8vIHZlYzMgdm5vcm1hbCA9IG5vcm1hbDtcXG5cIiArXG5cIiAgICAvLyB2ZWMyIHZ0ZXhjb29yZCA9IHRleGNvb3JkO1xcblwiICtcblwiXFxuXCIgK1xuXCIgICAgLy8gQ2FsYyBwb3NpdGlvbiBvZiB2ZXJ0ZXggaW4gbWV0ZXJzLCByZWxhdGl2ZSB0byBjZW50ZXIgb2Ygc2NyZWVuXFxuXCIgK1xuXCIgICAgdnBvc2l0aW9uLnkgKj0gLTEuMDsgLy8gYWRqdXN0IGZvciBmbGlwcGVkIHktY29vcmRzXFxuXCIgK1xuXCIgICAgdnBvc2l0aW9uLnh5ICo9ICh0aWxlX21heCAtIHRpbGVfbWluKSAvIFRJTEVfU0NBTEU7IC8vIGFkanVzdCBmb3IgdmVydGV4IGxvY2F0aW9uIHdpdGhpbiB0aWxlIChzY2FsZWQgZnJvbSBsb2NhbCBjb29yZHMgdG8gbWV0ZXJzKVxcblwiICtcblwiICAgIHZwb3NpdGlvbi54eSArPSB0aWxlX21pbi54eSAtIG1hcF9jZW50ZXI7IC8vIGFkanVzdCBmb3IgY29ybmVyIG9mIHRpbGUgcmVsYXRpdmUgdG8gbWFwIGNlbnRlclxcblwiICtcblwiICAgIHZwb3NpdGlvbi54eSAvPSBtZXRlcl96b29tOyAvLyBhZGp1c3QgZm9yIHpvb20gaW4gbWV0ZXJzIHRvIGdldCBjbGlwIHNwYWNlIGNvb3Jkc1xcblwiICtcblwiXFxuXCIgK1xuXCIgICAgLy8gU2hhZGluZyAmIHRleHR1cmVcXG5cIiArXG5cIiAgICBmY29sb3IgPSBjb2xvcjtcXG5cIiArXG5cIiAgICBmdGV4Y29vcmQgPSB0ZXhjb29yZDtcXG5cIiArXG5cIlxcblwiICtcblwiICAgIC8vICNpZiBkZWZpbmVkKFBST0pFQ1RJT05fUEVSU1BFQ1RJVkUpXFxuXCIgK1xuXCIgICAgLy8gICAgIC8vIFBlcnNwZWN0aXZlLXN0eWxlIHByb2plY3Rpb25cXG5cIiArXG5cIiAgICAvLyAgICAgdmVjMiBwZXJzcGVjdGl2ZV9vZmZzZXQgPSB2ZWMyKC0wLjI1LCAtMC4yNSk7XFxuXCIgK1xuXCIgICAgLy8gICAgIHZlYzIgcGVyc3BlY3RpdmVfZmFjdG9yID0gdmVjMigwLjgsIDAuOCk7IC8vIHZlYzIoLTAuMjUsIDAuNzUpO1xcblwiICtcblwiICAgIC8vICAgICB2cG9zaXRpb24ueHkgKz0gdnBvc2l0aW9uLnogKiBwZXJzcGVjdGl2ZV9mYWN0b3IgKiAodnBvc2l0aW9uLnh5IC0gcGVyc3BlY3RpdmVfb2Zmc2V0KSAvIG1ldGVyX3pvb20ueHk7IC8vIHBlcnNwZWN0aXZlIGZyb20gb2Zmc2V0IGNlbnRlciBzY3JlZW5cXG5cIiArXG5cIiAgICAvLyAjZWxpZiBkZWZpbmVkKFBST0pFQ1RJT05fSVNPTUVUUklDKSB8fCBkZWZpbmVkKFBST0pFQ1RJT05fUE9QVVApXFxuXCIgK1xuXCIgICAgLy8gICAgIC8vIFBvcC11cCBlZmZlY3QgLSAzZCBpbiBjZW50ZXIgb2Ygdmlld3BvcnQsIGZhZGluZyB0byAyZCBhdCBlZGdlc1xcblwiICtcblwiICAgIC8vICAgICAjaWYgZGVmaW5lZChQUk9KRUNUSU9OX1BPUFVQKVxcblwiICtcblwiICAgIC8vICAgICAgICAgaWYgKHZwb3NpdGlvbi56ID4gMS4wKSB7XFxuXCIgK1xuXCIgICAgLy8gICAgICAgICAgICAgZmxvYXQgY2QgPSBkaXN0YW5jZSh2cG9zaXRpb24ueHkgKiAocmVzb2x1dGlvbi54eSAvIHJlc29sdXRpb24ueXkpLCB2ZWMyKDAuMCwgMC4wKSk7XFxuXCIgK1xuXCIgICAgLy8gICAgICAgICAgICAgY29uc3QgZmxvYXQgcG9wdXBfZmFkZV9pbm5lciA9IDAuNTtcXG5cIiArXG5cIiAgICAvLyAgICAgICAgICAgICBjb25zdCBmbG9hdCBwb3B1cF9mYWRlX291dGVyID0gMC43NTtcXG5cIiArXG5cIiAgICAvLyAgICAgICAgICAgICBpZiAoY2QgPiBwb3B1cF9mYWRlX2lubmVyKSB7XFxuXCIgK1xuXCIgICAgLy8gICAgICAgICAgICAgICAgIHZwb3NpdGlvbi56ICo9IDEuMCAtIHNtb290aHN0ZXAocG9wdXBfZmFkZV9pbm5lciwgcG9wdXBfZmFkZV9vdXRlciwgY2QpO1xcblwiICtcblwiICAgIC8vICAgICAgICAgICAgIH1cXG5cIiArXG5cIiAgICAvLyAgICAgICAgICAgICBjb25zdCBmbG9hdCB6b29tX2Jvb3N0X3N0YXJ0ID0gMTUuMDtcXG5cIiArXG5cIiAgICAvLyAgICAgICAgICAgICBjb25zdCBmbG9hdCB6b29tX2Jvb3N0X2VuZCA9IDE3LjA7XFxuXCIgK1xuXCIgICAgLy8gICAgICAgICAgICAgY29uc3QgZmxvYXQgem9vbV9ib29zdF9tYWduaXR1ZGUgPSAwLjc1O1xcblwiICtcblwiICAgIC8vICAgICAgICAgICAgIHZwb3NpdGlvbi56ICo9IDEuMCArICgxLjAgLSBzbW9vdGhzdGVwKHpvb21fYm9vc3Rfc3RhcnQsIHpvb21fYm9vc3RfZW5kLCBtYXBfem9vbSkpICogem9vbV9ib29zdF9tYWduaXR1ZGU7XFxuXCIgK1xuXCIgICAgLy8gICAgICAgICB9XFxuXCIgK1xuXCIgICAgLy8gICAgICNlbmRpZlxcblwiICtcblwiXFxuXCIgK1xuXCIgICAgLy8gICAgIC8vIElzb21ldHJpYy1zdHlsZSBwcm9qZWN0aW9uXFxuXCIgK1xuXCIgICAgLy8gICAgIHZwb3NpdGlvbi55ICs9IHZwb3NpdGlvbi56IC8gbWV0ZXJfem9vbS55OyAvLyB6IGNvb3JkaW5hdGUgaXMgYSBzaW1wbGUgdHJhbnNsYXRpb24gdXAgYWxvbmcgeSBheGlzLCBhbGEgaXNvbWV0cmljXFxuXCIgK1xuXCIgICAgLy8gICAgIC8vIHZwb3NpdGlvbi55ICs9IHZwb3NpdGlvbi56ICogMC41OyAvLyBjbG9zZXIgdG8gVWx0aW1hIDctc3R5bGUgYXhvbm9tZXRyaWNcXG5cIiArXG5cIiAgICAvLyAgICAgLy8gdnBvc2l0aW9uLnggLT0gdnBvc2l0aW9uLnogKiAwLjU7XFxuXCIgK1xuXCIgICAgLy8gI2VuZGlmXFxuXCIgK1xuXCJcXG5cIiArXG5cIiAgICAvLyBSZXZlcnNlIGFuZCBzY2FsZSB0byAwLTEgZm9yIEdMIGRlcHRoIGJ1ZmZlclxcblwiICtcblwiICAgIC8vIExheWVycyBhcmUgZm9yY2Utb3JkZXJlZCAoaGlnaGVyIGxheWVycyBndWFyYW50ZWVkIHRvIHJlbmRlciBvbiB0b3Agb2YgbG93ZXIpLCB0aGVuIGJ5IGhlaWdodC9kZXB0aFxcblwiICtcblwiICAgIGZsb2F0IHpfbGF5ZXJfc2NhbGUgPSA0MDk2LjtcXG5cIiArXG5cIiAgICBmbG9hdCB6X2xheWVyX3JhbmdlID0gKG51bV9sYXllcnMgKyAxLikgKiB6X2xheWVyX3NjYWxlO1xcblwiICtcblwiICAgIGZsb2F0IHpfbGF5ZXIgPSAobGF5ZXIgKyAxLikgKiB6X2xheWVyX3NjYWxlO1xcblwiICtcblwiICAgIC8vIGZsb2F0IHpfbGF5ZXIgPSAobGF5ZXIgKyAxLik7XFxuXCIgK1xuXCJcXG5cIiArXG5cIiAgICB2cG9zaXRpb24ueiA9IHpfbGF5ZXIgKyBjbGFtcCh2cG9zaXRpb24ueiwgMS4sIHpfbGF5ZXJfc2NhbGUpO1xcblwiICtcblwiICAgIHZwb3NpdGlvbi56ID0gKHpfbGF5ZXJfcmFuZ2UgLSB2cG9zaXRpb24ueikgLyB6X2xheWVyX3JhbmdlO1xcblwiICtcblwiXFxuXCIgK1xuXCIgICAgZ2xfUG9zaXRpb24gPSB2ZWM0KHZwb3NpdGlvbiwgMS4wKTtcXG5cIiArXG5cIn1cXG5cIiArXG5cIlwiO1xuXG5zaGFkZXJfc291cmNlc1sncG9seWdvbl9mcmFnbWVudCddID1cblwidW5pZm9ybSB2ZWMyIHJlc29sdXRpb247XFxuXCIgK1xuXCJ1bmlmb3JtIGZsb2F0IHRpbWU7XFxuXCIgK1xuXCJcXG5cIiArXG5cInZhcnlpbmcgdmVjMyBmY29sb3I7XFxuXCIgK1xuXCJcXG5cIiArXG5cIiNpZiBkZWZpbmVkKEVGRkVDVF9OT0lTRV9URVhUVVJFKVxcblwiICtcblwiICAgIHZhcnlpbmcgdmVjMyBmcG9zaXRpb247XFxuXCIgK1xuXCJcXG5cIiArXG5cIiAgICAvLyBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzQyMDAyMjQvcmFuZG9tLW5vaXNlLWZ1bmN0aW9ucy1mb3ItZ2xzbFxcblwiICtcblwiICAgIC8vIGZsb2F0IHJhbmQgKHZlYzIgY28pIHtcXG5cIiArXG5cIiAgICAvLyAgICByZXR1cm4gZnJhY3Qoc2luKGRvdChjby54eSwgdmVjMigxMi45ODk4LCA3OC4yMzMpKSkgKiA0Mzc1OC41NDUzKTtcXG5cIiArXG5cIiAgICAvLyB9XFxuXCIgK1xuXCJcXG5cIiArXG5cIiAgICAvLyBOb2lzZSBmdW5jdGlvbnMgZnJvbTogaHR0cHM6Ly9naXRodWIuY29tL2FzaGltYS93ZWJnbC1ub2lzZVxcblwiICtcblwiICAgIHZlYzMgbW9kMjg5KHZlYzMgeCkge1xcblwiICtcblwiICAgICAgICByZXR1cm4geCAtIGZsb29yKHggKiAoMS4wIC8gMjg5LjApKSAqIDI4OS4wO1xcblwiICtcblwiICAgIH1cXG5cIiArXG5cIlxcblwiICtcblwiICAgIHZlYzQgbW9kMjg5KHZlYzQgeCkge1xcblwiICtcblwiICAgICAgICByZXR1cm4geCAtIGZsb29yKHggKiAoMS4wIC8gMjg5LjApKSAqIDI4OS4wO1xcblwiICtcblwiICAgIH1cXG5cIiArXG5cIlxcblwiICtcblwiICAgIHZlYzQgcGVybXV0ZSh2ZWM0IHgpIHtcXG5cIiArXG5cIiAgICAgICAgcmV0dXJuIG1vZDI4OSgoKHgqMzQuMCkrMS4wKSp4KTtcXG5cIiArXG5cIiAgICB9XFxuXCIgK1xuXCJcXG5cIiArXG5cIiAgICB2ZWM0IHRheWxvckludlNxcnQodmVjNCByKSB7XFxuXCIgK1xuXCIgICAgICAgIHJldHVybiAxLjc5Mjg0MjkxNDAwMTU5IC0gMC44NTM3MzQ3MjA5NTMxNCAqIHI7XFxuXCIgK1xuXCIgICAgfVxcblwiICtcblwiXFxuXCIgK1xuXCIgICAgdmVjMyBmYWRlKHZlYzMgdCkge1xcblwiICtcblwiICAgICAgICByZXR1cm4gdCp0KnQqKHQqKHQqNi4wLTE1LjApKzEwLjApO1xcblwiICtcblwiICAgIH1cXG5cIiArXG5cIlxcblwiICtcblwiICAgIGZsb2F0IHNub2lzZSh2ZWMzIHYpIHtcXG5cIiArXG5cIiAgICAgICAgY29uc3QgdmVjMiAgQyA9IHZlYzIoMS4wLzYuMCwgMS4wLzMuMCkgO1xcblwiICtcblwiICAgICAgICBjb25zdCB2ZWM0ICBEID0gdmVjNCgwLjAsIDAuNSwgMS4wLCAyLjApO1xcblwiICtcblwiXFxuXCIgK1xuXCIgICAgICAgIC8vIEZpcnN0IGNvcm5lclxcblwiICtcblwiICAgICAgICB2ZWMzIGkgID0gZmxvb3IodiArIGRvdCh2LCBDLnl5eSkgKTtcXG5cIiArXG5cIiAgICAgICAgdmVjMyB4MCA9ICAgdiAtIGkgKyBkb3QoaSwgQy54eHgpIDtcXG5cIiArXG5cIlxcblwiICtcblwiICAgICAgICAvLyBPdGhlciBjb3JuZXJzXFxuXCIgK1xuXCIgICAgICAgIHZlYzMgZyA9IHN0ZXAoeDAueXp4LCB4MC54eXopO1xcblwiICtcblwiICAgICAgICB2ZWMzIGwgPSAxLjAgLSBnO1xcblwiICtcblwiICAgICAgICB2ZWMzIGkxID0gbWluKCBnLnh5eiwgbC56eHkgKTtcXG5cIiArXG5cIiAgICAgICAgdmVjMyBpMiA9IG1heCggZy54eXosIGwuenh5ICk7XFxuXCIgK1xuXCJcXG5cIiArXG5cIiAgICAgICAgLy8gICB4MCA9IHgwIC0gMC4wICsgMC4wICogQy54eHg7XFxuXCIgK1xuXCIgICAgICAgIC8vICAgeDEgPSB4MCAtIGkxICArIDEuMCAqIEMueHh4O1xcblwiICtcblwiICAgICAgICAvLyAgIHgyID0geDAgLSBpMiAgKyAyLjAgKiBDLnh4eDtcXG5cIiArXG5cIiAgICAgICAgLy8gICB4MyA9IHgwIC0gMS4wICsgMy4wICogQy54eHg7XFxuXCIgK1xuXCIgICAgICAgIHZlYzMgeDEgPSB4MCAtIGkxICsgQy54eHg7XFxuXCIgK1xuXCIgICAgICAgIHZlYzMgeDIgPSB4MCAtIGkyICsgQy55eXk7IC8vIDIuMCpDLnggPSAxLzMgPSBDLnlcXG5cIiArXG5cIiAgICAgICAgdmVjMyB4MyA9IHgwIC0gRC55eXk7ICAgICAgLy8gLTEuMCszLjAqQy54ID0gLTAuNSA9IC1ELnlcXG5cIiArXG5cIlxcblwiICtcblwiICAgICAgICAvLyBQZXJtdXRhdGlvbnNcXG5cIiArXG5cIiAgICAgICAgaSA9IG1vZDI4OShpKTtcXG5cIiArXG5cIiAgICAgICAgdmVjNCBwID0gcGVybXV0ZSggcGVybXV0ZSggcGVybXV0ZShcXG5cIiArXG5cIiAgICAgICAgaS56ICsgdmVjNCgwLjAsIGkxLnosIGkyLnosIDEuMCApKVxcblwiICtcblwiICAgICAgICArIGkueSArIHZlYzQoMC4wLCBpMS55LCBpMi55LCAxLjAgKSlcXG5cIiArXG5cIiAgICAgICAgKyBpLnggKyB2ZWM0KDAuMCwgaTEueCwgaTIueCwgMS4wICkpO1xcblwiICtcblwiXFxuXCIgK1xuXCIgICAgICAgIC8vIEdyYWRpZW50czogN3g3IHBvaW50cyBvdmVyIGEgc3F1YXJlLCBtYXBwZWQgb250byBhbiBvY3RhaGVkcm9uLlxcblwiICtcblwiICAgICAgICAvLyBUaGUgcmluZyBzaXplIDE3KjE3ID0gMjg5IGlzIGNsb3NlIHRvIGEgbXVsdGlwbGUgb2YgNDkgKDQ5KjYgPSAyOTQpXFxuXCIgK1xuXCIgICAgICAgIGZsb2F0IG5fID0gMC4xNDI4NTcxNDI4NTc7IC8vIDEuMC83LjBcXG5cIiArXG5cIiAgICAgICAgdmVjMyAgbnMgPSBuXyAqIEQud3l6IC0gRC54eng7XFxuXCIgK1xuXCJcXG5cIiArXG5cIiAgICAgICAgdmVjNCBqID0gcCAtIDQ5LjAgKiBmbG9vcihwICogbnMueiAqIG5zLnopOyAgLy8gIG1vZChwLDcqNylcXG5cIiArXG5cIlxcblwiICtcblwiICAgICAgICB2ZWM0IHhfID0gZmxvb3IoaiAqIG5zLnopO1xcblwiICtcblwiICAgICAgICB2ZWM0IHlfID0gZmxvb3IoaiAtIDcuMCAqIHhfICk7ICAgIC8vIG1vZChqLE4pXFxuXCIgK1xuXCJcXG5cIiArXG5cIiAgICAgICAgdmVjNCB4ID0geF8gKm5zLnggKyBucy55eXl5O1xcblwiICtcblwiICAgICAgICB2ZWM0IHkgPSB5XyAqbnMueCArIG5zLnl5eXk7XFxuXCIgK1xuXCIgICAgICAgIHZlYzQgaCA9IDEuMCAtIGFicyh4KSAtIGFicyh5KTtcXG5cIiArXG5cIlxcblwiICtcblwiICAgICAgICB2ZWM0IGIwID0gdmVjNCggeC54eSwgeS54eSApO1xcblwiICtcblwiICAgICAgICB2ZWM0IGIxID0gdmVjNCggeC56dywgeS56dyApO1xcblwiICtcblwiXFxuXCIgK1xuXCIgICAgICAgIC8vdmVjNCBzMCA9IHZlYzQobGVzc1RoYW4oYjAsMC4wKSkqMi4wIC0gMS4wO1xcblwiICtcblwiICAgICAgICAvL3ZlYzQgczEgPSB2ZWM0KGxlc3NUaGFuKGIxLDAuMCkpKjIuMCAtIDEuMDtcXG5cIiArXG5cIiAgICAgICAgdmVjNCBzMCA9IGZsb29yKGIwKSoyLjAgKyAxLjA7XFxuXCIgK1xuXCIgICAgICAgIHZlYzQgczEgPSBmbG9vcihiMSkqMi4wICsgMS4wO1xcblwiICtcblwiICAgICAgICB2ZWM0IHNoID0gLXN0ZXAoaCwgdmVjNCgwLjApKTtcXG5cIiArXG5cIlxcblwiICtcblwiICAgICAgICB2ZWM0IGEwID0gYjAueHp5dyArIHMwLnh6eXcqc2gueHh5eSA7XFxuXCIgK1xuXCIgICAgICAgIHZlYzQgYTEgPSBiMS54enl3ICsgczEueHp5dypzaC56end3IDtcXG5cIiArXG5cIlxcblwiICtcblwiICAgICAgICB2ZWMzIHAwID0gdmVjMyhhMC54eSxoLngpO1xcblwiICtcblwiICAgICAgICB2ZWMzIHAxID0gdmVjMyhhMC56dyxoLnkpO1xcblwiICtcblwiICAgICAgICB2ZWMzIHAyID0gdmVjMyhhMS54eSxoLnopO1xcblwiICtcblwiICAgICAgICB2ZWMzIHAzID0gdmVjMyhhMS56dyxoLncpO1xcblwiICtcblwiXFxuXCIgK1xuXCIgICAgICAgIC8vTm9ybWFsaXNlIGdyYWRpZW50c1xcblwiICtcblwiICAgICAgICB2ZWM0IG5vcm0gPSB0YXlsb3JJbnZTcXJ0KHZlYzQoZG90KHAwLHAwKSwgZG90KHAxLHAxKSwgZG90KHAyLCBwMiksIGRvdChwMyxwMykpKTtcXG5cIiArXG5cIiAgICAgICAgcDAgKj0gbm9ybS54O1xcblwiICtcblwiICAgICAgICBwMSAqPSBub3JtLnk7XFxuXCIgK1xuXCIgICAgICAgIHAyICo9IG5vcm0uejtcXG5cIiArXG5cIiAgICAgICAgcDMgKj0gbm9ybS53O1xcblwiICtcblwiXFxuXCIgK1xuXCIgICAgICAgIC8vIE1peCBmaW5hbCBub2lzZSB2YWx1ZVxcblwiICtcblwiICAgICAgICB2ZWM0IG0gPSBtYXgoMC42IC0gdmVjNChkb3QoeDAseDApLCBkb3QoeDEseDEpLCBkb3QoeDIseDIpLCBkb3QoeDMseDMpKSwgMC4wKTtcXG5cIiArXG5cIiAgICAgICAgbSA9IG0gKiBtO1xcblwiICtcblwiICAgICAgICByZXR1cm4gNDIuMCAqIGRvdCggbSptLCB2ZWM0KCBkb3QocDAseDApLCBkb3QocDEseDEpLCBkb3QocDIseDIpLCBkb3QocDMseDMpICkgKTtcXG5cIiArXG5cIiAgICB9XFxuXCIgK1xuXCJcXG5cIiArXG5cIiAgICAvLyBDbGFzc2ljIFBlcmxpbiBub2lzZVxcblwiICtcblwiICAgIGZsb2F0IGNub2lzZSh2ZWMzIFApIHtcXG5cIiArXG5cIiAgICAgICAgdmVjMyBQaTAgPSBmbG9vcihQKTsgLy8gSW50ZWdlciBwYXJ0IGZvciBpbmRleGluZ1xcblwiICtcblwiICAgICAgICB2ZWMzIFBpMSA9IFBpMCArIHZlYzMoMS4wKTsgLy8gSW50ZWdlciBwYXJ0ICsgMVxcblwiICtcblwiICAgICAgICBQaTAgPSBtb2QyODkoUGkwKTtcXG5cIiArXG5cIiAgICAgICAgUGkxID0gbW9kMjg5KFBpMSk7XFxuXCIgK1xuXCIgICAgICAgIHZlYzMgUGYwID0gZnJhY3QoUCk7IC8vIEZyYWN0aW9uYWwgcGFydCBmb3IgaW50ZXJwb2xhdGlvblxcblwiICtcblwiICAgICAgICB2ZWMzIFBmMSA9IFBmMCAtIHZlYzMoMS4wKTsgLy8gRnJhY3Rpb25hbCBwYXJ0IC0gMS4wXFxuXCIgK1xuXCIgICAgICAgIHZlYzQgaXggPSB2ZWM0KFBpMC54LCBQaTEueCwgUGkwLngsIFBpMS54KTtcXG5cIiArXG5cIiAgICAgICAgdmVjNCBpeSA9IHZlYzQoUGkwLnl5LCBQaTEueXkpO1xcblwiICtcblwiICAgICAgICB2ZWM0IGl6MCA9IFBpMC56enp6O1xcblwiICtcblwiICAgICAgICB2ZWM0IGl6MSA9IFBpMS56enp6O1xcblwiICtcblwiXFxuXCIgK1xuXCIgICAgICAgIHZlYzQgaXh5ID0gcGVybXV0ZShwZXJtdXRlKGl4KSArIGl5KTtcXG5cIiArXG5cIiAgICAgICAgdmVjNCBpeHkwID0gcGVybXV0ZShpeHkgKyBpejApO1xcblwiICtcblwiICAgICAgICB2ZWM0IGl4eTEgPSBwZXJtdXRlKGl4eSArIGl6MSk7XFxuXCIgK1xuXCJcXG5cIiArXG5cIiAgICAgICAgdmVjNCBneDAgPSBpeHkwICogKDEuMCAvIDcuMCk7XFxuXCIgK1xuXCIgICAgICAgIHZlYzQgZ3kwID0gZnJhY3QoZmxvb3IoZ3gwKSAqICgxLjAgLyA3LjApKSAtIDAuNTtcXG5cIiArXG5cIiAgICAgICAgZ3gwID0gZnJhY3QoZ3gwKTtcXG5cIiArXG5cIiAgICAgICAgdmVjNCBnejAgPSB2ZWM0KDAuNSkgLSBhYnMoZ3gwKSAtIGFicyhneTApO1xcblwiICtcblwiICAgICAgICB2ZWM0IHN6MCA9IHN0ZXAoZ3owLCB2ZWM0KDAuMCkpO1xcblwiICtcblwiICAgICAgICBneDAgLT0gc3owICogKHN0ZXAoMC4wLCBneDApIC0gMC41KTtcXG5cIiArXG5cIiAgICAgICAgZ3kwIC09IHN6MCAqIChzdGVwKDAuMCwgZ3kwKSAtIDAuNSk7XFxuXCIgK1xuXCJcXG5cIiArXG5cIiAgICAgICAgdmVjNCBneDEgPSBpeHkxICogKDEuMCAvIDcuMCk7XFxuXCIgK1xuXCIgICAgICAgIHZlYzQgZ3kxID0gZnJhY3QoZmxvb3IoZ3gxKSAqICgxLjAgLyA3LjApKSAtIDAuNTtcXG5cIiArXG5cIiAgICAgICAgZ3gxID0gZnJhY3QoZ3gxKTtcXG5cIiArXG5cIiAgICAgICAgdmVjNCBnejEgPSB2ZWM0KDAuNSkgLSBhYnMoZ3gxKSAtIGFicyhneTEpO1xcblwiICtcblwiICAgICAgICB2ZWM0IHN6MSA9IHN0ZXAoZ3oxLCB2ZWM0KDAuMCkpO1xcblwiICtcblwiICAgICAgICBneDEgLT0gc3oxICogKHN0ZXAoMC4wLCBneDEpIC0gMC41KTtcXG5cIiArXG5cIiAgICAgICAgZ3kxIC09IHN6MSAqIChzdGVwKDAuMCwgZ3kxKSAtIDAuNSk7XFxuXCIgK1xuXCJcXG5cIiArXG5cIiAgICAgICAgdmVjMyBnMDAwID0gdmVjMyhneDAueCxneTAueCxnejAueCk7XFxuXCIgK1xuXCIgICAgICAgIHZlYzMgZzEwMCA9IHZlYzMoZ3gwLnksZ3kwLnksZ3owLnkpO1xcblwiICtcblwiICAgICAgICB2ZWMzIGcwMTAgPSB2ZWMzKGd4MC56LGd5MC56LGd6MC56KTtcXG5cIiArXG5cIiAgICAgICAgdmVjMyBnMTEwID0gdmVjMyhneDAudyxneTAudyxnejAudyk7XFxuXCIgK1xuXCIgICAgICAgIHZlYzMgZzAwMSA9IHZlYzMoZ3gxLngsZ3kxLngsZ3oxLngpO1xcblwiICtcblwiICAgICAgICB2ZWMzIGcxMDEgPSB2ZWMzKGd4MS55LGd5MS55LGd6MS55KTtcXG5cIiArXG5cIiAgICAgICAgdmVjMyBnMDExID0gdmVjMyhneDEueixneTEueixnejEueik7XFxuXCIgK1xuXCIgICAgICAgIHZlYzMgZzExMSA9IHZlYzMoZ3gxLncsZ3kxLncsZ3oxLncpO1xcblwiICtcblwiXFxuXCIgK1xuXCIgICAgICAgIHZlYzQgbm9ybTAgPSB0YXlsb3JJbnZTcXJ0KHZlYzQoZG90KGcwMDAsIGcwMDApLCBkb3QoZzAxMCwgZzAxMCksIGRvdChnMTAwLCBnMTAwKSwgZG90KGcxMTAsIGcxMTApKSk7XFxuXCIgK1xuXCIgICAgICAgIGcwMDAgKj0gbm9ybTAueDtcXG5cIiArXG5cIiAgICAgICAgZzAxMCAqPSBub3JtMC55O1xcblwiICtcblwiICAgICAgICBnMTAwICo9IG5vcm0wLno7XFxuXCIgK1xuXCIgICAgICAgIGcxMTAgKj0gbm9ybTAudztcXG5cIiArXG5cIiAgICAgICAgdmVjNCBub3JtMSA9IHRheWxvckludlNxcnQodmVjNChkb3QoZzAwMSwgZzAwMSksIGRvdChnMDExLCBnMDExKSwgZG90KGcxMDEsIGcxMDEpLCBkb3QoZzExMSwgZzExMSkpKTtcXG5cIiArXG5cIiAgICAgICAgZzAwMSAqPSBub3JtMS54O1xcblwiICtcblwiICAgICAgICBnMDExICo9IG5vcm0xLnk7XFxuXCIgK1xuXCIgICAgICAgIGcxMDEgKj0gbm9ybTEuejtcXG5cIiArXG5cIiAgICAgICAgZzExMSAqPSBub3JtMS53O1xcblwiICtcblwiXFxuXCIgK1xuXCIgICAgICAgIGZsb2F0IG4wMDAgPSBkb3QoZzAwMCwgUGYwKTtcXG5cIiArXG5cIiAgICAgICAgZmxvYXQgbjEwMCA9IGRvdChnMTAwLCB2ZWMzKFBmMS54LCBQZjAueXopKTtcXG5cIiArXG5cIiAgICAgICAgZmxvYXQgbjAxMCA9IGRvdChnMDEwLCB2ZWMzKFBmMC54LCBQZjEueSwgUGYwLnopKTtcXG5cIiArXG5cIiAgICAgICAgZmxvYXQgbjExMCA9IGRvdChnMTEwLCB2ZWMzKFBmMS54eSwgUGYwLnopKTtcXG5cIiArXG5cIiAgICAgICAgZmxvYXQgbjAwMSA9IGRvdChnMDAxLCB2ZWMzKFBmMC54eSwgUGYxLnopKTtcXG5cIiArXG5cIiAgICAgICAgZmxvYXQgbjEwMSA9IGRvdChnMTAxLCB2ZWMzKFBmMS54LCBQZjAueSwgUGYxLnopKTtcXG5cIiArXG5cIiAgICAgICAgZmxvYXQgbjAxMSA9IGRvdChnMDExLCB2ZWMzKFBmMC54LCBQZjEueXopKTtcXG5cIiArXG5cIiAgICAgICAgZmxvYXQgbjExMSA9IGRvdChnMTExLCBQZjEpO1xcblwiICtcblwiXFxuXCIgK1xuXCIgICAgICAgIHZlYzMgZmFkZV94eXogPSBmYWRlKFBmMCk7XFxuXCIgK1xuXCIgICAgICAgIHZlYzQgbl96ID0gbWl4KHZlYzQobjAwMCwgbjEwMCwgbjAxMCwgbjExMCksIHZlYzQobjAwMSwgbjEwMSwgbjAxMSwgbjExMSksIGZhZGVfeHl6LnopO1xcblwiICtcblwiICAgICAgICB2ZWMyIG5feXogPSBtaXgobl96Lnh5LCBuX3ouencsIGZhZGVfeHl6LnkpO1xcblwiICtcblwiICAgICAgICBmbG9hdCBuX3h5eiA9IG1peChuX3l6LngsIG5feXoueSwgZmFkZV94eXoueCk7XFxuXCIgK1xuXCIgICAgICAgIHJldHVybiAyLjIgKiBuX3h5ejtcXG5cIiArXG5cIiAgICB9XFxuXCIgK1xuXCJcXG5cIiArXG5cIiAgICAvLyBDbGFzc2ljIFBlcmxpbiBub2lzZSwgcGVyaW9kaWMgdmFyaWFudFxcblwiICtcblwiICAgIGZsb2F0IHBub2lzZSh2ZWMzIFAsIHZlYzMgcmVwKSB7XFxuXCIgK1xuXCIgICAgICAgIHZlYzMgUGkwID0gbW9kKGZsb29yKFApLCByZXApOyAvLyBJbnRlZ2VyIHBhcnQsIG1vZHVsbyBwZXJpb2RcXG5cIiArXG5cIiAgICAgICAgdmVjMyBQaTEgPSBtb2QoUGkwICsgdmVjMygxLjApLCByZXApOyAvLyBJbnRlZ2VyIHBhcnQgKyAxLCBtb2QgcGVyaW9kXFxuXCIgK1xuXCIgICAgICAgIFBpMCA9IG1vZDI4OShQaTApO1xcblwiICtcblwiICAgICAgICBQaTEgPSBtb2QyODkoUGkxKTtcXG5cIiArXG5cIiAgICAgICAgdmVjMyBQZjAgPSBmcmFjdChQKTsgLy8gRnJhY3Rpb25hbCBwYXJ0IGZvciBpbnRlcnBvbGF0aW9uXFxuXCIgK1xuXCIgICAgICAgIHZlYzMgUGYxID0gUGYwIC0gdmVjMygxLjApOyAvLyBGcmFjdGlvbmFsIHBhcnQgLSAxLjBcXG5cIiArXG5cIiAgICAgICAgdmVjNCBpeCA9IHZlYzQoUGkwLngsIFBpMS54LCBQaTAueCwgUGkxLngpO1xcblwiICtcblwiICAgICAgICB2ZWM0IGl5ID0gdmVjNChQaTAueXksIFBpMS55eSk7XFxuXCIgK1xuXCIgICAgICAgIHZlYzQgaXowID0gUGkwLnp6eno7XFxuXCIgK1xuXCIgICAgICAgIHZlYzQgaXoxID0gUGkxLnp6eno7XFxuXCIgK1xuXCJcXG5cIiArXG5cIiAgICAgICAgdmVjNCBpeHkgPSBwZXJtdXRlKHBlcm11dGUoaXgpICsgaXkpO1xcblwiICtcblwiICAgICAgICB2ZWM0IGl4eTAgPSBwZXJtdXRlKGl4eSArIGl6MCk7XFxuXCIgK1xuXCIgICAgICAgIHZlYzQgaXh5MSA9IHBlcm11dGUoaXh5ICsgaXoxKTtcXG5cIiArXG5cIlxcblwiICtcblwiICAgICAgICB2ZWM0IGd4MCA9IGl4eTAgKiAoMS4wIC8gNy4wKTtcXG5cIiArXG5cIiAgICAgICAgdmVjNCBneTAgPSBmcmFjdChmbG9vcihneDApICogKDEuMCAvIDcuMCkpIC0gMC41O1xcblwiICtcblwiICAgICAgICBneDAgPSBmcmFjdChneDApO1xcblwiICtcblwiICAgICAgICB2ZWM0IGd6MCA9IHZlYzQoMC41KSAtIGFicyhneDApIC0gYWJzKGd5MCk7XFxuXCIgK1xuXCIgICAgICAgIHZlYzQgc3owID0gc3RlcChnejAsIHZlYzQoMC4wKSk7XFxuXCIgK1xuXCIgICAgICAgIGd4MCAtPSBzejAgKiAoc3RlcCgwLjAsIGd4MCkgLSAwLjUpO1xcblwiICtcblwiICAgICAgICBneTAgLT0gc3owICogKHN0ZXAoMC4wLCBneTApIC0gMC41KTtcXG5cIiArXG5cIlxcblwiICtcblwiICAgICAgICB2ZWM0IGd4MSA9IGl4eTEgKiAoMS4wIC8gNy4wKTtcXG5cIiArXG5cIiAgICAgICAgdmVjNCBneTEgPSBmcmFjdChmbG9vcihneDEpICogKDEuMCAvIDcuMCkpIC0gMC41O1xcblwiICtcblwiICAgICAgICBneDEgPSBmcmFjdChneDEpO1xcblwiICtcblwiICAgICAgICB2ZWM0IGd6MSA9IHZlYzQoMC41KSAtIGFicyhneDEpIC0gYWJzKGd5MSk7XFxuXCIgK1xuXCIgICAgICAgIHZlYzQgc3oxID0gc3RlcChnejEsIHZlYzQoMC4wKSk7XFxuXCIgK1xuXCIgICAgICAgIGd4MSAtPSBzejEgKiAoc3RlcCgwLjAsIGd4MSkgLSAwLjUpO1xcblwiICtcblwiICAgICAgICBneTEgLT0gc3oxICogKHN0ZXAoMC4wLCBneTEpIC0gMC41KTtcXG5cIiArXG5cIlxcblwiICtcblwiICAgICAgICB2ZWMzIGcwMDAgPSB2ZWMzKGd4MC54LGd5MC54LGd6MC54KTtcXG5cIiArXG5cIiAgICAgICAgdmVjMyBnMTAwID0gdmVjMyhneDAueSxneTAueSxnejAueSk7XFxuXCIgK1xuXCIgICAgICAgIHZlYzMgZzAxMCA9IHZlYzMoZ3gwLnosZ3kwLnosZ3owLnopO1xcblwiICtcblwiICAgICAgICB2ZWMzIGcxMTAgPSB2ZWMzKGd4MC53LGd5MC53LGd6MC53KTtcXG5cIiArXG5cIiAgICAgICAgdmVjMyBnMDAxID0gdmVjMyhneDEueCxneTEueCxnejEueCk7XFxuXCIgK1xuXCIgICAgICAgIHZlYzMgZzEwMSA9IHZlYzMoZ3gxLnksZ3kxLnksZ3oxLnkpO1xcblwiICtcblwiICAgICAgICB2ZWMzIGcwMTEgPSB2ZWMzKGd4MS56LGd5MS56LGd6MS56KTtcXG5cIiArXG5cIiAgICAgICAgdmVjMyBnMTExID0gdmVjMyhneDEudyxneTEudyxnejEudyk7XFxuXCIgK1xuXCJcXG5cIiArXG5cIiAgICAgICAgdmVjNCBub3JtMCA9IHRheWxvckludlNxcnQodmVjNChkb3QoZzAwMCwgZzAwMCksIGRvdChnMDEwLCBnMDEwKSwgZG90KGcxMDAsIGcxMDApLCBkb3QoZzExMCwgZzExMCkpKTtcXG5cIiArXG5cIiAgICAgICAgZzAwMCAqPSBub3JtMC54O1xcblwiICtcblwiICAgICAgICBnMDEwICo9IG5vcm0wLnk7XFxuXCIgK1xuXCIgICAgICAgIGcxMDAgKj0gbm9ybTAuejtcXG5cIiArXG5cIiAgICAgICAgZzExMCAqPSBub3JtMC53O1xcblwiICtcblwiICAgICAgICB2ZWM0IG5vcm0xID0gdGF5bG9ySW52U3FydCh2ZWM0KGRvdChnMDAxLCBnMDAxKSwgZG90KGcwMTEsIGcwMTEpLCBkb3QoZzEwMSwgZzEwMSksIGRvdChnMTExLCBnMTExKSkpO1xcblwiICtcblwiICAgICAgICBnMDAxICo9IG5vcm0xLng7XFxuXCIgK1xuXCIgICAgICAgIGcwMTEgKj0gbm9ybTEueTtcXG5cIiArXG5cIiAgICAgICAgZzEwMSAqPSBub3JtMS56O1xcblwiICtcblwiICAgICAgICBnMTExICo9IG5vcm0xLnc7XFxuXCIgK1xuXCJcXG5cIiArXG5cIiAgICAgICAgZmxvYXQgbjAwMCA9IGRvdChnMDAwLCBQZjApO1xcblwiICtcblwiICAgICAgICBmbG9hdCBuMTAwID0gZG90KGcxMDAsIHZlYzMoUGYxLngsIFBmMC55eikpO1xcblwiICtcblwiICAgICAgICBmbG9hdCBuMDEwID0gZG90KGcwMTAsIHZlYzMoUGYwLngsIFBmMS55LCBQZjAueikpO1xcblwiICtcblwiICAgICAgICBmbG9hdCBuMTEwID0gZG90KGcxMTAsIHZlYzMoUGYxLnh5LCBQZjAueikpO1xcblwiICtcblwiICAgICAgICBmbG9hdCBuMDAxID0gZG90KGcwMDEsIHZlYzMoUGYwLnh5LCBQZjEueikpO1xcblwiICtcblwiICAgICAgICBmbG9hdCBuMTAxID0gZG90KGcxMDEsIHZlYzMoUGYxLngsIFBmMC55LCBQZjEueikpO1xcblwiICtcblwiICAgICAgICBmbG9hdCBuMDExID0gZG90KGcwMTEsIHZlYzMoUGYwLngsIFBmMS55eikpO1xcblwiICtcblwiICAgICAgICBmbG9hdCBuMTExID0gZG90KGcxMTEsIFBmMSk7XFxuXCIgK1xuXCJcXG5cIiArXG5cIiAgICAgICAgdmVjMyBmYWRlX3h5eiA9IGZhZGUoUGYwKTtcXG5cIiArXG5cIiAgICAgICAgdmVjNCBuX3ogPSBtaXgodmVjNChuMDAwLCBuMTAwLCBuMDEwLCBuMTEwKSwgdmVjNChuMDAxLCBuMTAxLCBuMDExLCBuMTExKSwgZmFkZV94eXoueik7XFxuXCIgK1xuXCIgICAgICAgIHZlYzIgbl95eiA9IG1peChuX3oueHksIG5fei56dywgZmFkZV94eXoueSk7XFxuXCIgK1xuXCIgICAgICAgIGZsb2F0IG5feHl6ID0gbWl4KG5feXoueCwgbl95ei55LCBmYWRlX3h5ei54KTtcXG5cIiArXG5cIiAgICAgICAgcmV0dXJuIDIuMiAqIG5feHl6O1xcblwiICtcblwiICAgIH1cXG5cIiArXG5cIiNlbmRpZlxcblwiICtcblwiXFxuXCIgK1xuXCJ2b2lkIG1haW4gKHZvaWQpIHtcXG5cIiArXG5cIlxcblwiICtcblwiICAgICNpZiBkZWZpbmVkKEVGRkVDVF9TUE9UTElHSFQpXFxuXCIgK1xuXCIgICAgLy8gU3BvdGxpZ2h0IGVmZmVjdFxcblwiICtcblwiICAgICAgICB2ZWMyIHBvc2l0aW9uID0gZ2xfRnJhZ0Nvb3JkLnh5IC8gcmVzb2x1dGlvbi54eTsgICAgLy8gc2NhbGUgY29vcmRzIHRvIFswLjAsIDEuMF1cXG5cIiArXG5cIiAgICAgICAgcG9zaXRpb24gPSBwb3NpdGlvbiAqIDIuMCAtIDEuMDsgICAgICAgICAgICAgICAgICAgIC8vIHNjYWxlIGNvb3JkcyB0byBbLTEuMCwgMS4wXVxcblwiICtcblwiICAgICAgICBwb3NpdGlvbi55ICo9IHJlc29sdXRpb24ueSAvIHJlc29sdXRpb24ueDsgICAgICAgICAgLy8gY29ycmVjdCBhc3BlY3QgcmF0aW9cXG5cIiArXG5cIlxcblwiICtcblwiICAgICAgICB2ZWMzIGNvbG9yID0gZmNvbG9yICogbWF4KDEuMCAtIGRpc3RhbmNlKHBvc2l0aW9uLCB2ZWMyKDAuMCwgMC4wKSksIDAuMik7XFxuXCIgK1xuXCIgICAgICAgIC8vIHZlYzMgY29sb3IgPSBmY29sb3IgKiAoMS4wIC0gZG90KG5vcm1hbGl6ZSh2ZWMzKHJhbmQoZ2xfRnJhZ0Nvb3JkLnh5ICogMC4wMSkgKiAxMC4wLCAwLjAsIC0xLjApKSwgdmVjMygwLCAwLCAxLjApKSk7XFxuXCIgK1xuXCIgICAgI2Vsc2VcXG5cIiArXG5cIiAgICAgICAgdmVjMyBjb2xvciA9IGZjb2xvcjtcXG5cIiArXG5cIiAgICAjZW5kaWZcXG5cIiArXG5cIlxcblwiICtcblwiICAgICNpZiBkZWZpbmVkKEVGRkVDVF9DT0xPUl9CTEVFRClcXG5cIiArXG5cIiAgICAgICAgLy8gTXV0YXRlIGNvbG9ycyBieSBzY3JlZW4gcG9zaXRpb24gb3IgdGltZVxcblwiICtcblwiICAgICAgICBjb2xvciArPSB2ZWMzKGdsX0ZyYWdDb29yZC54IC8gcmVzb2x1dGlvbi54LCAwLjAsIGdsX0ZyYWdDb29yZC55IC8gcmVzb2x1dGlvbi55KTtcXG5cIiArXG5cIiAgICAgICAgY29sb3IuciArPSBzaW4odGltZSAvIDMuMCk7XFxuXCIgK1xuXCIgICAgI2VuZGlmXFxuXCIgK1xuXCJcXG5cIiArXG5cIiAgICAvLyBNdXRhdGUgY29sb3IgYnkgM2Qgbm9pc2VcXG5cIiArXG5cIiAgICAjaWYgZGVmaW5lZCAoRUZGRUNUX05PSVNFX1RFWFRVUkUpXFxuXCIgK1xuXCIgICAgICAgICNpZiBkZWZpbmVkKEVGRkVDVF9OT0lTRV9BTklNQVRBQkxFKSAmJiBkZWZpbmVkKEVGRkVDVF9OT0lTRV9BTklNQVRFRClcXG5cIiArXG5cIiAgICAgICAgICAgIGNvbG9yICo9IChhYnMoY25vaXNlKChmcG9zaXRpb24gKyB2ZWMzKHRpbWUgKiA1LiwgdGltZSAqIDcuNSwgdGltZSAqIDEwLikpIC8gMTAuMCkpIC8gNC4wKSArIDAuNzU7XFxuXCIgK1xuXCIgICAgICAgICNlbmRpZlxcblwiICtcblwiICAgICAgICAjaWZuZGVmIEVGRkVDVF9OT0lTRV9BTklNQVRBQkxFXFxuXCIgK1xuXCIgICAgICAgICAgICBjb2xvciAqPSAoYWJzKGNub2lzZShmcG9zaXRpb24gLyAxMC4wKSkgLyA0LjApICsgMC43NTtcXG5cIiArXG5cIiAgICAgICAgI2VuZGlmXFxuXCIgK1xuXCIgICAgI2VuZGlmXFxuXCIgK1xuXCJcXG5cIiArXG5cIiAgICBnbF9GcmFnQ29sb3IgPSB2ZWM0KGNvbG9yLCAxLjApO1xcblwiICtcblwiICAgIC8vIGdsX0ZyYWdDb2xvciA9IHZlYzQoMS4wLCAwLjAsIDAuMCwgMS4wKTtcXG5cIiArXG5cIn1cXG5cIiArXG5cIlwiO1xuXG5zaGFkZXJfc291cmNlc1sncG9seWdvbl92ZXJ0ZXgnXSA9XG5cIi8vICNkZWZpbmUgUFJPSkVDVElPTl9QRVJTUEVDVElWRVxcblwiICtcblwiLy8gI2RlZmluZSBQUk9KRUNUSU9OX0lTT01FVFJJQ1xcblwiICtcblwiLy8gI2RlZmluZSBQUk9KRUNUSU9OX1BPUFVQXFxuXCIgK1xuXCJcXG5cIiArXG5cIi8vICNkZWZpbmUgTElHSFRJTkdfUE9JTlRcXG5cIiArXG5cIi8vICNkZWZpbmUgTElHSFRJTkdfRElSRUNUSU9OXFxuXCIgK1xuXCJcXG5cIiArXG5cIi8vICNkZWZpbmUgQU5JTUFUSU9OX0VMRVZBVE9SXFxuXCIgK1xuXCIvLyAjZGVmaW5lIEFOSU1BVElPTl9XQVZFXFxuXCIgK1xuXCJcXG5cIiArXG5cInVuaWZvcm0gdmVjMiByZXNvbHV0aW9uO1xcblwiICtcblwidW5pZm9ybSB2ZWMyIG1hcF9jZW50ZXI7XFxuXCIgK1xuXCJ1bmlmb3JtIGZsb2F0IG1hcF96b29tO1xcblwiICtcblwidW5pZm9ybSB2ZWMyIG1ldGVyX3pvb207XFxuXCIgK1xuXCJ1bmlmb3JtIHZlYzIgdGlsZV9taW47XFxuXCIgK1xuXCJ1bmlmb3JtIHZlYzIgdGlsZV9tYXg7XFxuXCIgK1xuXCJ1bmlmb3JtIGZsb2F0IG51bV9sYXllcnM7XFxuXCIgK1xuXCJ1bmlmb3JtIGZsb2F0IHRpbWU7XFxuXCIgK1xuXCJ1bmlmb3JtIGZsb2F0IHVfaGVpZ2h0VmFyO1xcblwiICtcblwidW5pZm9ybSBmbG9hdCB1X2xheWVyVmFyO1xcblwiICtcblwidW5pZm9ybSBmbG9hdCB1X2xpZ2h0QXppbXV0aDtcXG5cIiArXG5cInVuaWZvcm0gZmxvYXQgdV9saWdodEVsZXZhdGlvbjtcXG5cIiArXG5cInVuaWZvcm0gZmxvYXQgdV9saWdodFJhZGl1cztcXG5cIiArXG5cInVuaWZvcm0gZmxvYXQgdV9saWdodHg7XFxuXCIgK1xuXCJ1bmlmb3JtIGZsb2F0IHVfbGlnaHR5O1xcblwiICtcblwidW5pZm9ybSBmbG9hdCB1X2xpZ2h0ejtcXG5cIiArXG5cInVuaWZvcm0gZmxvYXQgdV9saWdodEludGVuc2l0eTtcXG5cIiArXG5cInVuaWZvcm0gZmxvYXQgdV9saWdodEFtYmllbnQ7XFxuXCIgK1xuXCJ1bmlmb3JtIGZsb2F0IHVfbGlnaHRIZWlnaHQ7XFxuXCIgK1xuXCJ1bmlmb3JtIGZsb2F0IHVfaGVpZ2h0TGltaXQ7XFxuXCIgK1xuXCJ1bmlmb3JtIHZlYzMgdV9saWdodFBvc2l0aW9uO1xcblwiICtcblwidW5pZm9ybSB2ZWMzIHRlc3RVbmlmb3JtQ29sb3IwO1xcblwiICtcblwidW5pZm9ybSB2ZWMzIHRlc3RVbmlmb3JtQ29sb3IxO1xcblwiICtcblwidW5pZm9ybSB2ZWMzIHRlc3RVbmlmb3JtQ29sb3IyO1xcblwiICtcblwidW5pZm9ybSB2ZWMzIHRlc3RVbmlmb3JtQ29sb3IzO1xcblwiICtcblwidW5pZm9ybSB2ZWMzIHRlc3RVbmlmb3JtQ29sb3I0O1xcblwiICtcblwidW5pZm9ybSB2ZWMzIHRlc3RVbmlmb3JtQ29sb3I1O1xcblwiICtcblwidW5pZm9ybSB2ZWMzIHRlc3RVbmlmb3JtQ29sb3I2O1xcblwiICtcblwidW5pZm9ybSB2ZWMzIHRlc3RVbmlmb3JtQ29sb3I3O1xcblwiICtcblwidW5pZm9ybSB2ZWMzIHRlc3RVbmlmb3JtQ29sb3I4O1xcblwiICtcblwidW5pZm9ybSB2ZWMzIHRlc3RVbmlmb3JtQ29sb3I5O1xcblwiICtcblwiXFxuXCIgK1xuXCJhdHRyaWJ1dGUgdmVjMyBwb3NpdGlvbjtcXG5cIiArXG5cImF0dHJpYnV0ZSB2ZWMzIG5vcm1hbDtcXG5cIiArXG5cImF0dHJpYnV0ZSB2ZWMzIGNvbG9yO1xcblwiICtcblwiYXR0cmlidXRlIGZsb2F0IGxheWVyO1xcblwiICtcblwiXFxuXCIgK1xuXCJ2YXJ5aW5nIHZlYzMgZmNvbG9yO1xcblwiICtcblwiXFxuXCIgK1xuXCIjaWYgZGVmaW5lZChFRkZFQ1RfTk9JU0VfVEVYVFVSRSlcXG5cIiArXG5cIiAgICB2YXJ5aW5nIHZlYzMgZnBvc2l0aW9uO1xcblwiICtcblwiI2VuZGlmXFxuXCIgK1xuXCJcXG5cIiArXG5cInZlYzMgbGlnaHQgPSBub3JtYWxpemUodmVjMygwLjIsIDAuNywgLTAuNSkpOyAvLyB2ZWMzKDAuMSwgMC4yLCAtMC40KVxcblwiICtcblwiY29uc3QgZmxvYXQgYW1iaWVudCA9IC40NTtcXG5cIiArXG5cIlxcblwiICtcblwiLy8gUHJvamVjdCBsYXQtbG5nIHRvIG1lcmNhdG9yXFxuXCIgK1xuXCIvLyB2ZWMyIGxhdExuZ1RvTWV0ZXJzICh2ZWMyIGNvb3JkaW5hdGUpIHtcXG5cIiArXG5cIi8vICAgICBjb25zdCBmbG9hdCBwaSA9IDMuMTQxNTkyNjtcXG5cIiArXG5cIi8vICAgICBjb25zdCBmbG9hdCBoYWxmX2NpcmN1bWZlcmVuY2VfbWV0ZXJzID0gMjAwMzc1MDguMzQyNzg5MjQ0O1xcblwiICtcblwiLy8gICAgIHZlYzIgcHJvamVjdGVkO1xcblwiICtcblwiXFxuXCIgK1xuXCIvLyAgICAgLy8gTGF0aXR1ZGVcXG5cIiArXG5cIi8vICAgICBwcm9qZWN0ZWQueSA9IGxvZyh0YW4oKGNvb3JkaW5hdGUueSArIDkwLjApICogcGkgLyAzNjAuMCkpIC8gKHBpIC8gMTgwLjApO1xcblwiICtcblwiLy8gICAgIHByb2plY3RlZC55ID0gcHJvamVjdGVkLnkgKiBoYWxmX2NpcmN1bWZlcmVuY2VfbWV0ZXJzIC8gMTgwLjA7XFxuXCIgK1xuXCJcXG5cIiArXG5cIi8vICAgICAvLyBMb25naXR1ZGVcXG5cIiArXG5cIi8vICAgICBwcm9qZWN0ZWQueCA9IGNvb3JkaW5hdGUueCAqIGhhbGZfY2lyY3VtZmVyZW5jZV9tZXRlcnMgLyAxODAuMDtcXG5cIiArXG5cIlxcblwiICtcblwiLy8gICAgIHJldHVybiBwcm9qZWN0ZWQ7XFxuXCIgK1xuXCIvLyB9XFxuXCIgK1xuXCJcXG5cIiArXG5cInZlYzMgc3BoZXJpY2FsVG9DYXJ0ZXNpYW4oIGZsb2F0IGF6aW11dGgsIGZsb2F0IGVsZXZhdGlvbiwgZmxvYXQgcmFkaXVzICkge1xcblwiICtcblwiICAgIC8vIGZsb2F0IHogPSBzcXJ0KCggcG93KHJhZGl1cywgMi4wKSAqIHBvdyhjb3MoYXppbXV0aCksIDIuMCkgKS8oMS4wICsgcG93KGNvcyhhemltdXRoKSwgMi4wKSAqIHBvdyh0YW4oZWxldmF0aW9uKSwgMi4wKSkpO1xcblwiICtcblwiICAgIC8vIGZsb2F0IHogPSAxLjA7XFxuXCIgK1xuXCIgICAgZmxvYXQgeCA9IHJhZGl1cyAqIHNpbihlbGV2YXRpb24pICogY29zKGF6aW11dGgpO1xcblwiICtcblwiICAgIGZsb2F0IHkgPSByYWRpdXMgKiBzaW4oZWxldmF0aW9uKSAqIHNpbihhemltdXRoKTtcXG5cIiArXG5cIiAgICBmbG9hdCB6ID0gcmFkaXVzICogY29zKGVsZXZhdGlvbik7XFxuXCIgK1xuXCIgICAgcmV0dXJuIHZlYzMoeCwgeSwgeik7XFxuXCIgK1xuXCJ9XFxuXCIgK1xuXCJcXG5cIiArXG5cInZvaWQgbWFpbigpIHtcXG5cIiArXG5cIiAgICB2ZWMzIHZwb3NpdGlvbiA9IHBvc2l0aW9uO1xcblwiICtcblwiICAgIHZlYzMgdm5vcm1hbCA9IG5vcm1hbDtcXG5cIiArXG5cIlxcblwiICtcblwiICAgIC8vIENhbGMgcG9zaXRpb24gb2YgdmVydGV4IGluIG1ldGVycywgcmVsYXRpdmUgdG8gY2VudGVyIG9mIHNjcmVlblxcblwiICtcblwiICAgIHZwb3NpdGlvbi55ICo9IC0xLjA7IC8vIGFkanVzdCBmb3IgZmxpcHBlZCB5LWNvb3Jkc1xcblwiICtcblwiICAgIC8vIHZwb3NpdGlvbi55ICs9IFRJTEVfU0NBTEU7IC8vIGFsdGVybmF0ZSwgdG8gYWxzbyBhZGp1c3QgZm9yIGZvcmNlLXBvc2l0aXZlIHkgY29vcmRzIGluIHRpbGVcXG5cIiArXG5cIiAgICB2cG9zaXRpb24ueHkgKj0gKHRpbGVfbWF4IC0gdGlsZV9taW4pIC8gVElMRV9TQ0FMRTsgLy8gYWRqdXN0IGZvciB2ZXJ0ZXggbG9jYXRpb24gd2l0aGluIHRpbGUgKHNjYWxlZCBmcm9tIGxvY2FsIGNvb3JkcyB0byBtZXRlcnMpXFxuXCIgK1xuXCJcXG5cIiArXG5cIiAgICAvLyB2cG9zaXRpb24ueiAqPSB0ZXN0VW5pZm9ybTtcXG5cIiArXG5cIlxcblwiICtcblwiICAgIC8vIFZlcnRleCBkaXNwbGFjZW1lbnQgKyBwcm9jZWR1cmFsIGVmZmVjdHNcXG5cIiArXG5cIiAgICAjaWYgZGVmaW5lZChBTklNQVRJT05fRUxFVkFUT1IpIHx8IGRlZmluZWQoQU5JTUFUSU9OX1dBVkUpIHx8IGRlZmluZWQoRUZGRUNUX05PSVNFX1RFWFRVUkUpXFxuXCIgK1xuXCIgICAgICAgIHZlYzMgdnBvc2l0aW9uX3dvcmxkID0gdnBvc2l0aW9uICsgdmVjMyh0aWxlX21pbiwgMC4pOyAvLyBuZWVkIHZlcnRleCBpbiB3b3JsZCBjb29yZHMgKGJlZm9yZSBtYXAgY2VudGVyIHRyYW5zZm9ybSksIGhhY2sgdG8gZ2V0IGFyb3VuZCBwcmVjaXNpb24gaXNzdWVzIChzZWUgYmVsb3cpXFxuXCIgK1xuXCJcXG5cIiArXG5cIiAgICAgICAgI2lmIGRlZmluZWQoRUZGRUNUX05PSVNFX1RFWFRVUkUpXFxuXCIgK1xuXCIgICAgICAgICAgICBmcG9zaXRpb24gPSB2cG9zaXRpb25fd29ybGQ7XFxuXCIgK1xuXCIgICAgICAgICNlbmRpZlxcblwiICtcblwiXFxuXCIgK1xuXCIgICAgICAgIGlmICh2cG9zaXRpb25fd29ybGQueiA+IDEuMCkge1xcblwiICtcblwiICAgICAgICAgICAgLy8gdnBvc2l0aW9uLnggKz0gc2luKHZwb3NpdGlvbl93b3JsZC56ICsgdGltZSkgKiAxMC4wICogc2luKHBvc2l0aW9uLngpOyAvLyBzd2F5aW5nIGJ1aWxkaW5nc1xcblwiICtcblwiICAgICAgICAgICAgLy8gdnBvc2l0aW9uLnkgKz0gY29zKHZwb3NpdGlvbl93b3JsZC56ICsgdGltZSkgKiAxMC4wO1xcblwiICtcblwiXFxuXCIgK1xuXCIgICAgICAgICAgICAjaWYgZGVmaW5lZChBTklNQVRJT05fRUxFVkFUT1IpXFxuXCIgK1xuXCIgICAgICAgICAgICAgICAgLy8gdnBvc2l0aW9uLnogKj0gKHNpbih2cG9zaXRpb25fd29ybGQueiAvIDI1LjAgKiB0aW1lKSArIDEuMCkgLyAyLjAgKyAwLjE7IC8vIGV2ZWxhdG9yIGJ1aWxkaW5nc1xcblwiICtcblwiICAgICAgICAgICAgICAgIHZwb3NpdGlvbi56ICo9IG1heCgoc2luKHZwb3NpdGlvbl93b3JsZC56ICsgdGltZSkgKyAxLjApIC8gMi4wLCAwLjA1KTsgLy8gZXZlbGF0b3IgYnVpbGRpbmdzXFxuXCIgK1xuXCIgICAgICAgICAgICAjZWxpZiBkZWZpbmVkKEFOSU1BVElPTl9XQVZFKVxcblwiICtcblwiICAgICAgICAgICAgICAgIHZwb3NpdGlvbi56ICo9IG1heCgoc2luKHZwb3NpdGlvbl93b3JsZC54IC8gMTAwLjAgKyB0aW1lKSArIDEuMCkgLyAyLjAsIDAuMDUpOyAvLyB3YXZlXFxuXCIgK1xuXCIgICAgICAgICAgICAjZW5kaWZcXG5cIiArXG5cIiAgICAgICAgfVxcblwiICtcblwiICAgICNlbmRpZlxcblwiICtcblwiXFxuXCIgK1xuXCIgICAgLy8gTk9URTogZHVlIHRvIHVucmVzb2x2ZWQgZmxvYXRpbmcgcG9pbnQgcHJlY2lzaW9uIGlzc3VlcywgdGlsZSBhbmQgbWFwIGNlbnRlciBhZGp1c3RtZW50IG5lZWQgdG8gaGFwcGVuIGluIE9ORSBvcGVyYXRpb24sIG9yIGFydGlmY2F0cyBhcmUgaW50cm9kdWNlZFxcblwiICtcblwiICAgIHZwb3NpdGlvbi54eSArPSB0aWxlX21pbi54eSAtIG1hcF9jZW50ZXI7IC8vIGFkanVzdCBmb3IgY29ybmVyIG9mIHRpbGUgcmVsYXRpdmUgdG8gbWFwIGNlbnRlclxcblwiICtcblwiICAgIHZwb3NpdGlvbi54eSAvPSBtZXRlcl96b29tOyAvLyBhZGp1c3QgZm9yIHpvb20gaW4gbWV0ZXJzIHRvIGdldCBjbGlwIHNwYWNlIGNvb3Jkc1xcblwiICtcblwiXFxuXCIgK1xuXCIgICAgLy8gU2hhZGluZ1xcblwiICtcblwiICAgIGZjb2xvciA9IGNvbG9yO1xcblwiICtcblwiICAgIC8vIGlmIChjb2xvclswXSA9PSAwLjUpIHtcXG5cIiArXG5cIiAgICAvLyAgICAgZmNvbG9yID0gdGVzdFVuaWZvcm1Db2xvcjE7XFxuXCIgK1xuXCIgICAgLy8gfSBcXG5cIiArXG5cIiAgICAvLyBpZiAoY29sb3JbMF0gPT0gMC42KSB7XFxuXCIgK1xuXCIgICAgLy8gICAgIGZjb2xvciA9IHRlc3RVbmlmb3JtQ29sb3IyO1xcblwiICtcblwiICAgIC8vIH0gXFxuXCIgK1xuXCIgICAgaWYgKGxheWVyID09IDAuMCkge1xcblwiICtcblwiICAgICAgICBmY29sb3IgPSB0ZXN0VW5pZm9ybUNvbG9yMDtcXG5cIiArXG5cIiAgICB9IFxcblwiICtcblwiICAgIGlmIChsYXllciA9PSAxLjApIHtcXG5cIiArXG5cIiAgICAgICAgZmNvbG9yID0gdGVzdFVuaWZvcm1Db2xvcjE7XFxuXCIgK1xuXCIgICAgfSBcXG5cIiArXG5cIiAgICBpZiAobGF5ZXIgPT0gMi4wKSB7XFxuXCIgK1xuXCIgICAgICAgIGZjb2xvciA9IHRlc3RVbmlmb3JtQ29sb3IyO1xcblwiICtcblwiICAgIH0gXFxuXCIgK1xuXCIgICAgaWYgKGxheWVyID09IDMuMCkge1xcblwiICtcblwiICAgICAgICBmY29sb3IgPSB0ZXN0VW5pZm9ybUNvbG9yMztcXG5cIiArXG5cIiAgICB9IFxcblwiICtcblwiICAgIGlmIChsYXllciA9PSA0LjApIHtcXG5cIiArXG5cIiAgICAgICAgZmNvbG9yID0gdGVzdFVuaWZvcm1Db2xvcjQ7XFxuXCIgK1xuXCIgICAgfSBcXG5cIiArXG5cIiAgICBpZiAobGF5ZXIgPT0gNS4wKSB7XFxuXCIgK1xuXCIgICAgICAgIGZjb2xvciA9IHRlc3RVbmlmb3JtQ29sb3I1O1xcblwiICtcblwiICAgIH0gXFxuXCIgK1xuXCIgICAgaWYgKGxheWVyID09IDYuMCkge1xcblwiICtcblwiICAgICAgICBmY29sb3IgPSB0ZXN0VW5pZm9ybUNvbG9yNjtcXG5cIiArXG5cIiAgICB9IFxcblwiICtcblwiICAgIGlmIChsYXllciA9PSA3LjApIHtcXG5cIiArXG5cIiAgICAgICAgZmNvbG9yID0gdGVzdFVuaWZvcm1Db2xvcjc7XFxuXCIgK1xuXCIgICAgfSBcXG5cIiArXG5cIiAgICBpZiAobGF5ZXIgPT0gOC4wKSB7XFxuXCIgK1xuXCIgICAgICAgIGZjb2xvciA9IHRlc3RVbmlmb3JtQ29sb3I4O1xcblwiICtcblwiICAgIH0gXFxuXCIgK1xuXCIgICAgaWYgKGxheWVyID09IDkuMCkge1xcblwiICtcblwiICAgICAgICBmY29sb3IgPSB0ZXN0VW5pZm9ybUNvbG9yOTtcXG5cIiArXG5cIiAgICB9IFxcblwiICtcblwiICAgIC8vIGlmIChsYXllciA9PSB1X2xheWVyVmFyKSB7XFxuXCIgK1xuXCIgICAgLy8gICAgIGZjb2xvciA9IHRlc3RVbmlmb3JtQ29sb3IxO1xcblwiICtcblwiICAgIC8vIH0gXFxuXCIgK1xuXCJcXG5cIiArXG5cIiAgICAvLyBmY29sb3IgKz0gdmVjMyhzaW4ocG9zaXRpb24ueiArIHRpbWUpLCAwLjAsIDAuMCk7IC8vIGNvbG9yIGNoYW5nZSBvbiBoZWlnaHQgKyB0aW1lXFxuXCIgK1xuXCIgICAgLy8gZmNvbG9yICs9IHZlYzMocG9zaXRpb24ueikgKiB2ZWMzKHRlc3RVbmlmb3JtKTsgLy8gY29sb3IgY2hhbmdlIG9uIGhlaWdodCArIHRpbWVcXG5cIiArXG5cIlxcblwiICtcblwiICAgIGZsb2F0IGhlaWdodF9tdWx0aXBsaWVyID0gdV9saWdodEhlaWdodCAqIDAuMDE7XFxuXCIgK1xuXCIgICAgZmxvYXQgaGVpZ2h0X2ZhY3RvciA9IGNsYW1wKHZwb3NpdGlvbi56ICogaGVpZ2h0X211bHRpcGxpZXIsIDAuMCwgdV9oZWlnaHRMaW1pdCk7XFxuXCIgK1xuXCJcXG5cIiArXG5cIiAgICAjaWYgZGVmaW5lZChMSUdIVElOR19QT0lOVCkgfHwgZGVmaW5lZChMSUdIVElOR19OSUdIVClcXG5cIiArXG5cIiAgICAgICAgLy8gR291cmF1ZCBzaGFkaW5nXFxuXCIgK1xuXCIgICAgICAgIC8vIGxpZ2h0ID0gdmVjMygtMC4yNSwgLTAuMjUsIDAuNTApOyAvLyB2ZWMzKDAuMSwgMC4xLCAwLjM1KTsgLy8gcG9pbnQgbGlnaHQgbG9jYXRpb25cXG5cIiArXG5cIlxcblwiICtcblwiICAgICAgICAvLyByZXZlcnNlIGF6aW11dGggcm90YXRpb24gZGlyZWN0aW9uLCByb3RhdGUgc28gMCA9PSBub3J0aCwgYW5kIGNvbnZlcnQgdG8gcmFpZGFuc1xcblwiICtcblwiICAgICAgICBmbG9hdCBhemltdXRoID0gKCgzNjAuMCAtIHVfbGlnaHRBemltdXRoICsgOTAuMCkgKiAzLjE0MTU5KSAvIDE4MC4wO1xcblwiICtcblwiICAgICAgICAvLyBjb252ZXJ0IGVsZXZhdGlvbiByYW5nZSBmcm9tIDAuLjEgdG8gcGkvMi4uMCBha2EgaG9yaXpvbiB0byBzdHJhaWdodCBvdmVyaGVhZFxcblwiICtcblwiICAgICAgICBmbG9hdCBlbGV2YXRpb24gPSAoMS4wIC0gdV9saWdodEVsZXZhdGlvbikgKiAoMy4xNDE1OSAvIDIuMCk7XFxuXCIgK1xuXCIgICAgICAgIC8vIGxpZ2h0ID0gc3BoZXJpY2FsVG9DYXJ0ZXNpYW4oYXppbXV0aCwgZWxldmF0aW9uLCB1X2xpZ2h0UmFkaXVzKTtcXG5cIiArXG5cIiAgICAgICAgLy8gZml4IGxpZ2h0IHNwaGVyZSByYWRpdXMgc28gbGlnaHQgaXMgYWx3YXlzIG9mZnNjcmVlblxcblwiICtcblwiICAgICAgICBsaWdodCA9IHNwaGVyaWNhbFRvQ2FydGVzaWFuKGF6aW11dGgsIGVsZXZhdGlvbiwgMTAuMCk7XFxuXCIgK1xuXCJcXG5cIiArXG5cIiAgICAgICAgI2lmIGRlZmluZWQoTElHSFRJTkdfTklHSFQpXFxuXCIgK1xuXCIgICAgICAgICAgICAvLyBcXFwiTmlnaHRcXFwiIGVmZmVjdCBieSBmbGlwcGluZyB2ZXJ0ZXggelxcblwiICtcblwiICAgICAgICAgICAgbGlnaHQgPSBub3JtYWxpemUodmVjMyh2cG9zaXRpb24ueCwgdnBvc2l0aW9uLnksIHZwb3NpdGlvbi56KSAtIGxpZ2h0KTsgLy8gbGlnaHQgYW5nbGUgZnJvbSBsaWdodCBwb2ludCB0byB2ZXJ0ZXhcXG5cIiArXG5cIiAgICAgICAgICAgIGZjb2xvciAqPSBkb3Qodm5vcm1hbCwgbGlnaHQgKiAtMS4wKTsgLy8gKyBhbWJpZW50ICsgY2xhbXAodnBvc2l0aW9uLnogKiAyLjAgLyBtZXRlcl96b29tLngsIDAuMCwgMC4yNSk7XFxuXCIgK1xuXCIgICAgICAgICAgICAvLyBmY29sb3IgKj0gZG90KHZub3JtYWwsIGxpZ2h0IC0gdV9saWdodEFtYmllbnQgKiAtMS4wKTsgLy8gKyBhbWJpZW50ICsgY2xhbXAodnBvc2l0aW9uLnogKiAyLjAgLyBtZXRlcl96b29tLngsIDAuMCwgMC4yNSk7XFxuXCIgK1xuXCIgICAgICAgICNlbHNlXFxuXCIgK1xuXCIgICAgICAgICAgICAvLyBQb2ludCBsaWdodC1iYXNlZCBncmFkaWVudFxcblwiICtcblwiICAgICAgICAgICAgbGlnaHQgPSBub3JtYWxpemUodmVjMyh2cG9zaXRpb24ueCwgdnBvc2l0aW9uLnksIC12cG9zaXRpb24ueikgLSBsaWdodCk7IC8vIGxpZ2h0IGFuZ2xlIGZyb20gbGlnaHQgcG9pbnQgdG8gdmVydGV4XFxuXCIgK1xuXCIgICAgICAgICAgICAvLyBmY29sb3IgKj0gZG90KHZub3JtYWwsIGxpZ2h0ICogLTEuMCkgKyBhbWJpZW50ICsgY2xhbXAodnBvc2l0aW9uLnogKiB0ZXN0VW5pZm9ybSAvIG1ldGVyX3pvb20ueCwgMC4wLCAwLjI1KTtcXG5cIiArXG5cIiAgICAgICAgICAgIGZjb2xvciAqPSBkb3Qodm5vcm1hbCwgbGlnaHQgKiAtMS4wICogdV9saWdodEludGVuc2l0eSkgKyB1X2xpZ2h0QW1iaWVudCArIGhlaWdodF9mYWN0b3I7XFxuXCIgK1xuXCIgICAgICAgICNlbmRpZlxcblwiICtcblwiXFxuXCIgK1xuXCIgICAgI2VsaWYgZGVmaW5lZChMSUdIVElOR19ESVJFQ1RJT04pXFxuXCIgK1xuXCIgICAgICAgIC8vIEZsYXQgc2hhZGluZ1xcblwiICtcblwiICAgICAgICBsaWdodCA9IG5vcm1hbGl6ZSh2ZWMzKDAuMiwgMC43LCAtMC41KSk7XFxuXCIgK1xuXCIgICAgICAgIC8vIGZjb2xvciAqPSBtYXgoZG90KHZub3JtYWwsIGxpZ2h0ICogLTEuMCksIDAuMSkgKyBhbWJpZW50O1xcblwiICtcblwiICAgICAgICBmY29sb3IgKj0gZG90KHZub3JtYWwsIGxpZ2h0ICogLTEuMCkgKyB1X2xpZ2h0QW1iaWVudCArIChoZWlnaHRfZmFjdG9yKTtcXG5cIiArXG5cIiAgICAjZW5kaWZcXG5cIiArXG5cIlxcblwiICtcblwiICAgICNpZiBkZWZpbmVkKFBST0pFQ1RJT05fUEVSU1BFQ1RJVkUpXFxuXCIgK1xuXCIgICAgICAgIC8vIC8vIFBlcnNwZWN0aXZlLXN0eWxlIHByb2plY3Rpb25cXG5cIiArXG5cIiAgICAgICAgdmVjMiBwZXJzcGVjdGl2ZV9vZmZzZXQgPSB2ZWMyKC0wLjUsIC0wLjUpO1xcblwiICtcblwiICAgICAgICAvLyB2ZWMyIHBlcnNwZWN0aXZlX29mZnNldCA9IHZlYzIoMC4wLDAuMCk7XFxuXCIgK1xuXCIgICAgICAgIC8vIHZlYzIgcGVyc3BlY3RpdmVfb2Zmc2V0ID0gdmVjMigtMC4yNSwgLTAuMjUpICsgdmVjMih0ZXN0VW5pZm9ybSk7XFxuXCIgK1xuXCIgICAgICAgIC8vIHZlYzIgcGVyc3BlY3RpdmVfZmFjdG9yID0gdmVjMigwLjgsIDAuOCk7IC8vIHZlYzIoLTAuMjUsIDAuNzUpO1xcblwiICtcblwiICAgICAgICB2ZWMyIHBlcnNwZWN0aXZlX2ZhY3RvciA9IHZlYzIoMC44LCAwLjgpICogdmVjMih1X2hlaWdodFZhcik7IC8vIHZlYzIoLTAuMjUsIDAuNzUpO1xcblwiICtcblwiICAgICAgICB2cG9zaXRpb24ueHkgKz0gdnBvc2l0aW9uLnogKiBwZXJzcGVjdGl2ZV9mYWN0b3IgKiAodnBvc2l0aW9uLnh5IC0gcGVyc3BlY3RpdmVfb2Zmc2V0KSAvIG1ldGVyX3pvb20ueHk7IC8vIHBlcnNwZWN0aXZlIGZyb20gb2Zmc2V0IGNlbnRlciBzY3JlZW5cXG5cIiArXG5cIiAgICAgICAgLy8gdnBvc2l0aW9uLnh5ICs9IHZlYzIodnBvc2l0aW9uLnogKiB0ZXN0VW5pZm9ybS8xMDAwLjApO1xcblwiICtcblwiICAgICNlbGlmIGRlZmluZWQoUFJPSkVDVElPTl9JU09NRVRSSUMpIHx8IGRlZmluZWQoUFJPSkVDVElPTl9QT1BVUClcXG5cIiArXG5cIiAgICAgICAgLy8gUG9wLXVwIGVmZmVjdCAtIDNkIGluIGNlbnRlciBvZiB2aWV3cG9ydCwgZmFkaW5nIHRvIDJkIGF0IGVkZ2VzXFxuXCIgK1xuXCIgICAgICAgICNpZiBkZWZpbmVkKFBST0pFQ1RJT05fUE9QVVApXFxuXCIgK1xuXCIgICAgICAgICAgICBpZiAodnBvc2l0aW9uLnogPiAxLjApIHtcXG5cIiArXG5cIiAgICAgICAgICAgICAgICBmbG9hdCBjZCA9IGRpc3RhbmNlKHZwb3NpdGlvbi54eSAqIChyZXNvbHV0aW9uLnh5IC8gcmVzb2x1dGlvbi55eSksIHZlYzIoMC4wLCAwLjApKTtcXG5cIiArXG5cIiAgICAgICAgICAgICAgICBjb25zdCBmbG9hdCBwb3B1cF9mYWRlX2lubmVyID0gMC4wNTtcXG5cIiArXG5cIiAgICAgICAgICAgICAgICBjb25zdCBmbG9hdCBwb3B1cF9mYWRlX291dGVyID0gMC43NTtcXG5cIiArXG5cIiAgICAgICAgICAgICAgICBpZiAoY2QgPiBwb3B1cF9mYWRlX2lubmVyKSB7XFxuXCIgK1xuXCIgICAgICAgICAgICAgICAgICAgIHZwb3NpdGlvbi56ICo9IDEuMCAtIHNtb290aHN0ZXAocG9wdXBfZmFkZV9pbm5lciwgcG9wdXBfZmFkZV9vdXRlciwgY2QpO1xcblwiICtcblwiICAgICAgICAgICAgICAgIH1cXG5cIiArXG5cIiAgICAgICAgICAgICAgICBjb25zdCBmbG9hdCB6b29tX2Jvb3N0X3N0YXJ0ID0gMTUuMDtcXG5cIiArXG5cIiAgICAgICAgICAgICAgICBjb25zdCBmbG9hdCB6b29tX2Jvb3N0X2VuZCA9IDE3LjA7XFxuXCIgK1xuXCIgICAgICAgICAgICAgICAgY29uc3QgZmxvYXQgem9vbV9ib29zdF9tYWduaXR1ZGUgPSAwLjc1O1xcblwiICtcblwiICAgICAgICAgICAgICAgIHZwb3NpdGlvbi56ICo9IDEuMCArICgxLjAgLSBzbW9vdGhzdGVwKHpvb21fYm9vc3Rfc3RhcnQsIHpvb21fYm9vc3RfZW5kLCBtYXBfem9vbSkpICogem9vbV9ib29zdF9tYWduaXR1ZGU7XFxuXCIgK1xuXCIgICAgICAgICAgICB9XFxuXCIgK1xuXCIgICAgICAgICNlbmRpZlxcblwiICtcblwiXFxuXCIgK1xuXCIgICAgICAgIC8vIElzb21ldHJpYy1zdHlsZSBwcm9qZWN0aW9uXFxuXCIgK1xuXCIgICAgICAgIHZwb3NpdGlvbi55ICs9IHZwb3NpdGlvbi56ICogdV9oZWlnaHRWYXIgLyBtZXRlcl96b29tLnk7IC8vIHogY29vcmRpbmF0ZSBpcyBhIHNpbXBsZSB0cmFuc2xhdGlvbiB1cCBhbG9uZyB5IGF4aXMsIGFsYSBpc29tZXRyaWNcXG5cIiArXG5cIiAgICAgICAgLy8gdnBvc2l0aW9uLnkgKz0gdnBvc2l0aW9uLnogKiAwLjU7IC8vIGNsb3NlciB0byBVbHRpbWEgNy1zdHlsZSBheG9ub21ldHJpY1xcblwiICtcblwiICAgICAgICAvLyB2cG9zaXRpb24ueCAtPSB2cG9zaXRpb24ueiAqIDAuNTtcXG5cIiArXG5cIiAgICAjZW5kaWZcXG5cIiArXG5cIlxcblwiICtcblwiICAgIC8vIFJvdGF0aW9uIHRlc3RcXG5cIiArXG5cIiAgICAvLyBmbG9hdCB0aGV0YSA9IDA7XFxuXCIgK1xuXCIgICAgLy8gY29uc3QgZmxvYXQgcGkgPSAzLjE0MTU5MjY7XFxuXCIgK1xuXCIgICAgLy8gdmVjMiBwcjtcXG5cIiArXG5cIiAgICAvLyBwci54ID0gdnBvc2l0aW9uLnggKiBjb3ModGhldGEgKiBwaSAvIDE4MC4wKSArIHZwb3NpdGlvbi55ICogLXNpbih0aGV0YSAqIHBpIC8gMTgwLjApO1xcblwiICtcblwiICAgIC8vIHByLnkgPSB2cG9zaXRpb24ueCAqIHNpbih0aGV0YSAqIHBpIC8gMTgwLjApICsgdnBvc2l0aW9uLnkgKiBjb3ModGhldGEgKiBwaSAvIDE4MC4wKTtcXG5cIiArXG5cIiAgICAvLyB2cG9zaXRpb24ueHkgPSBwcjtcXG5cIiArXG5cIlxcblwiICtcblwiICAgIC8vIHZwb3NpdGlvbi55ICo9IG1heChhYnMoc2luKHZwb3NpdGlvbi54KSksIDAuMSk7IC8vIGhvdXJnbGFzcyBlZmZlY3RcXG5cIiArXG5cIiAgICAvLyB2cG9zaXRpb24ueSAqPSBhYnMobWF4KHNpbih2cG9zaXRpb24ueCksIDAuMSkpOyAvLyBmdW5uZWwgZWZmZWN0XFxuXCIgK1xuXCJcXG5cIiArXG5cIiAgICAvLyBSZXZlcnNlIGFuZCBzY2FsZSB0byAwLTEgZm9yIEdMIGRlcHRoIGJ1ZmZlclxcblwiICtcblwiICAgIC8vIExheWVycyBhcmUgZm9yY2Utb3JkZXJlZCAoaGlnaGVyIGxheWVycyBndWFyYW50ZWVkIHRvIHJlbmRlciBvbiB0b3Agb2YgbG93ZXIpLCB0aGVuIGJ5IGhlaWdodC9kZXB0aFxcblwiICtcblwiICAgIGZsb2F0IHpfbGF5ZXJfc2NhbGUgPSA0MDk2LjtcXG5cIiArXG5cIiAgICBmbG9hdCB6X2xheWVyX3JhbmdlID0gKG51bV9sYXllcnMgKyAxLikgKiB6X2xheWVyX3NjYWxlO1xcblwiICtcblwiICAgIGZsb2F0IHpfbGF5ZXIgPSAobGF5ZXIgKyAxLikgKiB6X2xheWVyX3NjYWxlO1xcblwiICtcblwiXFxuXCIgK1xuXCIgICAgdnBvc2l0aW9uLnogPSB6X2xheWVyICsgY2xhbXAodnBvc2l0aW9uLnosIDEuLCB6X2xheWVyX3NjYWxlKTtcXG5cIiArXG5cIiAgICB2cG9zaXRpb24ueiA9ICh6X2xheWVyX3JhbmdlIC0gdnBvc2l0aW9uLnopIC8gel9sYXllcl9yYW5nZTtcXG5cIiArXG5cIlxcblwiICtcblwiICAgIGdsX1Bvc2l0aW9uID0gdmVjNCh2cG9zaXRpb24sIDEuMCk7XFxuXCIgK1xuXCJ9XFxuXCIgK1xuXCJcIjtcblxuaWYgKG1vZHVsZS5leHBvcnRzICE9PSB1bmRlZmluZWQpIHsgbW9kdWxlLmV4cG9ydHMgPSBzaGFkZXJfc291cmNlczsgfVxuXG4iLCJ2YXIgVmVjdG9yUmVuZGVyZXIgPSByZXF1aXJlKCcuL3ZlY3Rvcl9yZW5kZXJlci5qcycpO1xuXG52YXIgTGVhZmxldExheWVyID0gTC5HcmlkTGF5ZXIuZXh0ZW5kKHtcblxuICAgIG9wdGlvbnM6IHtcbiAgICAgICAgdmVjdG9yUmVuZGVyZXI6ICdjYW52YXMnXG4gICAgfSxcblxuICAgIGluaXRpYWxpemU6IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIEwuc2V0T3B0aW9ucyh0aGlzLCBvcHRpb25zKTtcbiAgICAgICAgdGhpcy5vcHRpb25zLnZlY3RvclJlbmRlcmVyID0gdGhpcy5vcHRpb25zLnZlY3RvclJlbmRlcmVyIHx8ICdHTFJlbmRlcmVyJztcbiAgICAgICAgdGhpcy5fcmVuZGVyZXIgPSBWZWN0b3JSZW5kZXJlci5jcmVhdGUodGhpcy5vcHRpb25zLnZlY3RvclJlbmRlcmVyLCB0aGlzLm9wdGlvbnMudmVjdG9yVGlsZVNvdXJjZSwgdGhpcy5vcHRpb25zLnZlY3RvckxheWVycywgdGhpcy5vcHRpb25zLnZlY3RvclN0eWxlcywgeyBudW1fd29ya2VyczogdGhpcy5vcHRpb25zLm51bVdvcmtlcnMgfSk7XG4gICAgICAgIHRoaXMuX3JlbmRlcmVyLmRlYnVnID0gdGhpcy5vcHRpb25zLmRlYnVnO1xuICAgICAgICB0aGlzLl9yZW5kZXJlci5jb250aW51b3VzX2FuaW1hdGlvbiA9IGZhbHNlOyAvLyBzZXQgdG8gdHJ1ZSBmb3IgYW5pbWF0aW5vcywgZXRjLiAoZXZlbnR1YWxseSB3aWxsIGJlIGF1dG9tYXRlZClcbiAgICB9LFxuXG4gICAgLy8gRmluaXNoIGluaXRpYWxpemluZyByZW5kZXJlciBhbmQgc2V0dXAgZXZlbnRzIHdoZW4gbGF5ZXIgaXMgYWRkZWQgdG8gbWFwXG4gICAgb25BZGQ6IGZ1bmN0aW9uIChtYXApIHtcbiAgICAgICAgdmFyIGxheWVyID0gdGhpcztcblxuICAgICAgICBsYXllci5vbigndGlsZXVubG9hZCcsIGZ1bmN0aW9uIChldmVudCkge1xuICAgICAgICAgICAgdmFyIHRpbGUgPSBldmVudC50aWxlO1xuICAgICAgICAgICAgdmFyIGtleSA9IHRpbGUuZ2V0QXR0cmlidXRlKCdkYXRhLXRpbGUta2V5Jyk7XG4gICAgICAgICAgICBsYXllci5fcmVuZGVyZXIucmVtb3ZlVGlsZShrZXkpO1xuICAgICAgICB9KTtcblxuICAgICAgICBsYXllci5fbWFwLm9uKCdyZXNpemUnLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgc2l6ZSA9IGxheWVyLl9tYXAuZ2V0U2l6ZSgpO1xuICAgICAgICAgICAgbGF5ZXIuX3JlbmRlcmVyLnJlc2l6ZU1hcChzaXplLngsIHNpemUueSk7XG4gICAgICAgICAgICBsYXllci51cGRhdGVCb3VuZHMoKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgbGF5ZXIuX21hcC5vbignbW92ZScsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciBjZW50ZXIgPSBsYXllci5fbWFwLmdldENlbnRlcigpO1xuICAgICAgICAgICAgbGF5ZXIuX3JlbmRlcmVyLnNldENlbnRlcihjZW50ZXIubG5nLCBjZW50ZXIubGF0KTtcbiAgICAgICAgICAgIGxheWVyLnVwZGF0ZUJvdW5kcygpO1xuICAgICAgICB9KTtcblxuICAgICAgICBsYXllci5fbWFwLm9uKCd6b29tc3RhcnQnLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcIm1hcC56b29tc3RhcnQgXCIgKyBsYXllci5fbWFwLmdldFpvb20oKSk7XG4gICAgICAgICAgICBsYXllci5fcmVuZGVyZXIuc3RhcnRab29tKCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGxheWVyLl9tYXAub24oJ3pvb21lbmQnLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcIm1hcC56b29tZW5kIFwiICsgbGF5ZXIuX21hcC5nZXRab29tKCkpO1xuICAgICAgICAgICAgbGF5ZXIuX3JlbmRlcmVyLnNldFpvb20obGF5ZXIuX21hcC5nZXRab29tKCkpO1xuICAgICAgICB9KTtcblxuICAgICAgICAvLyBDYW52YXMgZWxlbWVudCB3aWxsIGJlIGluc2VydGVkIGFmdGVyIG1hcCBjb250YWluZXIgKGxlYWZsZXQgdHJhbnNmb3JtcyBzaG91bGRuJ3QgYmUgYXBwbGllZCB0byB0aGUgR0wgY2FudmFzKVxuICAgICAgICAvLyBUT0RPOiBmaW5kIGEgYmV0dGVyIHdheSB0byBkZWFsIHdpdGggdGhpcz8gcmlnaHQgbm93IEdMIG1hcCBvbmx5IHJlbmRlcnMgY29ycmVjdGx5IGFzIHRoZSBib3R0b20gbGF5ZXJcbiAgICAgICAgbGF5ZXIuX3JlbmRlcmVyLmNvbnRhaW5lciA9IGxheWVyLl9tYXAuZ2V0Q29udGFpbmVyKCk7XG5cbiAgICAgICAgdmFyIGNlbnRlciA9IGxheWVyLl9tYXAuZ2V0Q2VudGVyKCk7XG4gICAgICAgIGxheWVyLl9yZW5kZXJlci5zZXRDZW50ZXIoY2VudGVyLmxuZywgY2VudGVyLmxhdCk7XG4gICAgICAgIGxheWVyLl9yZW5kZXJlci5zZXRab29tKGxheWVyLl9tYXAuZ2V0Wm9vbSgpKTtcbiAgICAgICAgbGF5ZXIudXBkYXRlQm91bmRzKCk7XG5cbiAgICAgICAgTC5HcmlkTGF5ZXIucHJvdG90eXBlLm9uQWRkLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgIGxheWVyLl9yZW5kZXJlci5pbml0KCk7XG4gICAgfSxcblxuICAgIG9uUmVtb3ZlOiBmdW5jdGlvbiAobWFwKSB7XG4gICAgICAgIEwuR3JpZExheWVyLnByb3RvdHlwZS5vblJlbW92ZS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICAvLyBUT0RPOiByZW1vdmUgZXZlbnQgaGFuZGxlcnMsIGRlc3Ryb3kgbWFwXG4gICAgfSxcblxuICAgIGNyZWF0ZVRpbGU6IGZ1bmN0aW9uIChjb29yZHMsIGRvbmUpIHtcbiAgICAgICAgdmFyIGRpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICB0aGlzLl9yZW5kZXJlci5sb2FkVGlsZShjb29yZHMsIGRpdiwgZG9uZSk7XG4gICAgICAgIHJldHVybiBkaXY7XG4gICAgfSxcblxuICAgIHVwZGF0ZUJvdW5kczogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgbGF5ZXIgPSB0aGlzO1xuICAgICAgICB2YXIgYm91bmRzID0gbGF5ZXIuX21hcC5nZXRCb3VuZHMoKTtcbiAgICAgICAgbGF5ZXIuX3JlbmRlcmVyLnNldEJvdW5kcyhib3VuZHMuZ2V0U291dGhXZXN0KCksIGJvdW5kcy5nZXROb3J0aEVhc3QoKSk7XG4gICAgfSxcblxuICAgIHJlbmRlcjogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLl9yZW5kZXJlci5yZW5kZXIoKTtcbiAgICB9XG5cbn0pO1xuXG52YXIgbGVhZmxldExheWVyID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICByZXR1cm4gbmV3IExlYWZsZXRMYXllcihvcHRpb25zKTtcbn07XG5cbmlmIChtb2R1bGUgIT09IHVuZGVmaW5lZCkge1xuICAgIG1vZHVsZS5leHBvcnRzID0ge1xuICAgICAgICBMZWFmbGV0TGF5ZXI6IExlYWZsZXRMYXllcixcbiAgICAgICAgbGVhZmxldExheWVyOiBsZWFmbGV0TGF5ZXJcbiAgICB9O1xufVxuIiwiLy8gTW9kdWxlcyBhbmQgZGVwZW5kZW5jaWVzIHRvIGV4cG9zZSBpbiB0aGUgcHVibGljIFRhbmdyYW0gbW9kdWxlXG5cbi8vIFRoZSBsZWFmbGV0IGxheWVyIHBsdWdpbiBpcyBjdXJyZW50bHkgdGhlIHByaW1hcnkgbWVhbnMgb2YgdXNpbmcgdGhlIGxpYnJhcnlcbnZhciBMZWFmbGV0ID0gcmVxdWlyZSgnLi9sZWFmbGV0X2xheWVyLmpzJyk7XG5cbi8vIFJlbmRlcmVyIG1vZHVsZXMgbmVlZCB0byBiZSBleHBsaWNpdGx5IGluY2x1ZGVkIHNpbmNlIHRoZXkgYXJlIG5vdCBvdGhlcndpc2UgcmVmZXJlbmNlZFxucmVxdWlyZSgnLi9nbC9nbF9yZW5kZXJlci5qcycpO1xucmVxdWlyZSgnLi9jYW52YXMvY2FudmFzX3JlbmRlcmVyLmpzJyk7XG5cbi8vIEdMIGZ1bmN0aW9ucyBpbmNsdWRlZCBmb3IgZWFzaWVyIGRlYnVnZ2luZyAvIGRpcmVjdCBhY2Nlc3MgdG8gc2V0dGluZyBnbG9iYWwgZGVmaW5lcywgcmVsb2FkaW5nIHByb2dyYW1zLCBldGMuXG52YXIgR0wgPSByZXF1aXJlKCcuL2dsL2dsLmpzJyk7XG5cbmlmIChtb2R1bGUgIT09IHVuZGVmaW5lZCkge1xuICAgIG1vZHVsZS5leHBvcnRzID0ge1xuICAgICAgICBMZWFmbGV0TGF5ZXI6IExlYWZsZXQuTGVhZmxldExheWVyLFxuICAgICAgICBsZWFmbGV0TGF5ZXI6IExlYWZsZXQubGVhZmxldExheWVyLFxuICAgICAgICBHTDogR0xcbiAgICB9O1xufVxuIiwiLy8gUG9pbnRcbmZ1bmN0aW9uIFBvaW50ICh4LCB5KVxue1xuICAgIHJldHVybiB7IHg6IHgsIHk6IHkgfTtcbn1cblxuUG9pbnQuY29weSA9IGZ1bmN0aW9uIChwKVxue1xuICAgIGlmIChwID09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIHJldHVybiB7IHg6IHAueCwgeTogcC55IH07XG59O1xuXG5pZiAobW9kdWxlICE9PSB1bmRlZmluZWQpIHtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IFBvaW50O1xufVxuIiwiLyoqKiBTdHlsZSBoZWxwZXJzICoqKi9cblxudmFyIFN0eWxlID0ge307XG5cblN0eWxlLmNvbG9yID0ge1xuICAgIHBzZXVkb1JhbmRvbUdyYXlzY2FsZTogZnVuY3Rpb24gKGYpIHsgdmFyIGMgPSBNYXRoLm1heCgocGFyc2VJbnQoZi5pZCwgMTYpICUgMTAwKSAvIDEwMCwgMC40KTsgcmV0dXJuIFswLjcgKiBjLCAwLjcgKiBjLCAwLjcgKiBjXTsgfSwgLy8gcHNldWRvLXJhbmRvbSBncmF5c2NhbGUgYnkgZ2VvbWV0cnkgaWRcbiAgICBwc2V1ZG9SYW5kb21Db2xvcjogZnVuY3Rpb24gKGYpIHsgcmV0dXJuIFswLjcgKiAocGFyc2VJbnQoZi5pZCwgMTYpIC8gMTAwICUgMSksIDAuNyAqIChwYXJzZUludChmLmlkLCAxNikgLyAxMDAwMCAlIDEpLCAwLjcgKiAocGFyc2VJbnQoZi5pZCwgMTYpIC8gMTAwMDAwMCAlIDEpXTsgfSwgLy8gcHNldWRvLXJhbmRvbSBjb2xvciBieSBnZW9tZXRyeSBpZFxuICAgIHJhbmRvbUNvbG9yOiBmdW5jdGlvbiAoZikgeyByZXR1cm4gWzAuNyAqIE1hdGgucmFuZG9tKCksIDAuNyAqIE1hdGgucmFuZG9tKCksIDAuNyAqIE1hdGgucmFuZG9tKCldOyB9IC8vIHJhbmRvbSBjb2xvclxufTtcblxuU3R5bGUud2lkdGggPSB7XG4gICAgcGl4ZWxzOiBmdW5jdGlvbiAocCkgeyByZXR1cm4gZnVuY3Rpb24gKGYsIHQpIHsgcmV0dXJuICh0eXBlb2YgcCA9PSAnZnVuY3Rpb24nID8gcChmLCB0KSA6IHApICogdC51bml0c19wZXJfcGl4ZWw7IH07IH0sIC8vIGxvY2FsIHRpbGUgdW5pdHMgZm9yIGEgZ2l2ZW4gcGl4ZWwgd2lkdGhcbiAgICBtZXRlcnM6IGZ1bmN0aW9uIChwKSB7IHJldHVybiBmdW5jdGlvbiAoZiwgdCkgeyByZXR1cm4gKHR5cGVvZiBwID09ICdmdW5jdGlvbicgPyBwKGYsIHQpIDogcCkgKiB0LnVuaXRzX3Blcl9tZXRlcjsgfTsgfSAgLy8gbG9jYWwgdGlsZSB1bml0cyBmb3IgYSBnaXZlbiBtZXRlciB3aWR0aFxufTtcblxuaWYgKG1vZHVsZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSBTdHlsZTtcbn1cbiIsIi8qKiogVmVjdG9yIGZ1bmN0aW9ucyAtIHZlY3RvcnMgcHJvdmlkZWQgYXMgW3gsIHksIHpdIGFycmF5cyAqKiovXG5cbnZhciBWZWN0b3IgPSB7fTtcblxuLy8gVmVjdG9yIGxlbmd0aCBzcXVhcmVkXG5WZWN0b3IubGVuZ3RoU3EgPSBmdW5jdGlvbiAodilcbntcbiAgICBpZiAodi5sZW5ndGggPT0gMikge1xuICAgICAgICByZXR1cm4gKHZbMF0qdlswXSArIHZbMV0qdlsxXSk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICByZXR1cm4gKHZbMF0qdlswXSArIHZbMV0qdlsxXSArIHZbMl0qdlsyXSk7XG4gICAgfVxufTtcblxuLy8gVmVjdG9yIGxlbmd0aFxuVmVjdG9yLmxlbmd0aCA9IGZ1bmN0aW9uICh2KVxue1xuICAgIHJldHVybiBNYXRoLnNxcnQoVmVjdG9yLmxlbmd0aFNxKHYpKTtcbn07XG5cbi8vIE5vcm1hbGl6ZSBhIHZlY3RvclxuVmVjdG9yLm5vcm1hbGl6ZSA9IGZ1bmN0aW9uICh2KVxue1xuICAgIHZhciBkO1xuICAgIGlmICh2Lmxlbmd0aCA9PSAyKSB7XG4gICAgICAgIGQgPSB2WzBdKnZbMF0gKyB2WzFdKnZbMV07XG4gICAgICAgIGQgPSBNYXRoLnNxcnQoZCk7XG5cbiAgICAgICAgaWYgKGQgIT0gMCkge1xuICAgICAgICAgICAgcmV0dXJuIFt2WzBdIC8gZCwgdlsxXSAvIGRdO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBbMCwgMF07XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICB2YXIgZCA9IHZbMF0qdlswXSArIHZbMV0qdlsxXSArIHZbMl0qdlsyXTtcbiAgICAgICAgZCA9IE1hdGguc3FydChkKTtcblxuICAgICAgICBpZiAoZCAhPSAwKSB7XG4gICAgICAgICAgICByZXR1cm4gW3ZbMF0gLyBkLCB2WzFdIC8gZCwgdlsyXSAvIGRdO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBbMCwgMCwgMF07XG4gICAgfVxufTtcblxuLy8gQ3Jvc3MgcHJvZHVjdCBvZiB0d28gdmVjdG9yc1xuVmVjdG9yLmNyb3NzICA9IGZ1bmN0aW9uICh2MSwgdjIpXG57XG4gICAgcmV0dXJuIFtcbiAgICAgICAgKHYxWzFdICogdjJbMl0pIC0gKHYxWzJdICogdjJbMV0pLFxuICAgICAgICAodjFbMl0gKiB2MlswXSkgLSAodjFbMF0gKiB2MlsyXSksXG4gICAgICAgICh2MVswXSAqIHYyWzFdKSAtICh2MVsxXSAqIHYyWzBdKVxuICAgIF07XG59O1xuXG4vLyBGaW5kIHRoZSBpbnRlcnNlY3Rpb24gb2YgdHdvIGxpbmVzIHNwZWNpZmllZCBhcyBzZWdtZW50cyBmcm9tIHBvaW50cyAocDEsIHAyKSBhbmQgKHAzLCBwNClcbi8vIGh0dHA6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvTGluZS1saW5lX2ludGVyc2VjdGlvblxuLy8gaHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9DcmFtZXInc19ydWxlXG5WZWN0b3IubGluZUludGVyc2VjdGlvbiA9IGZ1bmN0aW9uIChwMSwgcDIsIHAzLCBwNCwgcGFyYWxsZWxfdG9sZXJhbmNlKVxue1xuICAgIHZhciBwYXJhbGxlbF90b2xlcmFuY2UgPSBwYXJhbGxlbF90b2xlcmFuY2UgfHwgMC4wMTtcblxuICAgIC8vIGExKnggKyBiMSp5ID0gYzEgZm9yIGxpbmUgKHgxLCB5MSkgdG8gKHgyLCB5MilcbiAgICAvLyBhMip4ICsgYjIqeSA9IGMyIGZvciBsaW5lICh4MywgeTMpIHRvICh4NCwgeTQpXG4gICAgdmFyIGExID0gcDFbMV0gLSBwMlsxXTsgLy8geTEgLSB5MlxuICAgIHZhciBiMSA9IHAxWzBdIC0gcDJbMF07IC8vIHgxIC0geDJcbiAgICB2YXIgYTIgPSBwM1sxXSAtIHA0WzFdOyAvLyB5MyAtIHk0XG4gICAgdmFyIGIyID0gcDNbMF0gLSBwNFswXTsgLy8geDMgLSB4NFxuICAgIHZhciBjMSA9IChwMVswXSAqIHAyWzFdKSAtIChwMVsxXSAqIHAyWzBdKTsgLy8geDEqeTIgLSB5MSp4MlxuICAgIHZhciBjMiA9IChwM1swXSAqIHA0WzFdKSAtIChwM1sxXSAqIHA0WzBdKTsgLy8geDMqeTQgLSB5Myp4NFxuICAgIHZhciBkZW5vbSA9IChiMSAqIGEyKSAtIChhMSAqIGIyKTtcblxuICAgIGlmIChNYXRoLmFicyhkZW5vbSkgPiBwYXJhbGxlbF90b2xlcmFuY2UpIHtcbiAgICAgICAgcmV0dXJuIFtcbiAgICAgICAgICAgICgoYzEgKiBiMikgLSAoYjEgKiBjMikpIC8gZGVub20sXG4gICAgICAgICAgICAoKGMxICogYTIpIC0gKGExICogYzIpKSAvIGRlbm9tXG4gICAgICAgIF07XG4gICAgfVxuICAgIHJldHVybiBudWxsOyAvLyByZXR1cm4gbnVsbCBpZiBsaW5lcyBhcmUgKGNsb3NlIHRvKSBwYXJhbGxlbFxufTtcblxuaWYgKG1vZHVsZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSBWZWN0b3I7XG59XG4iLCJ2YXIgUG9pbnQgPSByZXF1aXJlKCcuL3BvaW50LmpzJyk7XG52YXIgR2VvID0gcmVxdWlyZSgnLi9nZW8uanMnKTtcbnZhciBTdHlsZSA9IHJlcXVpcmUoJy4vc3R5bGUuanMnKTtcblxuLy8gR2V0IGJhc2UgVVJMIGZyb20gd2hpY2ggdGhlIGxpYnJhcnkgd2FzIGxvYWRlZFxuLy8gVXNlZCB0byBsb2FkIGFkZGl0aW9uYWwgcmVzb3VyY2VzIGxpa2Ugc2hhZGVycywgdGV4dHVyZXMsIGV0Yy4gaW4gY2FzZXMgd2hlcmUgbGlicmFyeSB3YXMgbG9hZGVkIGZyb20gYSByZWxhdGl2ZSBwYXRoXG4oZnVuY3Rpb24oKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgVmVjdG9yUmVuZGVyZXIubGlicmFyeV9iYXNlX3VybCA9ICcnO1xuICAgICAgICB2YXIgc2NyaXB0cyA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdzY3JpcHQnKTsgLy8gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnc2NyaXB0W3NyYyo9XCIuanNcIl0nKTtcbiAgICAgICAgZm9yICh2YXIgcz0wOyBzIDwgc2NyaXB0cy5sZW5ndGg7IHMrKykge1xuICAgICAgICAgICAgLy8gdmFyIGJhc2VfbWF0Y2ggPSBzY3JpcHRzW3NdLnNyYy5tYXRjaCgvKC4qKXZlY3Rvci1tYXAuKGRlYnVnfG1pbikuanMvKTsgLy8gc2hvdWxkIG1hdGNoIGRlYnVnIG9yIG1pbmlmaWVkIHZlcnNpb25zXG4gICAgICAgICAgICAvLyBpZiAoYmFzZV9tYXRjaCAhPSBudWxsICYmIGJhc2VfbWF0Y2gubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgLy8gICAgIFZlY3RvclJlbmRlcmVyLmxpYnJhcnlfYmFzZV91cmwgPSBiYXNlX21hdGNoWzFdO1xuICAgICAgICAgICAgLy8gICAgIGJyZWFrO1xuICAgICAgICAgICAgLy8gfVxuICAgICAgICAgICAgdmFyIG1hdGNoID0gc2NyaXB0c1tzXS5zcmMuaW5kZXhPZigndmVjdG9yLW1hcC5kZWJ1Zy5qcycpO1xuICAgICAgICAgICAgaWYgKG1hdGNoID09IC0xKSB7XG4gICAgICAgICAgICAgICAgbWF0Y2ggPSBzY3JpcHRzW3NdLnNyYy5pbmRleE9mKCd2ZWN0b3ItbWFwLm1pbi5qcycpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKG1hdGNoID49IDApIHtcbiAgICAgICAgICAgICAgICBWZWN0b3JSZW5kZXJlci5saWJyYXJ5X2Jhc2VfdXJsID0gc2NyaXB0c1tzXS5zcmMuc3Vic3RyKDAsIG1hdGNoKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICBjYXRjaCAoZSkge1xuICAgICAgICAvLyBza2lwIGluIHdlYiB3b3JrZXJcbiAgICB9XG59KCkpO1xuXG5WZWN0b3JSZW5kZXJlci50aWxlX3NjYWxlID0gNDA5NjsgLy8gY29vcmRpbmF0ZXMgYXJlIGxvY2FsbHkgc2NhbGVkIHRvIHRoZSByYW5nZSBbMCwgdGlsZV9zY2FsZV1cblZlY3RvclJlbmRlcmVyLnVuaXRzX3Blcl9tZXRlciA9IFtdO1xuVmVjdG9yUmVuZGVyZXIudW5pdHNfcGVyX3BpeGVsID0gW107XG4oZnVuY3Rpb24oKSB7XG4gICAgZm9yICh2YXIgej0wOyB6IDw9IEdlby5tYXhfem9vbTsgeisrKSB7XG4gICAgICAgIFZlY3RvclJlbmRlcmVyLnVuaXRzX3Blcl9tZXRlclt6XSA9IFZlY3RvclJlbmRlcmVyLnRpbGVfc2NhbGUgLyAoR2VvLnRpbGVfc2l6ZSAqIEdlby5tZXRlcnNfcGVyX3BpeGVsW3pdKTtcbiAgICAgICAgVmVjdG9yUmVuZGVyZXIudW5pdHNfcGVyX3BpeGVsW3pdID0gVmVjdG9yUmVuZGVyZXIudGlsZV9zY2FsZSAvIEdlby50aWxlX3NpemU7XG4gICAgfVxufSgpKTtcblxuLy8gTGF5ZXJzICYgc3R5bGVzOiBwYXNzIGFuIG9iamVjdCBkaXJlY3RseSwgb3IgYSBVUkwgYXMgc3RyaW5nIHRvIGxvYWQgcmVtb3RlbHlcbmZ1bmN0aW9uIFZlY3RvclJlbmRlcmVyICh0eXBlLCB0aWxlX3NvdXJjZSwgbGF5ZXJzLCBzdHlsZXMsIG9wdGlvbnMpXG57XG4gICAgdmFyIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICAgIHRoaXMudHlwZSA9IHR5cGU7XG4gICAgdGhpcy50aWxlX3NvdXJjZSA9IHRpbGVfc291cmNlO1xuICAgIHRoaXMudGlsZXMgPSB7fTtcbiAgICB0aGlzLm51bV93b3JrZXJzID0gb3B0aW9ucy5udW1fd29ya2VycyB8fCAxO1xuXG4gICAgdGhpcy5sYXllcl9zb3VyY2UgPSBWZWN0b3JSZW5kZXJlci51cmxGb3JQYXRoKGxheWVycyk7IC8vIFRPRE86IGZpeCB0aGlzIGZvciBsYXllcnMgcHJvdmlkZWQgYXMgb2JqZWN0cywgdGhpcyBhc3N1bWVzIGEgVVJMIGlzIHBhc3NlZFxuICAgIGlmICh0eXBlb2YobGF5ZXJzKSA9PSAnc3RyaW5nJykge1xuICAgICAgICB0aGlzLmxheWVycyA9IFZlY3RvclJlbmRlcmVyLmxvYWRMYXllcnMobGF5ZXJzKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHRoaXMubGF5ZXJzID0gbGF5ZXJzO1xuICAgIH1cblxuICAgIHRoaXMuc3R5bGVfc291cmNlID0gVmVjdG9yUmVuZGVyZXIudXJsRm9yUGF0aChzdHlsZXMpOyAvLyBUT0RPOiBmaXggdGhpcyBmb3Igc3R5bGVzIHByb3ZpZGVkIGFzIG9iamVjdHMsIHRoaXMgYXNzdW1lcyBhIFVSTCBpcyBwYXNzZWRcbiAgICBpZiAodHlwZW9mKHN0eWxlcykgPT0gJ3N0cmluZycpIHtcbiAgICAgICAgdGhpcy5zdHlsZXMgPSBWZWN0b3JSZW5kZXJlci5sb2FkU3R5bGVzKHN0eWxlcyk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICB0aGlzLnN0eWxlcyA9IHN0eWxlcztcbiAgICB9XG5cbiAgICB0aGlzLmNyZWF0ZVdvcmtlcnMoKTtcblxuICAgIHRoaXMuem9vbSA9IG51bGw7XG4gICAgdGhpcy5jZW50ZXIgPSBudWxsO1xuICAgIHRoaXMuZGV2aWNlX3BpeGVsX3JhdGlvID0gd2luZG93LmRldmljZVBpeGVsUmF0aW8gfHwgMTtcbiAgICB0aGlzLmRpcnR5ID0gdHJ1ZTsgLy8gcmVxdWVzdCBhIHJlZHJhd1xuICAgIHRoaXMuaW5pdGlhbGl6ZWQgPSBmYWxzZTtcbn1cblxuVmVjdG9yUmVuZGVyZXIuY3JlYXRlID0gZnVuY3Rpb24gKHR5cGUsIHRpbGVfc291cmNlLCBsYXllcnMsIHN0eWxlcywgb3B0aW9ucylcbntcbiAgICByZXR1cm4gbmV3IFZlY3RvclJlbmRlcmVyW3R5cGVdKHRpbGVfc291cmNlLCBsYXllcnMsIHN0eWxlcywgb3B0aW9ucyk7XG59O1xuXG5WZWN0b3JSZW5kZXJlci5wcm90b3R5cGUuaW5pdCA9IGZ1bmN0aW9uICgpXG57XG4gICAgLy8gQ2hpbGQgY2xhc3Mtc3BlY2lmaWMgaW5pdGlhbGl6YXRpb24gKGUuZy4gR0wgY29udGV4dCBjcmVhdGlvbilcbiAgICBpZiAodHlwZW9mKHRoaXMuX2luaXQpID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgdGhpcy5faW5pdC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cblxuICAgIHZhciByZW5kZXJlciA9IHRoaXM7XG4gICAgdGhpcy53b3JrZXJzLmZvckVhY2goZnVuY3Rpb24od29ya2VyKSB7XG4gICAgICAgIHdvcmtlci5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgcmVuZGVyZXIudGlsZVdvcmtlckNvbXBsZXRlZC5iaW5kKHJlbmRlcmVyKSk7XG4gICAgfSk7XG5cbiAgICB0aGlzLmluaXRpYWxpemVkID0gdHJ1ZTtcbn07XG5cbi8vIFdlYiB3b3JrZXJzIGhhbmRsZSBoZWF2eSBkdXR5IGdlb21ldHJ5IHByb2Nlc3NpbmdcblZlY3RvclJlbmRlcmVyLnByb3RvdHlwZS5jcmVhdGVXb3JrZXJzID0gZnVuY3Rpb24gKClcbntcbiAgICB2YXIgcmVuZGVyZXIgPSB0aGlzO1xuICAgIHZhciB1cmwgPSBWZWN0b3JSZW5kZXJlci5saWJyYXJ5X2Jhc2VfdXJsICsgJ3ZlY3Rvci1tYXAtd29ya2VyLm1pbi5qcyc7XG5cbiAgICAvLyBUbyBhbGxvdyB3b3JrZXJzIHRvIGJlIGxvYWRlZCBjcm9zcy1kb21haW4sIGZpcnN0IGxvYWQgd29ya2VyIHNvdXJjZSB2aWEgWEhSLCB0aGVuIGNyZWF0ZSBhIGxvY2FsIFVSTCB2aWEgYSBibG9iXG4gICAgdmFyIHJlcSA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgIHJlcS5vbmxvYWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciB3b3JrZXJfbG9jYWxfdXJsID0gd2luZG93LlVSTC5jcmVhdGVPYmplY3RVUkwobmV3IEJsb2IoW3JlcS5yZXNwb25zZV0sIHsgdHlwZTogJ2FwcGxpY2F0aW9uL2phdmFzY3JpcHQnIH0pKTtcblxuICAgICAgICByZW5kZXJlci53b3JrZXJzID0gW107XG4gICAgICAgIGZvciAodmFyIHc9MDsgdyA8IHJlbmRlcmVyLm51bV93b3JrZXJzOyB3KyspIHtcbiAgICAgICAgICAgIHJlbmRlcmVyLndvcmtlcnMucHVzaChuZXcgV29ya2VyKHdvcmtlcl9sb2NhbF91cmwpKTtcbiAgICAgICAgfVxuICAgIH07XG4gICAgcmVxLm9wZW4oJ0dFVCcsIHVybCwgZmFsc2UgLyogYXN5bmMgZmxhZyAqLyk7XG4gICAgcmVxLnNlbmQoKTtcblxuICAgIC8vIEFsdGVybmF0ZSBmb3IgZGVidWdnaW5nIC0gdHJhZHRpb25hbCBtZXRob2Qgb2YgbG9hZGluZyBmcm9tIHJlbW90ZSBVUkwgaW5zdGVhZCBvZiBYSFItdG8tbG9jYWwtYmxvYlxuICAgIC8vIHJlbmRlcmVyLndvcmtlcnMgPSBbXTtcbiAgICAvLyBmb3IgKHZhciB3PTA7IHcgPCByZW5kZXJlci5udW1fd29ya2VyczsgdysrKSB7XG4gICAgLy8gICAgIHJlbmRlcmVyLndvcmtlcnMucHVzaChuZXcgV29ya2VyKHVybCkpO1xuICAgIC8vIH1cblxuICAgIHRoaXMubmV4dF93b3JrZXIgPSAwO1xufTtcblxuVmVjdG9yUmVuZGVyZXIucHJvdG90eXBlLnNldENlbnRlciA9IGZ1bmN0aW9uIChsbmcsIGxhdClcbntcbiAgICB0aGlzLmNlbnRlciA9IHsgbG5nOiBsbmcsIGxhdDogbGF0IH07XG4gICAgdGhpcy5kaXJ0eSA9IHRydWU7XG59O1xuXG5WZWN0b3JSZW5kZXJlci5wcm90b3R5cGUuc2V0Wm9vbSA9IGZ1bmN0aW9uICh6b29tKVxue1xuICAgIHRoaXMubWFwX2xhc3Rfem9vbSA9IHRoaXMuem9vbTtcbiAgICB0aGlzLnpvb20gPSB6b29tO1xuICAgIHRoaXMubWFwX3pvb21pbmcgPSBmYWxzZTtcbiAgICB0aGlzLmRpcnR5ID0gdHJ1ZTtcbn07XG5cblZlY3RvclJlbmRlcmVyLnByb3RvdHlwZS5zdGFydFpvb20gPSBmdW5jdGlvbiAoKVxue1xuICAgIHRoaXMubWFwX2xhc3Rfem9vbSA9IHRoaXMuem9vbTtcbiAgICB0aGlzLm1hcF96b29taW5nID0gdHJ1ZTtcbn07XG5cblZlY3RvclJlbmRlcmVyLnByb3RvdHlwZS5zZXRCb3VuZHMgPSBmdW5jdGlvbiAoc3csIG5lKVxue1xuICAgIHRoaXMuYm91bmRzID0ge1xuICAgICAgICBzdzogeyBsbmc6IHN3LmxuZywgbGF0OiBzdy5sYXQgfSxcbiAgICAgICAgbmU6IHsgbG5nOiBuZS5sbmcsIGxhdDogbmUubGF0IH1cbiAgICB9O1xuXG4gICAgdmFyIGJ1ZmZlciA9IDIwMCAqIEdlby5tZXRlcnNfcGVyX3BpeGVsW35+dGhpcy56b29tXTsgLy8gcGl4ZWxzIC0+IG1ldGVyc1xuICAgIHRoaXMuYnVmZmVyZWRfbWV0ZXJfYm91bmRzID0ge1xuICAgICAgICBzdzogR2VvLmxhdExuZ1RvTWV0ZXJzKFBvaW50KHRoaXMuYm91bmRzLnN3LmxuZywgdGhpcy5ib3VuZHMuc3cubGF0KSksXG4gICAgICAgIG5lOiBHZW8ubGF0TG5nVG9NZXRlcnMoUG9pbnQodGhpcy5ib3VuZHMubmUubG5nLCB0aGlzLmJvdW5kcy5uZS5sYXQpKVxuICAgIH07XG4gICAgdGhpcy5idWZmZXJlZF9tZXRlcl9ib3VuZHMuc3cueCAtPSBidWZmZXI7XG4gICAgdGhpcy5idWZmZXJlZF9tZXRlcl9ib3VuZHMuc3cueSAtPSBidWZmZXI7XG4gICAgdGhpcy5idWZmZXJlZF9tZXRlcl9ib3VuZHMubmUueCArPSBidWZmZXI7XG4gICAgdGhpcy5idWZmZXJlZF9tZXRlcl9ib3VuZHMubmUueSArPSBidWZmZXI7XG5cbiAgICAvLyBjb25zb2xlLmxvZyhcInNldCByZW5kZXJlciBib3VuZHMgdG8gXCIgKyBKU09OLnN0cmluZ2lmeSh0aGlzLmJvdW5kcykpO1xuXG4gICAgLy8gTWFyayB0aWxlcyBhcyB2aXNpYmxlL2ludmlzaWJsZVxuICAgIGZvciAodmFyIHQgaW4gdGhpcy50aWxlcykge1xuICAgICAgICB0aGlzLnVwZGF0ZVZpc2liaWxpdHlGb3JUaWxlKHRoaXMudGlsZXNbdF0pO1xuICAgIH1cblxuICAgIHRoaXMuZGlydHkgPSB0cnVlO1xufTtcblxuVmVjdG9yUmVuZGVyZXIucHJvdG90eXBlLnVwZGF0ZVZpc2liaWxpdHlGb3JUaWxlID0gZnVuY3Rpb24gKHRpbGUpXG57XG4gICAgdGlsZS52aXNpYmxlID0gR2VvLmJveEludGVyc2VjdCh0aWxlLmJvdW5kcywgdGhpcy5idWZmZXJlZF9tZXRlcl9ib3VuZHMpO1xuICAgIHJldHVybiB0aWxlLnZpc2libGU7XG59O1xuXG5WZWN0b3JSZW5kZXJlci5wcm90b3R5cGUucmVzaXplTWFwID0gZnVuY3Rpb24gKHdpZHRoLCBoZWlnaHQpXG57XG4gICAgdGhpcy5kaXJ0eSA9IHRydWU7XG59O1xuXG5WZWN0b3JSZW5kZXJlci5wcm90b3R5cGUucmVxdWVzdFJlZHJhdyA9IGZ1bmN0aW9uICgpXG57XG4gICAgdGhpcy5kaXJ0eSA9IHRydWU7XG59O1xuXG5WZWN0b3JSZW5kZXJlci5wcm90b3R5cGUucmVuZGVyID0gZnVuY3Rpb24gKClcbntcbiAgICBpZiAodGhpcy5kaXJ0eSA9PSBmYWxzZSB8fCB0aGlzLmluaXRpYWxpemVkID09IGZhbHNlKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgdGhpcy5kaXJ0eSA9IGZhbHNlOyAvLyBzdWJjbGFzc2VzIGNhbiBzZXQgdGhpcyBiYWNrIHRvIHRydWUgd2hlbiBhbmltYXRpb24gaXMgbmVlZGVkXG5cbiAgICAvLyBDaGlsZCBjbGFzcy1zcGVjaWZpYyByZW5kZXJpbmcgKGUuZy4gR0wgZHJhdyBjYWxscylcbiAgICBpZiAodHlwZW9mKHRoaXMuX3JlbmRlcikgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICB0aGlzLl9yZW5kZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG5cbiAgICAvLyBjb25zb2xlLmxvZyhcInJlbmRlciBtYXBcIik7XG4gICAgcmV0dXJuIHRydWU7XG59O1xuXG5WZWN0b3JSZW5kZXJlci5wcm90b3R5cGUubG9hZFRpbGUgPSBmdW5jdGlvbiAoY29vcmRzLCBkaXYsIGNhbGxiYWNrKVxue1xuICAgIC8vIE92ZXJ6b29tP1xuICAgIGlmIChjb29yZHMueiA+IHRoaXMudGlsZV9zb3VyY2UubWF4X3pvb20pIHtcbiAgICAgICAgdmFyIHpnYXAgPSBjb29yZHMueiAtIHRoaXMudGlsZV9zb3VyY2UubWF4X3pvb207XG4gICAgICAgIC8vIHZhciBvcmlnaW5hbF90aWxlID0gW2Nvb3Jkcy54LCBjb29yZHMueSwgY29vcmRzLnpdLmpvaW4oJy8nKTtcbiAgICAgICAgY29vcmRzLnggPSB+fihjb29yZHMueCAvIE1hdGgucG93KDIsIHpnYXApKTtcbiAgICAgICAgY29vcmRzLnkgPSB+fihjb29yZHMueSAvIE1hdGgucG93KDIsIHpnYXApKTtcbiAgICAgICAgY29vcmRzLmRpc3BsYXlfeiA9IGNvb3Jkcy56OyAvLyB6IHdpdGhvdXQgb3Zlcnpvb21cbiAgICAgICAgY29vcmRzLnogLT0gemdhcDtcbiAgICAgICAgLy8gY29uc29sZS5sb2coXCJhZGp1c3RlZCBmb3Igb3Zlcnpvb20sIHRpbGUgXCIgKyBvcmlnaW5hbF90aWxlICsgXCIgLT4gXCIgKyBbY29vcmRzLngsIGNvb3Jkcy55LCBjb29yZHMuel0uam9pbignLycpKTtcbiAgICB9XG5cbiAgICAvLyBTdGFydCB0cmFja2luZyBuZXcgdGlsZSBzZXQgaWYgbm8gb3RoZXIgdGlsZXMgYWxyZWFkeSBsb2FkaW5nXG4gICAgaWYgKHRoaXMudGlsZV9zZXRfbG9hZGluZyA9PSBudWxsKSB7XG4gICAgICAgIHRoaXMudGlsZV9zZXRfbG9hZGluZyA9ICtuZXcgRGF0ZSgpO1xuICAgICAgICBjb25zb2xlLmxvZyhcInRpbGUgc2V0IGxvYWQgU1RBUlRcIik7XG4gICAgfVxuXG4gICAgdmFyIGtleSA9IFtjb29yZHMueCwgY29vcmRzLnksIGNvb3Jkcy56XS5qb2luKCcvJyk7XG5cbiAgICAvLyBBbHJlYWR5IGxvYWRpbmcvbG9hZGVkP1xuICAgIGlmICh0aGlzLnRpbGVzW2tleV0pIHtcbiAgICAgICAgLy8gaWYgKHRoaXMudGlsZXNba2V5XS5sb2FkZWQgPT0gdHJ1ZSkge1xuICAgICAgICAvLyAgICAgY29uc29sZS5sb2coXCJ1c2UgbG9hZGVkIHRpbGUgXCIgKyBrZXkgKyBcIiBmcm9tIGNhY2hlXCIpO1xuICAgICAgICAvLyB9XG4gICAgICAgIC8vIGlmICh0aGlzLnRpbGVzW2tleV0ubG9hZGluZyA9PSB0cnVlKSB7XG4gICAgICAgIC8vICAgICBjb25zb2xlLmxvZyhcImFscmVhZHkgbG9hZGluZyB0aWxlIFwiICsga2V5ICsgXCIsIHNraXBcIik7XG4gICAgICAgIC8vIH1cblxuICAgICAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIGRpdik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciB0aWxlID0gdGhpcy50aWxlc1trZXldID0ge307XG4gICAgdGlsZS5rZXkgPSBrZXk7XG4gICAgdGlsZS5jb29yZHMgPSBjb29yZHM7XG4gICAgdGlsZS5taW4gPSBHZW8ubWV0ZXJzRm9yVGlsZSh0aWxlLmNvb3Jkcyk7XG4gICAgdGlsZS5tYXggPSBHZW8ubWV0ZXJzRm9yVGlsZSh7IHg6IHRpbGUuY29vcmRzLnggKyAxLCB5OiB0aWxlLmNvb3Jkcy55ICsgMSwgejogdGlsZS5jb29yZHMueiB9KTtcbiAgICB0aWxlLmJvdW5kcyA9IHsgc3c6IHsgeDogdGlsZS5taW4ueCwgeTogdGlsZS5tYXgueSB9LCBuZTogeyB4OiB0aWxlLm1heC54LCB5OiB0aWxlLm1pbi55IH0gfTtcbiAgICB0aWxlLnVuaXRzX3Blcl9tZXRlciA9IFZlY3RvclJlbmRlcmVyLnVuaXRzX3Blcl9tZXRlclt0aWxlLmNvb3Jkcy56XTtcbiAgICB0aWxlLnVuaXRzX3Blcl9waXhlbCA9IFZlY3RvclJlbmRlcmVyLnVuaXRzX3Blcl9waXhlbFt0aWxlLmNvb3Jkcy56XTtcbiAgICB0aWxlLmRlYnVnID0ge307XG4gICAgdGlsZS5sb2FkaW5nID0gdHJ1ZTtcbiAgICB0aWxlLmxvYWRlZCA9IGZhbHNlO1xuICAgIHRoaXMudXBkYXRlVmlzaWJpbGl0eUZvclRpbGUodGlsZSk7XG5cbiAgICB0aGlzLndvcmtlcnNbdGhpcy5uZXh0X3dvcmtlcl0ucG9zdE1lc3NhZ2Uoe1xuICAgICAgICB0eXBlOiAnbG9hZFRpbGUnLFxuICAgICAgICB0aWxlOiB0aWxlLFxuICAgICAgICByZW5kZXJlcl90eXBlOiB0aGlzLnR5cGUsXG4gICAgICAgIHRpbGVfc291cmNlOiB0aGlzLnRpbGVfc291cmNlLFxuICAgICAgICBsYXllcl9zb3VyY2U6IHRoaXMubGF5ZXJfc291cmNlLFxuICAgICAgICBzdHlsZV9zb3VyY2U6IHRoaXMuc3R5bGVfc291cmNlXG4gICAgfSk7XG4gICAgdGlsZS53b3JrZXIgPSB0aGlzLndvcmtlcnNbdGhpcy5uZXh0X3dvcmtlcl07XG4gICAgdGhpcy5uZXh0X3dvcmtlciA9ICh0aGlzLm5leHRfd29ya2VyICsgMSkgJSB0aGlzLndvcmtlcnMubGVuZ3RoO1xuXG4gICAgLy8gRGVidWcgaW5mb1xuICAgIGRpdi5zZXRBdHRyaWJ1dGUoJ2RhdGEtdGlsZS1rZXknLCB0aWxlLmtleSk7XG4gICAgZGl2LnN0eWxlLndpZHRoID0gJzI1NnB4JztcbiAgICBkaXYuc3R5bGUuaGVpZ2h0ID0gJzI1NnB4JztcblxuICAgIGlmICh0aGlzLmRlYnVnKSB7XG4gICAgICAgIHZhciBkZWJ1Z19vdmVybGF5ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgIGRlYnVnX292ZXJsYXkudGV4dENvbnRlbnQgPSB0aWxlLmtleTtcbiAgICAgICAgZGVidWdfb3ZlcmxheS5zdHlsZS5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XG4gICAgICAgIGRlYnVnX292ZXJsYXkuc3R5bGUubGVmdCA9IDA7XG4gICAgICAgIGRlYnVnX292ZXJsYXkuc3R5bGUudG9wID0gMDtcbiAgICAgICAgZGVidWdfb3ZlcmxheS5zdHlsZS5jb2xvciA9ICd3aGl0ZSc7XG4gICAgICAgIGRlYnVnX292ZXJsYXkuc3R5bGUuZm9udFNpemUgPSAnMTZweCc7XG4gICAgICAgIC8vIGRlYnVnX292ZXJsYXkuc3R5bGUudGV4dE91dGxpbmUgPSAnMXB4ICMwMDAwMDAnO1xuICAgICAgICBkaXYuYXBwZW5kQ2hpbGQoZGVidWdfb3ZlcmxheSk7XG5cbiAgICAgICAgZGl2LnN0eWxlLmJvcmRlclN0eWxlID0gJ3NvbGlkJztcbiAgICAgICAgZGl2LnN0eWxlLmJvcmRlckNvbG9yID0gJ3doaXRlJztcbiAgICAgICAgZGl2LnN0eWxlLmJvcmRlcldpZHRoID0gJzFweCc7XG4gICAgfVxuXG4gICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIGRpdik7XG4gICAgfVxufTtcblxuLy8gQ2FsbGVkIG9uIG1haW4gdGhyZWFkIHdoZW4gYSB3ZWIgd29ya2VyIGNvbXBsZXRlcyBwcm9jZXNzaW5nIGZvciBhIHNpbmdsZSB0aWxlXG5WZWN0b3JSZW5kZXJlci5wcm90b3R5cGUudGlsZVdvcmtlckNvbXBsZXRlZCA9IGZ1bmN0aW9uIChldmVudClcbntcbiAgICBpZiAoZXZlbnQuZGF0YS50eXBlICE9ICdsb2FkVGlsZUNvbXBsZXRlZCcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciB0aWxlID0gZXZlbnQuZGF0YS50aWxlO1xuXG4gICAgLy8gUmVtb3ZlZCB0aGlzIHRpbGUgZHVyaW5nIGxvYWQ/XG4gICAgaWYgKHRoaXMudGlsZXNbdGlsZS5rZXldID09IG51bGwpIHtcbiAgICAgICAgY29uc29sZS5sb2coXCJkaXNjYXJkZWQgdGlsZSBcIiArIHRpbGUua2V5ICsgXCIgaW4gVmVjdG9yUmVuZGVyZXIudGlsZVdvcmtlckNvbXBsZXRlZCBiZWNhdXNlIHByZXZpb3VzbHkgcmVtb3ZlZFwiKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMudGlsZXNbdGlsZS5rZXldID0gdGlsZTsgLy8gVE9ETzogT0sgdG8ganVzdCB3aXBlIG91dCB0aGUgdGlsZSBoZXJlPyBvciBjb3VsZCBwYXNzIGJhY2sgYSBsaXN0IG9mIHByb3BlcnRpZXMgdG8gcmVwbGFjZT8gZmVlbGluZyB0aGUgbGFjayBvZiB1bmRlcnNjb3JlIGhlcmUuLi5cblxuICAgIC8vIENoaWxkIGNsYXNzLXNwZWNpZmljIHRpbGUgcHJvY2Vzc2luZ1xuICAgIGlmICh0eXBlb2YodGhpcy5fdGlsZVdvcmtlckNvbXBsZXRlZCkgPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICB0aGlzLl90aWxlV29ya2VyQ29tcGxldGVkKHRpbGUpO1xuICAgIH1cblxuICAgIGRlbGV0ZSB0aWxlLmxheWVyczsgLy8gZGVsZXRlIHRoZSBzb3VyY2UgZGF0YSBpbiB0aGUgdGlsZSB0byBzYXZlIG1lbW9yeVxuXG4gICAgLy8gTm8gbW9yZSB0aWxlcyBhY3RpdmVseSBsb2FkaW5nP1xuICAgIGlmICh0aGlzLnRpbGVfc2V0X2xvYWRpbmcgIT0gbnVsbCkge1xuICAgICAgICB2YXIgZW5kX3RpbGVfc2V0ID0gdHJ1ZTtcbiAgICAgICAgZm9yICh2YXIgdCBpbiB0aGlzLnRpbGVzKSB7XG4gICAgICAgICAgICBpZiAodGhpcy50aWxlc1t0XS5sb2FkaW5nID09IHRydWUpIHtcbiAgICAgICAgICAgICAgICBlbmRfdGlsZV9zZXQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChlbmRfdGlsZV9zZXQgPT0gdHJ1ZSkge1xuICAgICAgICAgICAgdGhpcy5sYXN0X3RpbGVfc2V0X2xvYWQgPSAoK25ldyBEYXRlKCkpIC0gdGhpcy50aWxlX3NldF9sb2FkaW5nO1xuICAgICAgICAgICAgdGhpcy50aWxlX3NldF9sb2FkaW5nID0gbnVsbDtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwidGlsZSBzZXQgbG9hZCBGSU5JU0hFRCBpbjogXCIgKyB0aGlzLmxhc3RfdGlsZV9zZXRfbG9hZCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLmRpcnR5ID0gdHJ1ZTtcbiAgICBpZiAodGlsZXNfZGVidWcpIHRoaXMucHJpbnREZWJ1Z0ZvclRpbGUodGlsZSk7XG59O1xuXG5WZWN0b3JSZW5kZXJlci5wcm90b3R5cGUucmVtb3ZlVGlsZSA9IGZ1bmN0aW9uIChrZXkpXG57XG4gICAgY29uc29sZS5sb2coXCJ0aWxlIHVubG9hZCBmb3IgXCIgKyBrZXkpO1xuICAgIHZhciB0aWxlID0gdGhpcy50aWxlc1trZXldO1xuICAgIGlmICh0aWxlICE9IG51bGwgJiYgdGlsZS5sb2FkaW5nID09IHRydWUpIHtcbiAgICAgICAgY29uc29sZS5sb2coXCJjYW5jZWwgdGlsZSBsb2FkIGZvciBcIiArIGtleSk7XG5cbiAgICAgICAgLy8gV2ViIHdvcmtlciB3aWxsIGNhbmNlbCBYSFIgcmVxdWVzdHNcbiAgICAgICAgaWYgKHRpbGUud29ya2VyICE9IG51bGwpIHtcbiAgICAgICAgICAgIHRpbGUud29ya2VyLnBvc3RNZXNzYWdlKHtcbiAgICAgICAgICAgICAgICB0eXBlOiAncmVtb3ZlVGlsZScsXG4gICAgICAgICAgICAgICAga2V5OiB0aWxlLmtleVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBkZWxldGUgdGhpcy50aWxlc1trZXldO1xuICAgIHRoaXMuZGlydHkgPSB0cnVlO1xufTtcblxuVmVjdG9yUmVuZGVyZXIucHJvdG90eXBlLnByaW50RGVidWdGb3JUaWxlID0gZnVuY3Rpb24gKHRpbGUpXG57XG4gICAgY29uc29sZS5sb2coXG4gICAgICAgIFwiZGVidWcgZm9yIFwiICsgdGlsZS5rZXkgKyAnOiBbICcgK1xuICAgICAgICBPYmplY3Qua2V5cyh0aWxlLmRlYnVnKS5tYXAoZnVuY3Rpb24gKHQpIHsgcmV0dXJuIHQgKyAnOiAnICsgdGlsZS5kZWJ1Z1t0XTsgfSkuam9pbignLCAnKSArICcgXSdcbiAgICApO1xufTtcblxuXG4vKioqIENsYXNzIG1ldGhvZHMgKHN0YXRlbGVzcykgKioqL1xuXG4vLyBTaW1wbGlzdGljIGRldGVjdGlvbiBvZiByZWxhdGl2ZSBwYXRocywgYXBwZW5kIGJhc2UgaWYgbmVjZXNzYXJ5XG5WZWN0b3JSZW5kZXJlci51cmxGb3JQYXRoID0gZnVuY3Rpb24gKHBhdGgpIHtcbiAgICB2YXIgcHJvdG9jb2wgPSBwYXRoLnRvTG93ZXJDYXNlKCkuc3Vic3RyKDAsIDQpO1xuICAgIGlmICghKHByb3RvY29sID09ICdodHRwJyB8fCBwcm90b2NvbCA9PSAnZmlsZScpKSB7XG4gICAgICAgIHBhdGggPSB3aW5kb3cubG9jYXRpb24ub3JpZ2luICsgd2luZG93LmxvY2F0aW9uLnBhdGhuYW1lICsgcGF0aDtcbiAgICB9XG4gICAgcmV0dXJuIHBhdGg7XG59O1xuXG5WZWN0b3JSZW5kZXJlci5sb2FkTGF5ZXJzID0gZnVuY3Rpb24gKHVybClcbntcbiAgICB2YXIgbGF5ZXJzO1xuICAgIHZhciByZXEgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICByZXEub25sb2FkID0gZnVuY3Rpb24gKCkgeyBldmFsKCdsYXllcnMgPSAnICsgcmVxLnJlc3BvbnNlKTsgfTsgLy8gVE9ETzogc2VjdXJpdHkhXG4gICAgcmVxLm9wZW4oJ0dFVCcsIHVybCwgZmFsc2UgLyogYXN5bmMgZmxhZyAqLyk7XG4gICAgcmVxLnNlbmQoKTtcbiAgICByZXR1cm4gbGF5ZXJzO1xufTtcblxuVmVjdG9yUmVuZGVyZXIubG9hZFN0eWxlcyA9IGZ1bmN0aW9uICh1cmwpXG57XG4gICAgdmFyIHN0eWxlcztcbiAgICB2YXIgcmVxID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgcmVxLm9ubG9hZCA9IGZ1bmN0aW9uICgpIHsgZXZhbCgnc3R5bGVzID0gJyArIHJlcS5yZXNwb25zZSk7IH07IC8vIFRPRE86IHNlY3VyaXR5IVxuICAgIHJlcS5vcGVuKCdHRVQnLCB1cmwsIGZhbHNlIC8qIGFzeW5jIGZsYWcgKi8pO1xuICAgIHJlcS5zZW5kKCk7XG4gICAgcmV0dXJuIHN0eWxlcztcbn07XG5cbi8vIFByb2Nlc3NlcyB0aGUgdGlsZSByZXNwb25zZSB0byBjcmVhdGUgbGF5ZXJzIGFzIGRlZmluZWQgYnkgdGhpcyByZW5kZXJlclxuLy8gQ2FuIGluY2x1ZGUgcG9zdC1wcm9jZXNzaW5nIHRvIHBhcnRpYWxseSBmaWx0ZXIgb3IgcmUtYXJyYW5nZSBkYXRhLCBlLmcuIG9ubHkgaW5jbHVkaW5nIFBPSXMgdGhhdCBoYXZlIG5hbWVzXG5WZWN0b3JSZW5kZXJlci5wcm9jZXNzTGF5ZXJzRm9yVGlsZSA9IGZ1bmN0aW9uIChsYXllcnMsIHRpbGUpXG57XG4gICAgdmFyIHRpbGVfbGF5ZXJzID0ge307XG4gICAgZm9yICh2YXIgdD0wOyB0IDwgbGF5ZXJzLmxlbmd0aDsgdCsrKSB7XG4gICAgICAgIGxheWVyc1t0XS5udW1iZXIgPSB0O1xuXG4gICAgICAgIGlmIChsYXllcnNbdF0gIT0gbnVsbCkge1xuICAgICAgICAgICAgLy8gSnVzdCBwYXNzIHRocm91Z2ggZGF0YSB1bnRvdWNoZWQgaWYgbm8gZGF0YSB0cmFuc2Zvcm0gZnVuY3Rpb24gZGVmaW5lZFxuICAgICAgICAgICAgaWYgKGxheWVyc1t0XS5kYXRhID09IG51bGwpIHtcbiAgICAgICAgICAgICAgICB0aWxlX2xheWVyc1tsYXllcnNbdF0ubmFtZV0gPSB0aWxlLmxheWVyc1tsYXllcnNbdF0ubmFtZV07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBQYXNzIHRocm91Z2ggZGF0YSBidXQgd2l0aCBkaWZmZXJlbnQgbGF5ZXIgbmFtZSBpbiB0aWxlIHNvdXJjZSBkYXRhXG4gICAgICAgICAgICBlbHNlIGlmICh0eXBlb2YgbGF5ZXJzW3RdLmRhdGEgPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICB0aWxlX2xheWVyc1tsYXllcnNbdF0ubmFtZV0gPSB0aWxlLmxheWVyc1tsYXllcnNbdF0uZGF0YV07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBBcHBseSB0aGUgdHJhbnNmb3JtIGZ1bmN0aW9uIGZvciBwb3N0LXByb2Nlc3NpbmdcbiAgICAgICAgICAgIGVsc2UgaWYgKHR5cGVvZiBsYXllcnNbdF0uZGF0YSA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICAgICAgdGlsZV9sYXllcnNbbGF5ZXJzW3RdLm5hbWVdID0gbGF5ZXJzW3RdLmRhdGEodGlsZS5sYXllcnMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gSGFuZGxlIGNhc2VzIHdoZXJlIG5vIGRhdGEgd2FzIGZvdW5kIGluIHRpbGUgb3IgcmV0dXJuZWQgYnkgcG9zdC1wcm9jZXNzb3JcbiAgICAgICAgdGlsZV9sYXllcnNbbGF5ZXJzW3RdLm5hbWVdID0gdGlsZV9sYXllcnNbbGF5ZXJzW3RdLm5hbWVdIHx8IHsgdHlwZTogJ0ZlYXR1cmVDb2xsZWN0aW9uJywgZmVhdHVyZXM6IFtdIH07XG4gICAgfVxuICAgIHRpbGUubGF5ZXJzID0gdGlsZV9sYXllcnM7XG4gICAgcmV0dXJuIHRpbGVfbGF5ZXJzO1xufTtcblxuXG4vKioqIFN0eWxlIHBhcnNpbmcgJiBkZWZhdWx0cyAqKiovXG5cbi8vIERldGVybWluZSBmaW5hbCBzdHlsZSBwcm9wZXJ0aWVzIChjb2xvciwgd2lkdGgsIGV0Yy4pXG5WZWN0b3JSZW5kZXJlci5zdHlsZV9kZWZhdWx0cyA9IHtcbiAgICBjb2xvcjogWzEuMCwgMCwgMF0sXG4gICAgd2lkdGg6IFN0eWxlLndpZHRoLnBpeGVscyg1KSxcbiAgICBzaXplOiBTdHlsZS53aWR0aC5waXhlbHMoNSksXG4gICAgZXh0cnVkZTogZmFsc2UsXG4gICAgaGVpZ2h0OiAyMCxcbiAgICBtaW5faGVpZ2h0OiAwLFxuICAgIG91dGxpbmU6IHtcbiAgICAgICAgLy8gY29sb3I6IFsxLjAsIDAsIDBdLFxuICAgICAgICAvLyB3aWR0aDogMSxcbiAgICAgICAgLy8gZGFzaDogbnVsbFxuICAgIH0sXG4gICAgLy8gcmVuZGVyX21vZGU6IHtcbiAgICAvLyAgICAgbmFtZTogJ3BvbHlnb25zJ1xuICAgIC8vIH1cbiAgICByZW5kZXJfbW9kZTogJ3BvbHlnb25zJ1xufTtcblxuVmVjdG9yUmVuZGVyZXIucGFyc2VTdHlsZUZvckZlYXR1cmUgPSBmdW5jdGlvbiAoZmVhdHVyZSwgbGF5ZXJfc3R5bGUsIHRpbGUpXG57XG4gICAgdmFyIGxheWVyX3N0eWxlID0gbGF5ZXJfc3R5bGUgfHwge307XG4gICAgdmFyIHN0eWxlID0ge307XG5cbiAgICAvLyBUZXN0IHdoZXRoZXIgZmVhdHVyZXMgc2hvdWxkIGJlIHJlbmRlcmVkIGF0IGFsbFxuICAgIGlmICh0eXBlb2YgbGF5ZXJfc3R5bGUuZmlsdGVyID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgaWYgKGxheWVyX3N0eWxlLmZpbHRlcihmZWF0dXJlLCB0aWxlKSA9PSBmYWxzZSkge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBQYXJzZSBzdHlsZXNcbiAgICBzdHlsZS5jb2xvciA9IChsYXllcl9zdHlsZS5jb2xvciAmJiAobGF5ZXJfc3R5bGUuY29sb3JbZmVhdHVyZS5wcm9wZXJ0aWVzLmtpbmRdIHx8IGxheWVyX3N0eWxlLmNvbG9yLmRlZmF1bHQpKSB8fCBWZWN0b3JSZW5kZXJlci5zdHlsZV9kZWZhdWx0cy5jb2xvcjtcbiAgICBpZiAodHlwZW9mIHN0eWxlLmNvbG9yID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgc3R5bGUuY29sb3IgPSBzdHlsZS5jb2xvcihmZWF0dXJlLCB0aWxlKTtcbiAgICB9XG5cbiAgICBzdHlsZS53aWR0aCA9IChsYXllcl9zdHlsZS53aWR0aCAmJiAobGF5ZXJfc3R5bGUud2lkdGhbZmVhdHVyZS5wcm9wZXJ0aWVzLmtpbmRdIHx8IGxheWVyX3N0eWxlLndpZHRoLmRlZmF1bHQpKSB8fCBWZWN0b3JSZW5kZXJlci5zdHlsZV9kZWZhdWx0cy53aWR0aDtcbiAgICBpZiAodHlwZW9mIHN0eWxlLndpZHRoID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgc3R5bGUud2lkdGggPSBzdHlsZS53aWR0aChmZWF0dXJlLCB0aWxlKTtcbiAgICB9XG5cbiAgICBzdHlsZS5zaXplID0gKGxheWVyX3N0eWxlLnNpemUgJiYgKGxheWVyX3N0eWxlLnNpemVbZmVhdHVyZS5wcm9wZXJ0aWVzLmtpbmRdIHx8IGxheWVyX3N0eWxlLnNpemUuZGVmYXVsdCkpIHx8IFZlY3RvclJlbmRlcmVyLnN0eWxlX2RlZmF1bHRzLnNpemU7XG4gICAgaWYgKHR5cGVvZiBzdHlsZS5zaXplID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgc3R5bGUuc2l6ZSA9IHN0eWxlLnNpemUoZmVhdHVyZSwgdGlsZSk7XG4gICAgfVxuXG4gICAgc3R5bGUuZXh0cnVkZSA9IChsYXllcl9zdHlsZS5leHRydWRlICYmIChsYXllcl9zdHlsZS5leHRydWRlW2ZlYXR1cmUucHJvcGVydGllcy5raW5kXSB8fCBsYXllcl9zdHlsZS5leHRydWRlLmRlZmF1bHQpKSB8fCBWZWN0b3JSZW5kZXJlci5zdHlsZV9kZWZhdWx0cy5leHRydWRlO1xuICAgIGlmICh0eXBlb2Ygc3R5bGUuZXh0cnVkZSA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHN0eWxlLmV4dHJ1ZGUgPSBzdHlsZS5leHRydWRlKGZlYXR1cmUsIHRpbGUpOyAvLyByZXR1cm5pbmcgYSBib29sZWFuIHdpbGwgZXh0cnVkZSB3aXRoIHRoZSBmZWF0dXJlJ3MgaGVpZ2h0LCBhIG51bWJlciB3aWxsIG92ZXJyaWRlIHRoZSBmZWF0dXJlIGhlaWdodCAoc2VlIGJlbG93KVxuICAgIH1cblxuICAgIHN0eWxlLmhlaWdodCA9IChmZWF0dXJlLnByb3BlcnRpZXMgJiYgZmVhdHVyZS5wcm9wZXJ0aWVzLmhlaWdodCkgfHwgVmVjdG9yUmVuZGVyZXIuc3R5bGVfZGVmYXVsdHMuaGVpZ2h0O1xuICAgIHN0eWxlLm1pbl9oZWlnaHQgPSAoZmVhdHVyZS5wcm9wZXJ0aWVzICYmIGZlYXR1cmUucHJvcGVydGllcy5taW5faGVpZ2h0KSB8fCBWZWN0b3JSZW5kZXJlci5zdHlsZV9kZWZhdWx0cy5taW5faGVpZ2h0O1xuXG4gICAgLy8gaGVpZ2h0IGRlZmF1bHRzIHRvIGZlYXR1cmUgaGVpZ2h0LCBidXQgZXh0cnVkZSBzdHlsZSBjYW4gZHluYW1pY2FsbHkgYWRqdXN0IGhlaWdodCBieSByZXR1cm5pbmcgYSBudW1iZXIgb3IgYXJyYXkgKGluc3RlYWQgb2YgYSBib29sZWFuKVxuICAgIGlmIChzdHlsZS5leHRydWRlKSB7XG4gICAgICAgIGlmICh0eXBlb2Ygc3R5bGUuZXh0cnVkZSA9PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgc3R5bGUuaGVpZ2h0ID0gc3R5bGUuZXh0cnVkZTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICh0eXBlb2Ygc3R5bGUuZXh0cnVkZSA9PSAnb2JqZWN0JyAmJiBzdHlsZS5leHRydWRlLmxlbmd0aCA+PSAyKSB7XG4gICAgICAgICAgICBzdHlsZS5taW5faGVpZ2h0ID0gc3R5bGUuZXh0cnVkZVswXTtcbiAgICAgICAgICAgIHN0eWxlLmhlaWdodCA9IHN0eWxlLmV4dHJ1ZGVbMV07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzdHlsZS5vdXRsaW5lID0ge307XG4gICAgbGF5ZXJfc3R5bGUub3V0bGluZSA9IGxheWVyX3N0eWxlLm91dGxpbmUgfHwge307XG4gICAgc3R5bGUub3V0bGluZS5jb2xvciA9IChsYXllcl9zdHlsZS5vdXRsaW5lLmNvbG9yICYmIChsYXllcl9zdHlsZS5vdXRsaW5lLmNvbG9yW2ZlYXR1cmUucHJvcGVydGllcy5raW5kXSB8fCBsYXllcl9zdHlsZS5vdXRsaW5lLmNvbG9yLmRlZmF1bHQpKSB8fCBWZWN0b3JSZW5kZXJlci5zdHlsZV9kZWZhdWx0cy5vdXRsaW5lLmNvbG9yO1xuICAgIGlmICh0eXBlb2Ygc3R5bGUub3V0bGluZS5jb2xvciA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHN0eWxlLm91dGxpbmUuY29sb3IgPSBzdHlsZS5vdXRsaW5lLmNvbG9yKGZlYXR1cmUsIHRpbGUpO1xuICAgIH1cblxuICAgIHN0eWxlLm91dGxpbmUud2lkdGggPSAobGF5ZXJfc3R5bGUub3V0bGluZS53aWR0aCAmJiAobGF5ZXJfc3R5bGUub3V0bGluZS53aWR0aFtmZWF0dXJlLnByb3BlcnRpZXMua2luZF0gfHwgbGF5ZXJfc3R5bGUub3V0bGluZS53aWR0aC5kZWZhdWx0KSkgfHwgVmVjdG9yUmVuZGVyZXIuc3R5bGVfZGVmYXVsdHMub3V0bGluZS53aWR0aDtcbiAgICBpZiAodHlwZW9mIHN0eWxlLm91dGxpbmUud2lkdGggPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBzdHlsZS5vdXRsaW5lLndpZHRoID0gc3R5bGUub3V0bGluZS53aWR0aChmZWF0dXJlLCB0aWxlKTtcbiAgICB9XG5cbiAgICBzdHlsZS5vdXRsaW5lLmRhc2ggPSAobGF5ZXJfc3R5bGUub3V0bGluZS5kYXNoICYmIChsYXllcl9zdHlsZS5vdXRsaW5lLmRhc2hbZmVhdHVyZS5wcm9wZXJ0aWVzLmtpbmRdIHx8IGxheWVyX3N0eWxlLm91dGxpbmUuZGFzaC5kZWZhdWx0KSkgfHwgVmVjdG9yUmVuZGVyZXIuc3R5bGVfZGVmYXVsdHMub3V0bGluZS5kYXNoO1xuICAgIGlmICh0eXBlb2Ygc3R5bGUub3V0bGluZS5kYXNoID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgc3R5bGUub3V0bGluZS5kYXNoID0gc3R5bGUub3V0bGluZS5kYXNoKGZlYXR1cmUsIHRpbGUpO1xuICAgIH1cblxuICAgIHN0eWxlLnJlbmRlcl9tb2RlID0gbGF5ZXJfc3R5bGUucmVuZGVyX21vZGUgfHwgVmVjdG9yUmVuZGVyZXIuc3R5bGVfZGVmYXVsdHMucmVuZGVyX21vZGU7XG4gICAgLy8gc3R5bGUucmVuZGVyX21vZGUgPSB7fTtcbiAgICAvLyBzdHlsZS5yZW5kZXJfbW9kZS5uYW1lID0gKGxheWVyX3N0eWxlLnJlbmRlcl9tb2RlICYmIGxheWVyX3N0eWxlLnJlbmRlcl9tb2RlLm5hbWUpIHx8IFZlY3RvclJlbmRlcmVyLnN0eWxlX2RlZmF1bHRzLnJlbmRlcl9tb2RlLm5hbWU7XG5cbiAgICByZXR1cm4gc3R5bGU7XG59O1xuXG5pZiAobW9kdWxlICE9PSB1bmRlZmluZWQpIHtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IFZlY3RvclJlbmRlcmVyO1xufVxuIl19
(9)
});
