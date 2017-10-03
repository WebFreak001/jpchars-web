module d_to_html;

import std.conv;
import std.stdio;
import std.traits;
import std.range;

struct Element
{
	string _name;
	string[string] _attributes;
	string _content;

	this(string name)
	{
		_name = name;
	}

	Element opCall(Args...)(Args args)
	{
		import std.xml : encode;

		foreach (arg; args)
		{
			alias T = typeof(arg);
			static if (is(T == Attribute))
				_attributes[arg.name] = arg.value;
			else static if (is(T == CssAttribute))
			{
				_content ~= arg.toString;
			}
			else static if (is(T == HeadElemBodyAttr))
			{
				if (_name == "head")
					_content ~= "<" ~ arg.tag.encode ~ ">" ~ encode(arg.value) ~ "</" ~ arg.tag.encode ~ ">";
				else
					_attributes["title"] = arg.value;
			}
			else static if (is(T == string[string]))
			{
				foreach (k, v; arg)
					_attributes[k] = v;
			}
			else
			{
				if (_name == "style")
				{
					static if (is(T == Element))
					{
						_content ~= arg.makeCssName ~ '{' ~ arg._content ~ '}';
					}
				}
				else
					_content ~= toContent(arg);
			}
		}
		return this;
	}

	Element opDispatch(string s, Args...)(Args args)
	{
		auto c = "class" in _attributes;
		if (c)
			_attributes["class"] ~= " " ~ s;
		else
			_attributes["class"] = s;
		static if (Args.length)
			return this.opCall(args);
		else
			return this;
	}

	auto opBinary(string op, T)(T rhs)
	{
		static if (op == "*" && isIntegral!T)
			return repeat(this, cast(size_t) rhs);
		else
			static assert(false);
	}

	string makeCssName()
	{
		string ret = _name;
		foreach (k, v; _attributes)
		{
			if (k == "class")
				ret ~= '.' ~ v.split().join(".");
			else if (k == "id")
				ret ~= '#' ~ v;
		}
		return ret;
	}

	string toString() const
	{
		import std.xml : encode;

		string attr;
		foreach (k, v; _attributes)
			attr ~= " " ~ k.encode ~ "=\"" ~ v.encode ~ "\"";
		string ret = "<" ~ _name.encode ~ attr;
		if (_content.length)
			ret ~= ">" ~ _content ~ "</" ~ _name.encode ~ ">";
		else
			ret ~= "/>";
		return ret;
	}
}

struct Attribute
{
	string name, value;
}

struct CssAttribute
{
	string name, value;

	this(string name)
	{
		this.name = name;
	}

	this(string name, string value)
	{
		this.name = name;
		this.value = value;
	}

	CssAttribute opCall(T)(T val)
	{
		static if (isIntegral!T)
		{
			auto hex = val.to!string(16);
			while (hex.length < 6)
				hex = '0' ~ hex;
			value = '#' ~ hex;
		}
		else
			value = val.to!string;
		return this;
	}

	alias opAssign = opCall;

	CssAttribute opBinary(string op, T)(T rhs)
	{
		static if (op == "-")
		{
			static if (is(T == string))
				return CssAttribute(name ~ '-' ~ rhs, value);
			else static if (is(T == CssAttribute))
				return CssAttribute(name ~ '-' ~ rhs.name, rhs.value);
			else
				static assert(false);
		}
		else
			static assert(false);
	}

	CssAttribute opUnary(string op : "-")()
	{
		return CssAttribute('-' ~ name, value);
	}

	string toString() const
	{
		return name ~ ':' ~ value ~ ';';
	}
}

struct Raw
{
	string html;
}

string toContent(T)(T arg)
{
	import std.xml : encode;

	static if (is(T == Raw))
		return arg.html;
	else static if (is(T == Element))
		return arg.toString;
	else static if (isInputRange!T && !isSomeString!T)
	{
		string ret;
		foreach (v; arg)
			ret ~= toContent(v);
		return ret;
	}
	else
		return encode(arg.to!string);
}

Raw raw(string html)()
{
	return Raw(html);
}

template attr(string name)
{
	Attribute attr(T)(T value)
	{
		static if (is(T == string))
			return Attribute(name, value);
		else
		{
			string val;
			static if (is(T == CssAttribute[]))
			{
				foreach (arg; value)
					val ~= arg.toString;
			}
			else static if (is(T == CssAttribute))
			{
				val = arg.toString;
			}
			else static if (is(T == string[]))
			{
				foreach (arg; value)
					val ~= arg;
			}
			else
				static assert(false);
			return Attribute(name, val);
		}
	}
}

