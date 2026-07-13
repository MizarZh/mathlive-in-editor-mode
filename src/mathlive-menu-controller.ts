import type { MathfieldElement } from "mathlive";

type MenuCleanup = () => void;

interface DocumentMenuState {
	fields: Set<MathfieldElement>;
	lastMathfield: MathfieldElement | null;
	pendingClickMathfield: MathfieldElement | null;
	onPointerDown: EventListener;
	onClick: EventListener;
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

function getPathMathfield(
	path: EventTarget[],
	fields: Set<MathfieldElement>
): MathfieldElement | null {
	return (path.find((target) =>
		fields.has(target as MathfieldElement)
	) as MathfieldElement | undefined) ?? null;
}

function isInsideMenu(event: Event, menus: HTMLElement[]): boolean {
	const path = event.composedPath();
	if (menus.some((menu) => path.includes(menu))) return true;
	if (!("clientX" in event) || !("clientY" in event)) return false;
	const { clientX, clientY } = event as MouseEvent;
	return menus.some((menu) => {
		const bounds = menu.getBoundingClientRect();
		return clientX >= bounds.left && clientX <= bounds.right &&
			clientY >= bounds.top && clientY <= bounds.bottom;
	});
}

export function dismissOpenMathLiveMenu(mfe: MathfieldElement): boolean {
	const menu = getOpenMenus(mfe)[0];
	if (!menu) return false;
	const scrim = menu.parentElement;
	if (!scrim) return false;
	const KeyboardEventConstructor =
		scrim.ownerDocument.defaultView?.KeyboardEvent ?? KeyboardEvent;
	// A top-layer menu does not reliably bubble its synthetic Escape to the scrim.
	// Keep it local so the math-field Escape handler does not undo current edits.
	scrim.dispatchEvent(new KeyboardEventConstructor("keydown", {
		key: "Escape",
		bubbles: false,
		cancelable: true,
		composed: false,
	}));
	// toggleContextMenu() can reopen a menu whose state is not exactly "open".
	return menu.parentElement === null;
}

function handleDocumentPointerDown(
	event: Event,
	ownerDocument: Document,
	state: DocumentMenuState
): void {
	const path = event.composedPath();
	const pathMathfield = getPathMathfield(path, state.fields);
	const activeMathfield = getActiveMathfield(ownerDocument, state.fields);
	state.pendingClickMathfield = [
		pathMathfield,
		activeMathfield,
		state.lastMathfield,
	].find((mfe) => mfe && getOpenMenus(mfe).length > 0) ?? null;
	if (pathMathfield) state.lastMathfield = pathMathfield;
}

function handleDocumentClick(event: Event, state: DocumentMenuState): void {
	const mfe = state.pendingClickMathfield;
	state.pendingClickMathfield = null;
	if (!mfe || !state.fields.has(mfe)) return;
	const menus = getOpenMenus(mfe);
	if (menus.length === 0 || isInsideMenu(event, menus)) return;
	// Menu item click handlers finish before this document-level fallback.
	queueMicrotask(() => {
		if (state.fields.has(mfe)) dismissOpenMathLiveMenu(mfe);
	});
}

function getDocumentMenuState(ownerDocument: Document): DocumentMenuState {
	const existing = documentMenuStates.get(ownerDocument);
	if (existing) return existing;

	const fields = new Set<MathfieldElement>();
	const state: DocumentMenuState = {
		fields,
		lastMathfield: null,
		pendingClickMathfield: null,
		onPointerDown: (event) => {
			handleDocumentPointerDown(event, ownerDocument, state);
		},
		onClick: (event) => {
			handleDocumentClick(event, state);
		},
	};
	ownerDocument.addEventListener("pointerdown", state.onPointerDown, true);
	ownerDocument.addEventListener("click", state.onClick);
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
		if (state.lastMathfield === mfe) state.lastMathfield = null;
		if (state.pendingClickMathfield === mfe) state.pendingClickMathfield = null;
		if (state.fields.size > 0) return;
		ownerDocument.removeEventListener("pointerdown", state.onPointerDown, true);
		ownerDocument.removeEventListener("click", state.onClick);
		documentMenuStates.delete(ownerDocument);
	};
	menuCleanups.set(mfe, cleanup);
}
