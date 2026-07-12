import { StateEffect } from "@codemirror/state";
import { EditorView, ViewPlugin } from "@codemirror/view";

export const mathLiveSettingsChanged = StateEffect.define<void>();

const editorViews = new Set<EditorView>();

export const trackMathLiveEditorViews = ViewPlugin.fromClass(class {
	private view: EditorView;

	constructor(view: EditorView) {
		this.view = view;
		editorViews.add(view);
	}

	destroy(): void {
		editorViews.delete(this.view);
	}
});

export function refreshMathLiveEditors(): void {
	for (const view of editorViews) {
		view.dispatch({ effects: mathLiveSettingsChanged.of(undefined) });
	}
}
