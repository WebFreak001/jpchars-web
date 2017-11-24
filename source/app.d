import vibe.vibe;

import std.algorithm;
import std.array;
import std.conv;
import std.functional;
import std.range;
import std.string;
import std.string : indexOfAny;

import modules.imodule;

import mongoschema;

import wagomu;

struct UserScore
{
	string user;
	string[string] storage;
	SchemaDate[string] storageUpdates;

	Json buildJson() const
	{
		Json ret = Json.emptyArray;
		foreach (key, value; storage)
			ret ~= Json(["id" : Json(key), "update" : Json(storageUpdates[key].toSysTime.toISOExtString),
					"value" : parseJsonString('[' ~ value ~ ']')]);
		return ret;
	}

	void addStorage(string key, string value, SysTime at)
	{
		if (key in storage)
			storage[key] ~= ',' ~ value;
		else
			storage[key] = value;
		storageUpdates[key] = SchemaDate.fromSysTime(at);
	}

	mixin MongoSchema;
}

void main()
{
	import modules.vocabulary : Vocabulary, VocabularyBook;

	static import config;

	auto settings = new HTTPServerSettings;
	settings.port = config.Port;
	settings.bindAddresses = ["::1", "127.0.0.1"];

	auto db = connectMongoDB("mongodb://localhost").getDatabase(config.Database);
	db["scores"].register!UserScore;
	db["vocpacks"].register!VocabularyBook;
	db["vocabulary"].register!Vocabulary;

	/*Vocabulary(BsonObjectID.init, SchemaDate.now, [
		"en": "tree",
		"jp": "木;;き"
	], ["webfreak"]).save();*/

	auto router = new URLRouter;
	auto longCache = new HTTPFileServerSettings();
	longCache.maxAge = 365.days;
	router.get("*", serveStaticFiles("node_modules", longCache));
	router.get("*", serveStaticFiles("public", longCache));
	router.get("/", &index);
	router.get("/api/list", &listScores);
	router.get("/api/add", &addScore);
	router.get("/api/kanji", &getKanji);
	router.get("/api/recognize", &getRecognize);
	router.post("/api/vocabulary", &postVocabulary);
	router.get("/api/vocabulary/book", &getVocabularyBooks);
	router.post("/api/vocabulary/book", &postVocabularyBook);
	router.get("/api/vocabulary/suggest", &getVocabularySuggestion);
	loadModules();
	loadKanjis();
	handwritingRecognizer.load("handwriting-ja.model");
	writeFileUTF8(Path("public/minikanji"),
			kanjis.filter!"a.frequency != 0 && a.frequency < 1000".map!"a.toMiniString".join("\n"));
	listenHTTP(settings, router);
	runApplication();
}

__gshared Recognizer handwritingRecognizer;

struct KanjiInfo
{
	dchar c;
	ushort frequency;
	string[] meanings;
	string[] readings;

	string toMiniString() const
	{
		return c.to!string ~ "\x1d" ~ frequency.to!string(
				36) ~ "\x1d" ~ meanings.join("\x1e") ~ "\x1d" ~ readings.join("\x1e");
	}

	static KanjiInfo fromLine(char[] line)
	{
		KanjiInfo ret;
		ret.c = line.front;
		line.popFront;
		line = line[12 .. $].stripLeft;
		bool brace, skipReading;
		while (line.length)
		{
			auto index = brace ? line.indexOf('}') : line.indexOfAny(" {");
			if (index == -1)
				index = line.length - 1;
			auto part = line[0 .. index].stripRight;
			bool wasBrace = brace;
			brace = line[index] == '{';
			line = line[index + 1 .. $].stripLeft;
			if (!part.length)
				continue;
			if (wasBrace)
				ret.meanings ~= part.idup;
			else if (part[0] == 'F')
				ret.frequency = part[1 .. $].to!ushort;
			else if ((part[0] == '-' || part.front > 255) && !skipReading)
				ret.readings ~= part.idup;
			else if (part[0] == 'T')
				skipReading = true;
			else
				skipReading = false;
		}
		return ret;
	}
}

KanjiInfo[] kanjis;

