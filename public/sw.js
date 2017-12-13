var CACHE_NAME = "v2";

this.addEventListener("install", function (event) {
	event.waitUntil(
		caches.open(CACHE_NAME).then(function (cache) {
			return cache.addAll([
				"/",
				"/minikanji",
				"/kanjivg.xml",
				"/css/main.css",
				"/js/autosuggest.js",
				"/js/draw.js",
				"/js/image_loader.js",
				"/js/kana_common.js",
				"/js/kana_rev.js",
				"/js/kana.js",
				"/js/kanjilearn.js",
				"/js/main.js",
				"/js/score.js",
				"/js/speedtype.js",
				"/js/vocabulary.js",
				"/flag-icon-css/css/flag-icon.min.css",
				"/material-components-web/dist/material-components-web.css",
				"/css/main.css",
				"/iconfont/MaterialIcons-Regular.eot",
				"/iconfont/MaterialIcons-Regular.woff2",
				"/iconfont/MaterialIcons-Regular.woff",
				"/iconfont/MaterialIcons-Regular.ttf",
			]);
		})
	);
});

self.addEventListener("fetch", function (event) {
	event.respondWith(
		caches.match(event.request)
			.then(function (response) {
				// Cache hit - return response
				if (response) {
					return response;
				}

				// IMPORTANT: Clone the request. A request is a stream and
				// can only be consumed once. Since we are consuming this
				// once by cache and once by the browser for fetch, we need
				// to clone the response.
				var fetchRequest = event.request.clone();

				return fetch(fetchRequest).then(
					function (response) {
						// Check if we received a valid response
						if (!response || response.status !== 200 || response.type !== "basic") {
							return response;
						}

						// IMPORTANT: Clone the response. A response is a stream
						// and because we want the browser to consume the response
						// as well as the cache consuming the response, we need
						// to clone it so we have two streams.
						var responseToCache = response.clone();

						caches.open(CACHE_NAME)
							.then(function (cache) {
								cache.put(event.request, responseToCache);
							});

						return response;
					}
				);
			})
	);
});
