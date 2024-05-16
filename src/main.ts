import { Plugin } from "obsidian";
import { mathliveListFieldWrapper } from "./mathlive-plugin";
import { MathfieldElement } from "mathlive";
import {
	MathliveEditorModePluginSettings,
	DEFAULT_SETTINGS,
	MathliveEditorModeSettingsTab,
} from "./setting";

export default class MathliveInEditorMode extends Plugin {
	settings: MathliveEditorModePluginSettings;

	async onload() {
		await this.loadSettings();

		if (customElements.get("math-field") === undefined)
			customElements.define("math-field", MathfieldElement);

		this.addSettingTab(new MathliveEditorModeSettingsTab(this.app, this));

		this.registerEditorExtension(mathliveListFieldWrapper(this.settings));

		this.addCommand({
			id: "toggle-mathfield",
			name: "Toggle MathLive Block",
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
