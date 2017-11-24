var speedtypeModule = {
	id: "speedtype",
	todo: [],
	correct: 0,
	wrong: 0,
	typed: 0,
	correctTyped: 0,
	page: null,
	future: null,
	current: null,
	input: null,
	translation: null,
	load: function (id) {
		this.correct = 0;
		this.wrong = 0;
		this.page = document.getElementById("speedtype");
		this.future = this.page.querySelector(".next");
		this.current = this.page.querySelector(".current");
		this.input = this.page.querySelector(".text");
		this.translation = this.page.querySelector(".translation");
		var self = this;
		var xhr = new XMLHttpRequest();
		xhr.open("GET", "/api/speedtype");
		xhr.onload = function () {
			self.todo = JSON.parse(xhr.responseText);
			self.init();
		};
		xhr.send();
	},
	unload: function () {
	},
	confirm: function () {
		var a = this.input.value.toLowerCase().trim().replace(/\s+/g, " ");
		var b = this.current.textContent.toLowerCase().trim().replace(/\s+/g, " ");
		if (a == b) {
			this.correct++;
			this.correctTyped += b.replace(/\s+/g, "").length;
		}
		else
			this.wrong++;
		this.next();
	},
	next: function () {
		this.input.value = "";
		this.current.textContent = this.future.textContent;
		this.translation.textContent = this.future.getAttribute("data-translation");
		this.typed += this.current.textContent.replace(/\s+/g, "").length;
		if (!this.todo.length) {
			if (this.current.textContent.trim().length == 0)
				this.finish();
			this.future.textContent = "";
			this.future.setAttribute("data-translation", "");
			return;
		}
		var val = this.todo.pop();
		var v = val[0];
		var semicolon = v.indexOf(";;");
		if (semicolon != -1)
			v = v.substr(0, semicolon);
		this.future.textContent = v;
		this.future.setAttribute("data-translation", val[1]);
	},
	init: function () {
		if (!this.todo.length)
		{
			alert("You need to create a vocabulary book before being able to speedtype");
			return;
		}
		var firstKey = true;
		var self = this;
		this.input.onkeydown = function (e) {
			if (firstKey)
				self.setTimer();
			firstKey = false;
			if (e.key == "Enter")
				self.confirm();
		};
		this.next();
		this.next();
	},
	finish: function () {
		showRating(this.id, {
			correct: this.correct,
			wrong: this.wrong
		}, this.correctTyped, this.typed);
	},
	setTimer: function () {
		var self = this;
		setTimelimit(this.page.querySelector(".mdc-linear-progress"), 60 * 1000, function () {
			self.finish();
		}, true);
	}
}

modules["speedtype"] = speedtypeModule;