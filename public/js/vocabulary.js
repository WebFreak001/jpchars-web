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

function addProblematic(problem) {
	var existing = listProblematic();
	var problems = listProblematic();
	for (var i = problems.length - 1; i >= 0; i--)
		if (problems[i].from == problem.from && problems[i].to == problem.from) {
			if (problems[i].important == problem.important) {
				problems[i].important = problem.important;
				setProblematic(problems);
			}
			return;
		}
	problems.push(problem);
	setProblematic(problems);
}

function clearProblematic(vocabulary) {
	var problems = listProblematic();
	for (var i = problems.length - 1; i >= 0; i--)
		if (problems[i].from == vocabulary[0] && problems[i].to == vocabulary[1])
			problems.splice(i, 1);
	setProblematic(problems);
}

function setProblematic(problems) {
	if (Array.isArray(problems))
		window.localStorage.setItem("vocabulary.problematic", JSON.stringify(problems));
}

function listProblematic() {
	return JSON.parse(window.localStorage.getItem("vocabulary.problematic") || "[]");
}

function addRecent(vocabulary) {
	var recent = JSON.parse(window.localStorage.getItem("vocabulary.recent") || "[]");
	var found = false;
	for (var i = 0; i < recent.length; i++) {
		if (recent[i].voc[0] == vocabulary[0] && recent[i].voc[1] == vocabulary[1]) {
			found = true;
			recent[i].time = new Date().getTime();
			break;
		}
	}
	if (!found)
		recent.push({ time: new Date().getTime(), voc: vocabulary });
	window.localStorage.setItem("vocabulary.recent", JSON.stringify(recent));
}

var recentMinutes = 120;
function dropRecentVocabulary(arr) {
	var ret = [];
	var recent = JSON.parse(window.localStorage.getItem("vocabulary.recent") || "[]");
	for (var i = 0; i < arr.length; i++) {
		var doneRecently = false;
		for (var j = 0; j < recent.length; j++) {
			if (new Date() - recent[j].time <= recentMinutes * 60 * 1000 && recent[j].voc[0] == arr[i][0] && recent[j].voc[1] == arr[i][1]) {
				doneRecently = true;
				break;
			}
		}
		if (doneRecently) continue;
		ret.push(arr[i]);
	}
	return ret;
}

function fixProblematicInRandom(problems, array, max, index, important) {
	for (var i = 0; i < index; i++) {
		var voc = array[i];
		for (var j = problems.length - 1; j >= 0; j--) {
			if (voc[0] == problems[j].from && voc[1] == problems[j].to && problems[j].important == important) {
				var tmp = array[index - 1];
				array[index - 1] = [problems[j].from, problems[j].to];
				array[i] = tmp;
				index--;
				i--;
				problems.slice(j, 1);
				if (index <= max)
					return index;
				break;
			}
		}
	}
	return index;
}

function shuffleArray(array, start, max) {
	var currentIndex = array.length, temporaryValue, randomIndex;
	var shuffleEnd = 0;

	if (start !== undefined)
		currentIndex = start;
	if (max !== undefined)
		shuffleEnd = Math.max(0, array.length - max);

	// While there remain elements to shuffle...
	while (currentIndex > shuffleEnd) {
		randomIndex = Math.floor(Math.random() * currentIndex);
		currentIndex--;

		temporaryValue = array[currentIndex];
		array[currentIndex] = array[randomIndex];
		array[randomIndex] = temporaryValue;
	}
}

function validateJapaneseVocabularyInput(s) {
	if (s.indexOf(";;") != -1 || s.indexOf("；；") != -1)
		return true;
	for (var i = 0; i < s.length; i++) {
		var c = s.charCodeAt(i);
		if (!mightBeKanji(c)) continue;
		alert("Please provide a romanization using kana after your japanese string separated with ;;\n\nExample: 日本語;;に・ほん・ご\n\n. will be converted to ・");
		return false;
	}
	return true;
}

// sync with app.d
function mightBeKanji(c) {
	if (c >= 0x2E80 && c <= 0x2EFF)
		return true;
	if (c >= 0x3400 && c <= 0x4DBF)
		return true;
	if (c >= 0x4E00 && c <= 0x9FFF)
		return true;
	if (c >= 0xF900 && c <= 0xFAFF)
		return true;
	return false;
}

