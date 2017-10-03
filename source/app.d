import vibe.vibe;

import modules.imodule;

void main()
{
	auto settings = new HTTPServerSettings;
	settings.port = 3000;
	settings.bindAddresses = ["::1", "127.0.0.1"];
	auto router = new URLRouter;
	router.get("*", serveStaticFiles("node_modules"));
	router.get("*", serveStaticFiles("public"));
	router.get("/", &index);
	loadModules();
	listenHTTP(settings, router);
	runApplication();
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

void index(HTTPServerRequest req, HTTPServerResponse res)
{
	res.render!("app.dt", loadedModules);
}
