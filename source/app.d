import vibe.vibe;

import modules.imodule;

import mongoschema;

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
	static import config;

	auto settings = new HTTPServerSettings;
	settings.port = config.Port;
	settings.bindAddresses = ["::1", "127.0.0.1"];

	auto db = connectMongoDB("mongodb://localhost").getDatabase(config.Database);
	db["scores"].register!UserScore;

	auto router = new URLRouter;
	router.get("*", serveStaticFiles("node_modules"));
	router.get("*", serveStaticFiles("public"));
	router.get("/", &index);
	router.get("/api/list", &listScores);
	router.get("/api/add", &addScore);
	loadModules();
	listenHTTP(settings, router);
	runApplication();
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

string hashUsername(string s)
{
	import std.base64;
	import std.digest.sha;

	auto hash = s.indexOf('#');
	if (hash == -1)
		throw new Exception("Username does not contain a hash");
	return s[0 .. hash + 1] ~ Base64.encode(sha512Of(s[hash + 1 .. $])).idup;
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

	loadedModules ~= Kana.hiragana;
	loadedModules ~= Kana.katakana;
	loadedModules ~= null;
	loadedModules ~= Kana.hiraganaRev;
	loadedModules ~= Kana.katakanaRev;
}

const(IModule)[] loadedModules;

void index(scope HTTPServerRequest req, scope HTTPServerResponse res)
{
	res.render!("app.dt", loadedModules);
}
