import type { MathfieldElement } from "mathlive";

type MenuCleanup = () => void;

interface DocumentMenuState {
	fields: Set<MathfieldElement>;
	onPointerDown: EventListener;
}

const documentMenuStates = new WeakMap<Document, DocumentMenuState>();
const menuCleanups = new WeakMap<MathfieldElement, MenuCleanup>();

function getOpenMenus(mfe: MathfieldElement): HTMLElement[] {
	return Array.from(
		mfe.shadowRoot?.querySelectorAll<HTMLElement>(
			'menu[part~="ui-menu-container"]'
		) ?? []
	);
}

function getActiveMathfield(
	ownerDocument: Document,
	fields: Set<MathfieldElement>
): MathfieldElement | null {
	let active: Element | null = ownerDocument.activeElement;
	let mathfield: MathfieldElement | null = null;
	while (active) {
		if (active.tagName === "MATH-FIELD" && fields.has(active as MathfieldElement)) {
			mathfield = active as MathfieldElement;
		}
		active = active.shadowRoot?.activeElement ?? null;
	}
	return mathfield;
}

export function dismissOpenMathLiveMenu(mfe: MathfieldElement): boolean {
	const menu = getOpenMenus(mfe)[0];
	if (!menu) return false;
	const scrim = menu.parentElement;
	if (!scrim) return false;
	const KeyboardEventConstructor =
		scrim.ownerDocument.defaultView?.KeyboardEvent ?? KeyboardEvent;
	// A top-layer menu does not reliably bubble its synthetic Escape to the scrim.
	scrim.dispatchEvent(new KeyboardEventConstructor("keydown", {
		key: "Escape",
		bubbles: true,
		cancelable: true,
		composed: true,
	}));
	if (menu.parentElement && mfe.isConnected) {
		mfe.executeCommand("toggleContextMenu");
	}
	return menu.parentElement === null;
}

function handleDocumentPointerDown(
	event: Event,
	ownerDocument: Document,
	fields: Set<MathfieldElement>
): void {
	const path = event.composedPath();
	const pathMathfield = path.find((target) =>
		fields.has(target as MathfieldElement)
	) as MathfieldElement | undefined;
	const mfe = pathMathfield ?? getActiveMathfield(ownerDocument, fields);
	if (!mfe) return;
	const menus = getOpenMenus(mfe);
	if (menus.length === 0) return;
	if (menus.some((menu) => path.includes(menu))) return;
	// Let MathLive finish the pointer dispatch before changing its popover state.
	queueMicrotask(() => {
		if (fields.has(mfe)) dismissOpenMathLiveMenu(mfe);
	});
}

function getDocumentMenuState(ownerDocument: Document): DocumentMenuState {
	const existing = documentMenuStates.get(ownerDocument);
	if (existing) return existing;

	const fields = new Set<MathfieldElement>();
	const onPointerDown: EventListener = (event) => {
		handleDocumentPointerDown(event, ownerDocument, fields);
	};
	const state = { fields, onPointerDown };
	ownerDocument.addEventListener("pointerdown", onPointerDown, true);
	documentMenuStates.set(ownerDocument, state);
	return state;
}

export function disposeMathLiveMenuDismissal(mfe: MathfieldElement): void {
	menuCleanups.get(mfe)?.();
}

export function setupMathLiveMenuDismissal(mfe: MathfieldElement): void {
	disposeMathLiveMenuDismissal(mfe);
	const ownerDocument = mfe.ownerDocument;
	const state = getDocumentMenuState(ownerDocument);
	state.fields.add(mfe);

	const cleanup = () => {
		if (menuCleanups.get(mfe) !== cleanup) return;
		menuCleanups.delete(mfe);
		state.fields.delete(mfe);
		if (state.fields.size > 0) return;
		ownerDocument.removeEventListener("pointerdown", state.onPointerDown, true);
		documentMenuStates.delete(ownerDocument);
	};
	menuCleanups.set(mfe, cleanup);
}
