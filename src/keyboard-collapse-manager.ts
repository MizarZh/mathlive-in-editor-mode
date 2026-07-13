export class KeyboardCollapseButtonManager {
	private static readonly instances = new Map<
		Document,
		KeyboardCollapseButtonManager
	>();

	private observer: MutationObserver | null = null;
	private pendingTimeouts = new Set<number>();
	private observerStopTimeout: number | null = null;
	private isObserving = false;
	private readonly COLLAPSE_BUTTON_CLASS = "obsidian-mathlive-keyboard-collapse";
	private readonly TOOLBAR_SELECTOR = ".ML__edit-toolbar";
	private readonly KEYBOARD_CONTAINER_SELECTOR = ".ML__keyboard";
	private readonly keyboard: typeof window.mathVirtualKeyboard | null;
	private readonly onKeyboardToggle = () => {
		if (this.keyboard?.visible) {
			this.cancelObserverStop();
			this.startObserving();
			this.injectButton();
			return;
		}
		this.clearPendingTimeouts();
		this.cancelObserverStop();
		this.stopObserving();
	};

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
			this.onKeyboardToggle
		);
	}

	private get ownerWindow(): Window {
		return this.ownerDocument.defaultView ?? window;
	}

	private getToolbars(): HTMLElement[] {
		return Array.from(
			this.ownerDocument.querySelectorAll<HTMLElement>(this.TOOLBAR_SELECTOR)
		);
	}

	private isKeyboardVisible(): boolean {
		const keyboard = this.ownerDocument.querySelector<HTMLElement>(
			this.KEYBOARD_CONTAINER_SELECTOR
		);
		return keyboard !== null && keyboard.offsetParent !== null;
	}

	private hasCollapseButton(toolbar: HTMLElement): boolean {
		return !!toolbar.querySelector(`.${this.COLLAPSE_BUTTON_CLASS}`);
	}

	private createCollapseButton(): HTMLElement {
		const button = this.ownerDocument.createElement("div");
		button.className = `action ${this.COLLAPSE_BUTTON_CLASS}`;
		button.textContent = "✕";
		button.setAttribute("role", "button");
		button.setAttribute("tabindex", "0");
		button.setAttribute("aria-label", "Collapse keyboard");
		button.dataset.tooltip = "Collapse keyboard";
		const hide = () => this.ownerWindow.mathVirtualKeyboard?.hide();
		button.addEventListener("click", hide);
		button.addEventListener("keydown", (event) => {
			if (event.key !== "Enter" && event.key !== " ") return;
			event.preventDefault();
			hide();
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
		this.observer.observe(this.ownerDocument.body, {
			childList: true,
			subtree: true,
		});
		this.isObserving = true;
	}

	private stopObserving(): void {
		this.observer?.disconnect();
		this.observer = null;
		this.isObserving = false;
	}

	private clearPendingTimeouts(): void {
		for (const timeout of this.pendingTimeouts) {
			this.ownerWindow.clearTimeout(timeout);
		}
		this.pendingTimeouts.clear();
	}

	private cancelObserverStop(): void {
		if (this.observerStopTimeout === null) return;
		this.ownerWindow.clearTimeout(this.observerStopTimeout);
		this.observerStopTimeout = null;
	}

	dispose(): void {
		this.keyboard?.removeEventListener(
			"virtual-keyboard-toggle",
			this.onKeyboardToggle
		);
		this.clearPendingTimeouts();
		this.cancelObserverStop();
		this.stopObserving();
		this.ownerDocument.querySelectorAll(`.${this.COLLAPSE_BUTTON_CLASS}`)
			.forEach((button) => button.remove());
	}

	ensureButton(): void {
		this.clearPendingTimeouts();
		this.cancelObserverStop();

		this.startObserving();
		if (this.isKeyboardVisible()) this.injectButton();
		for (const delay of [100, 300, 600, 1000]) {
			const timeout = this.ownerWindow.setTimeout(() => {
				this.pendingTimeouts.delete(timeout);
				if (this.isKeyboardVisible()) this.injectButton();
			}, delay);
			this.pendingTimeouts.add(timeout);
		}
		this.observerStopTimeout = this.ownerWindow.setTimeout(() => {
			this.observerStopTimeout = null;
			if (this.isKeyboardVisible()) {
				this.injectButton();
				return;
			}
			this.stopObserving();
		}, 1500);
	}
}

export function disposeKeyboardCollapseManager(): void {
	KeyboardCollapseButtonManager.disposeInstances();
}
