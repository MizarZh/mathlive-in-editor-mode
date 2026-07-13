import { parse as json5parse } from "json5";
import type {
	InlineShortcutDefinitions,
	Keybinding,
	MacroDictionary,
} from "mathlive";

export type TouchKeyboardProvider = "mathlive" | "system" | "disabled";
export type InlineWidgetPosition = "left" | "right";

export interface ParsedMathLiveSettings {
	macros: MacroDictionary | null;
	inlineShortcuts: InlineShortcutDefinitions | null;
	keybindings: Keybinding[] | null;
	errors: Partial<Record<"macros" | "inlineShortcuts" | "keybindings", string>>;
}

export interface Global {
	baseMacros: MacroDictionary;
	baseShortcuts: InlineShortcutDefinitions;
	baseKeybindings: Keybinding[];
	parsedSettings: ParsedMathLiveSettings;
}

export interface MathLiveEditorModePluginSettings {
	display: boolean;
	blockDisplay: boolean;
	hideMathJaxBlock: boolean;
	blockMenuIcon: boolean;
	blockKeyboardIcon: boolean;
	inlineDisplay: boolean;
	inlineWidgetPosition: InlineWidgetPosition;
	hideMathJaxInline: boolean;
	inlineMenuIcon: boolean;
	inlineKeyboardIcon: boolean;
	macros: string;
	inlineShortcuts: string;
	keybindings: string;
	immediateUpdate: boolean;
	touchKeyboardProvider: TouchKeyboardProvider;
	hideMathVirtualKeyboardOnBlur: boolean;
	arrowKeyNavigation: boolean;
}

export const DEFAULT_SETTINGS: MathLiveEditorModePluginSettings = {
	display: true,
	blockDisplay: true,
	hideMathJaxBlock: false,
	blockMenuIcon: true,
	blockKeyboardIcon: true,
	inlineDisplay: false,
	inlineWidgetPosition: "left",
	hideMathJaxInline: false,
	inlineMenuIcon: false,
	inlineKeyboardIcon: false,
	macros: "",
	inlineShortcuts: "",
	keybindings: "",
	immediateUpdate: true,
	touchKeyboardProvider: "mathlive",
	hideMathVirtualKeyboardOnBlur: false,
	arrowKeyNavigation: true,
};

function isKeybinding(value: unknown): value is Keybinding {
	if (typeof value !== "object" || value === null) return false;
	const candidate = value as Record<string, unknown>;
	const validCommand =
		(typeof candidate.command === "string" && candidate.command.length > 0) ||
		(Array.isArray(candidate.command) &&
			typeof candidate.command[0] === "string" &&
			candidate.command[0].length > 0);
	return typeof candidate.key === "string" &&
		candidate.key.trim().length > 0 && validCommand;
}

export function parseMathLiveSettings(
	settings: MathLiveEditorModePluginSettings
): ParsedMathLiveSettings {
	const result: ParsedMathLiveSettings = {
		macros: null,
		inlineShortcuts: null,
		keybindings: null,
		errors: {},
	};

	try {
		result.macros = json5parse(settings.macros.trim() || "{}") as MacroDictionary;
	} catch {
		result.errors.macros = "Invalid JSON5 macros.";
	}
	try {
		result.inlineShortcuts = json5parse(
			settings.inlineShortcuts.trim() || "{}"
		) as InlineShortcutDefinitions;
	} catch {
		result.errors.inlineShortcuts = "Invalid JSON5 inline shortcuts.";
	}
	try {
		const keybindings: unknown = json5parse(settings.keybindings.trim() || "[]");
		if (!Array.isArray(keybindings) || !keybindings.every(isKeybinding)) {
			throw new Error();
		}
		result.keybindings = keybindings;
	} catch {
		result.errors.keybindings = "Keybindings must be a JSON5 array with valid key and command fields.";
	}

	return result;
}
