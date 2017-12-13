module modules.kanjilearn;

import modules.imodule;

import vibe.data.bson;
import vibe.db.mongo.collection;

class KanjiLearnModule : IModule
{
	static const KanjiLearnModule instance = new KanjiLearnModule();

	private this()
	{
	}

	override string id() const @property
	{
		return "kanjilearn";
	}

	override string icon() const @property
	{
		return "golf_course";
	}

	string[] scripts() const @property
	{
		return ["/js/image_loader.js", "/js/draw.js", "/js/kanjilearn.js"];
	}

	override string name(string language) const @property
	{
		return "Kanji Practice";
	}

	override string description(string language) const @property
	{
		return "Kanji stroke order minigame";
	}

	override string render(string language) const
	{
		import d_to_html;

		//dfmt off
		return div(class_="kanjilearn mdc-elevation--z5",
			section.learn(
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
				button(class_="start mdc-button", title="Start", onclick="kanjilearnModule.next()", "Start"),
				div.area(" "),
				div.translation(" "),
				div.word(" "),
				div.actions(
					button(onclick="kanjilearnModule.correct()", class_="correct mdc-button", "Correct"),
					button(onclick="kanjilearnModule.wrong()", class_="wrong mdc-button secondary-text-button", "Wrong")
				)
			)
		).toString;
		//dfmt on
	}
}
