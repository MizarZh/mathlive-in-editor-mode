/** Build MathLive widget decorations from Markdown math syntax nodes. */
import { syntaxTree } from "@codemirror/language";
import { EditorState, RangeSetBuilder } from "@codemirror/state";
import { Decoration, DecorationSet } from "@codemirror/view";
import { getMathNavigationPositions } from "./math-boundaries";
import { MathLiveWidget } from "./mathlive-widget";
import type { Global, MathLiveEditorModePluginSettings } from "./settings-model";

export function buildMathLiveDecorations(
	state: EditorState,
	settings: MathLiveEditorModePluginSettings,
	global: Global
): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();
	let begin = -1;
	let end = -1;
	let isInline = false;

	syntaxTree(state).iterate({
		enter(node) {
			if (node.type.name.contains("formatting-math-begin")) {
				if (node.type.name.contains("math-block")) begin = node.from + 2;
				else {
					begin = node.from + 1;
					isInline = true;
				}
			}
			if (!node.type.name.contains("formatting-math-end") || begin === -1) return;
			end = node.from;
			const mathContent = state.sliceDoc(begin, end);
			const position = getMathNavigationPositions(state.doc, {
				from: begin,
				to: end,
				isInline,
			}).decorationPosition;
			if (!isInline || settings.inlineDisplay) {
				builder.add(position, position, Decoration.widget({
					widget: new MathLiveWidget(
						{ from: begin, to: end }, mathContent, settings, isInline, global
					),
					block: !isInline,
					side: isInline ? 1 : 10,
				}));
			}
			begin = end = -1;
			isInline = false;
		},
	});

	return builder.finish();
}
