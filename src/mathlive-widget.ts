import { ChangeDesc, EditorSelection } from "@codemirror/state";
import { EditorView, WidgetType } from "@codemirror/view";
import { MathfieldElement } from "mathlive";
import type { MathLiveEditorModePluginSettings, Global } from "./settings-model";
import { getMathNavigationPositions } from "./math-boundaries";
import { applyMathLiveSettings } from "./mathlive-settings-applier";
import {
	disposeMathLiveInputSync,
	setupMathLiveInputSync,
} from "./mathlive-input-sync";
import {
	dismissOpenMathLiveMenu,
	disposeMathLiveMenuDismissal,
	setupMathLiveMenuDismissal,
} from "./mathlive-menu-controller";
import {
	configureTouchKeyboard,
	setupBackslashCommandInput,
	setupKeyboardCollapseButton,
	setupTouchKeyboard,
} from "./touch-keyboard-controller";
interface WidgetConfig {
	from: number;
	to: number;
}

function placeSelectionAfterBlockWidget(view: EditorView, widgetDom: HTMLElement): void {
	let nextLine = widgetDom.nextElementSibling;
	while (nextLine && !nextLine.classList.contains("cm-line")) {
		nextLine = nextLine.nextElementSibling;
	}
	if (!nextLine) return;

	const rootSelection = (view.root as DocumentOrShadowRoot & {
		getSelection?: () => Selection | null;
	}).getSelection?.();
	const selection = rootSelection ?? view.dom.ownerDocument.getSelection();
	if (!selection) return;
	const range = view.dom.ownerDocument.createRange();
	range.selectNodeContents(nextLine);
	range.collapse(true);
	selection.removeAllRanges();
	selection.addRange(range);
}

export class MathLiveWidget extends WidgetType {
	equation: string;
	config: WidgetConfig;
	settings: MathLiveEditorModePluginSettings;
	isInline: boolean;
	global: Global;
	private initializationTimeout: number | null = null;
	private mathfield: MathfieldElement | null = null;

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
		this.mathfield = mfe;
		div.appendChild(mfe);
		setupMathLiveMenuDismissal(mfe);
		div.addClass("obsidian-mathlive-codemirror-wrapper");
		div.addClass("cm-line");
		mfe.defaultMode = this.isInline ? "inline-math" : "math";
		mfe.addClass("obsidian-mathlive-codemirror-math-field");
		mfe.setValue(this.equation);
		mfe.dataset.from = `${this.config.from}`;
		mfe.dataset.to = `${this.config.to}`;
		setupBackslashCommandInput(mfe);
		setupTouchKeyboard(mfe, this.settings, this.isInline);

		// have to put them in setTimeout, mfe is somehow not initialized
		this.initializationTimeout = window.setTimeout(() => {
			this.initializationTimeout = null;
			if (!mfe.isConnected) return;

			applyMathLiveSettings(mfe, this.settings, this.global);
			configureTouchKeyboard(mfe, this.settings, this.isInline);

			// Setup the plugin-owned keyboard collapse overlay.
			setupKeyboardCollapseButton(mfe);
		}, 0);

		this.style(mfe, div);
		const initialPositions = getMathNavigationPositions(view.state.doc, {
			from: this.config.from,
			to: this.config.to,
			isInline: this.isInline,
		}, this.settings.inlineWidgetPosition);
		const refreshInlinePreview = this.isInline &&
			this.settings.inlineWidgetPosition === "right";

		setupMathLiveInputSync({
			mfe,
			view,
			settings: this.settings,
			preserveWidgetDom: initialPositions.decorationSide < 0,
			refreshInlinePreview,
			initialValue: this.equation,
			getEquation: () => this.equation,
			onEquationChange: (value) => { this.equation = value; },
		});

