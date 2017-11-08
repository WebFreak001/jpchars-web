var createVocabularyList = document.getElementById("create-vocabulary-list");

var lastSuggest;
var ignoreSuggest;
var suggestTimeout;
function suggestTranslation(id, ev) {
	if (ignoreSuggest)
		return;
	clearTimeout(suggestTimeout);
	var this_ = this;
	suggestTimeout = setTimeout(function () {
		var xhr = new XMLHttpRequest();
		xhr.open("GET", "/api/vocabulary/suggest?lang=" + encodeURIComponent(document.getElementById("vocadd_lang" + id).value)
			+ "&input=" + encodeURIComponent(this_.value));
		xhr.onload = function () {
			var voc = JSON.parse(xhr.responseText);
			if (!Array.isArray(voc) || voc.length == 0)
				return;
			var suggestions = [];
			for (var i = 0; i < voc.length; i++) {
				var a = voc[i].translations[document.getElementById("vocadd_lang" + id).value];
				var b = voc[i].translations[document.getElementById("vocadd_lang" + (id == 1 ? 2 : 1)).value];
				suggestions.push([
					a + " - " + b,
					new Date(voc[i].date).toLocaleString() + " by " + voc[i].contributors.join(", "),
					[a, b, voc[i].bsonID]
				]);
			}
			suggest(this_, suggestions, function (ret) {
				ignoreSuggest = true;
				setTimeout(function () {
					ignoreSuggest = false;
				}, 600);
				lastSuggest = ret[2];
				this_.value = ret[2][0];
				this_.focus();
				var other = document.getElementById("vocadd_translation" + (id == 1 ? 2 : 1));
				if (!other.value) {
					other.value = ret[2][1];
					other.focus();
				}
			});
		};
		xhr.send();
	}, 500);
}

function validateJapaneseVocabularyInput(s) {
	if (s.indexOf(";;") != -1 || s.indexOf("；；") != -1)
		return true;
	for (var i = 0; i < s.length; i++) {
		var c = s.charCodeAt(i);
		if (c < 0x2E80) continue;
		if (c > 0x3040 && c < 0x30FF) continue;
		alert("Please provide a romanization using kana after your japanese string separated with ;;\n\nExample: 日本語;;に・ほん・ご\n\n. will be converted to ・");
		return false;
	}
	return true;
}


var vocabularyCreationDialog = new mdc.dialog.MDCDialog(document.getElementById("vocabulary-create"));
vocabularyCreationDialog.listen("MDCDialog:accept", function () {
	var book = {
		name: document.getElementById("vocadd_name").value || "Unnamed Vocabulary Book",
		lang1: document.getElementById("vocadd_lang1").value,
		lang2: document.getElementById("vocadd_lang2").value,
		vocabulary: []
	};
	var req = {
		name: book.name,
		lang1: book.lang1,
		lang2: book.lang2,
		vocabulary: []
	}
	for (var i = 0; i < createVocabularyList.children.length; i++) {
		var child = createVocabularyList.children[i];
		var id = child.getAttribute("data-vocabulary-id");
		var a = child.getAttribute("data-vocabulary-a");
		var b = child.getAttribute("data-vocabulary-b");
		if (!a || !b)
			continue;
		var tr = {};
		tr[book.lang1] = a;
		tr[book.lang2] = b;
		book.vocabulary.push({
			_id: id,
			translations: tr
		});
		req.vocabulary.push(id);
	}
	if (!book.vocabulary.length)
		return;
	function saveVocabularyBook() {
		var s = JSON.stringify(book);
		var existing = window.localStorage.getItem("vocabulary.packs") || "";
		if (!existing || existing == "[]")
			window.localStorage.setItem("vocabulary.packs", "[" + s + "]");
		else
			window.localStorage.setItem("vocabulary.packs", existing.slice(0, -1) + "," + s + "]");
		vocabularyModule.reloadPacks();
	}
	if (username) {
		var xhr = new XMLHttpRequest();
		xhr.open("POST", "/api/vocabulary/book?user=" + encodeURIComponent(username));
		xhr.setRequestHeader("Content-Type", "application/json");
		xhr.send(JSON.stringify(req));
		xhr.onloadend = function () {
			if (xhr.status == 0 || xhr.status == 200)
				return;
			alert("Failed to save vocabulary book:\n\n" + xhr.responseText);
			vocabularyCreationDialog.show();
		};
		xhr.onload = function () {
			if (xhr.status == 200) {
				var id = JSON.parse(xhr.responseText);
				if (typeof id !== "string")
					return alert("Unexpected response: " + id);
				book._id = id;
				saveVocabularyBook();
			}
		}
	}
	else saveVocabularyBook();
});
vocabularyCreationDialog.listen("MDCDialog:cancel", function (e) {
	if (e.explicitOriginalTarget.tagName != "BUTTON")
		setTimeout(function () {
			vocabularyCreationDialog.show();
		}, 10);
});

