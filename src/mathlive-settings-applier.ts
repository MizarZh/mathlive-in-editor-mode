import type {
	InlineShortcutDefinitions,
	Keybinding,
	MacroDictionary,
	MathfieldElement,
} from "mathlive";
import type { Global, MathLiveEditorModePluginSettings } from "./settings-model";

export function applyMathLiveSettings(
	mfe: MathfieldElement,
	settings: MathLiveEditorModePluginSettings,
	global: Global
): void {
	const parsed = global.parsedSettings;
	if (mfe.dataset.macros !== settings.macros && parsed.macros !== null) {
		if (Object.keys(global.baseMacros).length === 0) {
			global.baseMacros = mfe.macros as MacroDictionary;
		}
		mfe.macros = { ...global.baseMacros, ...parsed.macros };
		mfe.dataset.macros = settings.macros;
	}

	if (
		mfe.dataset.shortcuts !== settings.inlineShortcuts &&
		parsed.inlineShortcuts !== null
	) {
		if (Object.keys(global.baseShortcuts).length === 0) {
			global.baseShortcuts = mfe.inlineShortcuts as InlineShortcutDefinitions;
		}
		mfe.inlineShortcuts = {
			...global.baseShortcuts,
			...parsed.inlineShortcuts,
		};
		mfe.dataset.shortcuts = settings.inlineShortcuts;
	}

	if (
		mfe.dataset.keybindings !== settings.keybindings &&
		parsed.keybindings !== null
	) {
		if (global.baseKeybindings.length === 0) {
			global.baseKeybindings = [...mfe.keybindings] as Keybinding[];
		}
		mfe.keybindings = [...global.baseKeybindings, ...parsed.keybindings];
		mfe.dataset.keybindings = settings.keybindings;
	}
}
