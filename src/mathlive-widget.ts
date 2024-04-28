import { EditorView, WidgetType } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { MathfieldElement } from "mathlive";

export class MathliveWidget extends WidgetType {
	equation: string;
	from: number;
	to: number;
	constructor(from: number, to: number, equation: string) {
		super();
		this.from = from;
		this.to = to;
		this.equation = equation;
	}
	toDOM(view: EditorView): HTMLElement {
		const div = document.createElement("div");
		const mfe = document.createElement("math-field") as MathfieldElement;
		div.appendChild(mfe);
		mfe.dataset.from = `${this.from + 2}`;
		mfe.dataset.to = `${this.to}`;
		mfe.setValue(this.equation);
		mfe.addEventListener("input", (ev: InputEvent) => {
			console.log(mfe.dataset.from, mfe.dataset.to, mfe.value);
			view.dispatch({
				changes: {
					from: parseInt(mfe.dataset.from),
					to: parseInt(mfe.dataset.to),
					insert: mfe.value,
				},
			});
		});
		return div;
	}
	updateDOM(dom: HTMLElement, view: EditorView): boolean {
		const mfe = dom.getElementsByTagName(
			"math-field"
		)[0] as MathfieldElement;
		mfe.setValue(this.equation);

		for (const { from, to } of view.visibleRanges) {
			syntaxTree(view.state).iterate({
				from,
				to,
				enter: (node) => {
					if (node.type.name.contains("formatting-math-begin")) {
						mfe.dataset.from = `${node.from + 2}`;
					}
					if (node.type.name.contains("formatting-math-end")) {
						mfe.dataset.to = `${node.from}`;
					}
				},
			});
		}
		console.log("updateDOM", mfe.dataset.from, mfe.dataset.to);

		return true;
	}
	destroy(dom: HTMLElement): void {}
}
