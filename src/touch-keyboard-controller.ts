import type { MathfieldElement, VirtualKeyboardPolicy } from "mathlive";
import { KeyboardCollapseButtonManager } from "./keyboard-collapse-manager";
import type { MathLiveEditorModePluginSettings } from "./settings-model";

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
	sink?.setAttribute("inputmode", provider === "system" ? "text" : "none");
	mfe.mathVirtualKeyboardPolicy = provider === "mathlive"
		? settings.mathVirtualKeyboardMode === "always"
			? "manual"
			: settings.mathVirtualKeyboardMode as VirtualKeyboardPolicy
		: "manual";
	const showIcon = provider === "mathlive" &&
		(isInline ? settings.inlineKeyboardIcon : settings.blockKeyboardIcon);
	mfe.classList.toggle("hide-keyboard", !showIcon);
	if (provider !== "mathlive") window.mathVirtualKeyboard?.hide();
}

export function setupTouchKeyboard(
	mfe: MathfieldElement,
	settings: MathLiveEditorModePluginSettings,
	isInline: boolean
): void {
	const configure = () => configureTouchKeyboard(mfe, settings, isInline);
	const showAlways = () => {
		if (settings.touchKeyboardProvider === "mathlive" &&
			settings.mathVirtualKeyboardMode === "always") {
			window.mathVirtualKeyboard?.show();
		}
	};
	configure();
	mfe.addEventListener("focusin", showAlways);
	mfe.addEventListener("focusout", (event) => {
		if (!settings.hideMathVirtualKeyboardOnBlur ||
			settings.touchKeyboardProvider !== "mathlive") return;
		const nextTarget = event.relatedTarget;
		if (nextTarget instanceof Element &&
			(nextTarget.closest("math-field") || nextTarget.closest(".ML__keyboard"))) return;
		requestAnimationFrame(() => {
			const activeElement = document.activeElement;
			const keyboardFocused = activeElement instanceof Element &&
				activeElement.closest(".ML__keyboard");
			if (!document.querySelector("math-field:focus-within") && !keyboardFocused) {
				window.mathVirtualKeyboard?.hide();
			}
		});
	});
	mfe.addEventListener("pointerdown", () => {
		configure();
		showAlways();
	}, { capture: true });
}

export function setupKeyboardCollapseButton(mfe: MathfieldElement): void {
	const manager = KeyboardCollapseButtonManager.getInstance();
	const ensureButton = () => manager.ensureButton();
	mfe.addEventListener("focus", ensureButton);
	mfe.addEventListener("click", ensureButton);
}
