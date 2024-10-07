import { parse as json5parse } from "json5";
import { Notice } from "obsidian";
import { Macros } from "./mathlive-widget";

export function macros2newcommands(macros: string) {
	try {
		const newcommandList = [];
		const macrosJSON = json5parse(macros) as Macros;
		for (const macro in macrosJSON) {
			const macroVal = macrosJSON[macro];
			if (typeof macroVal === "string") {
				newcommandList.push(`\\newcommand{\\${macro}}{${macroVal}}`);
			} else if ("args" in macroVal && "def" in macroVal) {
				newcommandList.push(
					`\\newcommand{\\${macro}}[${macroVal.args}]{${macroVal.def}}`
				);
			}
		}
		return newcommandList.join('\n')
	} catch (e) {
		new Notice("MathLive: Incorrect macro settings.");
		console.error(e);
	}
}
