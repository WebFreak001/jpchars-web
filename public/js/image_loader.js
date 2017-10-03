var imageCache = {};

function loadImage(src, cb) {
	if (imageCache[src]) {
		imageCache[src].onready(function () {
			cb(imageCache[src].image);
		});
	}
	else {
		var obj = {
			queued: [],
			done: false,
			onready: function (cb) {
				if (this.done)
					setTimeout(cb, 0);
				else
					this.queued.push(cb);
			},
			image: new Image()
		};
		imageCache[src] = obj;
		obj.image.src = src;
		obj.onready(function () {
			cb(obj.image);
		});
		obj.image.onload = function () {
			obj.done = true;
			obj.queued.forEach(function (fn) {
				setTimeout(fn, 0);
			});
		};
	}
}