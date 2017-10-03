module modules.imodule;

interface IModule
{
	string id() const @property;
	string icon() const @property;
	string[] scripts() const @property;
	string name(string language) const @property;
	string description(string language) const @property;
	string render(string language) const;
}