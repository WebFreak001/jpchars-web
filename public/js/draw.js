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

var kanjiStrokes = undefined;
function loadKanjiStrokes() {
	if (kanjiStrokes !== undefined)
		return;
	kanjiStrokes = null;
	var xhr = new XMLHttpRequest();
	xhr.open("GET", "/kanjivg.xml");
	xhr.onload = function () {
		if (xhr.status == 200) {
			kanjiStrokes = xhr.responseXML;
		}
	};
	xhr.send();
}

function getKanjiSVG(char) {
	if (!kanjiStrokes)
		return null;
	var code = char.charCodeAt(0).toString(16);
	while (code.length < 5)
		code = "0" + code;
	var kanji = kanjiStrokes.querySelector("kanji[id=\"kvg:kanji_" + code + "\"]");
	if (!kanji)
		return null;
	return kanji;
}

function makeKanjiImage(kanji) {
	var children = "";
	for (var i = 0; i < kanji.children.length; i++)
		children += new XMLSerializer().serializeToString(kanji.children[i]);
	var style = "<defs><style type=\"text/css\"><![CDATA[path{stroke:black;fill:none;stroke-linecap:round;stroke-linejoin:round}]]></style></defs>";
	var svg = "<svg viewBox=\"0 0 109 109\" width=\"109\" height=\"109\" xmlns=\"http://www.w3.org/2000/svg\">" + style + children + "</svg>";
	var img = new Image();
	img.src = "data:image/svg+xml," + encodeURIComponent(svg);
	return img;
}

loadKanjiStrokes();

var reqAnimationFrame = requestAnimationFrame || webkitRequestAnimationFrame || mozRequestAnimationFrame || oRequestAnimationFrame || function (cb) { setTimeout(cb, 16); };

var kanjiMeanings;

function loadKanjiMeanings() {
	if (kanjiMeanings !== undefined)
		return;
	kanjiMeanings = {};
	var xhr = new XMLHttpRequest();
	xhr.onload = function () {
		var lines = xhr.responseText.split('\n');
		for (var i = 0; i < lines.length; i++) {
			var part = lines[i].split('\x1d');
			kanjiMeanings[part[0]] = {
				c: part[0],
				frequency: parseInt(part[1], 36),
				meanings: part[2].split('\x1e'),
				readings: part[3].split('\x1e')
			}
		}
	};
	xhr.open("GET", "/minikanji");
	xhr.send();
}

loadKanjiMeanings();

function getKanjiMeaning(c, cb) {
	if (kanjiMeanings[c] !== undefined)
		cb(kanjiMeanings[c]);
	else {
		var xhr = new XMLHttpRequest();
		xhr.onload = function () {
			if (xhr.status == 200)
				cb(kanjiMeanings[c] = JSON.parse(xhr.responseText));
		};
		xhr.onloadend = function () {
			if (xhr.status != 200)
				cb(kanjiMeanings[c] = null);
		};
		xhr.open("GET", "/api/kanji?kanji=" + c);
		xhr.send();
	}
}

var kanjiFrameCache = {};

