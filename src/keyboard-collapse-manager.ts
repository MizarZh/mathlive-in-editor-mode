export class KeyboardCollapseButtonManager {
	private observer: MutationObserver | null = null;
	private pendingTimeouts = new Set<number>();
	private observerStopTimeout: number | null = null;
	private isObserving = false;
	private readonly COLLAPSE_BUTTON_CLASS = "obsidian-mathlive-keyboard-collapse";
	private readonly TOOLBAR_SELECTOR = ".ML__edit-toolbar";
	private readonly KEYBOARD_CONTAINER_SELECTOR = ".ML__keyboard";

	private static instance: KeyboardCollapseButtonManager | null = null;

	static getInstance(): KeyboardCollapseButtonManager {
		if (!this.instance) {
			this.instance = new KeyboardCollapseButtonManager();
		}
		return this.instance;
	}

	static disposeInstance(): void {
		this.instance?.dispose();
		this.instance = null;
	}

	private constructor() { }

	private getToolbars(): HTMLElement[] {
		return Array.from(document.querySelectorAll(this.TOOLBAR_SELECTOR));
	}

	private isKeyboardVisible(): boolean {
		const keyboard = document.querySelector(this.KEYBOARD_CONTAINER_SELECTOR);
		return keyboard !== null && (keyboard as HTMLElement).offsetParent !== null;
	}

	private hasCollapseButton(toolbar: HTMLElement): boolean {
		return !!toolbar.querySelector(`.${this.COLLAPSE_BUTTON_CLASS}`);
	}

	private createCollapseButton(): HTMLElement {
		const button = document.createElement("div");
		button.className = `action ${this.COLLAPSE_BUTTON_CLASS}`;
		button.innerHTML = "✕";
		button.setAttribute("aria-label", "Collapse Keyboard");
		button.dataset.tooltip = "Collapse Keyboard";
		button.addEventListener("click", () => {
			window.mathVirtualKeyboard?.hide();
		});
		return button;
	}

	private injectButton(): void {
		for (const toolbar of this.getToolbars()) {
			if (!this.hasCollapseButton(toolbar)) {
				toolbar.appendChild(this.createCollapseButton());
			}
		}
	}

	private startObserving(): void {
		if (this.isObserving) return;
		this.observer = new MutationObserver(() => {
			if (this.isKeyboardVisible()) this.injectButton();
		});
		this.observer.observe(document.body, { childList: true, subtree: true });
		this.isObserving = true;
	}

	private stopObserving(): void {
		this.observer?.disconnect();
		this.observer = null;
		this.isObserving = false;
	}

	dispose(): void {
		for (const timeout of this.pendingTimeouts) {
			window.clearTimeout(timeout);
		}
		this.pendingTimeouts.clear();
		if (this.observerStopTimeout !== null) {
			window.clearTimeout(this.observerStopTimeout);
			this.observerStopTimeout = null;
		}
		this.stopObserving();
		document.querySelectorAll(`.${this.COLLAPSE_BUTTON_CLASS}`).forEach(
			(button) => button.remove()
		);
	}

	ensureButton(): void {
		for (const timeout of this.pendingTimeouts) {
			window.clearTimeout(timeout);
		}
		this.pendingTimeouts.clear();
		if (this.observerStopTimeout !== null) {
			window.clearTimeout(this.observerStopTimeout);
			this.observerStopTimeout = null;
		}

		this.startObserving();
		if (this.isKeyboardVisible()) this.injectButton();
		for (const delay of [100, 300, 600, 1000]) {
			const timeout = window.setTimeout(() => {
				this.pendingTimeouts.delete(timeout);
				if (this.isKeyboardVisible()) this.injectButton();
			}, delay);
			this.pendingTimeouts.add(timeout);
		}
		this.observerStopTimeout = window.setTimeout(() => {
			this.observerStopTimeout = null;
			this.stopObserving();
		}, 1500);
	}
}

export function disposeKeyboardCollapseManager(): void {
	KeyboardCollapseButtonManager.disposeInstance();
}