var vocabularyImportDialog = new mdc.dialog.MDCDialog(document.getElementById("vocabulary-import"));
vocabularyImportDialog.listen("MDCDialog:accept", function () {
	var list = document.getElementById("vocabulary-import").querySelector(".mdc-list");
	var lang1, lang2;
	var vocabulary = [];
	var working = 0;
	function importVocabulary(id) {
		working++;
		var xhr = new XMLHttpRequest();
		xhr.open("GET", "/api/vocabulary?id=" + encodeURIComponent(id));
		xhr.onload = function () {
			if (xhr.status == 200) {
				var voc = JSON.parse(xhr.responseText);
				for (var i = 0; i < voc.length; i++) {
					var found = false;
					for (var j = 0; j < vocabulary.length; j++) {
						if (vocabulary[j]._id == voc[i]._id) {
							found = true;
							break;
						}
					}
					if (found)
						continue;
					vocabulary.push(voc[i]);
				}
			}
			working--;
			if (working <= 0)
				vocabularyModule.creator.showNew(vocabulary, lang1, lang2);
		};
		xhr.send();
	}
	for (var i = 0; i < list.children.length; i++) {
		var child = list.children[i];
		var id = child.getAttribute("data-id");
		if (!id || !child.querySelector(".mdc-checkbox input").checked)
			continue;
		var l1 = child.getAttribute("data-lang1");
		var l2 = child.getAttribute("data-lang2");
		if (!lang1) {
			lang1 = l1;
			lang2 = l2;
		}
		importVocabulary(id);
	}
});
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
		var existing = window.localStorage.getItem("vocabulary.packs") || "[]";
		if (vocabularyCreationDialog.replaceID) {
			var all = JSON.parse(existing);
			var found = false;
			for (var i = 0; i < all.length; i++) {
				if (all[i]._id == vocabularyCreationDialog.replaceID) {
					all[i] = book;
					found = true;
					break;
				}
			}
			if (!found)
				all.push(book);
			window.localStorage.setItem("vocabulary.packs", JSON.stringify(all));
		}
		else {
			var s = JSON.stringify(book);
			if (existing == "[]")
				window.localStorage.setItem("vocabulary.packs", "[" + s + "]");
			else
				window.localStorage.setItem("vocabulary.packs", existing.slice(0, -1) + "," + s + "]");
		}
		vocabularyModule.reloadPacks();
	}
	if (username) {
		var xhr = new XMLHttpRequest();
		var suff = "";
		if (vocabularyCreationDialog.replaceID && !vocabularyCreationDialog.replaceID.startsWith("priv"))
			suff = "&disown=" + encodeURIComponent(vocabularyCreationDialog.replaceID);
		xhr.open("POST", "/api/vocabulary/book?user=" + encodeURIComponent(username) + suff);
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
	else {
		book._id = "priv" + new Date().getTime() + Math.random().toString(36);
		saveVocabularyBook();
	}
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
		this.total = 0;
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
		document.querySelector(".vocabulary .fab-group").style.display = "";
		setTimeout(function () {
			document.getElementById("vocabulary-create-pack-button").classList.remove("mdc-fab--exited");
		}, 20);

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
			/**
			 * @type {{_id: string, name: string, lang1: string, lang2: string, vocabluary: {_id: string, date: string, translations: {[index: string]: string}, contributors: string[]}[]}}
			 */
			var pack = vocabularyPacks[i];
			if (soft && packs.querySelector("li[data-id=\"" + pack._id + "\"]"))
				continue;
			var li = document.createElement("li");
			li.className = "mdc-list-item";
			li.setAttribute("data-id", pack._id);
			li.setAttribute("data", JSON.stringify(pack));
			var cb = document.getElementById("checkbox-template").cloneNode(true);
			cb.className = "mdc-list-item__graphic mdc-checkbox";
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
			var editButton = document.createElement("i");
			editButton.className = "material-icons vocabulary-edit-button";
			editButton.setAttribute("aria-role", "button");
			editButton.setAttribute("title", "Edit Vocabulary Pack");
			editButton.textContent = "edit";
			editButton.onclick = function (pack) {
				vocabularyModule.creator.showNew(pack.vocabulary, pack.lang1, pack.lang2, pack._id);
			}.bind(editButton, pack);
			text.appendChild(editButton);
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
		var vocabulary = this.getSelectedVocabulary();
		if (!vocabulary.length) {
			var packs = document.getElementById("vocabulary-packs").children;
			for (var i = 0; i < packs.length; i++) {
				var pack = packs[i];
				if (pack.tagName != "LI")
					continue;
				var v = loadVocabularyFromElement(pack);
				vocabulary.push.apply(vocabulary, v);
			}
		}
		var origVocabulary = vocabulary;
		vocabulary = dropRecentVocabulary(vocabulary);

		var currentIndex = vocabulary.length;

		if (document.getElementById("vocabulary_improv").checked) {
			var problems = listProblematic();
			currentIndex = fixProblematicInRandom(problems, vocabulary, vocabulary.length - 10, currentIndex, true);
			currentIndex = fixProblematicInRandom(problems, vocabulary, vocabulary.length - 10, currentIndex, false);

			var problemPercent = 0.4;
			var minIndex = Math.round(10 * (1 - problemPercent));
			currentIndex = Math.max(currentIndex, vocabulary.length - minIndex);
		}

		shuffleArray(vocabulary, currentIndex, 10);

		if (vocabulary.length > 10)
			vocabulary = vocabulary.slice(-10);
		if (vocabulary.length == 0) {
			if (origVocabulary.length == 0)
				return alert("There is no vocabulary to learn from, create a pack first.");
			else
				return alert("You have learned enough for now. Come back later or manually select vocabulary.");
		}
		this.learnVocabulary(vocabulary, 2);
	},
	getSelectedVocabulary: function () {
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
		return vocabulary;
	},
	learnSelected: function (mode) {
		var vocabulary = this.getSelectedVocabulary();
		shuffleArray(vocabulary);
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
		document.getElementById("vocabulary-create-pack-button").classList.add("mdc-fab--exited");
		setTimeout(function () {
			document.querySelector(".vocabulary .fab-group").style.display = "none";
		}, 700);
	},
	numLearn: 0,
	toLearn: [],
	currentVoc: ["", ""],
	currentFullVoc: ["", ""],
	learnMode: 0,
	hint: "",
	validating: false,
	correct: 0,
	partly: 0,
	wrong: 0,
	total: 0,
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

			if (state > 0) {
				addProblematic({
					from: this.currentFullVoc[0],
					to: this.currentFullVoc[1],
					important: state == 2
				});
			}
			else clearProblematic(this.currentFullVoc);
			addRecent(this.currentFullVoc);
			this.total++;
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
			this.showKanjiMeaning();
			stopTimelimit();
		}
		unsaved = true;
	},
	nextVocabulary: function () {
		if (this.toLearn.length == 0) {
			showRating("vocabulary", {
				correct: this.correct,
				partly: this.partly,
				wrong: this.wrong
			}, this.correct * 2 + this.partly, this.total * 2);
			return;
		} else {
			var v = this.toLearn.pop();
			this.currentFullVoc = JSON.parse(JSON.stringify(v));
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
			var kanji = this.learn.querySelector(".kanji");
			while (kanji.childNodes.length)
				kanji.removeChild(kanji.lastChild);
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
		for (var i = 0; i < this.currentVoc[1].length; i++)
			this.drawCanvas.putAnimation(i, this.currentVoc[1][i]);
		this.learn.querySelector(".romanization").textContent = this.hint;
		if (this.learn.querySelector(".answer").disabled)
			this.learn.querySelector(".answer").value = this.currentVoc[0];
		else if (this.learn.querySelector(".answer").value != this.currentVoc[0])
			this.learn.querySelector(".answer").value += " -> " + this.currentVoc[0];
		else
			this.learn.querySelector(".answer").value += " - Correct!";
	},
	showKanjiMeaning: function () {
		for (var i = 0; i < this.currentVoc[1].length; i++) {
			if (mightBeKanji(this.currentVoc[1].charCodeAt(i))) {
				var info = document.createElement("div");
				info.className = "meaning";
				info.style.display = "none";
				var character = document.createElement("div");
				character.className = "character";
				character.textContent = this.currentVoc[1].charAt(i);
				info.appendChild(character);
				getKanjiMeaning(this.currentVoc[1].charAt(i), function (stats) {
					if (!stats)
						return;
					info.style.display = "";
					if (stats.frequency) {
						var freq = document.createElement("div");
						freq.className = "frequency";
						freq.textContent = "Frequency Rank #" + stats.frequency;
						info.appendChild(freq);
					}
					if (stats.meanings.length) {
						var meanings = document.createElement("div");
						meanings.className = "meanings";
						meanings.textContent = "Meanings: " + stats.meanings.join(", ");
						info.appendChild(meanings);
					}
					if (stats.readings.length) {
						var readings = document.createElement("div");
						readings.className = "readings"; // TODO: kun, on
						readings.textContent = "Readings: " + stats.readings.join(", ");
						info.appendChild(readings);
					}
				});
				this.learn.querySelector(".kanji").appendChild(info);
			}
		}
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
			cb.className = "mdc-list-item__graphic mdc-checkbox";
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
		/**
		 * @param {{_id: string, translations: {[index: string]: string}}[]} vocabulary
		 */
		showNew: function (vocabulary, from, to, replaceID) {
			vocabularyCreationDialog.show();
			document.getElementById("vocadd_name").focus();
			for (var i = createVocabularyList.children.length - 1; i >= 0; i--) {
				var child = createVocabularyList.children[i];
				if (!child.id)
					child.parentElement.removeChild(child);
			}
			vocabularyCreationDialog.replaceID = replaceID;
			var a = document.getElementById("vocadd_lang1");
			var b = document.getElementById("vocadd_lang2");
			console.log(from);
			console.log(to);
			if (from)
				a.value = from;
			else
				a.value = a.options[0].value;
			if (to)
				b.value = to;
			else
				b.value = b.options[1].value;

			this.updateLang();

			if (vocabulary && from && to) {
				vocabulary = vocabulary.sort(function (a, b) {
					var a1 = a.translations[from];
					var a2 = a.translations[to];
					var b1 = b.translations[from];
					var b2 = b.translations[to];
					if (a1 == b1 || a2 == b2)
						return 0;
					if (a1 < b1)
						return -1;
					else if (a1 > b1)
						return 1;
					else if (a2 < b2)
						return -1;
					else if (a2 > b2)
						return 1;
					else return 0;
				});
				for (var i = 0; i < vocabulary.length; i++) {
					this.add(vocabulary[i]._id, vocabulary[i].translations[from], vocabulary[i].translations[to]);
				}
			}
		},
		showImport: function () {
			var done = false;
			var show = function () {
				if (done) return;
				done = true;
				vocabularyImportDialog.show();
			};
			var list = document.getElementById("vocabulary-import").querySelector(".mdc-list");
			while (list.children.length)
				list.removeChild(list.lastChild);

			setTimeout(show, 100);
			var xhr = new XMLHttpRequest();
			xhr.open("GET", "/api/vocabulary/book/all");
			xhr.onload = function () {
				var books = JSON.parse(xhr.responseText);
				function updateDisabled(lang1, lang2) {
					for (var i = 0; i < list.children.length; i++) {
						var child = list.children[i];
						if (!child.getAttribute("data-id"))
							continue;
						var l1 = child.getAttribute("data-lang1");
						var l2 = child.getAttribute("data-lang2");
						var enabled = (l1 == lang1 && l2 == lang2) || (l1 == lang2 && l2 == lang1);
						child.querySelector(".mdc-checkbox input").disabled = !enabled;
					}
				}
				function uncheckUpdate() {
					if (!list.querySelector(".mdc-checkbox input:checked")) {
						var cbs = list.querySelectorAll(".mdc-checkbox input");
						for (var i = 0; i < cbs.length; i++)
							cbs[i].disabled = false;
					}
				}
				for (var i = 0; i < books.length; i++) {
					var li = document.createElement("li");
					li.setAttribute("data-lang1", books[i].lang1);
					li.setAttribute("data-lang2", books[i].lang2);
					li.setAttribute("data-id", books[i]._id);
					li.className = "mdc-list-item";
					var cb = document.getElementById("checkbox-template").cloneNode(true);
					cb.className = "mdc-list-item__graphic mdc-checkbox";
					cb.querySelector("input").onchange = function (li) {
						if (this.checked)
							updateDisabled(li.getAttribute("data-lang1"), li.getAttribute("data-lang2"));
						else
							uncheckUpdate();
					}.bind(cb.querySelector("input"), li);
					li.appendChild(cb);
					var text = document.createElement("span");
					text.className = "mdc-list-item__text";
					text.textContent = books[i].name;
					var textSecondary = document.createElement("span");
					textSecondary.className = "mdc-list-item__text__secondary";
					textSecondary.textContent = books[i].vocabulary + " vocabulary packed by " + shortenUserhash(books[i].creator);
					text.appendChild(textSecondary);
					li.appendChild(text);
					list.appendChild(li);
				}
				show();
			};
			xhr.send();
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
