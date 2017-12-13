var kanjilearnModule = {
	id: "kanjilearn",
	todo: [],
	current: [],
	currentWord: "",
	correctCount: 0,
	wrongCount: 0,
	canvas: null,
	showedZero: false,
	showing: false,
	checking: false,
	currentChar: "",
	load: function (id) {
		this.showedZero = false;
		this.checking = false;
		this.showing = false;
		this.correctCount = 0;
		this.wrongCount = 0;
		this.canvas = makeDrawCanvas(1, 1);
		this.canvas.locked = true;
		document.querySelector("#kanjilearn .correct").disabled = true;
		document.querySelector("#kanjilearn .wrong").disabled = true;
		var startBtn = document.querySelector("#kanjilearn .start");
		var area = document.querySelector("#kanjilearn .area");
		while (area.children.length > 0)
			area.removeChild(area.lastChild);
		area.appendChild(this.canvas.element);
		startBtn.disabled = true;
		var self = this;
		var xhr = new XMLHttpRequest();
		xhr.open("GET", "/api/kanjilearn?max=5&user=" + encodeURIComponent(username));
		xhr.onload = function () {
			self.todo = JSON.parse(xhr.responseText);
			if (!self.todo.length) {
				alert("You need to create a vocabulary book before being able to practice kanji");
				return;
			}
			startBtn.disabled = false;
		};
		xhr.send();
		this.canvas.onRepeat = function () {
			if (!self.showing)
				return;
			var i = self.canvas.strokeAnimations[0].frame;
			if (i == 1)
				self.showedZero = true;
			var len = self.canvas.strokeAnimations[0].images.length;
			setProgress(document.querySelector("#kanjilearn .mdc-linear-progress"), i / len);
			if (i >= len && self.showedZero) {
				self.animatedPause();
			}
		};
	},
	unload: function () {
	},
	correct: function () {
		this.correctCount++;
		this.rate();
	},
	wrong: function () {
		this.wrongCount++;
		this.rate();
	},
	rate: function () {
		this.checking = false;
		this.next();
	},
	next: function () {
		if (this.checking) {
			document.querySelector("#kanjilearn .correct").disabled = false;
			document.querySelector("#kanjilearn .wrong").disabled = false;
			document.querySelector("#kanjilearn .start").disabled = true;
			this.canvas.putAnimation(0, this.currentChar);
			return;
		}
		document.querySelector("#kanjilearn .correct").disabled = true;
		document.querySelector("#kanjilearn .wrong").disabled = true;
		document.querySelector("#kanjilearn .start").disabled = true;
		if (!this.current.length) {
			if (!this.todo.length) {
				this.finish();
				return;
			}
			this.todo.shift();
			var l = this.todo[0][0];
			var start = l.split("\t", 2);
			this.current = JSON.parse(start[0]);
			this.currentWord = start[1];
		}
		var l = this.currentWord;
		var currentIndex = this.current.shift();
		var c = l[currentIndex];
		this.currentChar = c;
		console.log(c);
		this.showedZero = false;
		this.canvas.clear();
		this.canvas.locked = true;
		this.canvas.putAnimation(0, c);
		document.querySelector("#kanjilearn .translation").textContent = this.todo[0][1];
		var word = document.querySelector("#kanjilearn .word");
		while (word.childNodes.length > 0)
			word.removeChild(word.lastChild);
		word.appendChild(document.createTextNode(l.substr(0, currentIndex)));
		var b = document.createElement("b");
		b.textContent = c;
		word.appendChild(b);
		word.appendChild(document.createTextNode(l.substr(currentIndex + 1)));
		this.showing = true;
		this.checking = true;
	},
	finish: function () {
	},
	animatedPause: function () {
		this.showing = false;
		this.canvas.putAnimation(0, "");
		this.canvas.clear();
		var word = document.querySelector("#kanjilearn .word");
		while (word.children.length > 0)
			word.removeChild(word.lastChild);
		var self = this;
		var animating = true;
		setTimelimit(document.querySelector("#kanjilearn .mdc-linear-progress"), 10000, function () {
			self.work();
			animating = false;
		}, true);
	},
	work: function () {
		document.querySelector("#kanjilearn .correct").disabled = true;
		document.querySelector("#kanjilearn .wrong").disabled = true;
		document.querySelector("#kanjilearn .start").disabled = false;
		this.canvas.locked = false;
	}
}

modules["kanjilearn"] = kanjilearnModule;