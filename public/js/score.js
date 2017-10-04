var loadedScores = [];

function loadScores(ids) {
	loadedScores = ids;
	ids.forEach(function (id) {
		try {
			var canvas = document.getElementById("score-" + id);
			var log = window.localStorage.getItem("score." + id);
			if (!log || log == "[]") {
				canvas.parentElement.style.display = "none";
				return;
			}
			canvas.parentElement.style.display = "block";
			var scores = JSON.parse(log);
			loadScore(canvas, scores);
			var n = 0;
			scores.forEach(function (score) {
				if (pastDays(score.at) < 7)
					n++;
			});
			var details = canvas.parentElement.querySelector("figcaption .details");
			details.textContent = " - " + n + " completed exercise" + (n == 1 ? "" : "s") + " in the last 7 days";
		}
		catch (e) {
			console.error(e);
		}
	});
}

function reloadScores() {
	loadScores(loadedScores);
}

var resizeTimer;
window.onresize = function () {
	clearTimeout(resizeTimer);
	resizeTimer = setTimeout(reloadScores, 100);
}

function transformRelativeTime(days) {
	return (Math.pow(0.5, days) - Math.pow(0.5, 6)) / (1 - Math.pow(0.5, 6));
}

function pastDays(ms) {
	return (new Date() - ms) / 1000 / 60 / 60 / 24;
}

function loadScore(canvas, scores) {
	/** @type { CanvasRenderingContext2D } */
	var context = canvas.getContext("2d");
	canvas.width = canvas.clientWidth;
	canvas.height = canvas.clientHeight;
	context.translate(0.5, 0.5);
	context.strokeStyle = "rgba(0,0,0,0.13)";
	for (var i = 0; i <= 10; i++) {
		if (i == 10)
			context.strokeStyle = "rgba(0,0,0,0.54)";
		else
			context.strokeStyle = "rgba(0,0,0,0.13)";
		var y = Math.floor((canvas.height - 1) * i / 10);
		context.beginPath();
		context.moveTo(0, y);
		context.lineTo(canvas.width - 1, y);
		context.stroke();
	}
	var dayLines = [];
	for (var i = 6; i >= 0; i--)
		dayLines.push(transformRelativeTime(i));
	dayLines.forEach(function (l) {
		var x = Math.round((canvas.width - 1) * l);
		context.beginPath();
		context.moveTo(x, canvas.height - 16);
		context.lineTo(x, canvas.height);
		context.stroke();
	});
	if (scores) {
		var first = 0;
		for (var i = 0; i < scores.length; i++) {
			if (new Date() - scores[i].at < 6 * 1000 * 60 * 60 * 24)
				break;
			first = i;
		}
		var maxMax = scores[first].max;
		for (var i = first + 1; i < scores.length; i++)
			maxMax = Math.max(maxMax, scores[i].max);
		function convY(y) {
			return canvas.height - 2 - (y / maxMax) * (canvas.height - 2);
		}
		function convX(t) {
			return transformRelativeTime(pastDays(t)) * canvas.width;
		}
		var lastY = 0;

		context.lineWidth = 2;

		context.strokeStyle = "rgba(0, 0, 0, 0.5)";
		context.beginPath();
		context.moveTo(0, lastY = convY(scores[first].max));
		for (var i = first; i < scores.length; i++)
			context.lineTo(convX(scores[i].at), lastY = convY(scores[i].max));
		context.lineTo(canvas.width, lastY);
		context.stroke();

		context.strokeStyle = "red";
		context.beginPath();
		context.moveTo(0, lastY = convY(scores[first].val));
		for (var i = first; i < scores.length; i++)
			context.lineTo(convX(scores[i].at), lastY = convY(scores[i].val));
		context.lineTo(canvas.width, lastY);
		context.stroke();
	}
	context.save();
	context.strokeStyle = "black";
	context.font = "12px Roboto, sans-serif";
	context.translate(-0.5, -0.5);
	context.rotate(0.5 * Math.PI);
	for (var i = 6; i >= 0; i--) {
		var txt = "Now";
		if (i != 6)
			txt = "-" + (6 - i) + " Day" + (i == 5 ? "" : "s");
		var w = context.measureText(txt).width;
		context.fillText(txt, canvas.height - w - 20, Math.max(-canvas.width + 12, -canvas.width * dayLines[i]));
	}
	context.restore();
}