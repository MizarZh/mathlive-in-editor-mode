import { parse as json5parse } from "json5";
import { Notice } from "obsidian";
import { MacroDictionary } from "mathlive";

export function macros2newcommands(macros: string): string {
	try {
		const newcommandList: string[] = [];
		const macrosJSON = json5parse(macros) as MacroDictionary;
		for (const [macro, macroVal] of Object.entries(macrosJSON)) {
			if (typeof macroVal === "string") {
				newcommandList.push(`\\newcommand{\\${macro}}{${macroVal}}`);
				continue;
			}

			// MathLive macros can also be objects like: { args: number, def: string }
			if (typeof macroVal === "object" && macroVal !== null) {
				const maybeArgs = (macroVal as { args?: unknown }).args;
				const maybeDef = (macroVal as { def?: unknown }).def;
				if (
					(typeof maybeArgs === "number" || typeof maybeArgs === "string") &&
					typeof maybeDef === "string"
				) {
					newcommandList.push(`\\newcommand{\\${macro}}[${maybeArgs}]{${maybeDef}}`);
				}
			}
		}
		return newcommandList.join("\n");
	} catch (e) {
		new Notice("MathLive: Incorrect macro settings.");
		console.error(e);
		return "";
	}
}

// export function hideMathJax(editor: EditorView) {