function loadVocabularyFromElement(elem) {
	var ret = [];
	var attr = elem.getAttribute("data");
	if (attr) {
		var data = JSON.parse(attr);
		var from = data.lang1;
		var to = data.lang2;
		for (var i = 0; i < data.vocabulary.length; i++) {
			var a = data.vocabulary[i].translations[from];
			var b = data.vocabulary[i].translations[to];
			if (a && b)
				ret.push([a, b]);
		}
	}
	return ret;
}

function regenCanvas() {
	var w = Math.max(1, Math.min(8, Math.floor(window.innerWidth / getCanvasSize())));
	var h = Math.round(16 / w);
	var area = document.querySelector(".vocabulary .learn .area");
	while (area.childNodes.length)
		area.removeChild(area.firstChild);
	var canvas = makeDrawCanvas(w, h);
	area.appendChild(canvas.element);
	canvas.createdFor = window.innerWidth;
	return canvas;
}

var vocabularyPacks = [];
var vocabularyModule = {
	packselect: document.querySelector(".vocabulary .packselect"),
	learn: document.querySelector(".vocabulary .learn"),
	drawCanvas: regenCanvas(),
	load: function () {
		var tra1 = document.getElementById("vocadd_translation1");
		var tra2 = document.getElementById("vocadd_translation2");
		tra1.onfocus = suggestTranslation.bind(tra1, 1);
		tra2.onfocus = suggestTranslation.bind(tra2, 2);
		tra1.oninput = suggestTranslation.bind(tra1, 1);
		tra2.oninput = suggestTranslation.bind(tra2, 2);
		this.correct = 0;
		this.partly = 0;
		this.wrong = 0;
		this.validating = false;
		this.learn.style.display = "none";
		this.showPackSelect();
		this.syncVocabulary();
	},
	syncVocabulary: function () {
		var packs = JSON.parse(window.localStorage.getItem("vocabulary.packs") || "[]");
		var xhr = new XMLHttpRequest();
		xhr.open("GET", "/api/vocabulary/book?user=" + encodeURIComponent(username));
		xhr.send();
		xhr.onload = function () {
			if (xhr.status == 200) {
				var vocs = JSON.parse(xhr.responseText);

				for (var j = 0; j < vocs.length; j++) {
					var voc = vocs[j];
					var found = false;
					for (var i = 0; i < packs.length; i++) {
						if (packs[i]._id == voc._id) {
							packs[i] = voc;
							found = true;
						}
					}
					if (!found)
						packs.push(voc);
				}

				window.localStorage.setItem("vocabulary.packs", JSON.stringify(packs));

				vocabularyModule.reloadPacks(true);
			}
		}
	},
	showPackSelect: function () {
		this.packselect.style.display = "block";
		var createPackButton = document.getElementById("vocabulary-create-pack-button");
		createPackButton.classList.remove("mdc-fab--exited");
	},
	reloadPacks: function (soft) {
		var packs = document.getElementById("vocabulary-packs");
		while (packs.lastChild && !soft)
			packs.removeChild(packs.lastChild);
		vocabularyPacks = JSON.parse(window.localStorage.getItem("vocabulary.packs") || "[]");
		if (!vocabularyPacks.length && !soft) {
			var nopacks = document.createElement("p");
			nopacks.className = "nopacks";
			nopacks.textContent = "No vocabulary packs have been created yet, create a new one or import a pack from the community to start";
			packs.appendChild(nopacks);
		}
		for (var i = 0; i < vocabularyPacks.length; i++) {
			var pack = vocabularyPacks[i];
			if (soft && packs.querySelector("li[data-id=\"" + pack._id + "\"]"))
				continue;
			var li = document.createElement("li");
			li.className = "mdc-list-item";
			li.setAttribute("data-id", pack._id);
			li.setAttribute("data", JSON.stringify(pack));
			var cb = document.getElementById("checkbox-template").cloneNode(true);
			cb.className = "mdc-list-item__start-detail mdc-checkbox";
			li.appendChild(cb);
			var text = document.createElement("span");
			text.className = "mdc-list-item__text";
			text.textContent = pack.name;
			var langPair = document.createElement("span");
			langPair.className = "lang-pair";
			var fromLang = document.createElement("span");
			fromLang.className = "lang-from flag-icon flag-icon-squared " + languageIcon(pack.lang1);
			langPair.appendChild(fromLang);
			var toLang = document.createElement("span");
			toLang.className = "lang-to flag-icon flag-icon-squared " + languageIcon(pack.lang2);
			langPair.appendChild(toLang);
			text.appendChild(langPair);
			li.appendChild(text);
			packs.appendChild(li);
			if (soft) {
				var nopacks = packs.querySelector(".nopacks");
				if (nopacks)
					packs.removeChild(nopacks);
			}
		}
	},
	unload: function () {
	},
	learnRandom: function () {
		var vocabulary = [];
		var packs = document.getElementById("vocabulary-packs").children;
		for (var i = 0; i < packs.length; i++) {
			var pack = packs[i];
			if (pack.tagName != "LI")
				continue;
			var v = loadVocabularyFromElement(pack);
			vocabulary.push.apply(vocabulary, v);
		}
		var currentIndex = vocabulary.length, temporaryValue, randomIndex;

		// While there remain elements to shuffle...
		while (currentIndex > 0 && currentIndex > vocabulary.length - 10) {
			randomIndex = Math.floor(Math.random() * currentIndex);
			currentIndex--;

			temporaryValue = vocabulary[currentIndex];
			vocabulary[currentIndex] = vocabulary[randomIndex];
			vocabulary[randomIndex] = temporaryValue;
		}

		if (vocabulary.length > 10)
			vocabulary = vocabulary.slice(-10);
		if (vocabulary.length == 0)
			return alert("There is no vocabulary to learn from, create a pack first.");
		this.learnVocabulary(vocabulary, 2);
	},
	learnSelected: function (mode) {
		var vocabulary = [];
		var packs = document.getElementById("vocabulary-packs").children;
		for (var i = 0; i < packs.length; i++) {
			var pack = packs[i];
			if (pack.tagName != "LI")
				continue;
			if (!pack.firstElementChild.querySelector("input").checked)
				continue;
			var v = loadVocabularyFromElement(pack);
			vocabulary.push.apply(vocabulary, v);
		}
		this.learnVocabulary(vocabulary, mode);
	},
	learnVocabulary: function (vocabulary, mode) {
		if (vocabulary.length == 0)
			return alert("Please select at least one vocabulary pack");
		this.toLearn = vocabulary;
		this.numLearn = vocabulary.length;
		this.learnMode = mode;
		this.packselect.style.display = "none";
		this.learn.style.display = "block";
		this.nextVocabulary();
	},
	numLearn: 0,
	toLearn: [],
	currentVoc: ["", ""],
	learnMode: 0,
	hint: "",
	validating: false,
	correct: 0,
	partly: 0,
	wrong: 0,
	confirm: function (state) {
		var confirmBtn = this.learn.querySelector(".confirm");
		var partialBtn = this.learn.querySelector(".partial");
		var wrongBtn = this.learn.querySelector(".wrong");
		if (this.validating) {
			if (state == 0)
				this.correct++;
			else if (state == 1)
				this.partly++;
			else
				this.wrong++;
			confirmBtn.textContent = confirmBtn.getAttribute("confirm-text");
			partialBtn.disabled = true;
			wrongBtn.disabled = true;
			this.validating = false;
			this.nextVocabulary();
		}
		else {
			confirmBtn.textContent = confirmBtn.getAttribute("correct-text");
			partialBtn.disabled = false;
			wrongBtn.disabled = false;
			this.validating = true;
			this.showSolution();
			stopTimelimit();
		}
	},
	nextVocabulary: function () {
		if (this.toLearn.length == 0) {

		} else {
			var v = this.toLearn.pop();
			this.currentVoc = v;
			var useB = this.learnMode == 1 || (this.learnMode == 2 && Math.random() > 0.5);
			this.hint = "";
			var insertText1 = v[1];
			var semicolon = v[0].indexOf(";;");
			if (semicolon != -1) {
				this.hint = v[0].substr(semicolon + 2).trim();
				v[0] = v[0].substr(0, semicolon);
			}
			semicolon = v[1].indexOf(";;");
			if (semicolon != -1) {
				if (this.hint)
					this.hint += " // ";
				this.hint += v[1].substr(semicolon + 2).trim();
				insertText1 = v[1].substr(semicolon + 2).trim().replace(/・/g, "") || v1.substr(0, semicolon);
				v[1] = v[1].substr(0, semicolon);
			}
			this.learn.querySelector(".progress").textContent = (this.numLearn - this.toLearn.length) + "/" + this.numLearn;
			this.learn.querySelector(".solution").textContent = useB ? insertText1 : "";
			this.learn.querySelector(".romanization").textContent = "";
			this.learn.querySelector(".answer").value = useB ? "" : v[0];
			this.learn.querySelector(".answer").disabled = !useB;
			if (window.innerWidth != this.drawCanvas.createdFor)
				this.drawCanvas = regenCanvas();
			else
				this.drawCanvas.clear();
			this.setTimer();
		}
	},
	setTimer: function () {
		var self = this;
		setTimelimit(this.learn.querySelector(".mdc-linear-progress"), speedrun ? 30000 : 45000, function () {
			if (!self.validating)
				self.confirm();
		});
	},
	showSolution: function () {
		this.learn.querySelector(".solution").textContent = this.currentVoc[1];
		this.learn.querySelector(".romanization").textContent = this.hint;
		if (this.learn.querySelector(".answer").disabled)
			this.learn.querySelector(".answer").value = this.currentVoc[0];
		else if (this.learn.querySelector(".answer").value != this.currentVoc[0])
			this.learn.querySelector(".answer").value += " -> " + this.currentVoc[0];
		else
			this.learn.querySelector(".answer").value += " - Correct!";
	},
	creator: {
		add: function (id, a, b) {
			if (document.getElementById("vocadd_lang1").value == "ja" && !validateJapaneseVocabularyInput(a))
				return;
			if (document.getElementById("vocadd_lang2").value == "ja" && !validateJapaneseVocabularyInput(b))
				return;
			if (document.getElementById("vocadd_lang1").value == "ja")
				a = a.replace(/\./g, "・").replace(/；；/g, ";;");
			if (document.getElementById("vocadd_lang2").value == "ja")
				b = b.replace(/\./g, "・").replace(/；；/g, ";;");
			var item = document.createElement("li");
			item.className = "mdc-list-item";
			item.setAttribute("data-vocabulary-id", id);
			item.setAttribute("data-vocabulary-a", a);
			item.setAttribute("data-vocabulary-b", b);
			var cb = document.getElementById("checkbox-template").cloneNode(true);
			cb.className = "mdc-list-item__start-detail mdc-checkbox";
			item.appendChild(cb);
			var text = document.createElement("span");
			text.className = "mdc-list-item__text";
			text.textContent = a;
			var textSecondary = document.createElement("span");
			textSecondary.className = "mdc-list-item__text__secondary";
			textSecondary.textContent = b;
			text.appendChild(textSecondary);
			item.appendChild(text);
			createVocabularyList.insertBefore(item, document.getElementById("vocaddentry"));
			//document.getElementById("vocabulary-create-dialog-section") // TODO: scroll to bottom
			return item;
		},
		listSelected: function () {
			var ret = [];
			for (var i = 0; i < createVocabularyList.children.length; i++) {
				var child = createVocabularyList.children[i];
				if (child.querySelector("input").checked)
					ret.push(child);
			}
			return ret;
		},
		removeSelected: function () {
			var selected = this.listSelected();
			for (var i = selected.length - 1; i >= 0; i--)
				selected[i].parentElement.removeChild(selected[i]);
		},
		addCurrent: function () {
			var tra1e = document.getElementById("vocadd_translation1");
			var tra2e = document.getElementById("vocadd_translation2");
			if (tra1e.disabled)
				return;
			if (document.getElementById("vocadd_lang1").value == "ja" && !validateJapaneseVocabularyInput(tra1e.value.trim()))
				return;
			if (document.getElementById("vocadd_lang2").value == "ja" && !validateJapaneseVocabularyInput(tra2e.value.trim()))
				return;
			var tra1 = tra1e.value.trim();
			var tra2 = tra2e.value.trim();
			if (document.getElementById("vocadd_lang1").value == "ja")
				tra1 = tra1.replace(/\./g, "・").replace(/；；/g, ";;");
			if (document.getElementById("vocadd_lang2").value == "ja")
				tra2 = tra2.replace(/\./g, "・").replace(/；；/g, ";;");
			if (!tra1 || !tra2)
				return alert("Please fill out both translations before adding");
			if (lastSuggest && (lastSuggest[0] == tra1 || lastSuggest[1] == tra1) && (lastSuggest[0] == tra2 || lastSuggest[1] == tra2)) {
				vocabularyModule.creator.add(lastSuggest[2], tra1, tra2);
				tra1e.value = "";
				tra2e.value = "";
				tra2e.focus();
				tra1e.focus();
				return;
			}
			var extend = lastSuggest && (lastSuggest[0] == tra1 || lastSuggest[1] == tra1 || lastSuggest[0] == tra2 || lastSuggest[1] == tra2);
			var query = "/api/vocabulary?user=" + encodeURIComponent(username);
			if (extend)
				query += "&extend=" + encodeURIComponent(lastSuggest[2]);
			query += "&lang=" + encodeURIComponent(document.getElementById("vocadd_lang1").value) + "&translation=" + encodeURIComponent(tra1);
			query += "&lang=" + encodeURIComponent(document.getElementById("vocadd_lang2").value) + "&translation=" + encodeURIComponent(tra2);
			tra1e.disabled = true;
			tra2e.disabled = true;
			var xhr = new XMLHttpRequest();
			xhr.open("POST", query);
			xhr.onloadend = function () {
				tra1e.disabled = false;
				tra2e.disabled = false;
				if (xhr.status != 0 && xhr.status != 200) alert("Error " + xhr.status + ": " + xhr.responseText);
			};
			xhr.onload = function () {
				tra1e.disabled = false;
				tra2e.disabled = false;
				if (xhr.status == 200) {
					var id = JSON.parse(xhr.responseText);
					if (typeof id != "string")
						return alert("Unexpected response");
					vocabularyModule.creator.add(id, tra1, tra2);
					tra1e.value = "";
					tra2e.value = "";
					tra2e.focus();
					tra1e.focus();
				}
				else alert("Error " + xhr.status + ": " + xhr.responseText);
			};
			xhr.send();
		},
		showNew: function () {
			vocabularyCreationDialog.show();
			document.getElementById("vocadd_name").focus();
		},
		updateLang: function () {
			var a = document.getElementById("vocadd_lang1");
			var b = document.getElementById("vocadd_lang2");
			document.getElementById("vocadd_translation1").nextElementSibling.textContent = expandLanguage(a.value) + " Translation";
			document.getElementById("vocadd_translation2").nextElementSibling.textContent = expandLanguage(b.value) + " Translation";
		}
	}
};

vocabularyModule.creator.updateLang();
vocabularyModule.reloadPacks();

modules["vocabulary"] = vocabularyModule;