void loadKanjis()
{
	import std.stdio : File;

	kanjis = File("kanjidic", "r").byLine.drop(1).map!(KanjiInfo.fromLine)
		.array.sort!"a.c<b.c".array;
}

void getRecognize(scope HTTPServerRequest req, scope HTTPServerResponse res)
{
	string chs = req.query.get("ch");
	if (chs.length < 3 || chs.length > 800)
	{
		res.writeBody("[]", HTTPStatus.badRequest, "application/json");
		return;
	}
	auto numVec = cast(int)(chs.length - 1) / 4;
	Character ch = Character(numVec, chs[0 .. 1].to!int(36));
	foreach (i; 0 .. numVec)
	{
		float[4] v = 0;
		v[0] = chs[1 + i * 4 .. 1 + 2 + i * 4].to!int(36);
		v[1] = chs[1 + 2 + i * 4 .. 1 + 4 + i * 4].to!int(36);
		ch.points[i] = v;
	}
	handwritingRecognizer.windowSize = req.query.get("ws", "0").to!int;
	res.writeJsonBody(handwritingRecognizer.recognize(ch, 10));
}

void getKanji(scope HTTPServerRequest req, scope HTTPServerResponse res)
{
	auto kanji = req.query.get("kanji", "");
	enforceBadRequest(kanji.length, "Invalid kanji");
	dchar c = kanji.front;

	auto ret = kanjis.assumeSorted!"a.c<b.c".equalRange(KanjiInfo(c));
	if (ret.empty)
		res.writeBody("false", 404, "application/json");
	else
		res.writeJsonBody(ret.front);
}

void postVocabulary(scope HTTPServerRequest req, scope HTTPServerResponse res)
{
	import modules.vocabulary : Vocabulary;

	string user = req.query.get("user", "");
	enforceBadRequest(user.length, "Username required for submitting vocabulary");
	auto langs = req.query.getAll("lang");
	auto translations = req.query.getAll("translation");
	enforceBadRequest(langs.length >= 2, "Requires at least 2 languages");
	enforceBadRequest(translations.length = langs.length, "Translations must match languages");
	string[string] tr;
	foreach (i, l; langs)
		tr[l] = translations[i];
	Vocabulary v;
	string extend = req.query.get("extend", "");
	if (extend.length)
		v = Vocabulary.findById(extend);
	v.bsonID = BsonObjectID.generate();
	v.date = SchemaDate.now;
	v.translations = tr;
	string creator = user.hashUsername(true);
	if (!v.contributors.canFind(creator))
		v.contributors ~= creator;
	v.save();
	res.writeJsonBody(v.bsonID);
}

void getVocabularyBooks(scope HTTPServerRequest req, scope HTTPServerResponse res)
{
	import modules.vocabulary : Vocabulary, VocabularyBook;

	string user = req.query.get("user", "");
	enforceBadRequest(user.length, "Username required for listing vocabulary books");

	Json ret = Json.emptyArray;

	foreach (book; VocabularyBook.findRange(["creator" : user.hashUsername]))
	{
		Json obj = Json.emptyObject;

		obj["_id"] = Json(book.bsonID.toString);
		obj["name"] = Json(book.name);
		obj["lang1"] = Json(book.lang1);
		obj["lang2"] = Json(book.lang2);
		obj["vocabulary"] = Json.emptyArray;

		foreach (id; book.vocabulary)
		{
			auto voc = Vocabulary.tryFindById(id);
			if (voc.isNull)
				continue;
			obj["vocabulary"].appendArrayElement(voc.toSchemaBson!Vocabulary.toJson);
		}

		ret.appendArrayElement(obj);
	}

	res.writeJsonBody(ret);
}

