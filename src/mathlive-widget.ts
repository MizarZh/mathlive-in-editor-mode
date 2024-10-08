import { EditorView, WidgetType } from "@codemirror/view";
import {
	MathfieldElement,
	InlineShortcutDefinitions,
	MacroDictionary,
	Keybinding,
} from "mathlive";
import { MathLiveEditorModePluginSettings, Global } from "./setting";
import { parse as json5parse } from "json5";
import { Notice } from "obsidian";
interface WidgetConfig {
	from: number;
	to: number;
}

export class MathLiveWidget extends WidgetType {
	equation: string;
	config: WidgetConfig;
	settings: MathLiveEditorModePluginSettings;
	isInline: boolean;
	global: Global;

	constructor(
		config: WidgetConfig,
		equation: string,
		settings: MathLiveEditorModePluginSettings,
		isInline: boolean,
		global: Global
	) {
		super();
		this.config = config;
		this.equation = equation;
		this.settings = settings;
		this.isInline = isInline;
		this.global = global;
	}
	toDOM(view: EditorView): HTMLElement {
		// element initialization
		const div = document.createElement("div");
		const mfe = document.createElement("math-field") as MathfieldElement;
		div.appendChild(mfe);
		div.addClass("obsidian-mathlive-codemirror-wrapper");
		mfe.addClass("obsidian-mathlive-codemirror-math-field");
		mfe.setValue(this.equation);
		mfe.dataset.from = `${this.config.from}`;
		mfe.dataset.to = `${this.config.to}`;

		// have to put them in setTimeout, mfe is somehow not initialized
		setTimeout(() => {
			this.global.baseMacros = mfe.macros as MacroDictionary;
			this.global.baseShortcuts =
				mfe.inlineShortcuts as InlineShortcutDefinitions;
			this.global.baseKeybindings = mfe.keybindings as Keybinding[];
		}, 0);

		this.style(mfe, div);
		// mfe -> editor
		mfe.addEventListener("input", (ev: InputEvent) => {
			const target = ev.target as MathfieldElement;
			if (this.equation !== target.value) {
				if (
					mfe.dataset.from !== undefined &&
					mfe.dataset.to !== undefined
				) {
					view.dispatch({
						changes: {
							from: parseInt(mfe.dataset.from),
							to: parseInt(mfe.dataset.to),
							insert: mfe.value,
						},
					});
					this.equation = mfe.value;
				}
			}
		});

		return div;
	}
	updateDOM(dom: HTMLElement, view: EditorView): boolean {
		// editor -> mfe
		const mfe = dom.getElementsByTagName(
			"math-field"
		)[0] as MathfieldElement;

		try {
			if (mfe.dataset.macros !== this.settings.macros) {
				let macros = this.settings.macros;
				if (this.settings.macros.trim() === "") {
					macros = "{}";
				}
				const macrosJSON = json5parse(macros) as MacroDictionary;
				mfe.macros = { ...this.global.baseMacros, ...macrosJSON };
				mfe.dataset.macros = this.settings.macros;
			}
		} catch (e) {
			new Notice("MathLive: Incorrect macro settings.");
			console.error(e);
		}

		try {
			if (mfe.dataset.shortcuts !== this.settings.inlineShortcuts) {
				let shortcuts = this.settings.inlineShortcuts;
				if (this.settings.inlineShortcuts.trim() === "") {
					shortcuts = "{}";
				}
				const shortcutsJSON = json5parse(
					shortcuts
				) as InlineShortcutDefinitions;
				mfe.inlineShortcuts = {
					...this.global.baseShortcuts,
					...shortcutsJSON,
				};
				mfe.dataset.shortcuts = this.settings.inlineShortcuts;
			}
		} catch (e) {
			new Notice("MathLive: Incorrect inline shortcut settings.");
			console.error(e);
		}

		try {
			if (mfe.dataset.keybindings !== this.settings.keybindings) {
				let keybindings = this.settings.keybindings;
				if (this.settings.keybindings.trim() === "") {
					keybindings = "[]";
				}
				const keybindingsJSON = json5parse(keybindings) as Keybinding[];
				if (keybindingsJSON.length !== 0) {
					mfe.keybindings = {
						...this.global.baseKeybindings,
						...keybindingsJSON,
					};
				}
			}
		} catch (e) {
			new Notice("MathLive: Incorrect keybinding settings.");
			console.error(e);
		}

		this.style(mfe, dom as HTMLDivElement);

		mfe.dataset.from = `${this.config.from}`;
		mfe.dataset.to = `${this.config.to}`;

		mfe.setValue(this.equation);

		return true;
	}
	destroy(dom: HTMLElement): void {
		const mfe = dom.getElementsByTagName(
			"math-field"
		)[0] as MathfieldElement;

		mfe.dataset.macros = "";
		mfe.dataset.shortcuts = "";
	}
	style(mfe: MathfieldElement, div: HTMLDivElement) {
		if (this.settings.display) {
			// display
			div.removeClass("hidden");
			if (this.isInline) {
				// inline
				div.addClass("inline");
				this.changeCSSClass(this.settings.inlineDisplay, div, "hidden");
				this.changeCSSClass(
					this.settings.inlineKeyboardIcon,
					mfe,
					"hide-keyboard"
				);
				this.changeCSSClass(
					this.settings.inlineMenuIcon,
					mfe,
					"hide-menu"
				);
			} else {
				// block
				div.removeClass("inline");
				this.changeCSSClass(this.settings.blockDisplay, div, "hidden");
				this.changeCSSClass(
					this.settings.blockKeyboardIcon,
					mfe,
					"hide-keyboard"
				);
				this.changeCSSClass(
					this.settings.blockMenuIcon,
					mfe,
					"hide-menu"
				);
			}
		} else {
			div.addClass("hidden");
		}
	}
	changeCSSClass(c: boolean, elem: HTMLElement, className: string) {
		if (c) {
			elem.removeClass(className);
		} else {
			elem.addClass(className);
		}
	}
}
