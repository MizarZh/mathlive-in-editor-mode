import { Plugin } from "obsidian";
import { mathliveListFieldWrapper } from "./mathlive-plugin";
import { MathfieldElement } from "mathlive";
import {
	MathLiveEditorModePluginSettings,
	DEFAULT_SETTINGS,
	MathLiveEditorModeSettingsTab,
	Global,
} from "./setting";

export default class MathLiveInEditorMode extends Plugin {
	settings: MathLiveEditorModePluginSettings;
	global: Global;

	async onload() {
		// mobile mode testing
		// @ts-ignore
		// this.app.emulateMobile(!this.app.isMobile);

		await this.loadSettings();

		if (customElements.get("math-field") === undefined)
			customElements.define("math-field", MathfieldElement);

		this.addSettingTab(new MathLiveEditorModeSettingsTab(this.app, this));

		this.global = {
			baseMacros: {},
			baseShortcuts: {},
			baseKeybindings: [],
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
				// update editor state
				const curser = editor.getCursor();
				editor.setCursor(curser);
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
		await this.saveData(this.settings);
		// Update MathJax visibility when settings change
		this.updateMathJaxVisibility();
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
