import { Annotation } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import type { MathfieldElement } from "mathlive";
import { finishRenderMath, renderMath } from "obsidian";
import type { MathLiveEditorModePluginSettings } from "./settings-model";

interface InputSyncOptions {
	mfe: MathfieldElement;
	view: EditorView;
	settings: MathLiveEditorModePluginSettings;
	isInline: boolean;
	initialValue: string;
	getEquation: () => string;
	onEquationChange: (value: string) => void;
}

export const mathLiveInputTransaction = Annotation.define<boolean>();

function findPrecedingInlineMath(mfe: MathfieldElement): HTMLElement | null {
	const wrapper = mfe.closest(".obsidian-mathlive-codemirror-wrapper");
	const line = wrapper?.parentElement?.closest(".cm-line");
	if (!wrapper || !line) return null;

	let preceding: HTMLElement | null = null;
	for (const math of Array.from(line.querySelectorAll<HTMLElement>("span.math"))) {
		if (math.compareDocumentPosition(wrapper) & Node.DOCUMENT_POSITION_FOLLOWING) {
			preceding = math;
		}
	}
	return preceding;
}

function refreshInlineMath(math: HTMLElement | null, source: string): void {
	if (!math?.isConnected) return;
	try {
		const rendered = renderMath(source, false);
		math.replaceChildren(...Array.from(rendered.childNodes));
		void finishRenderMath();
	} catch {
		// Partial LaTeX can be temporarily invalid while the user is typing.
	}
}

export function setupMathLiveInputSync(options: InputSyncOptions): void {
	const {
		mfe,
		view,
		settings,
		isInline,
		initialValue,
		getEquation,
		onEquationChange,
	} = options;
	mfe.dataset.initialValue = initialValue;

	const dispatchChange = (newValue: string) => {
		const from = parseInt(mfe.dataset.from ?? "", 10);
		const to = parseInt(mfe.dataset.to ?? "", 10);
		if (Number.isNaN(from) || Number.isNaN(to)) return;
		onEquationChange(newValue);
		mfe.dataset.to = String(from + newValue.length);
		const inputState = (view as unknown as {
			inputState?: { composing: number };
		}).inputState;
		const previousComposing = inputState?.composing;
		const inlineMath = isInline ? findPrecedingInlineMath(mfe) : null;
		if (isInline && inputState) inputState.composing = 1;
		try {
			view.dispatch({
				changes: { from, to, insert: newValue },
				annotations: mathLiveInputTransaction.of(true),
			});
		} finally {
			if (isInline && inputState && previousComposing !== undefined) {
				inputState.composing = previousComposing;
			}
		}
		if (isInline) refreshInlineMath(inlineMath, newValue);
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
