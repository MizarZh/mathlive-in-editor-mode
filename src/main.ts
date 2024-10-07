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
		await this.loadSettings();

		if (customElements.get("math-field") === undefined)
			customElements.define("math-field", MathfieldElement);

		this.addSettingTab(new MathLiveEditorModeSettingsTab(this.app, this));

		this.global = {
			baseMacros: {},
			baseShortcuts: {},
			baseKeybindings: [],
		};

		this.registerEditorExtension(
			mathliveListFieldWrapper(this.settings, this.global)
		);

		this.addCommand({
			id: "toggle-mathfield",
			name: "Toggle MathLive block",
			editorCallback: async (editor, view) => {
				this.settings.display = !this.settings.display;
				await this.saveSettings();
				// update editor state
				const curser = editor.getCursor();
				editor.setCursor(curser);
				// new Notice("Toggle successfully!");
			},
		});
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
