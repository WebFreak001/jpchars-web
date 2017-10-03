var views = document.getElementById("views");

function loadPage(id) {
	window.location.hash = "#" + id;
	var activePanel = views.querySelector(".view.active");
	var activeTab = document.querySelector(".modules > a.mdc-permanent-drawer--selected");
	if (activePanel) {
		activePanel.classList.remove("active");
		activePanel.setAttribute("aria-hidden", "true");
		activeTab.classList.remove("mdc-permanent-drawer--selected");
	}
	var newActivePanel = document.getElementById(id);
	var newActiveTab = document.querySelector(".modules > a[aria-controls=" + id + "]");
	if (newActivePanel) {
		newActivePanel.classList.add("active");
		activePanel.setAttribute("aria-hidden", "false");
		newActiveTab.classList.add("mdc-permanent-drawer--selected");
	}
}

var modules = {};

var activeModule;
var unsaved;

var speedrun = false;
var timersEnabled = true;

function loadModule(id) {
	if (unloadModule()) {
		activeModule = id;
		loadPage(id);
		if (modules[id] && modules[id].load)
			modules[id].load(id);
	}
}

function unloadModule() {
	stopTimelimit();
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
	stopTimelimit();
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

function setTimelimit(elem, ms, cb) {
	if (!timersEnabled)
		return;
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
			stopTimelimit();
			cb();
		}
	}, 10);
}

function pauseTimelimit() {
	timelimitRunning = false;
}

function resumeTimelimit() {
	timelimitRunning = true;
}

function stopTimelimit() {
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
}

window.onload = function () {
	mdc.autoInit();
	var drawer = new mdc.drawer.MDCPersistentDrawer(document.querySelector(".mdc-persistent-drawer"));
	drawer.open = window.innerWidth > 600;
	document.querySelector(".mdc-toolbar__icon--menu").addEventListener("click", function () {
		drawer.open = !drawer.open;
	});

	document.querySelectorAll('.mdc-button').forEach(function (btn) {
		mdc.ripple.MDCRipple.attachTo(btn);
	})
	document.querySelectorAll('.mdc-textfield').forEach(function (field) {
		mdc.textfield.MDCTextfield.attachTo(field);
	})
	document.querySelectorAll('.mdc-linear-progress').forEach(function (field) {
		var p = mdc.linearProgress.MDCLinearProgress.attachTo(field);
		p.progress = 0;
	})
	scoreDialogElement = document.getElementById("score-dialog");
	scoreDialog = new mdc.dialog.MDCDialog(scoreDialogElement);
	var hash = window.location.hash;
	if (hash) {
		loadModule(hash.substr(1));
	}
};