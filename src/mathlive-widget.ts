import { EditorView, WidgetType } from "@codemirror/view";
import {
	MathfieldElement,
	InlineShortcutDefinitions,
	MacroDictionary,
	Keybinding,
	VirtualKeyboardPolicy,
} from "mathlive";
import { MathLiveEditorModePluginSettings, Global } from "./setting";
import { parse as json5parse } from "json5";
import { Notice } from "obsidian";
interface WidgetConfig {
	from: number;
	to: number;
}

const processedKeyboards = new WeakSet<HTMLElement>();

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
		mfe.defaultMode = this.isInline ? "inline-math" : "math";
		mfe.addClass("obsidian-mathlive-codemirror-math-field");
		mfe.setValue(this.equation);
		mfe.dataset.from = `${this.config.from}`;
		mfe.dataset.to = `${this.config.to}`;

		// have to put them in setTimeout, mfe is somehow not initialized
		setTimeout(() => {
			// Save base defaults if not already saved
			if (Object.keys(this.global.baseMacros).length === 0) {
				this.global.baseMacros = mfe.macros as MacroDictionary;
			}
			if (Object.keys(this.global.baseShortcuts).length === 0) {
				this.global.baseShortcuts =
					mfe.inlineShortcuts as InlineShortcutDefinitions;
			}
			if (this.global.baseKeybindings.length === 0) {
				this.global.baseKeybindings = mfe.keybindings as Keybinding[];
			}
			mfe.mathVirtualKeyboardPolicy = this.settings.mathVirtualKeyboardMode as VirtualKeyboardPolicy;

			// Setup keyboard close button injection
			this.setupKeyboardCollapseButton(mfe);
		}, 0);

		this.style(mfe, div);

		// Save initial value (for Esc to cancel)
		const initialValue = this.equation;
		mfe.dataset.initialValue = initialValue;

		// Helper function to dispatch changes
		const dispatchChange = (newValue: string) => {
			if (
				mfe.dataset.from !== undefined &&
				mfe.dataset.to !== undefined
			) {
				view.dispatch({
					changes: {
						from: parseInt(mfe.dataset.from),
						to: parseInt(mfe.dataset.to),
						insert: newValue,
					},
				});
				this.equation = newValue;
				// Update 'to' position (content length may have changed)
				mfe.dataset.to = String(
					parseInt(mfe.dataset.from) + newValue.length
				);
			}
		};

		// mfe -> editor
		if (this.settings.immediateUpdate) {
			// Immediate update mode: dispatch on every input
			mfe.addEventListener("input", (ev: InputEvent) => {
				const target = ev.target as MathfieldElement;
				if (this.equation !== target.value) {
					dispatchChange(mfe.value);
				}
			});
		} else {
			// Blur update mode: only mark changes on input, dispatch on blur
			mfe.addEventListener("input", (ev: InputEvent) => {
				mfe.dataset.hasUnsavedChanges = "true";
			});

			// Dispatch changes on blur
			mfe.addEventListener("blur", () => {
				if (mfe.dataset.hasUnsavedChanges === "true") {
					const newValue = mfe.value;
					if (newValue !== this.equation) {
						dispatchChange(newValue);
					}
					mfe.dataset.hasUnsavedChanges = "false";
				}
			});
		}

		// Esc to cancel changes
		mfe.addEventListener("keydown", (ev: KeyboardEvent) => {
			if (ev.key === "Escape") {
				mfe.setValue(initialValue);
				mfe.dataset.hasUnsavedChanges = "false";
				mfe.blur();
				ev.preventDefault();
				ev.stopPropagation();
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
				// If baseMacros is not initialized yet, get it from mfe first
				if (Object.keys(this.global.baseMacros).length === 0) {
					this.global.baseMacros = mfe.macros as MacroDictionary;
				}
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
				// If baseShortcuts is not initialized yet, get it from mfe first
				if (Object.keys(this.global.baseShortcuts).length === 0) {
					this.global.baseShortcuts =
						mfe.inlineShortcuts as InlineShortcutDefinitions;
				}
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
				// If baseKeybindings is not initialized yet, get it from mfe first
				if (this.global.baseKeybindings.length === 0) {
					this.global.baseKeybindings = mfe.keybindings as Keybinding[];
				}
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

		mfe.mathVirtualKeyboardPolicy = this.settings.mathVirtualKeyboardMode as VirtualKeyboardPolicy;

		this.style(mfe, dom as HTMLDivElement);

		mfe.dataset.from = `${this.config.from}`;
		mfe.dataset.to = `${this.config.to}`;

		// Only update value when not focused and value differs (avoid interrupting input)
		const isFocused = document.activeElement === mfe ||
			(document.activeElement instanceof Node && mfe.contains(document.activeElement));
		if (!isFocused && mfe.value !== this.equation) {
			mfe.setValue(this.equation);
		}

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

	setupKeyboardCollapseButton(mfe: MathfieldElement) {
		const manager = KeyboardCollapseButtonManager.getInstance();

		const handleInteraction = () => {
			manager.ensureButton();
		};

		mfe.addEventListener('focus', handleInteraction);
		mfe.addEventListener('click', handleInteraction);
	}
	// eq(other: MathLiveWidget) {
	// 	// Only compare anchor position (from) and type, not 'to' or 'equation'
	// 	// This allows CodeMirror to reuse DOM when content changes, avoiding rebuild and focus loss
	// 	return (
	// 		other instanceof MathLiveWidget &&
	// 		other.config.from === this.config.from &&
	// 		other.isInline === this.isInline
	// 	);
	// }
}

// Global keyboard close button manager
class KeyboardCollapseButtonManager {
	private observer: MutationObserver | null = null;
	private pendingTimeout: number | null = null;
	private isObserving = false;
	private readonly COLLAPSE_BUTTON_CLASS = 'obsidian-mathlive-keyboard-collapse';
	private readonly TOOLBAR_SELECTOR = '.ML__edit-toolbar';
	private readonly KEYBOARD_CONTAINER_SELECTOR = '.ML__keyboard';

	private static instance: KeyboardCollapseButtonManager | null = null;

	static getInstance(): KeyboardCollapseButtonManager {
		if (!this.instance) {
			this.instance = new KeyboardCollapseButtonManager();
		}
		return this.instance;
	}

	private constructor() { }

	private getToolbars(): HTMLElement[] {
		return Array.from(document.querySelectorAll(this.TOOLBAR_SELECTOR));
	}

	private isKeyboardVisible(): boolean {
		const keyboard = document.querySelector(this.KEYBOARD_CONTAINER_SELECTOR);
		return keyboard !== null && (keyboard as HTMLElement).offsetParent !== null;
	}

	private hasCollapseButton(toolbar: HTMLElement): boolean {
		return !!toolbar.querySelector(`.${this.COLLAPSE_BUTTON_CLASS}`);
	}

	private createCollapseButton(): HTMLElement {
		const button = document.createElement('div');
		button.className = `action ${this.COLLAPSE_BUTTON_CLASS}`;
		button.innerHTML = '✕';
		button.setAttribute('aria-label', 'Collapse Keyboard');
		button.dataset.tooltip = "Collapse Keyboard";
		button.addEventListener('click', () => {
			window.mathVirtualKeyboard?.hide();
		});
		return button;
	}

	private injectButton(): void {
		const toolbars = this.getToolbars();
		for (const toolbar of toolbars) {
			if (!this.hasCollapseButton(toolbar)) {
				toolbar.appendChild(this.createCollapseButton());
			}
		}
	}

	private startObserving(): void {
		if (this.isObserving) return;

		this.observer = new MutationObserver(() => {
			if (!this.isKeyboardVisible()) {
				this.stopObserving();
				return;
			}
			this.injectButton();
		});

		this.observer.observe(document.body, {
			childList: true,
			subtree: true,
		});

		this.isObserving = true;
	}

	private stopObserving(): void {
		if (this.observer) {
			this.observer.disconnect();
			this.isObserving = false;
		}
	}

	public ensureButton(): void {
		// Cancel any pending timeout to avoid accumulation
		if (this.pendingTimeout !== null) {
			clearTimeout(this.pendingTimeout);
			this.pendingTimeout = null;
		}

		// Only proceed if keyboard is actually visible
		if (!this.isKeyboardVisible()) {
			return;
		}

		// Schedule button injection
		this.pendingTimeout = window.setTimeout(() => {
			this.pendingTimeout = null;
			this.injectButton();

			// Start observing only when keyboard is visible
			if (!this.isObserving) {
				this.startObserving();
			}
		}, 300);
	}
}