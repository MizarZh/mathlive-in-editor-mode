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
		let begin: number;
		syntaxTree(transaction.state).iterate({
			enter(node) {
				// console.log(node.type.name);
				// console.log(EditorView.editable);
				// console.log(transaction.state);

				if (node.type.name.contains("formatting-math-begin")) {
					begin = node.from + 2;
				}
				if (node.type.name.contains("formatting-math-end")) {
					const listCharFrom = node.from;
					builder.add(
						listCharFrom + 3,
						listCharFrom + 3,
						Decoration.replace({
							widget: new MathliveWidget(
								{ from: begin, to: listCharFrom },
								transaction.state.sliceDoc(begin, listCharFrom)
							),
							block: true,
						})
					);
				}
			},
		});

		return builder.finish();
	},
	provide(field: StateField<DecorationSet>): Extension {
		return EditorView.decorations.from(field);
	},
});

// class MathlivePlugin implements PluginValue {
// 	decorations: DecorationSet;
// 	mathliveListField: DecorationSet;

// 	constructor(view: EditorView) {
// 		this.decorations = this.buildDecorations(view);
// 	}

// 	update(update: ViewUpdate) {
// 		if (update.docChanged || update.viewportChanged) {
// 			this.decorations = this.buildDecorations(update.view);
// 		}
// 	}

// 	buildDecorations(view: EditorView): DecorationSet {
// 		const builder = new RangeSetBuilder<Decoration>();
// 		let begin: number;
// 		for (const { from, to } of view.visibleRanges) {
// 			syntaxTree(view.state).iterate({
// 				from,
// 				to,
// 				enter(node) {
// 					console.log(node.type.name);
// 					if (node.type.name.contains("formatting-math-begin")) {
// 						console.log(node.type.name);
// 						begin = node.from + 2;
// 					}
// 					if (node.type.name.contains("formatting-math-end")) {
// 						console.log(node.type.name);
// 						const listCharFrom = node.from;

// 						builder.add(
// 							listCharFrom,
// 							listCharFrom,
// 							Decoration.widget({
// 								widget: new MathliveWidget(
// 									begin,
// 									listCharFrom,
// 									view.state.sliceDoc(begin, listCharFrom)
// 								),
// 								block: true,
// 								side: 1,
// 							})
// 						);
// 					}
// 				},
// 			});
// 		}

// 		return builder.finish();
// 	}

// 	destroy() {}
// }

// const pluginSpec: PluginSpec<MathlivePlugin> = {
// 	decorations: (value: MathlivePlugin) => value.decorations,
// };

// export const MathliveListPlugin = ViewPlugin.fromClass(
// 	MathlivePlugin,
// 	pluginSpec
// );
