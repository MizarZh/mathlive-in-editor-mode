import {
	App,
	Editor,
	MarkdownView,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
} from "obsidian";
import { EditorView } from "@codemirror/view";
import { mathliveListField } from "./mathlive-plugin";
import { MathfieldElement } from "mathlive";

// Remember to rename these classes and interfaces!

interface ObsidianMathliveCodemirrorPluginSettings {
	default: string;
}

const DEFAULT_SETTINGS: ObsidianMathliveCodemirrorPluginSettings = {
	default: "default",
};

export default class ObsidianMathliveCodemirror extends Plugin {
	settings: ObsidianMathliveCodemirrorPluginSettings;

	async onload() {
		await this.loadSettings();

		if (customElements.get("math-field") === undefined)
			customElements.define("math-field", MathfieldElement);

		this.registerEditorExtension(mathliveListField);
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
