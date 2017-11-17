module modules.imodule;

struct TranslatedString
{
	string[string] translations;

	string translate(string language) const
	{
		auto ptr = language in translations;
		if (ptr)
			return *ptr;
		ptr = "en" in translations;
		if (ptr)
			return *ptr;
		return translations.byValue.front;
	}
}

interface IModule
{
	string id() const @property;
	string icon() const @property;
	string[] scripts() const @property;
	string name(string language) const @property;
	string description(string language) const @property;
	string render(string language) const;
}

class ModuleSeparator : IModule
{
	TranslatedString translatedName;

	this(TranslatedString translatedName)
	{
		this.translatedName = translatedName;
	}

	string id() const @property
	{
		return null;
	}

	string icon() const @property
	{
		return null;
	}

	string[] scripts() const @property
	{
		return null;
	}

	string name(string language) const @property
	{
		return this.translatedName.translate(language);
	}

	string description(string language) const @property
	{
		return null;
	}

	string render(string language) const
	{
		return null;
	}
}

class MarkdownModule : IModule
{
	TranslatedString translatedName;
	string path;

	this(TranslatedString translatedName, string path)
	{
		this.translatedName = translatedName;
		this.path = path;
	}

	string id() const @property
	{
		import std.path : baseName, stripExtension;

		return "md-" ~ path.baseName.stripExtension;
	}

	string icon() const @property
	{
		return "help";
	}

	string[] scripts() const @property
	{
		return null;
	}

	string name(string language) const @property
	{
		return translatedName.translate(language);
	}

	string description(string language) const @property
	{
		return null;
	}

	string render(string language) const
	{
		import vibe.core.file : readFileUTF8;
		import vibe.textfilter.markdown : filterMarkdown;
		import std.array : replace;

		return "<div class=\"markdown mdc-elevation--z5\">" ~ filterMarkdown(readFileUTF8(path))
			.replace(" id=\"", " name=\"") ~ "</div>";
	}
}
