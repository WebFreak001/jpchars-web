var kanaRevModule = {
	todo: [],
	total: 0,
	page: null,
	$: {},
	correct: 0,
	wrong: 0,
	id: "",
	confirming: false,
	first: false,
	load: function (id) {
		loadKanaBase(this, id);
		this.$.draw = makeDrawCanvas();
		var area = this.page.querySelector(".area");
		while (area.firstChild)
			area.removeChild(area.firstChild);
		area.appendChild(this.$.draw.element);
		this.confirming = false;
		this.next();
	},
	unload: function () {
	},
	reset: function () {
		this.$.confirm.disabled = false;
		this.$.confirm.textContent = this.$.confirm.getAttribute("confirm-text");
		this.$.skip.disabled = false;
		this.$.skip.textContent = this.$.skip.getAttribute("skip-text");
		this.$.abort.disabled = false;
		this.$.draw.locked = false;
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
		var q = this.todo.shift();
		if (!pop)
			this.todo.push(q);
		var progress = this.page.querySelector(".progress");
		progress.textContent = (this.total - this.todo.length) + "/" + this.total;
		var qdiv = this.page.querySelector(".question");
		qdiv.textContent = romanizeCharacter(q);
		this.current = q;
		this.$.draw.clear();
		this.setTimer();
	},
	setTimer: function () {
		var self = this;
		setTimelimit(this.page.querySelector(".mdc-linear-progress"), speedrun ? 1500 : 4000, function () {
			self.confirm();
		});
	},
	confirm: function () {
		if (this.confirming) {
			this.correct++;
			this.next();
			return;
		}
		this.$.draw.locked = true;
		this.confirming = true;
		stopTimelimit();
		unsaved = true;
		this.$.confirm.textContent = this.$.confirm.getAttribute("correct-text");
		this.$.skip.textContent = this.$.skip.getAttribute("wrong-text");
		this.$.abort.disabled = true;

		this.page.querySelector(".question").textContent = this.current;
	},
	skip: function () {
		if (this.confirming) {
			this.wrong++;
			this.next();
			return;
		}
		this.next(false);
	},
	abort: function () {
		this.$.answer.value = "-";
		this.confirm();
	}
}

modules["katakana-rev"] = modules["hiragana-rev"] = kanaRevModule;