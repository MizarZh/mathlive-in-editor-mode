import { Notice, Plugin } from "obsidian";
import { mathliveListFieldWrapper } from "./mathlive-plugin";
import { MathfieldElement } from "mathlive";
import {
	ObsidianMathliveCodemirrorPluginSettings,
	DEFAULT_SETTINGS,
	ObsidianMathliveCodemirrorSettingTab,
} from "./setting";

export default class ObsidianMathliveCodemirror extends Plugin {
	settings: ObsidianMathliveCodemirrorPluginSettings;

	async onload() {
		await this.loadSettings();

		if (customElements.get("math-field") === undefined)
			customElements.define("math-field", MathfieldElement);

		this.addSettingTab(
			new ObsidianMathliveCodemirrorSettingTab(this.app, this)
		);

		this.registerEditorExtension(mathliveListFieldWrapper(this.settings));

		this.addCommand({
			id: "toggle-mathfield",
			name: "Toggle Mathlive Block",
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
