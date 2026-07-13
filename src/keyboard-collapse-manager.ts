import { setIcon } from "obsidian";

export class KeyboardCollapseButtonManager {
	private static readonly instances = new Map<
		Document,
		KeyboardCollapseButtonManager
	>();

	private readonly keyboard: typeof window.mathVirtualKeyboard | null;
	private button: HTMLButtonElement | null = null;
	private readonly onKeyboardChange = () => this.syncButton();

	static getInstance(ownerDocument: Document): KeyboardCollapseButtonManager {
		let instance = this.instances.get(ownerDocument);
		if (!instance) {
			instance = new KeyboardCollapseButtonManager(ownerDocument);
			this.instances.set(ownerDocument, instance);
		}
		return instance;
	}

	static disposeInstances(): void {
		for (const instance of this.instances.values()) instance.dispose();
		this.instances.clear();
	}

	private constructor(private readonly ownerDocument: Document) {
		this.keyboard = ownerDocument.defaultView?.mathVirtualKeyboard ?? null;
		this.keyboard?.addEventListener(
			"virtual-keyboard-toggle",
			this.onKeyboardChange
		);
		this.keyboard?.addEventListener("geometrychange", this.onKeyboardChange);
	}

	private createButton(): HTMLButtonElement {
		const button = this.ownerDocument.createElement("button");
		button.type = "button";
		button.className = "obsidian-mathlive-keyboard-collapse";
		button.setAttribute("aria-label", "Collapse keyboard");
		button.setAttribute("data-tooltip-position", "top");
		button.setAttribute("data-tooltip", "Collapse keyboard");
		setIcon(button, "chevron-down");
		button.addEventListener("click", () => this.keyboard?.hide());
		return button;
	}

	private removeButton(): void {
		this.button?.remove();
		this.button = null;
	}

	private syncButton(): void {
		if (!this.keyboard?.visible) {
			this.removeButton();
			return;
		}

		const bounds = this.keyboard.boundingRect;
		if (bounds.width <= 0 || bounds.height <= 0) {
			this.removeButton();
			return;
		}

		if (!this.button) {
			this.button = this.createButton();
			this.ownerDocument.body.appendChild(this.button);
		}

		const buttonSize = 36;
		const inset = 8;
		const viewportWidth = this.ownerDocument.documentElement.clientWidth;
		const maxLeft = Math.max(inset, viewportWidth - buttonSize - inset);
		const left = Math.min(
			maxLeft,
			Math.max(bounds.left + inset, bounds.right - buttonSize - inset)
		);
		this.button.style.left = `${left}px`;
		this.button.style.top = `${Math.max(inset, bounds.top + inset)}px`;
	}

	dispose(): void {
		this.keyboard?.removeEventListener(
			"virtual-keyboard-toggle",
			this.onKeyboardChange
		);
		this.keyboard?.removeEventListener("geometrychange", this.onKeyboardChange);
		this.removeButton();
	}

	ensureButton(): void {
		this.syncButton();
	}
}

export function disposeKeyboardCollapseManager(): void {
	KeyboardCollapseButtonManager.disposeInstances();
}
