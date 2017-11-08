function line(x0, y0, x1, y1, cb) {
	var dx = Math.abs(x1 - x0);
	var dy = Math.abs(y1 - y0);
	var sx = (x0 < x1) ? 1 : -1;
	var sy = (y0 < y1) ? 1 : -1;
	var err = dx - dy;

	while (true) {
		cb(x0, y0);

		if ((x0 == x1) && (y0 == y1)) break;
		var e2 = 2 * err;
		if (e2 > -dy) { err -= dy; x0 += sx; }
		if (e2 < dx) { err += dx; y0 += sy; }
	}
}

function getCanvasSize() {
	if (window.innerWidth < 500)
		return 80;
	else if (window.innerWidth < 720)
		return 90;
	else
		return 100;
}

function getBrushSize() {
	if (window.innerWidth < 500)
		return 1;
	else if (window.innerWidth < 720)
		return 2;
	else
		return 2;
}

function makeDrawCanvas(w, h) {
	if (!w) w = 1;
	if (!h) h = 1;
	var canvas = document.createElement("canvas");
	canvas.className = "paintarea";
	var context = canvas.getContext("2d");
	var s = getCanvasSize() - 2;
	var bs = getBrushSize();
	canvas.width = w * s + 2;
	canvas.height = h * s + 2;
	var obj = {
		element: canvas,
		context: context,
		bg: null,
		raw: null,
		redrawTimer: 0,
		locked: false,
		queueRedraw: function () {
			if (!obj.raw)
				return;
			clearTimeout(obj.redrawTimer);
			obj.redrawTimer = setTimeout(function () {
				context.putImageData(obj.raw, 0, 0, 0, 0, canvas.width, canvas.height);
			}, 10);
		},
		clear: function () {
			if (!obj.bg)
				return;
			context.putImageData(obj.bg, 0, 0, 0, 0, canvas.width, canvas.height);
			obj.raw = context.getImageData(0, 0, canvas.width, canvas.height);
		}
	};
	loadImage("/img/stroke_base.png", function (img) {
		context.fillStyle = "#ddd";
		context.fillRect(0, 0, canvas.width, canvas.height);
		for (var y = 0; y < h; y++)
			for (var x = 0; x < w; x++)
				context.drawImage(img, x * s, y * s, s, s);
		obj.bg = context.getImageData(0, 0, canvas.width, canvas.height);
		obj.raw = context.getImageData(0, 0, canvas.width, canvas.height);

		var prevX, prevY;
		function putDot(xx, yy, erase) {
			var r = bs * (erase ? 2 : 1);
			for (var oy = -r; oy <= r; oy++) {
				if (y < 0 || y >= canvas.width)
					continue;
				var y = yy + oy;
				for (var ox = -r; ox <= r; ox++) {
					var x = xx + ox;
					if (x < 0 || x >= canvas.width)
						continue;
					if (erase) {
						obj.raw.data[(x + y * canvas.width) * 4] = obj.bg.data[(x + y * canvas.width) * 4];
						obj.raw.data[(x + y * canvas.width) * 4 + 1] = obj.bg.data[(x + y * canvas.width) * 4 + 1];
						obj.raw.data[(x + y * canvas.width) * 4 + 2] = obj.bg.data[(x + y * canvas.width) * 4 + 2];
						obj.raw.data[(x + y * canvas.width) * 4 + 3] = obj.bg.data[(x + y * canvas.width) * 4 + 3];
					}
					else {
						obj.raw.data[(x + y * canvas.width) * 4] = 0;
						obj.raw.data[(x + y * canvas.width) * 4 + 1] = 0;
						obj.raw.data[(x + y * canvas.width) * 4 + 2] = 0;
						obj.raw.data[(x + y * canvas.width) * 4 + 3] = 0xFF;
					}
				}
			}
		}

		var mouseDown = false;
		var erasing = false;

		function draw(dstX, dstY, start) {
			if (obj.locked || !mouseDown)
				return;
			dstX = Math.floor(dstX);
			dstY = Math.floor(dstY);
			if (start) {
				prevX = dstX;
				prevY = dstY;
			}
			line(prevX, prevY, dstX, dstY, function (x, y) {
				putDot(x, y, erasing);
			});
			obj.queueRedraw();
			prevX = dstX;
			prevY = dstY;
		}

		canvas.ontouchstart = function (e) {
			e.preventDefault();
			if (canvas.setCapture)
				canvas.setCapture();
			mouseDown = true;
			var t = e.targetTouches.length > 0 ? e.targetTouches[0] : e.touches[0];
			var x = t.pageX - canvas.offsetLeft;
			var y = t.pageY - canvas.offsetTop;
			draw(x, y, true);
		};
		canvas.ontouchmove = function (e) {
			e.preventDefault();
			var t = e.targetTouches.length > 0 ? e.targetTouches[0] : e.touches[0];
			var x = t.pageX - canvas.offsetLeft;
			var y = t.pageY - canvas.offsetTop;
			draw(x, y);
		};
		canvas.ontouchend = function (e) {
			mouseDown = false;
		};
		canvas.ontouchcancel = function (e) {
			mouseDown = false;
		};
		canvas.oncontextmenu = function (e) {
			e.preventDefault();
		};
		canvas.onmousedown = function (e) {
			erasing = e.button == 2;
			e.preventDefault();
			if (canvas.setCapture)
				canvas.setCapture();
			mouseDown = true;
			draw(e.offsetX || e.layerX, e.offsetY || e.layerY, true);
		};
		canvas.onmousemove = function (e) {
			if (mouseDown) {
				e.preventDefault();
				draw(e.offsetX || e.layerX, e.offsetY || e.layerY);
			}
		};
		window.onmouseup = function (e) {
			mouseDown = false;
		};
	});
	return obj;
}