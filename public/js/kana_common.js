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

function loadKanaBase(self, id) {
	self.id = id;
	self.todo = [];
	self.page = document.getElementById(id);
	self.correct = 0;
	self.wrong = 0;
	self.first = true;
	self.timeoutTime = 0;
	var code;
	if (id.startsWith("hiragana"))
		code = 0x3040;
	else if (id.startsWith("katakana"))
		code = 0x30A0;
	else throw new Error("Module used for non-katakana/hiragana");
	for (var i = 0; i < learnedKana.length; i++)
		self.todo.push(String.fromCharCode(code + learnedKana[i]));
	self.todo = shuffle(self.todo);
	self.total = self.todo.length;
	self.$ = {};
	self.$.confirm = self.page.querySelector(".confirm");
	self.$.confirm.onclick = function () { self.confirm(); };
	self.$.skip = self.page.querySelector(".skip");
	self.$.skip.onclick = function () { self.skip(); };
	self.$.abort = self.page.querySelector(".abort");
	self.$.abort.onclick = function () { self.abort(); };
}