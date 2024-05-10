import { EditorView, WidgetType } from "@codemirror/view";
import { MathfieldElement } from "mathlive";

interface WidgetConfig {
	from: number;
	to: number;
}
export class MathliveWidget extends WidgetType {
	equation: string;
	config: WidgetConfig;
	display: boolean;

	constructor(config: WidgetConfig, equation: string, display: boolean) {
		super();
		this.config = config;
		this.equation = equation;
		this.display = display;
	}
	toDOM(view: EditorView): HTMLElement {
		// element initialization
		const div = document.createElement("div");
		const mfe = document.createElement("math-field") as MathfieldElement;
		div.appendChild(mfe);
		div.addClass("obsidian-mathlive-codemirror-div");
		mfe.addClass("obsidian-mathlive-codemirror-math-field");
		mfe.setValue(this.equation);
		mfe.dataset.from = `${this.config.from}`;
		mfe.dataset.to = `${this.config.to}`;
		if (this.display) {
			mfe.removeClass("hidden");
		} else {
			mfe.addClass("hidden");
		}
		
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

		mfe.style.display = this.display ? "block" : "none";

		mfe.dataset.from = `${this.config.from}`;
		mfe.dataset.to = `${this.config.to}`;

		mfe.setValue(this.equation);

		return true;
	}
	destroy(dom: HTMLElement): void {}
}
