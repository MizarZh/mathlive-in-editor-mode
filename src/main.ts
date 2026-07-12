import { Plugin } from "obsidian";
import { mathliveListFieldWrapper, refreshMathLiveEditors } from "./mathlive-plugin";
import { MathfieldElement } from "mathlive";
import { disposeKeyboardCollapseManager } from "./keyboard-collapse-manager";
import {
	MathLiveEditorModePluginSettings,
	DEFAULT_SETTINGS,
	Global,
	parseMathLiveSettings,
} from "./settings-model";
import { MathLiveEditorModeSettingsTab } from "./setting";

export default class MathLiveInEditorMode extends Plugin {
	settings: MathLiveEditorModePluginSettings;
	global: Global;
	private settingsSaveTimeout: number | null = null;

	async onload() {
		// mobile mode testing
		// @ts-ignore
		// this.app.emulateMobile(true);
		// this.app.emulateMobile(false);

		await this.loadSettings();

		if (customElements.get("math-field") === undefined)
			customElements.define("math-field", MathfieldElement);

		this.addSettingTab(new MathLiveEditorModeSettingsTab(this.app, this));

		this.global = {
			baseMacros: {},
			baseShortcuts: {},
			baseKeybindings: [],
			parsedSettings: parseMathLiveSettings(this.settings),
			// forceUpdate: false,
		};

		this.registerEditorExtension(
			mathliveListFieldWrapper(this.settings, this.global)
		);

		this.addCommand({
			id: "toggle-mathfield",
			name: "Toggle MathLive block",
			editorCallback: async (editor, view) => {
				this.settings.display = !this.settings.display;
				// console.log("toggle mathlive block display");
				await this.saveSettings();
				if (this.settings.display) {
					this.updateMathJaxVisibility();
				} else {
					this.updateMathJaxVisibility(true);
				}
				// new Notice("Toggle successfully!");
			},
		});

		this.updateMathJaxVisibility();
	}

	onunload() {
		if (this.settingsSaveTimeout !== null) {
			window.clearTimeout(this.settingsSaveTimeout);
			this.settingsSaveTimeout = null;
			void this.saveData(this.settings);
		}
		disposeKeyboardCollapseManager();
		document.body.removeClass("mathlive-hide-mathjax-block");
		document.body.removeClass("mathlive-hide-mathjax-inline");
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		this.updateParsedSettings();
		await this.saveData(this.settings);
		refreshMathLiveEditors();
		// Update MathJax visibility when settings change
		this.updateMathJaxVisibility();
	}

	scheduleSettingsSave(delay = 600): void {
		this.updateParsedSettings();
		if (this.settingsSaveTimeout !== null) {
			window.clearTimeout(this.settingsSaveTimeout);
		}
		this.settingsSaveTimeout = window.setTimeout(() => {
			this.settingsSaveTimeout = null;
			void this.saveSettings();
		}, delay);
	}

	private updateParsedSettings(): void {
		const previous = this.global.parsedSettings;
		const parsed = parseMathLiveSettings(this.settings);
		if (parsed.macros === null) parsed.macros = previous.macros;
		if (parsed.inlineShortcuts === null) {
			parsed.inlineShortcuts = previous.inlineShortcuts;
		}
		if (parsed.keybindings === null) parsed.keybindings = previous.keybindings;
		this.global.parsedSettings = parsed;
	}

	updateMathJaxVisibility(onlyRemove: boolean = false) {
		document.body.removeClass("mathlive-hide-mathjax-block");
		document.body.removeClass("mathlive-hide-mathjax-inline");

		if (onlyRemove) {
			return;
		}

		const { hideMathJaxBlock, hideMathJaxInline } = this.settings;

		if (hideMathJaxBlock && hideMathJaxInline) {
			document.body.addClass("mathlive-hide-mathjax-block");
			document.body.addClass("mathlive-hide-mathjax-inline");
		} else if (hideMathJaxBlock && !hideMathJaxInline) {
			document.body.addClass("mathlive-hide-mathjax-block");
		} else if (!hideMathJaxBlock && hideMathJaxInline) {
			document.body.addClass("mathlive-hide-mathjax-inline");
		}
	}
}
