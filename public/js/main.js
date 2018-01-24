if ('serviceWorker' in navigator) {
	navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(function (reg) {
		if (reg.installing) {
			console.log('Service worker installing');
		} else if (reg.waiting) {
			console.log('Service worker installed');
		} else if (reg.active) {
			console.log('Service worker active');
			reg.update();
		}
	}).catch(function (error) {
		// registration failed
		console.log('Registration failed with ' + error);
	});
}

var views = document.getElementById("views");

function loadPage(id) {
	window.location.hash = "#" + id;
	var activePanel = views.querySelector(".view.active");
	var activeTab = document.querySelector(".modules > a.mdc-list-item--selected");
	if (activePanel) {
		activePanel.classList.remove("active");
		activePanel.setAttribute("aria-hidden", "true");
		activeTab.classList.remove("mdc-list-item--selected");
	}
	var newActivePanel = document.getElementById(id);
	var newActiveTab = document.querySelector(".modules > a[aria-controls=" + id + "]");
	if (newActivePanel) {
		newActivePanel.classList.add("active");
		if (activePanel)
			activePanel.setAttribute("aria-hidden", "false");
		newActiveTab.classList.add("mdc-list-item--selected");
	}

	if (isSmallScreen())
		drawer.open = false;

	if (id == "home")
		reloadScores();
}

var modules = {};

var activeModule;
var unsaved;
var drawer;
var startupDialog;
var usernamePreview;

var speedrun = false;
var timersEnabled = true;
var shouldSync = false;
var username = "";

function loadModule(id) {
	if (unloadModule()) {
		activeModule = id;
		loadPage(id);
		if (modules[id] && modules[id].load)
			modules[id].load(id);
	}
}

function unloadModule() {
	stopTimelimit(true);
	if (activeModule && !unsaved && modules[activeModule] && modules[activeModule].unload) {
		if (modules[activeModule].unload(activeModule) === false)
			return;
		activeModule = undefined;
		unsaved = false;
		return true;
	}
	else if (!activeModule || !unsaved || confirm("Do you really want to exit?")) {
		activeModule = undefined;
		unsaved = false;
		return true;
	}
	return false;
}

function exitModule() {
	if (unloadModule())
		loadPage("home");
}

window.onbeforeunload = function () {
	if (unsaved)
		return true;
};

function shuffle(array) {
	var m = array.length, t, i;

	// While there remain elements to shuffle…
	while (m) {

		// Pick a remaining element…
		i = Math.floor(Math.random() * m--);

		// And swap it with the current element.
		t = array[m];
		array[m] = array[i];
		array[i] = t;
	}

	return array;
}

var scoreDialog;
var scoreDialogElement;

function showRating(id, obj, score, total) {
	if (total == 0)
		total = 1;
	stopTimelimit(true);
	if (modules[activeModule] && modules[activeModule].unload)
		modules[activeModule].unload(activeModule);
	activeModule = undefined;
	unsaved = false;
	loadPage("home");
	var percent = Math.round(score / total * 1000) / 10;
	var grade = "F";
	if (percent >= 100)
		grade = "S";
	else if (percent >= 95)
		grade = "A";
	else if (percent >= 80)
		grade = "B";
	else if (percent >= 65)
		grade = "C";
	else if (percent >= 50)
		grade = "D";
	scoreDialogElement.querySelector(".score").textContent = percent + "%";
	var icon = scoreDialogElement.querySelector(".icon");
	icon.className = "icon " + grade.toLowerCase();
	icon.textContent = grade;
	var details = scoreDialogElement.querySelector(".details");
	while (details.firstChild)
		details.removeChild(details.firstChild);
	for (var key in obj) {
		if (obj.hasOwnProperty(key)) {
			var detail = document.createElement("p");
			detail.className = "detail " + key;
			detail.textContent = obj[key];
			details.appendChild(detail);
		}
	}
	scoreDialog.show();

	putScore(id, {
		detail: obj,
		val: score,
		max: total,
		at: new Date().getTime()
	});
}

var timelimitTimer;
var timelimitElement;
var timelimitRunning;
var timelimitRemaining;
var timelimitMax;
var timelimitForce;

function setProgress(elem, progress) {
	new mdc.linearProgress.MDCLinearProgress(elem).progress = progress;
}

function setTimelimit(elem, ms, cb, force) {
	if (!timersEnabled && !force)
		return;
	timelimitForce = force;
	timelimitElement = new mdc.linearProgress.MDCLinearProgress(elem);
	timelimitElement.progress = 0;
	timelimitMax = timelimitRemaining = ms;
	clearInterval(timelimitTimer);
	timelimitRunning = true;
	timelimitTimer = setInterval(function () {
		if (!timelimitRunning)
			return;
		timelimitRemaining -= 10;
		timelimitElement.progress = (timelimitMax - timelimitRemaining) / timelimitMax;
		if (timelimitRemaining <= 0) {
			stopTimelimit(true);
			cb();
		}
	}, 10);
}

function pauseTimelimit(force) {
	if (timelimitForce && !force)
		return;
	timelimitRunning = false;
}

function resumeTimelimit() {
	timelimitRunning = true;
}

function stopTimelimit(force) {
	if (timelimitForce && !force)
		return;
	if (timelimitElement)
		timelimitElement.progress = 0;
	timelimitRunning = false;
	clearInterval(timelimitTimer);
}