struct HeadElemBodyAttr
{
	string tag, value;
}

template headElemBodyAttr(string tag)
{
	HeadElemBodyAttr headElemBodyAttr(string val)
	{
		return HeadElemBodyAttr(tag, val);
	}

	Element headElemBodyAttr(Args...)(Args args)
	{
		return Element(tag)(args);
	}
}

alias title = headElemBodyAttr!"title";
alias style = headElemBodyAttr!"style";

enum html = Element("html");
enum head = Element("head");
enum 
	body = Element("body");
enum p = Element("p");
enum h1 = Element("h1");
enum h2 = Element("h2");
enum h3 = Element("h3");
enum h4 = Element("h4");
enum h5 = Element("h5");
enum h6 = Element("h6");
enum div = Element("div");
enum span = Element("span");
enum img = Element("img");
enum link = Element("link");
enum meta = Element("meta");
enum br = Element("br");
enum hr = Element("hr");
enum b = Element("b");
enum i = Element("i");
enum u = Element("u");
enum ul = Element("ul");
enum ol = Element("ol");
enum li = Element("li");
enum table = Element("table");
enum thead = Element("thead");
enum tbody = Element("tbody");
enum tr = Element("tr");
enum td = Element("td");
enum th = Element("th");
enum pre = Element("pre");
enum code = Element("code");
enum input = Element("input");
enum fieldset = Element("fieldset");
enum legend = Element("legend");
enum script = Element("script");
enum canvas = Element("canvas");
enum select = Element("select");
enum option = Element("option");
enum button = Element("button");
enum form = Element("form");
enum header = Element("header");
enum footer = Element("footer");
enum svg = Element("svg");
enum label = Element("label");

enum font = CssAttribute("font");
enum family = CssAttribute("family");
enum size = CssAttribute("size");
enum color = CssAttribute("color");
enum width = CssAttribute("width");
enum height = CssAttribute("height");
enum border = CssAttribute("border");
enum text = CssAttribute("text");
enum decoration = CssAttribute("decoration");
enum radius = CssAttribute("radius");
enum transition = CssAttribute("transition");
enum background = CssAttribute("background");
enum margin = CssAttribute("margin");
enum padding = CssAttribute("padding");
enum left = CssAttribute("left");
enum top = CssAttribute("top");
enum right = CssAttribute("right");
enum bottom = CssAttribute("bottom");
enum max = CssAttribute("max");
enum min = CssAttribute("min");
enum box = CssAttribute("box");
enum shadow = CssAttribute("shadow");
enum sizing = CssAttribute("sizing");

alias class_ = attr!"class";
alias id = attr!"id";
alias name = attr!"name";
alias src = attr!"src";
alias href = attr!"href";
alias rel = attr!"rel";
alias type = attr!"type";
alias minLength = attr!"minLength";
alias maxLength = attr!"maxLength";
alias pattern = attr!"pattern";
alias required = attr!"required";
alias disabled = attr!"disabled";
alias placeholder = attr!"placeholder";
alias role = attr!"role";
alias for_ = attr!"for";
alias media = attr!"media";
alias content = attr!"content";
alias property = attr!"property";
alias tabindex = attr!"tabindex";
alias action = attr!"action";
alias method = attr!"method";

