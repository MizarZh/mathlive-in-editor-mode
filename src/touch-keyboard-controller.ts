import type { MathfieldElement } from "mathlive";
import { KeyboardCollapseButtonManager } from "./keyboard-collapse-manager";
import type { MathLiveEditorModePluginSettings } from "./settings-model";

const touchInputStates = new WeakMap<MathfieldElement, boolean>();

export function setupBackslashCommandInput(mfe: MathfieldElement): void {
	const root = mfe.shadowRoot;
	if (!root) return;
	const handleBeforeInput = (event: Event) => {
		const inputEvent = event as InputEvent;
		if (
			!inputEvent.cancelable || inputEvent.isComposing ||
			inputEvent.inputType !== "insertText" || inputEvent.data !== "\\" ||
			mfe.mode !== "math"
		) return;
		inputEvent.preventDefault();
		inputEvent.stopImmediatePropagation();
		mfe.executeCommand([
			"typedText",
			"\\",
			{ focus: true, feedback: false, simulateKeystroke: true },
		]);
	};
	root.addEventListener("beforeinput", handleBeforeInput, { capture: true });
}

export function configureTouchKeyboard(
	mfe: MathfieldElement,
	settings: MathLiveEditorModePluginSettings,
	isInline: boolean
): void {
	const provider = settings.touchKeyboardProvider;
	const sink = mfe.shadowRoot?.querySelector<HTMLElement>('[part="keyboard-sink"]');
	const useSystemKeyboard = touchInputStates.get(mfe) === true &&
		provider === "system";
	sink?.setAttribute("inputmode", useSystemKeyboard ? "text" : "none");
	mfe.mathVirtualKeyboardPolicy = "manual";
	const showIcon = isInline
		? settings.inlineKeyboardIcon
		: settings.blockKeyboardIcon;
	mfe.classList.toggle("hide-keyboard", !showIcon);
}

export function setupTouchKeyboard(
	mfe: MathfieldElement,
	settings: MathLiveEditorModePluginSettings,
	isInline: boolean
): void {
	const configure = () => configureTouchKeyboard(mfe, settings, isInline);
	const keyboard = mfe.ownerDocument.defaultView?.mathVirtualKeyboard;
	let pendingTouchFocus = false;
	const showForTouchFocus = () => {
		if (!pendingTouchFocus) return;
		pendingTouchFocus = false;
		if (settings.touchKeyboardProvider === "mathlive") keyboard?.show();
	};
	configure();
	mfe.addEventListener("focusin", showForTouchFocus);
	mfe.addEventListener("focusout", (event) => {
		touchInputStates.set(mfe, false);
		pendingTouchFocus = false;
		configure();
		if (!settings.hideMathVirtualKeyboardOnBlur) return;
		const nextTarget = event.relatedTarget;
		if (nextTarget instanceof Element &&
			(nextTarget.closest("math-field") || nextTarget.closest(".ML__keyboard"))) return;
		requestAnimationFrame(() => {
			const ownerDocument = mfe.ownerDocument;
			const activeElement = ownerDocument.activeElement;
			const keyboardFocused = activeElement instanceof Element &&
				activeElement.closest(".ML__keyboard");
			if (!ownerDocument.querySelector("math-field:focus-within") &&
				!keyboardFocused) {
				keyboard?.hide();
			}
		});
	});
	mfe.addEventListener("pointerdown", (event: PointerEvent) => {
		const manualKeyboardToggle = event.composedPath().some((target) =>
			target instanceof Element &&
			target.getAttribute("part")?.split(/\s+/).includes(
				"virtual-keyboard-toggle"
			)
		);
		if (manualKeyboardToggle) {
			touchInputStates.set(mfe, false);
			pendingTouchFocus = false;
			configure();
			return;
		}
		const isTouch = event.pointerType === "touch";
		touchInputStates.set(mfe, isTouch);
		pendingTouchFocus = isTouch;
		configure();
		if (!isTouch) return;
		if (settings.touchKeyboardProvider !== "mathlive") {
			keyboard?.hide();
			return;
		}
		if (mfe.matches(":focus-within")) showForTouchFocus();
	}, { capture: true });
}

export function setupKeyboardCollapseButton(mfe: MathfieldElement): void {
	const manager = KeyboardCollapseButtonManager.getInstance(mfe.ownerDocument);
	const ensureButton = () => manager.ensureButton();
	mfe.addEventListener("focus", ensureButton);
	mfe.addEventListener("pointerdown", ensureButton, { capture: true });
	if (mfe.matches(":focus-within")) ensureButton();
}
