module modules.vocabulary;

import modules.imodule;

import vibe.data.bson;
import vibe.db.mongo.collection;

import mongoschema;

struct VocabularyBook
{
	string creator;
	string name;
	string lang1, lang2;
	BsonObjectID[] vocabulary;

	mixin MongoSchema;
}

struct Vocabulary
{
	SchemaDate date = SchemaDate.now;
	string[string] translations;
	string[] contributors;

	mixin MongoSchema;
}

class VocabularyModule : IModule
{
	static const VocabularyModule instance = new VocabularyModule();

	private this()
	{
	}

	override string id() const @property
	{
		return "vocabulary";
	}

	override string icon() const @property
	{
		return "library_books";
	}

	string[] scripts() const @property
	{
		return ["/js/autosuggest.js", "/js/draw.js", "/js/vocabulary.js"];
	}

	override string name(string language) const @property
	{
		return "Vocabulary";
	}

	override string description(string language) const @property
	{
		return "Learn translating single words back and forth.";
	}

	override string render(string language) const
	{
		import d_to_html;

		//dfmt off
		return div(class_="vocabulary mdc-elevation--z5",
			button(attr!"id"="vocabulary-create-pack-button", class_="mdc-fab mdc-fab--exited material-icons", onclick="vocabularyModule.creator.showNew()", attr!"aria-label"="Add",
				span(class_="mdc-fab__icon", "add")
			),
			section.packselect(
				button(class_="random mdc-button", "Random Vocabulary", onclick="vocabularyModule.learnRandom()"),
				nav(class_="mdc-list mdc-list--dense", attr!"id"="vocabulary-packs", " "),
				div.actions(
					button(class_="startab mdc-button multiicons", title="Learn To", onclick="vocabularyModule.learnSelected(0)",
						span(class_="material-icons", attr!"aria-label"="Learn 2nd Language", "language arrow_forward language")
					),
					button(class_="startba mdc-button multiicons", title="Learn From", onclick="vocabularyModule.learnSelected(1)",
						span(class_="material-icons", attr!"aria-label"="Learn 1st Language", "language arrow_back language")
					),
					button(class_="start mdc-button multiicons", title="Learn Both", onclick="vocabularyModule.learnSelected(2)",
						span(class_="material-icons", attr!"aria-label"="Learn Languages Randomly", "language compare_arrows language")
					),
				)
			),
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
				div.progress("0/0"),
				div.area(" "),
				div.solution("?"),
				div.romanization("?"),
				input(type="text", class_="answer", attr!"id"="vocabulary_input"),
				div.actions(
					button(onclick="vocabularyModule.confirm(0)", attr!"confirm-text"="Confirm", attr!"correct-text"="Correct", class_="confirm mdc-button", "Confirm"),
					button(onclick="vocabularyModule.confirm(1)", class_="partial mdc-button secondary-text-button", "Partly Correct", disabled="disabled"),
					button(onclick="vocabularyModule.confirm(2)", class_="wrong mdc-button secondary-text-button", "Wrong", disabled="disabled")
				),
				div.kanji(" ")
			),
			aside(class_="mdc-dialog", attr!"id"="vocabulary-create", role="alertdialog",
					attr!"aria-hidden"="true", attr!"aria-labelledby"="vocabulary-create-dialog-label",
					attr!"aria-describedby"="vocabulary-create-dialog-desc",
				div(class_="mdc-dialog__surface",
					header(class_="mdc-dialog__header",
						h2(class_="mdc-dialog__header__title", attr!"id"="vocabulary-create-dialog-label", "Create Vocabulary Book")
					),
					section(attr!"id"="vocabulary-create-dialog-section", class_="mdc-dialog__body mdc-dialog__body--scrollable",
						p(attr!"id"="vocabulary-create-dialog-desc",
							"Select from a list of vocabulary and create and publish a custom pack to learn."),
						div(class_="mdc-textfield name",
							input(type="text", class_="mdc-textfield__input", attr!"id"="vocadd_name", value="Unnamed Vocabulary Book"),
							label(attr!"for"="vocadd_name", class_="mdc-textfield__label", "Vocabulary Book Name"),
							div(class_="mdc-textfield__bottom-line", " ")
						),
						label("Language 1",
							select(attr!"id"="vocadd_lang1", onchange="vocabularyModule.creator.updateLang()",
								option(selected, "en"),
								option("ja"),
							)
						),
						label("Language 2",
							select(attr!"id"="vocadd_lang2", onchange="vocabularyModule.creator.updateLang()",
								option("en"),
								option(selected, "ja"),
							)
						),
						div(class_="vocabulary-create-topbar",
							button(class_="mdc-button removebutton", onclick="vocabularyModule.creator.removeSelected()",
								span(class_="material-icons", attr!"aria-label"="Remove", "remove"),
								"Remove Selected Vocabulary"
							)
						),
						nav(class_="mdc-list", attr!"id"="create-vocabulary-list",
							li(attr!"id"="vocaddentry", class_="mdc-list-item",
								div(class_="mdc-textfield",
									input(type="text", class_="mdc-textfield__input", attr!"id"="vocadd_translation1"),
									label(attr!"for"="vocadd_translation1", class_="mdc-textfield__label", "Translation 1"),
									div(class_="mdc-textfield__bottom-line", " ")
								),
								div(class_="mdc-textfield",
									input(type="text", class_="mdc-textfield__input", attr!"id"="vocadd_translation2"),
									label(attr!"for"="vocadd_translation2", class_="mdc-textfield__label", "Translation 2"),
									div(class_="mdc-textfield__bottom-line", " ")
								),
								button(class_="add material-icons mdc-button mdc-button--raised", title="Add to Vocabulary",
									attr!"aria-label"="Add", "add", onclick="vocabularyModule.creator.addCurrent()")
							)
						)
					),
					footer(class_="mdc-dialog__footer",
						button(class_="mdc-button mdc-dialog__footer__button mdc-dialog__footer__button--accept", "Save"),
						button(class_="mdc-button mdc-dialog__footer__button mdc-dialog__footer__button--cancel", "Cancel")
					)
				),
				div(class_="mdc-dialog__backdrop")
			)
		).toString;
		//dfmt on
	}
}
