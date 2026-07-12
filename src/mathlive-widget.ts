import { EditorSelection } from "@codemirror/state";
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
		div.addClass("cm-line");
		mfe.defaultMode = this.isInline ? "inline-math" : "math";
		mfe.addClass("obsidian-mathlive-codemirror-math-field");
		mfe.setValue(this.equation);
		mfe.dataset.from = `${this.config.from}`;
		mfe.dataset.to = `${this.config.to}`;
		this.setupBackslashCommandInput(mfe);
		this.setupTouchKeyboard(mfe);

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
			this.configureTouchKeyboard(mfe);

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

		// Esc to cancel (on mfe)
		mfe.addEventListener("keydown", (ev: KeyboardEvent) => {
			if (ev.key === "Escape") {
				mfe.setValue(initialValue);
				mfe.dataset.hasUnsavedChanges = "false";
				mfe.blur();
				ev.preventDefault();
				ev.stopPropagation();
			}
		});

		// Arrow keys at boundaries: exit to LaTeX (on wrapper, capture phase, so we run before MathLive)
		const exitToEditor = (cursorPos: number) => {
			const docLen = view.state.doc.length;
			if (cursorPos < 0 || cursorPos > docLen) return;
			view.dispatch({ selection: EditorSelection.single(cursorPos) });
			view.focus();
		};
		div.addEventListener("keydown", (ev: KeyboardEvent) => {
			if (document.activeElement !== mfe && !mfe.contains(document.activeElement)) return;
			if (!this.settings.arrowKeyNavigation) return;
			// Use current range from dataset (updated by dispatchChange when LaTeX changes)
			const from = parseInt(mfe.dataset.from ?? String(this.config.from), 10);
			const to = parseInt(mfe.dataset.to ?? String(this.config.to), 10);
			const posBefore = this.isInline ? from - 1 : to;
			const posAfter = this.isInline ? from : to + 3;
			const atStart = mfe.position === 0;
			const atEnd = mfe.position === mfe.lastOffset;
			if (ev.key === "ArrowLeft" && atStart) {
				ev.preventDefault();
				ev.stopPropagation();
				exitToEditor(posBefore);
				return;
			}
			if (ev.key === "ArrowRight" && atEnd) {
				ev.preventDefault();
				ev.stopPropagation();
				exitToEditor(posAfter);
				return;
			}

			// Only jump to prev/next line when at outermost level (not inside \frac{}{} etc.)
			const info = mfe.getElementInfo?.(mfe.position);
			const atOutermost = info?.depth === 0;
			// Use visual lines (wrapped) instead of document lines
			if (ev.key === "ArrowUp" && atOutermost) {
				// const block = view.lineBlockAt(to + 2);
				// block.top starting from the same line as math-field and last $$ symbol
				// if (block.top > 0) {
				// 	const prevBlock = view.lineBlockAtHeight(block.top + 0.1);
				// 	ev.preventDefault();
				// 	ev.stopPropagation();
				// 	exitToEditor(prevBlock.to);
				// 	return;
				// }
				ev.preventDefault();
				ev.stopPropagation();
				exitToEditor(posBefore);
				return;
			}
			if (ev.key === "ArrowDown" && atOutermost) {
				// const block = view.lineBlockAt(to + 3);
				// if (block.bottom < view.contentHeight - 1) {
				// 	console.log(block.bottom)
				// 	const nextBlock = view.lineBlockAtHeight(block.bottom);
				// 	ev.preventDefault();
				// 	ev.stopPropagation();
				// 	exitToEditor(nextBlock.from);
				// 	return;
				// }
				ev.preventDefault();
				ev.stopPropagation();
				exitToEditor(posAfter);
				return;
			}

		}, true);

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

		this.configureTouchKeyboard(mfe);

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
					this.settings.touchKeyboardProvider === "mathlive" &&
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
					this.settings.touchKeyboardProvider === "mathlive" &&
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

	setupBackslashCommandInput(mfe: MathfieldElement) {
		const root = mfe.shadowRoot;
		if (!root) return;

		root.addEventListener(
			"beforeinput",
			(event) => {
				const inputEvent = event as InputEvent;
				if (
					!inputEvent.cancelable ||
					inputEvent.isComposing ||
					inputEvent.inputType !== "insertText" ||
					inputEvent.data !== "\\" ||
					mfe.mode !== "math"
				) {
					return;
				}

				inputEvent.preventDefault();
				inputEvent.stopImmediatePropagation();
				mfe.executeCommand([
					"typedText",
					"\\",
					{
						focus: true,
						feedback: false,
						simulateKeystroke: true,
					},
				]);
			},
			{ capture: true }
		);
	}

	setupTouchKeyboard(mfe: MathfieldElement) {
		this.configureTouchKeyboard(mfe);
		const showAlways = () => {
			if (
				this.settings.touchKeyboardProvider === "mathlive" &&
				this.settings.mathVirtualKeyboardMode === "always"
			) {
				window.mathVirtualKeyboard?.show();
			}
		};
		mfe.addEventListener("focusin", showAlways);
		mfe.addEventListener(
			"pointerdown",
			() => {
				this.configureTouchKeyboard(mfe);
				showAlways();
			},
			{ capture: true }
		);
	}

	configureTouchKeyboard(mfe: MathfieldElement) {
		const provider = this.settings.touchKeyboardProvider;
		const sink = mfe.shadowRoot?.querySelector<HTMLElement>(
			'[part="keyboard-sink"]'
		);
		if (sink) {
			sink.setAttribute("inputmode", provider === "system" ? "text" : "none");
		}

		mfe.mathVirtualKeyboardPolicy = provider === "mathlive"
			? this.settings.mathVirtualKeyboardMode === "always"
				? "manual"
				: this.settings.mathVirtualKeyboardMode as VirtualKeyboardPolicy
			: "manual";

		const showKeyboardIcon = provider === "mathlive" &&
			(this.isInline
				? this.settings.inlineKeyboardIcon
				: this.settings.blockKeyboardIcon);
		this.changeCSSClass(showKeyboardIcon, mfe, "hide-keyboard");

		if (provider !== "mathlive") {
			window.mathVirtualKeyboard?.hide();
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
