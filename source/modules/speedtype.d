module modules.speedtype;

import modules.imodule;

class SpeedTypeModule : IModule
{
	static const SpeedTypeModule instance = new SpeedTypeModule();

	private this()
	{
	}

	override string id() const @property
	{
		return "speedtype";
	}

	override string icon() const @property
	{
		return "keyboard";
	}

	string[] scripts() const @property
	{
		return ["/js/speedtype.js"];
	}

	override string name(string language) const @property
	{
		return "Speed Typing";
	}

	override string description(string language) const @property
	{
		return "Write words properly quickly";
	}

	override string render(string language) const
	{
		import d_to_html;

		//dfmt off
		return div(class_="speedtype mdc-elevation--z5",
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
			div.next("???"),
			div.current("???"),
			input.text(type="text", " "),
			div.translation("???")
		).toString;
		//dfmt on
	}
}
