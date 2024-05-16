import { EditorView, WidgetType } from "@codemirror/view";
import { MathfieldElement } from "mathlive";
import { MathLiveEditorModePluginSettings } from "./setting";

interface WidgetConfig {
	from: number;
	to: number;
}
export class MathLiveWidget extends WidgetType {
	equation: string;
	config: WidgetConfig;
	settings: MathLiveEditorModePluginSettings;
	isInline: boolean;

	constructor(
		config: WidgetConfig,
		equation: string,
		settings: MathLiveEditorModePluginSettings,
		isInline: boolean
	) {
		super();
		this.config = config;
		this.equation = equation;
		this.settings = settings;
		this.isInline = isInline;
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

		this.style(mfe, dom as HTMLDivElement);

		mfe.dataset.from = `${this.config.from}`;
		mfe.dataset.to = `${this.config.to}`;

		mfe.setValue(this.equation);

		return true;
	}
	destroy(dom: HTMLElement): void {}
	style(mfe: MathfieldElement, div: HTMLDivElement) {
		if (this.settings.display) {
			// display
			mfe.removeClass("hidden");
			if (this.isInline) {
				// inline
				div.addClass("inline");
				this.changeCSSClass(this.settings.inlineDisplay, mfe, "hidden");
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
				this.changeCSSClass(this.settings.blockDisplay, mfe, "hidden");
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
			mfe.addClass("hidden");
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
