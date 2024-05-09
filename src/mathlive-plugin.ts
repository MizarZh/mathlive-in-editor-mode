import { syntaxTree } from "@codemirror/language";
import {
	RangeSetBuilder,
	StateField,
	Transaction,
	Extension,
} from "@codemirror/state";
import { Decoration, DecorationSet, EditorView } from "@codemirror/view";
import { MathliveWidget } from "./mathlive-widget";

export const mathliveListField = StateField.define<DecorationSet>({
	create(state): DecorationSet {
		return Decoration.none;
	},
	update(oldState: DecorationSet, transaction: Transaction): DecorationSet {
		const builder = new RangeSetBuilder<Decoration>();
		let begin: number, end: number;
		syntaxTree(transaction.state).iterate({
			enter(node) {
				// console.log(node.type.name);
				// console.log(EditorView.editable);
				// console.log(transaction.state);
				if (
					node.type.name.contains("formatting-math-begin") &&
					node.type.name.contains("math-block")
				) {
					begin = node.from + 2;
				}
				// exclude inline elements, for now
				if (
					node.type.name.contains("formatting-math-end") &&
					begin !== -1
				) {
					end = node.from;
					builder.add(
						end + 3,
						end + 3,
						Decoration.widget({
							widget: new MathliveWidget(
								{ from: begin, to: end },
								transaction.state.sliceDoc(begin, end)
							),
							block: true,
							side: 100,
						})
					);
					begin = end = -1;
				}
			},
		});

		return builder.finish();
	},
	provide(field: StateField<DecorationSet>): Extension {
		return EditorView.decorations.from(field);
	},
});