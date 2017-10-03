module modules.kana;

import modules.imodule;

static immutable string[] kanaRomanization = [
	null, "", "a", "", "i", "", "u", "", "e", "", "o", "ka", "ga", "ki", "gi",
	"ku", "gu", "ke", "ge", "ko", "go", "sa", "za", "shi", "ji", "su", "zu",
	"se", "ze", "so", "zo", "ta", "da", "chi", "ji", "", "tsu", "dsu", "te",
	"de", "to", "do", "na", "ni", "nu", "ne", "no", "ha", "ba", "pa", "hi", "bi",
	"pi", "fu", "bu", "pu", "he", "be", "pe", "ho", "bo", "po", "ma", "mi", "mu",
	"me", "mo", "", "ya", "", "yu", "", "yo", "ra", "ri", "ru", "re", "ro", "",
	"wa", "wi", "we", "wo", "n", "vu"
];
static immutable int[] learnedKana = [
	0x02, 0x04, 0x06, 0x08, 0x0a, 0x0b, 0x0d, 0x0f, 0x11, 0x13, 0x15, 0x17, 0x19,
	0x1b, 0x1d, 0x1f, 0x21, 0x24, 0x26, 0x28, 0x2a, 0x2b, 0x2c, 0x2d, 0x2e, 0x2f,
	0x32, 0x35, 0x38, 0x3b, 0x3e, 0x3f, 0x40, 0x41, 0x42, 0x44, 0x46, 0x48, 0x49,
	0x4a, 0x4b, 0x4c, 0x4d, 0x4f, 0x52, 0x53
];

static assert(learnedKana.length == 46);

class Kana : IModule
{
	static const Kana hiragana = new Kana(true, false);
	static const Kana katakana = new Kana(false, false);
	static const Kana hiraganaRev = new Kana(true, true);
	static const Kana katakanaRev = new Kana(false, true);

	bool hira, reverse;

	private this(bool hira, bool reverse)
	{
		this.hira = hira;
		this.reverse = reverse;
	}

	override string id() const @property
	{
		return (hira ? "hiragana" : "katakana") ~ (reverse ? "-rev" : "");
	}

	override string icon() const @property
	{
		return reverse ? "sort_by_alpha" : "translate";
	}

	string[] scripts() const @property
	{
		return ["/js/kana_common.js"] ~ (reverse ? ["/js/kana_rev.js"] : ["/js/kana.js"]);
	}

	override string name(string language) const @property
	{
		switch (language)
		{
		case "ja":
			return (hira ? "ひらがな" : "カタカナ") ~ (reverse ? " （逆）" : "");
		default:
			return (hira ? "Hiragana" : "Katakana") ~ (reverse ? " (Reverse)" : "");
		}
	}

	override string description(string language) const @property
	{
		return "Learn converting " ~ name(language) ~ (reverse
				? " from the roman alphabet." : " to the roman alphabet.");
	}

	override string render(string language) const
	{
		import d_to_html;

		//dfmt off
		return div(class_="kana mdc-elevation--z5",
			div(class_="mdc-linear-progress timelimit", role="progressbar",
				div(class_="mdc-linear-progress__buffering-dots", " "),
				div(class_="mdc-linear-progress__buffer", " "),
				div(class_="mdc-linear-progress__bar mdc-linear-progress__primary-bar",
					span(class_="mdc-linear-progress__bar-inner", " ")
				),
				div(class_="mdc-linear-progress__bar mdc-linear-progress__secondary-bar",
					span(class_="mdc-linear-progress__bar-inner", " ")
				)
			),
			div.progress("0/0"),
			div.question("?"),
			reverse ?
					div.area(" ")
					:
					div(class_="mdc-textfield",
						input(type="text", class_="answer mdc-textfield__input", attr!"id"=(this.id ~ "_input")),
						label(attr!"for"=(this.id ~ "_input"), class_="mdc-textfield__label", "Representation"),
						div(class_="mdc-textfield__bottom-line", " ")
					),
			div.actions(
				button(attr!"confirm-text"="Confirm", attr!"correct-text"="Correct", class_="confirm mdc-button", "Confirm"),
				button(attr!"skip-text"="Skip", attr!"wrong-text"="Wrong", class_="skip mdc-button secondary-text-button", "Skip"),
				button(class_="abort mdc-button secondary-text-button", "Give Up")
			)
		).toString;
		//dfmt on
	}
}