function loadKanjiFrames(char) {
	if (kanjiFrameCache[char] !== undefined)
		return kanjiFrameCache[char];
	kanjiFrameCache[char] = null;
	var svg = getKanjiSVG(char);
	if (!svg)
		return kanjiFrameCache[char];
	var paths = svg.querySelectorAll("path");
	var strokes = [];
	for (var i = 0; i < paths.length; i++) {
		if (/-s\d+$/.test(paths[i].id)) {
			var m = /^M(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)/.exec(paths[i].getAttribute("d"));
			var entry = [paths[i], null];
			if (m) {
				var circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
				circle.setAttribute("cx", m[1]);
				circle.setAttribute("cy", m[2]);
				circle.setAttribute("r", "3");
				circle.setAttribute("fill", "red");
				circle.setAttribute("style", "display:none");
				paths[i].parentElement.insertBefore(circle, paths[i].nextSibling);
				entry[1] = circle;
			}
			strokes.push(entry);
			paths[i].setAttribute("style", "display:none");
		}
	}
	if (!strokes.length)
		return kanjiFrameCache[char];
	kanjiFrameCache[char] = [];
	function loadNext(char, strokeN) {
		if (strokes[strokeN - 1] && strokes[strokeN - 1][1])
			strokes[strokeN - 1][1].setAttribute("style", "display:none");
		if (!strokes[strokeN])
			return;
		strokes[strokeN][0].removeAttribute("style");
		if (strokes[strokeN][1])
			strokes[strokeN][1].removeAttribute("style");
		var img = makeKanjiImage(svg);
		img.onload = function () {
			kanjiFrameCache[char].push(img);
			loadNext(char, strokeN + 1);
		};
	}
	loadNext(char, 0);
	return kanjiFrameCache[char];
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
	canvas.height = h * s + 2 + 32;
	canvas.style.width = canvas.width + "px";
	canvas.style.height = canvas.height + "px";
	var characters = [];
	for (var i = 0; i < w * h; i++)
		characters.push({ dots: [], starts: [] });
	var obj = {
		element: canvas,
		context: context,
		bg: null,
		raw: null,
		redrawTimer: 0,
		locked: false,
		strokeAnimationTimer: 0,
		strokeAnimations: [],
		characters: characters,
		selectedTool: 0,
		onRepeat: undefined,
		putAnimation: function (n, char) {
			if (!char) {
				obj.strokeAnimations[n] = undefined;
				return false;
			}
			var images = loadKanjiFrames(char);
			if (images === null) {
				obj.strokeAnimations[n] = undefined;
				return false;
			}
			obj.strokeAnimations[n] = {
				char: char,
				frame: 0,
				fresh: true,
				images: images
			};
			return true;
		},
		updateAnimation: function () {
			var found = false;
			for (var i = 0; i < obj.strokeAnimations.length; i++) {
				if (!obj.strokeAnimations[i])
					continue;
				found = true;
				if (obj.strokeAnimations[i].fresh) {
					obj.strokeAnimations[i].frame = 0;
					obj.strokeAnimations[i].fresh = false;
				}
				else
					obj.strokeAnimations[i].frame = (obj.strokeAnimations[i].frame + 1) % (obj.strokeAnimations[i].images.length + 1);
				reqAnimationFrame(function (i) {
					if (obj.onRepeat)
						obj.onRepeat(i);
				}.bind(obj, i));
			}
			if (found)
				obj.queueRedraw();
		},
		queueRedraw: function () {
			if (!obj.raw)
				return;
			clearTimeout(obj.redrawTimer);
			obj.redrawTimer = setTimeout(function () {
				reqAnimationFrame(function () {
					context.putImageData(obj.raw, 0, 0, 0, 0, canvas.width, canvas.height);
					for (var i = 0; i < obj.strokeAnimations.length; i++) {
						if (!obj.strokeAnimations[i] || !obj.strokeAnimations[i].images.length)
							continue;
						var frame = obj.strokeAnimations[i].images[obj.strokeAnimations[i].frame];
						if (!frame)
							continue;
						context.drawImage(frame, (i % w) * s, Math.floor(i / w) * s, s, s);
					}
					context.save();
					context.clearRect(0, canvas.height - 32, canvas.width, 32);
					context.fillStyle = "black";
					context.fillRect(0, canvas.height - 32, canvas.width / 2, 32);
					context.lineWidth = 4;
					context.strokeStyle = "gray";
					for (var i = 0; i < 2; i++) {
						context.beginPath();
						context.rect(canvas.width / 2 * i + 2, canvas.height - 30, canvas.width / 2 - 4, 28);
						context.stroke();
					}
					context.strokeStyle = "red";
					context.beginPath();
					context.rect(canvas.width / 2 * obj.selectedTool + 2, canvas.height - 30, canvas.width / 2 - 4, 28);
					context.stroke();
					context.restore();
				});
			}, 10);
		},
		clear: function () {
			if (!obj.bg)
				return;
			context.putImageData(obj.bg, 0, 0, 0, 0, canvas.width, canvas.height);
			obj.raw = context.getImageData(0, 0, canvas.width, canvas.height);
			obj.strokeAnimations = [];
			for (var i = 0; i < obj.characters.length; i++)
				obj.characters[i] = { dots: [], starts: [] };
			obj.queueRedraw();
		}
	};
	loadImage("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGIAAABiCAYAAACrpQYOAAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH4AUVEi4ZBXlPDQAAAP9JREFUeNrt3DGOhDAQRUGMOInvfyX3VSAyQgSQINmN6kUbTDJb24O+VprSWtsXDW/1K5ijrf9Qa037JiIi/XtwESAEAoReH9aZy/yQdhEg9FuIiDi3BAiBACEQIATCsrasXYSPJoGwrAUChEAIBAhZ1i5CIEBY1i4ChECAEAgQsqwta4EAYVmDcBECAUIgBMKytqxdRIKLuA+i61/Z01jyum9e5yImqfSvkvPFWZ4RAgFCIEDIsnYRAgFiyKDzP2uBACEQIATCsrasXYSPJoGwrAVCIEAIBAhZ1i5CIEBY1i4ChECAEAgQsqwta4EAYVmDcBECIRAgBMKytqwfOgCQQ1pvz+H/5gAAAABJRU5ErkJggg==",
		function (img) {
			obj.strokeAnimationTimer = setInterval(obj.updateAnimation, 2000);
			context.fillStyle = "#ddd";
			context.fillRect(0, 0, canvas.width, canvas.height);
			for (var y = 0; y < h; y++)
				for (var x = 0; x < w; x++)
					context.drawImage(img, x * s, y * s, s, s);
			obj.bg = context.getImageData(0, 0, canvas.width, canvas.height);
			obj.raw = context.getImageData(0, 0, canvas.width, canvas.height);

			obj.queueRedraw();

			var prevX, prevY;
			function putDot(xx, yy, erase, start) {
				var i = Math.floor(xx / s) + Math.floor(yy / s) * w;
				var r = bs * (erase ? 2 : 1);
				if (start)
					addStartCharDot(obj.characters[i], (xx / s % 1) * 1000, (yy / s % 1) * 1000);
				else if (erase)
					removeCharDot(obj.characters[i], (xx / s % 1) * 1000, (yy / s % 1) * 1000);
				else
					placeCharDot(obj.characters[i], (xx / s % 1) * 1000, (yy / s % 1) * 1000);
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
						else if (start) {
							obj.raw.data[(x + y * canvas.width) * 4] = 0xFF;
							obj.raw.data[(x + y * canvas.width) * 4 + 1] = 0;
							obj.raw.data[(x + y * canvas.width) * 4 + 2] = 0;
							obj.raw.data[(x + y * canvas.width) * 4 + 3] = 0xFF;
						}
						else {
							if (obj.raw.data[(x + y * canvas.width) * 4] == 0xFF && obj.raw.data[(x + y * canvas.width) * 4 + 1] == 0
								&& obj.raw.data[(x + y * canvas.width) * 4 + 2] == 0)
								continue;
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
			var drawX, drawY;

			function draw(dstX, dstY, start) {
				if (obj.locked || !mouseDown)
					return;
				if (dstY > canvas.height - 32) {
					if (start) {
						obj.selectedTool = Math.floor(dstX / canvas.width * 2);
						obj.queueRedraw();
					}
					return;
				}
				dstX = Math.floor(dstX);
				dstY = Math.floor(dstY);
				if (start) {
					prevX = dstX;
					prevY = dstY;
					drawX = Math.floor(dstX / s);
					drawY = Math.floor(dstY / s);
				}
				line(prevX, prevY, dstX, dstY, function (x, y) {
					var tx = Math.floor(x / s);
					var ty = Math.floor(y / s);
					if (tx != drawX || ty != drawY)
						return;
					putDot(x, y, obj.selectedTool == 1 || erasing, start);
					start = false;
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

function addStartCharDot(dots, x, y) {
	for (var i = 0; i < dots.dots.length; i += 2) {
		var ox = dots.dots[i];
		var oy = dots.dots[i + 1];

		if ((ox - x) * (ox - x) + (oy - y) * (oy - y) < 50 * 50)
			return;
	}
	dots.starts.push(x, y);
	dots.dots.push(x, y);
}

function placeCharDot(dots, x, y) {
	for (var i = 0; i < dots.dots.length; i += 2) {
		var ox = dots.dots[i];
		var oy = dots.dots[i + 1];

		if ((ox - x) * (ox - x) + (oy - y) * (oy - y) < 50 * 50)
			return;
	}
	dots.dots.push(x, y);
}

function removeCharDot(dots, x, y) {
	for (var i = dots.dots.length - 2; i >= 0; i -= 2) {
		var ox = dots.dots[i];
		var oy = dots.dots[i + 1];

		if ((ox - x) * (ox - x) + (oy - y) * (oy - y) < 80 * 80)
			dots.dots.splice(i, 2);
	}
	for (var i = dots.starts.length - 2; i >= 0; i -= 2) {
		var ox = dots.starts[i];
		var oy = dots.starts[i + 1];

		if ((ox - x) * (ox - x) + (oy - y) * (oy - y) < 50 * 50)
			dots.starts.splice(i, 2);
	}
}

function serializeCharacter(character) {
	var strokes = character.starts.length / 2;
	if (strokes > 35)
		strokes = 35;
	var serialization = strokes.toString(36);
	for (var i = 0; i < Math.min(400, character.dots.length); i++) {
		var n = Math.min(Math.max(Math.round(character.dots[i]), 0), 1000);
		var s = n.toString(36);
		if (s.length < 2)
			s = "0" + s;
		serialization += s;
	}
	return serialization;
}

function recognizeCharacter(character, cb) {
	var xhr = new XMLHttpRequest();
	xhr.open("GET", "/api/recognize?ch=" + encodeURIComponent(serializeCharacter(character)));
	xhr.onload = function () {
		cb(JSON.parse(xhr.responseText));
	};
	xhr.send();
}