void postVocabularyBook(scope HTTPServerRequest r, scope HTTPServerResponse res)
{
	import modules.vocabulary : Vocabulary, VocabularyBook;

	string user = r.query.get("user", "");
	enforceBadRequest(user.length, "Username required for submitting vocabulary books");
	Json req = r.json;
	string name = req["name"].get!string;
	enforceBadRequest(name.length, "Vocabulary books must have a name");
	string lang1 = req["lang1"].get!string;
	enforceBadRequest(lang1.length == 2, "Invalid first language");
	string lang2 = req["lang2"].get!string;
	enforceBadRequest(lang2.length == 2, "Invalid second language");
	auto vocabulary = req["vocabulary"].deserializeJson!(string[]);
	VocabularyBook book;
	book.creator = user.hashUsername;
	book.name = name;
	book.lang1 = lang1;
	book.lang2 = lang2;
	book.vocabulary.reserve(vocabulary.length);
	foreach (idStr; vocabulary)
	{
		BsonObjectID id = BsonObjectID.fromString(idStr);
		enforceBadRequest(!Vocabulary.tryFindById(id).isNull,
				"Vocabulary with ID " ~ idStr ~ " not found");
		book.vocabulary ~= id;
	}
	book.save();
	res.writeJsonBody(book.bsonID);
}

void getVocabularySuggestion(scope HTTPServerRequest req, scope HTTPServerResponse res)
{
	import modules.vocabulary : Vocabulary;
	import std.regex : escaper;

	string lang = req.query.get("lang", "en");
	string input = req.query.get("input", "");
	auto ret = Vocabulary.find(["$query" : Bson(["translations." ~ lang
			: Bson(["$regex" : Bson(input.escaper.to!string)])]), "$orderby" : Bson(["date" : Bson(-1)])]);
	res.writeJsonBody(ret);
}

void listScores(scope HTTPServerRequest req, scope HTTPServerResponse res)
{
	string user = req.query.get("user").hashUsername;
	auto score = UserScore.tryFindOne(["user" : user]);
	if (score.isNull)
	{
		// response checked for this in main.js
		res.writeBody("user not found", 404);
		return;
	}
	res.writeJsonBody(score.buildJson);
}

string hashUsername(string s, bool shortVersion = false)
{
	import std.base64;
	import std.digest.sha;

	auto hash = s.indexOf('#');
	if (hash == -1)
		throw new Exception("Username does not contain a hash");
	return s[0 .. hash + 1] ~ Base64.encode(sha512Of(s[hash + 1 .. $]))[0 .. shortVersion ? 5 : $]
		.idup;
}

void addScore(scope HTTPServerRequest req, scope HTTPServerResponse res)
{
	string user = req.query.get("user").hashUsername;
	string id = req.query.get("id");
	string obj = req.query.get("score");
	string atstr = req.query.get("at");
	SysTime at;
	try
	{
		parseJsonString(obj);
	}
	catch (Exception)
	{
		res.writeBody("'score' is not a valid json value", HTTPStatus.badRequest);
		return;
	}
	try
	{
		at = SysTime.fromISOExtString(atstr);
	}
	catch (Exception)
	{
		res.writeBody("'at' is not a valid ISO ext string", HTTPStatus.badRequest);
		return;
	}
	auto score = UserScore.tryFindOne(["user" : user]);
	if (score.isNull)
	{
		score = UserScore.init;
		score.user = user;
	}
	score.addStorage(id, obj, at);
	score.save();
	res.writeJsonBody(score.buildJson);
}

void loadModules()
{
	import modules.kana : Kana;
	import modules.vocabulary : VocabularyModule;

	loadedModules ~= new MarkdownModule(TranslatedString(["en" : "Introduction"]),
			"public/md/home.md");
	loadedModules ~= VocabularyModule.instance;
	loadedModules ~= new ModuleSeparator(TranslatedString(["en" : "Kana"]));
	loadedModules ~= new MarkdownModule(TranslatedString(["en"
			: "Kana Cheatsheet"]), "public/md/kana-cheatsheet.md");
	loadedModules ~= Kana.hiragana;
	loadedModules ~= Kana.katakana;
	loadedModules ~= new ModuleSeparator(TranslatedString(["en" : "Reverse Kana"]));
	loadedModules ~= Kana.hiraganaRev;
	loadedModules ~= Kana.katakanaRev;
}

const(IModule)[] loadedModules;

void index(scope HTTPServerRequest req, scope HTTPServerResponse res)
{
	res.render!("app.dt", loadedModules);
}
