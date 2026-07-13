import { Annotation } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import type { MathfieldElement } from "mathlive";
import { finishRenderMath, renderMath } from "obsidian";
import type { MathLiveEditorModePluginSettings } from "./settings-model";

interface InputSyncOptions {
	mfe: MathfieldElement;
	view: EditorView;
	settings: MathLiveEditorModePluginSettings;
	preserveWidgetDom: boolean;
	refreshInlinePreview: boolean;
	initialValue: string;
	getEquation: () => string;
	onEquationChange: (value: string) => void;
}

export const mathLiveInputTransaction = Annotation.define<boolean>();

type CodeMirrorInputState = { composing: number };
type InputSyncCleanup = () => void;

const inputSyncCleanups = new WeakMap<MathfieldElement, InputSyncCleanup>();

function getCodeMirrorInputState(view: EditorView): CodeMirrorInputState | undefined {
	return (view as unknown as {
		inputState?: CodeMirrorInputState;
	}).inputState;
}

export function disposeMathLiveInputSync(mfe: MathfieldElement): void {
	inputSyncCleanups.get(mfe)?.();
}

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
	disposeMathLiveInputSync(options.mfe);
	const {
		mfe,
		view,
		settings,
		preserveWidgetDom,
		refreshInlinePreview,
		initialValue,
		getEquation,
		onEquationChange,
	} = options;
	mfe.dataset.initialValue = initialValue;
	let focusedPreviousComposing: number | undefined;
	const beginCompositionGuard = () => {
		if (!preserveWidgetDom || focusedPreviousComposing !== undefined) return;
		const inputState = getCodeMirrorInputState(view);
		if (!inputState) return;
		focusedPreviousComposing = inputState.composing;
		inputState.composing = 1;
	};
	const endCompositionGuard = () => {
		if (focusedPreviousComposing === undefined) return;
		const inputState = getCodeMirrorInputState(view);
		if (inputState) inputState.composing = focusedPreviousComposing;
		focusedPreviousComposing = undefined;
	};
	mfe.addEventListener("focus", beginCompositionGuard);
	mfe.addEventListener("blur", endCompositionGuard);

	const dispatchChange = (newValue: string) => {
		const from = parseInt(mfe.dataset.from ?? "", 10);
		const to = parseInt(mfe.dataset.to ?? "", 10);
		if (Number.isNaN(from) || Number.isNaN(to)) return;
		onEquationChange(newValue);
		mfe.dataset.to = String(from + newValue.length);
		const inputState = preserveWidgetDom ? getCodeMirrorInputState(view) : undefined;
		const previousComposing = inputState?.composing;
		const inlineMath = refreshInlinePreview ? findPrecedingInlineMath(mfe) : null;
		if (preserveWidgetDom && inputState) inputState.composing = 1;
		try {
			// MathLive menu callbacks still reference this field after changing its value.
			view.dispatch({
				changes: { from, to, insert: newValue },
				annotations: mathLiveInputTransaction.of(true),
			});
		} finally {
			if (preserveWidgetDom && inputState && previousComposing !== undefined) {
				inputState.composing = previousComposing;
			}
		}
		if (refreshInlinePreview) refreshInlineMath(inlineMath, newValue);
	};

	const onInput = (event: InputEvent) => {
		const target = event.target as MathfieldElement;
		if (settings.immediateUpdate) {
			if (getEquation() !== target.value) dispatchChange(target.value);
			mfe.dataset.hasUnsavedChanges = "false";
		} else {
			mfe.dataset.hasUnsavedChanges = "true";
		}
	};
	mfe.addEventListener("input", onInput);

	const onDeferredBlur = () => {
		if (mfe.dataset.hasUnsavedChanges !== "true") return;
		if (mfe.value !== getEquation()) dispatchChange(mfe.value);
		mfe.dataset.hasUnsavedChanges = "false";
	};
	mfe.addEventListener("blur", onDeferredBlur);

	const onKeydown = (event: KeyboardEvent) => {
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
	};
	mfe.addEventListener("keydown", onKeydown);

	const cleanup = () => {
		if (inputSyncCleanups.get(mfe) !== cleanup) return;
		inputSyncCleanups.delete(mfe);
		mfe.removeEventListener("focus", beginCompositionGuard);
		mfe.removeEventListener("blur", endCompositionGuard);
		mfe.removeEventListener("input", onInput);
		mfe.removeEventListener("blur", onDeferredBlur);
		mfe.removeEventListener("keydown", onKeydown);
		endCompositionGuard();
	};
	inputSyncCleanups.set(mfe, cleanup);
}
