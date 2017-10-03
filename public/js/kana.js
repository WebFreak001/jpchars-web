var kanaRomanization = [
	undefined, "", "a", "", "i", "", "u", "", "e", "", "o", "ka", "ga", "ki", "gi",
	"ku", "gu", "ke", "ge", "ko", "go", "sa", "za", "shi", "ji", "su", "zu",
	"se", "ze", "so", "zo", "ta", "da", "chi", "ji", "", "tsu", "dsu", "te",
	"de", "to", "do", "na", "ni", "nu", "ne", "no", "ha", "ba", "pa", "hi", "bi",
	"pi", "fu", "bu", "pu", "he", "be", "pe", "ho", "bo", "po", "ma", "mi", "mu",
	"me", "mo", "", "ya", "", "yu", "", "yo", "ra", "ri", "ru", "re", "ro", "",
	"wa", "wi", "we", "wo", "n", "vu"
];
var learnedKana = [
	0x02, 0x04, 0x06, 0x08, 0x0a, 0x0b, 0x0d, 0x0f, 0x11, 0x13, 0x15, 0x17, 0x19,
	0x1b, 0x1d, 0x1f, 0x21, 0x24, 0x26, 0x28, 0x2a, 0x2b, 0x2c, 0x2d, 0x2e, 0x2f,
	0x32, 0x35, 0x38, 0x3b, 0x3e, 0x3f, 0x40, 0x41, 0x42, 0x44, 0x46, 0x48, 0x49,
	0x4a, 0x4b, 0x4c, 0x4d, 0x4f, 0x52, 0x53
];

function romanizeCharacter(c) {
	var code = c.charCodeAt(0);
	if (code >= 0x30A0)
		return kanaRomanization[code - 0x30A0];
	else if (code >= 0x3040)
		return kanaRomanization[code - 0x3040];
	else
		return undefined;
}

var kanaModule = {
	todo: [],
	total: 0,
	reverse: false,
	page: null,
	$: {},
	correct: 0,
	wrong: 0,
	id: "",
	first: false,
	timeoutTime: 0,
	load: function (id) {
		this.id = id;
		this.todo = [];
		this.reverse = false;
		this.page = document.getElementById(id);
		this.correct = 0;
		this.wrong = 0;
		this.first = true;
		this.timeoutTime = 0;
		var code;
		if (id.startsWith("hiragana"))
			code = 0x3040;
		else if (id.startsWith("katakana"))
			code = 0x30A0;
		else throw new Error("Module used for non-katakana/hiragana");
		this.reverse = id.endsWith("-rev");
		for (var i = 0; i < learnedKana.length; i++)
			this.todo.push(String.fromCharCode(code + learnedKana[i]));
		this.todo = shuffle(this.todo);
		this.total = this.todo.length;
		var self = this;
		this.$ = {};
		this.$.confirm = this.page.querySelector(".confirm");
		this.$.confirm.onclick = function () { self.confirm(); };
		this.$.skip = this.page.querySelector(".skip");
		this.$.skip.onclick = function () { self.skip(); };
		this.$.abort = this.page.querySelector(".abort");
		this.$.abort.onclick = function () { self.abort(); };
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

modules["katakana"] = modules["hiragana"] = modules["katakana-rev"] = modules["hiragana-rev"] = kanaModule;