		// Arrow keys at boundaries: exit to LaTeX (on wrapper, capture phase, so we run before MathLive)
		const exitToEditor = (
			cursorPos: number,
			assoc = 0,
			placeAfterBlock = false
		) => {
			const docLen = view.state.doc.length;
			if (cursorPos < 0 || cursorPos > docLen) return;
			view.dispatch({ selection: EditorSelection.cursor(cursorPos, assoc) });
			view.focus();
			if (placeAfterBlock) {
				placeSelectionAfterBlockWidget(view, div);
				view.requestMeasure({
					read: () => null,
					write: () => {
						if (
							div.isConnected && view.hasFocus &&
							view.state.selection.main.head === cursorPos
						) placeSelectionAfterBlockWidget(view, div);
					},
					key: div,
				});
			}
		};
		div.addEventListener("keydown", (ev: KeyboardEvent) => {
			if (document.activeElement !== mfe && !mfe.contains(document.activeElement)) return;
			if (!this.settings.arrowKeyNavigation) return;
			// Use current range from dataset (updated by dispatchChange when LaTeX changes)
			const from = parseInt(mfe.dataset.from ?? String(this.config.from), 10);
			const to = parseInt(mfe.dataset.to ?? String(this.config.to), 10);
			if (Number.isNaN(from) || Number.isNaN(to)) return;
			const positions = getMathNavigationPositions(view.state.doc, {
				from,
				to,
				isInline: this.isInline,
			}, this.settings.inlineWidgetPosition);
			const atStart = mfe.position === 0;
			const atEnd = mfe.position === mfe.lastOffset;
			const rightInline = this.isInline &&
				this.settings.inlineWidgetPosition === "right";
			const exitsAfterBlock = !this.isInline &&
				positions.forwardBoundary === positions.decorationPosition;
			if (ev.key === "ArrowLeft" && atStart) {
				ev.preventDefault();
				ev.stopPropagation();
				exitToEditor(positions.backwardBoundary, rightInline ? -1 : 0);
				return;
			}
			if (ev.key === "ArrowRight" && atEnd) {
				ev.preventDefault();
				ev.stopPropagation();
				exitToEditor(
					positions.forwardBoundary,
					rightInline || exitsAfterBlock ? 1 : 0,
					exitsAfterBlock
				);
				return;
			}

			// Only jump to prev/next line when at outermost level (not inside \frac{}{} etc.)
			const info = mfe.getElementInfo?.(mfe.position);
			const atOutermost = info?.depth === 0;
			// Use visual lines (wrapped) instead of document lines
			if (ev.key === "ArrowUp" && atOutermost) {
				ev.preventDefault();
				ev.stopPropagation();
				exitToEditor(positions.backwardBoundary, rightInline ? -1 : 0);
				return;
			}
			if (ev.key === "ArrowDown" && atOutermost) {
				ev.preventDefault();
				ev.stopPropagation();
				exitToEditor(
					positions.forwardBoundary,
					rightInline || exitsAfterBlock ? 1 : 0,
					exitsAfterBlock
				);
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

		applyMathLiveSettings(mfe, this.settings, this.global);
		configureTouchKeyboard(mfe, this.settings, this.isInline);

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
		this.mathfield = null;
		if (this.initializationTimeout !== null) {
			window.clearTimeout(this.initializationTimeout);
			this.initializationTimeout = null;
		}

		const mfe = dom.getElementsByTagName(
			"math-field"
		)[0] as MathfieldElement;

		dismissOpenMathLiveMenu(mfe);
		disposeMathLiveMenuDismissal(mfe);
		disposeMathLiveInputSync(mfe);
		mfe.blur();
		mfe.dataset.macros = "";
		mfe.dataset.shortcuts = "";
	}
	mapSourceRange(changes: ChangeDesc): void {
		this.config = {
			from: changes.mapPos(this.config.from, -1),
			to: changes.mapPos(this.config.to, 1),
		};
		if (this.mathfield?.isConnected) {
			this.mathfield.dataset.from = String(this.config.from);
			this.mathfield.dataset.to = String(this.config.to);
		}
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

	eq(other: MathLiveWidget): boolean {
		if (
			!this.isInline || !other.isInline ||
			this.config.from !== other.config.from ||
			this.equation === other.equation
		) return false;

		let active = document.activeElement;
		if (active?.getRootNode() instanceof ShadowRoot) {
			active = (active.getRootNode() as ShadowRoot).host;
		}
		if (!(active instanceof HTMLElement) || active.tagName !== "MATH-FIELD") {
			return false;
		}

		return parseInt(active.dataset.from ?? "", 10) === this.config.from;
	}
}
