import { syntaxTree } from "@codemirror/language";
import { Extension, StateField, Transaction } from "@codemirror/state";
import { DecorationSet, EditorView } from "@codemirror/view";
import { buildMathLiveDecorations } from "./mathlive-decorations";
import { createMathNavigation } from "./editor-math-navigation";
import {
	mathLiveSettingsChanged,
	trackMathLiveEditorViews,
} from "./editor-refresh";
import type { Global, MathLiveEditorModePluginSettings } from "./settings-model";

export const mathliveListFieldWrapper = (
	settings: MathLiveEditorModePluginSettings,
	global: Global
): Extension => {
	const mathliveListField = StateField.define<DecorationSet>({
		create(state): DecorationSet {
			return buildMathLiveDecorations(state, settings, global);
		},
		update(oldState: DecorationSet, transaction: Transaction): DecorationSet {
			const settingsChanged = transaction.effects.some((effect) =>
				effect.is(mathLiveSettingsChanged)
			);
			const syntaxTreeChanged =
				syntaxTree(transaction.startState) !== syntaxTree(transaction.state);
			if (!transaction.docChanged && !settingsChanged && !syntaxTreeChanged) {
				return oldState;
			}
			return buildMathLiveDecorations(transaction.state, settings, global);
		},
		provide(field): Extension {
			return [
				EditorView.decorations.from(field),
				createMathNavigation(settings),
			];
		},
	});
	return [mathliveListField, trackMathLiveEditorViews];
};