function putScore(id, obj) {
	var existing = window.localStorage.getItem("score." + id);
	if (!existing || existing == "[]")
		window.localStorage.setItem("score." + id, JSON.stringify([obj]));
	else
		window.localStorage.setItem("score." + id, existing.substr(0, existing.length - 1) + "," + JSON.stringify(obj) + "]");
	var at = new Date().toISOString();
	window.localStorage.setItem("update." + id, at);
	reloadScores();

	if (shouldSync) {
		var xhr = new XMLHttpRequest();
		xhr.onload = function () {
			if (xhr.status == 200) {
				processScoreDownload(JSON.parse(xhr.responseText));
			}
		};
		xhr.open("GET", "/api/add?user=" + encodeURIComponent(username) + "&id=" + encodeURIComponent(id) + "&score=" + encodeURIComponent(JSON.stringify(obj)) + "&at=" + encodeURIComponent(at));
		xhr.send();
	}
}

function processScoreDownload(json) {
	var updated = false;
	for (var i = 0; i < json.length; i++) {
		var elem = json[i];
		if (!window.localStorage.getItem("score." + elem.id) || !window.localStorage.getItem("update." + elem.id) || new Date(elem.update) > new Date(window.localStorage.getItem("update." + elem.id))) {
			window.localStorage.setItem("score." + elem.id, JSON.stringify(elem.value));
			window.localStorage.setItem("update." + elem.id, elem.update);
			updated = true;
		}
	}
	if (updated)
		reloadScores();
}

function clearScores() {
	for (var key in window.localStorage)
		if (key.startsWith("score.") || key.startsWith("update."))
			window.localStorage.removeItem(key);
}

function downloadScores() {
	var xhr = new XMLHttpRequest();
	xhr.onload = function () {
		if (xhr.status == 200) {
			processScoreDownload(JSON.parse(xhr.responseText));
		}
	};
	xhr.onloadend = function () {
		if (xhr.status == 404 && xhr.responseText.trim().toLowerCase() == "user not found") {
			clearScores();
			reloadScores();
		}
	}
	xhr.open("GET", "/api/list?user=" + encodeURIComponent(username));
	xhr.send();
}

function isSmallScreen() {
	return window.innerWidth <= 600;
}

function updateUsernamePreview() {
	if (username)
		usernamePreview.textContent = "Online: " + username.substr(0, username.indexOf('#'));
	else
		usernamePreview.textContent = "Offline Mode";
}

function shortenUserhash(userhash) {
	var pound = userhash.indexOf("#");
	if (pound == -1)
		return userhash;
	else
		return userhash.substr(0, pound + 1 + 5);
}

function expandLanguage(id) {
	return {
		en: "English",
		de: "Deutsch",
		ja: "日本語"
	}[id] || id;
}

function languageIcon(id) {
	switch (id) {
		case "en":
			id = "gb";
			break;
		case "ja":
			id = "jp";
			break;
	}
	return "flag-icon-" + id;
}

window.onload = function () {
	mdc.autoInit();
	drawer = new mdc.drawer.MDCPersistentDrawer(document.querySelector(".mdc-drawer--persistent"));
	drawer.open = !isSmallScreen();
	document.querySelector(".mdc-toolbar__menu-icon").addEventListener("click", function () {
		drawer.open = !drawer.open;
	});

	startupDialog = new mdc.dialog.MDCDialog(document.getElementById("startup-dialog"));
	startupDialog.listen("MDCDialog:accept", function () {
		var name = document.getElementById("username-input").value;
		if (!name) {
			username = "";
			window.localStorage.setItem("username", "no");
			shouldSync = false;
		}
		else {
			if (name.indexOf('#') <= 0) {
				alert("Please enter a hash along with your username");
				startupDialog.show();
			}
			else {
				username = name;
				window.localStorage.setItem("username", name);
				shouldSync = true;
				clearScores();
				downloadScores();
				updateUsernamePreview();
			}
		}
	});

	username = window.localStorage.getItem("username");
	if (!username) {
		startupDialog.show();
		loadModule("md-home");
	}
	else if (username == "no") {
		shouldSync = false;
		username = "";
	}
	else
		shouldSync = true;

	function attach(c, selector) {
		document.querySelectorAll(selector).forEach(function (elem) {
			if (elem.id.endsWith("-template"))
				return;
			c.attachTo(elem);
		})
	}

	attach(mdc.ripple.MDCRipple, ".mdc-fab");
	attach(mdc.ripple.MDCRipple, ".mdc-button");
	attach(mdc.ripple.MDCRipple, ".mdc-ripple-surface");
	attach(mdc.select.MDCSelect, ".mdc-select");
	attach(mdc.textField.MDCTextField, ".mdc-text-field");
	document.querySelectorAll(".mdc-linear-progress").forEach(function (field) {
		var p = mdc.linearProgress.MDCLinearProgress.attachTo(field);
		p.progress = 0;
	});
	scoreDialogElement = document.getElementById("score-dialog");
	scoreDialog = new mdc.dialog.MDCDialog(scoreDialogElement);
	var hash = window.location.hash;
	if (hash) {
		loadModule(hash.substr(1));
	}

	usernamePreview = document.getElementById("username-preview");
	usernamePreview.parentElement.onclick = function () {
		document.getElementById("username-input").value = username;
		startupDialog.show();
		setTimeout(function () {
			document.getElementById("username-input").focus();
		}, 100);
	};

	updateUsernamePreview();

	if (shouldSync) {
		downloadScores();
	}
};