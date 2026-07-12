import type { EditorView } from "@codemirror/view";
import type { MathfieldElement } from "mathlive";
import type { MathLiveEditorModePluginSettings } from "./settings-model";

interface InputSyncOptions {
	mfe: MathfieldElement;
	view: EditorView;
	settings: MathLiveEditorModePluginSettings;
	initialValue: string;
	getEquation: () => string;
	onEquationChange: (value: string) => void;
}

export function setupMathLiveInputSync(options: InputSyncOptions): void {
	const { mfe, view, settings, initialValue, getEquation, onEquationChange } = options;
	mfe.dataset.initialValue = initialValue;

	const dispatchChange = (newValue: string) => {
		const from = parseInt(mfe.dataset.from ?? "", 10);
		const to = parseInt(mfe.dataset.to ?? "", 10);
		if (Number.isNaN(from) || Number.isNaN(to)) return;
		view.dispatch({ changes: { from, to, insert: newValue } });
		onEquationChange(newValue);
		mfe.dataset.to = String(from + newValue.length);
	};

	mfe.addEventListener("input", (event: InputEvent) => {
		const target = event.target as MathfieldElement;
		if (settings.immediateUpdate) {
			if (getEquation() !== target.value) dispatchChange(target.value);
			mfe.dataset.hasUnsavedChanges = "false";
		} else {
			mfe.dataset.hasUnsavedChanges = "true";
		}
	});

	mfe.addEventListener("blur", () => {
		if (mfe.dataset.hasUnsavedChanges !== "true") return;
		if (mfe.value !== getEquation()) dispatchChange(mfe.value);
		mfe.dataset.hasUnsavedChanges = "false";
	});

	mfe.addEventListener("keydown", (event: KeyboardEvent) => {
		if (event.key !== "Escape") return;
		const from = parseInt(mfe.dataset.from ?? "", 10);
		const to = parseInt(mfe.dataset.to ?? "", 10);
		if (
			!Number.isNaN(from) && !Number.isNaN(to) && from >= 0 &&
			to >= from && to <= view.state.doc.length &&
			view.state.doc.sliceString(from, to) !== initialValue
		) {
			dispatchChange(initialValue);
		}
		mfe.setValue(initialValue);
		mfe.dataset.hasUnsavedChanges = "false";
		mfe.blur();
		event.preventDefault();
		event.stopPropagation();
	});
}