enum aliceBlue = "aliceBlue";
enum antiqueWhite = "antiqueWhite";
enum aqua = "aqua";
enum aquamarine = "aquamarine";
enum azure = "azure";
enum beige = "beige";
enum bisque = "bisque";
enum black = "black";
enum blanchedAlmond = "blanchedAlmond";
enum blue = "blue";
enum blueViolet = "blueViolet";
enum brown = "brown";
enum burlyWood = "burlyWood";
enum cadetBlue = "cadetBlue";
enum chartreuse = "chartreuse";
enum chocolate = "chocolate";
enum coral = "coral";
enum cornflowerBlue = "cornflowerBlue";
enum cornsilk = "cornsilk";
enum crimson = "crimson";
enum cyan = "cyan";
enum darkBlue = "darkBlue";
enum darkCyan = "darkCyan";
enum darkGoldenRod = "darkGoldenRod";
enum darkGray = "darkGray";
enum darkGreen = "darkGreen";
enum darkKhaki = "darkKhaki";
enum darkMagenta = "darkMagenta";
enum darkOliveGreen = "darkOliveGreen";
enum darkOrange = "darkOrange";
enum darkOrchid = "darkOrchid";
enum darkRed = "darkRed";
enum darkSalmon = "darkSalmon";
enum darkSeaGreen = "darkSeaGreen";
enum darkSlateBlue = "darkSlateBlue";
enum darkSlateGray = "darkSlateGray";
enum darkTurquoise = "darkTurquoise";
enum darkViolet = "darkViolet";
enum deepPink = "deepPink";
enum deepSkyBlue = "deepSkyBlue";
enum dimGray = "dimGray";
enum dodgerBlue = "dodgerBlue";
enum fireBrick = "fireBrick";
enum floralWhite = "floralWhite";
enum forestGreen = "forestGreen";
enum fuchsia = "fuchsia";
enum gainsboro = "gainsboro";
enum ghostWhite = "ghostWhite";
enum gold = "gold";
enum goldenRod = "goldenRod";
enum gray = "gray";
enum green = "green";
enum greenYellow = "greenYellow";
enum honeyDew = "honeyDew";
enum hotPink = "hotPink";
enum indianRed = "indianRed";
enum indigo = "indigo";
enum ivory = "ivory";
enum khaki = "khaki";
enum lavender = "lavender";
enum lavenderBlush = "lavenderBlush";
enum lawnGreen = "lawnGreen";
enum lemonChiffon = "lemonChiffon";
enum lightBlue = "lightBlue";
enum lightCoral = "lightCoral";
enum lightCyan = "lightCyan";
enum lightGoldenRodYellow = "lightGoldenRodYellow";
enum lightGray = "lightGray";
enum lightGreen = "lightGreen";
enum lightPink = "lightPink";
enum lightSalmon = "lightSalmon";
enum lightSeaGreen = "lightSeaGreen";
enum lightSkyBlue = "lightSkyBlue";
enum lightSlateGray = "lightSlateGray";
enum lightSteelBlue = "lightSteelBlue";
enum lightYellow = "lightYellow";
enum lime = "lime";
enum limeGreen = "limeGreen";
enum linen = "linen";
enum magenta = "magenta";
enum maroon = "maroon";
enum mediumAquaMarine = "mediumAquaMarine";
enum mediumBlue = "mediumBlue";
enum mediumOrchid = "mediumOrchid";
enum mediumPurple = "mediumPurple";
enum mediumSeaGreen = "mediumSeaGreen";
enum mediumSlateBlue = "mediumSlateBlue";
enum mediumSpringGreen = "mediumSpringGreen";
enum mediumTurquoise = "mediumTurquoise";
enum mediumVioletRed = "mediumVioletRed";
enum midnightBlue = "midnightBlue";
enum mintCream = "mintCream";
enum mistyRose = "mistyRose";
enum moccasin = "moccasin";
enum navajoWhite = "navajoWhite";
enum navy = "navy";
enum oldLace = "oldLace";
enum olive = "olive";
enum oliveDrab = "oliveDrab";
enum orange = "orange";
enum orangeRed = "orangeRed";
enum orchid = "orchid";
enum paleGoldenRod = "paleGoldenRod";
enum paleGreen = "paleGreen";
enum paleTurquoise = "paleTurquoise";
enum paleVioletRed = "paleVioletRed";
enum papayaWhip = "papayaWhip";
enum peachPuff = "peachPuff";
enum peru = "peru";
enum pink = "pink";
enum plum = "plum";
enum powderBlue = "powderBlue";
enum purple = "purple";
enum rebeccaPurple = "rebeccaPurple";
enum red = "red";
enum rosyBrown = "rosyBrown";
enum royalBlue = "royalBlue";
enum saddleBrown = "saddleBrown";
enum salmon = "salmon";
enum sandyBrown = "sandyBrown";
enum seaGreen = "seaGreen";
enum seaShell = "seaShell";
enum sienna = "sienna";
enum silver = "silver";
enum skyBlue = "skyBlue";
enum slateBlue = "slateBlue";
enum slateGray = "slateGray";
enum snow = "snow";
enum springGreen = "springGreen";
enum steelBlue = "steelBlue";
enum tan = "tan";
enum teal = "teal";
enum thistle = "thistle";
enum tomato = "tomato";
enum turquoise = "turquoise";
enum violet = "violet";
enum wheat = "wheat";
enum white = "white";
enum whiteSmoke = "whiteSmoke";
enum yellow = "yellow";
enum yellowGreen = "yellowGreen";

enum auto_ = "auto";
enum inherit = "inherit";
enum center = "center";
enum justify = "justify";

string px(double d)
{
	return d.to!string ~ "px";
}

string pt(double d)
{
	return d.to!string ~ "pt";
}

string em(double d)
{
	return d.to!string ~ "em";
}

string cm(double d)
{
	return d.to!string ~ "cm";
}
