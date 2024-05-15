import { syntaxTree } from "@codemirror/language";
import {
	RangeSetBuilder,
	StateField,
	Transaction,
	Extension,
} from "@codemirror/state";
import { Decoration, DecorationSet, EditorView } from "@codemirror/view";
import { MathliveWidget } from "./mathlive-widget";
import { ObsidianMathliveCodemirrorPluginSettings } from "./setting";

export const mathliveListFieldWrapper = (
	settings: ObsidianMathliveCodemirrorPluginSettings
) => {
	const mathliveListField = StateField.define<DecorationSet>({
		create(state): DecorationSet {
			return Decoration.none;
		},
		update(
			oldState: DecorationSet,
			transaction: Transaction
		): DecorationSet {
			const builder = new RangeSetBuilder<Decoration>();
			let begin = -1,
				end = -1,
				isInline = false;
			syntaxTree(transaction.state).iterate({
				enter(node) {
					// console.log(node.type.name);
					// console.log(EditorView.editable);
					// console.log(transaction.state);

					// exclude inline elements, for now
					if (node.type.name.contains("formatting-math-begin")) {
						if (node.type.name.contains("math-block"))
							begin = node.from + 2;
						else {
							begin = node.from + 1;
							isInline = true;
						}
					}
					if (
						node.type.name.contains("formatting-math-end") &&
						begin !== -1
					) {
						end = node.from;
						if (!isInline) {
							// block
							builder.add(
								end + 2,
								end + 2,
								Decoration.widget({
									widget: new MathliveWidget(
										{ from: begin, to: end },
										transaction.state.sliceDoc(begin, end),
										settings,
										isInline
									),
									block: true,
									side: 10,
								})
							);
						} else {
							if (settings.inlineDisplay)
								// inline
								builder.add(
									end + 1,
									end + 1,
									Decoration.replace({
										widget: new MathliveWidget(
											{ from: begin, to: end },
											transaction.state.sliceDoc(
												begin,
												end
											),
											settings,
											isInline
										),
									})
								);
						}

						begin = end = -1;
						isInline = false;
					}
				},
			});
			return builder.finish();
		},
		provide(field: StateField<DecorationSet>): Extension {
			return EditorView.decorations.from(field);
		},
	});
	return mathliveListField;
};
