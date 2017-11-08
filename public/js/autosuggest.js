function suggest(input, suggestions, callback) {
	if (input !== document.activeElement)
		return;
	var elem = document.createElement("div");
	var rect = input.getBoundingClientRect();
	elem.style.position = "fixed";
	var y = rect.top + (rect.height || 20);
	elem.style.top = y + "px";
	elem.style.maxWidth = "100vw";
	elem.style.maxHeight = (window.innerHeight - y) + "px";
	if (window.innerWidth <= 600 || window.innerWidth - rect.left <= 300) {
		elem.style.left = "0px";
		elem.style.width = "100vw";
	}
	else {
		elem.style.left = rect.left + "px";
		elem.style.minWidth = (rect.width || 200) + "px";
	}
	elem.style.zIndex = "1000000";
	var existing = document.getElementById("input-autocomplete");
	if (existing)
		existing.parentElement.removeChild(existing);
	elem.id = "input-autocomplete";
	var clicked = -1;
	for (var i = 0; i < suggestions.length; i++) {
		var child = document.createElement("div");
		child.onclick = function (i) {
			clicked = i;
			removeSuggest();
		}.bind(child, i);
		if (typeof suggestions[i] == "string")
			child.textContent = suggestions[i];
		else if (suggestions[i] instanceof Node)
			child.appendChild(suggestions[i]);
		else if (Array.isArray(suggestions[i]) && suggestions[i].length >= 2) {
			var main = document.createElement("span");
			main.textContent = suggestions[i][0];
			var side = document.createElement("span");
			side.className = "detail";
			side.textContent = suggestions[i][1];
			child.appendChild(main);
			child.appendChild(side);
		}
		else console.log("Invalid suggestion ", suggestions[i]);
		elem.appendChild(child);
	}
	var removeSuggest = function () {
		setTimeout(function () {
			document.body.removeChild(elem);
			if (clicked != -1)
				callback(suggestions[clicked], clicked);
		}, 200);
		input.removeEventListener("blur", removeSuggest);
	};
	input.addEventListener("blur", removeSuggest);
	document.body.appendChild(elem);
}