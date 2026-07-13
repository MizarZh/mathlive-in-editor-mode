import type { MathfieldElement } from "mathlive";

type MenuCleanup = () => void;

interface DocumentMenuState {
	fields: Set<MathfieldElement>;
	lastMathfield: MathfieldElement | null;
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

function getPathMathfield(
	path: EventTarget[],
	fields: Set<MathfieldElement>
): MathfieldElement | null {
	return (path.find((target) =>
		fields.has(target as MathfieldElement)
	) as MathfieldElement | undefined) ?? null;
}

function isInsideMenu(event: Event, menus: HTMLElement[]): boolean {
	if ("clientX" in event && "clientY" in event) {
		const { clientX, clientY } = event as PointerEvent;
		return menus.some((menu) => {
			const bounds = menu.getBoundingClientRect();
			return clientX >= bounds.left && clientX <= bounds.right &&
				clientY >= bounds.top && clientY <= bounds.bottom;
		});
	}

	// Top-layer popovers can place the menu in an unrelated composed path.
	// Pointer coordinates are authoritative; this fallback serves non-pointer events.
	const path = event.composedPath();
	return menus.some((menu) => path.includes(menu));
}

export function dismissOpenMathLiveMenu(mfe: MathfieldElement): boolean {
	const menu = getOpenMenus(mfe)[0];
	if (!menu) return false;
	const scrim = menu.parentElement;
	if (!scrim) return false;
	const MouseEventConstructor =
		scrim.ownerDocument.defaultView?.MouseEvent ?? MouseEvent;
	// Use MathLive's light-dismiss path so menu, scrim, focus, and state close together.
	scrim.dispatchEvent(new MouseEventConstructor("click", {
		bubbles: false,
		cancelable: true,
		composed: false,
	}));
	if (menu.parentElement === null) return true;

	const KeyboardEventConstructor =
		scrim.ownerDocument.defaultView?.KeyboardEvent ?? KeyboardEvent;
	// Fallback for a scrim whose light-dismiss state is already inconsistent.
	scrim.dispatchEvent(new KeyboardEventConstructor("keydown", {
		key: "Escape",
		bubbles: false,
		cancelable: true,
		composed: false,
	}));
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
	const mfe = [
		pathMathfield,
		activeMathfield,
		state.lastMathfield,
	].find((mfe) => mfe && getOpenMenus(mfe).length > 0) ?? null;
	if (pathMathfield) state.lastMathfield = pathMathfield;
	if (!mfe || !state.fields.has(mfe)) return;
	const menus = getOpenMenus(mfe);
	if (menus.length === 0 || isInsideMenu(event, menus)) return;
	// The scrim is nested inside MathLive's menu toggle. Stop this pointerdown
	// before removing the scrim, or it continues to the toggle and reopens the menu.
	if (event.cancelable) event.preventDefault();
	event.stopPropagation();
	dismissOpenMathLiveMenu(mfe);
}

function getDocumentMenuState(ownerDocument: Document): DocumentMenuState {
	const existing = documentMenuStates.get(ownerDocument);
	if (existing) return existing;

	const fields = new Set<MathfieldElement>();
	const state: DocumentMenuState = {
		fields,
		lastMathfield: null,
		onPointerDown: (event) => {
			handleDocumentPointerDown(event, ownerDocument, state);
		},
	};
	ownerDocument.addEventListener("pointerdown", state.onPointerDown, true);
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
		if (state.fields.size > 0) return;
		ownerDocument.removeEventListener("pointerdown", state.onPointerDown, true);
		documentMenuStates.delete(ownerDocument);
	};
	menuCleanups.set(mfe, cleanup);
}
