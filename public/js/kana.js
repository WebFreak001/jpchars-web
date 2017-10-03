var kanaModule = {
	todo: [],
	total: 0,
	page: null,
	$: {},
	correct: 0,
	wrong: 0,
	id: "",
	first: false,
	timeoutTime: 0,
	load: function (id) {
		loadKanaBase(this, id);
		var self = this;
		this.$.answer = this.page.querySelector(".answer");
		this.$.answer.onkeydown = function (e) {
			if (self.first && !timelimitRunning)
				self.setTimer();
			if (e.key == "Enter") {
				if (new Date() - self.timeoutTime < 500)
					return;
				e.preventDefault();
				self.confirm();
			}
			else if (e.key == "Backspace" || e.key == "Delete" || e.key == "Home" || e.key == "End" || e.key == "Tab" || e.key == "ArrowLeft" || e.key == "ArrowRight" || e.key == "ArrowUp" || e.key == "ArrowDown") {
			}
			else if (e.key < 'a' || e.key > 'z') {
				e.preventDefault();
			}
		};
		this.next();
	},
	unload: function () {
	},
	reset: function () {
		this.$.answer.parentElement.classList.remove("invalid");
		this.$.answer.readOnly = false;
		this.$.answer.value = "";
		this.$.confirm.disabled = false;
		this.$.skip.disabled = false;
		this.$.abort.disabled = false;
		this.confirming = false;
	},
	next: function (pop) {
		if (pop === undefined)
			pop = true;
		this.reset();
		if (!this.todo.length) {
			showRating(this.id, {
				correct: this.correct,
				wrong: this.wrong
			}, this.correct, this.total);
			return;
		}
		this.$.answer.focus();
		var q = this.todo.shift();
		if (!pop)
			this.todo.push(q);
		var progress = this.page.querySelector(".progress");
		progress.textContent = (this.total - this.todo.length) + "/" + this.total;
		var qdiv = this.page.querySelector(".question");
		qdiv.textContent = q;
		this.current = q;

		if (!this.first)
			this.setTimer();
	},
	setTimer: function () {
		var self = this;
		setTimelimit(this.page.querySelector(".mdc-linear-progress"), speedrun ? 1500 : 4000, function () {
			if (!self.$.answer.value.trim())
				self.$.answer.value = "-";
			self.timeoutTime = new Date();
			self.confirm();
		});
	},
	confirm: function () {
		var input = this.$.answer.value.trim().toLowerCase();
		if (!input)
			return;
		stopTimelimit();
		unsaved = true;
		if (this.confirming) {
			this.next();
			return;
		}
		this.first = false;
		this.confirming = true;
		var correct = romanizeCharacter(this.current);
		if (correct == input) {
			this.correct++;
			this.next();
		}
		else {
			this.wrong++;
			this.$.skip.disabled = true;
			this.$.abort.disabled = true;

			this.$.answer.parentElement.classList.add("invalid");
			this.$.answer.readOnly = true;
			this.$.answer.value += " -> " + correct;
			this.$.answer.focus();
		}
	},
	skip: function () {
		this.next(false);
	},
	abort: function () {
		this.$.answer.value = "-";
		this.confirm();
	}
}

modules["katakana"] = modules["hiragana"] = kanaModule;