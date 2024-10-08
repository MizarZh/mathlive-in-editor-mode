import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import MathLiveInEditorMode from "./main";
import { macros2newcommands } from "./utils";
import {
	InlineShortcutDefinitions,
	MacroDictionary,
	Keybinding,
} from "mathlive";

export interface Global {
	// previousMacros: string;
	// previousInlineShortcuts: string;
	// previousKeybindings: string;
	baseMacros: MacroDictionary;
	baseShortcuts: InlineShortcutDefinitions;
	baseKeybindings: Keybinding[];
	forceUpdate: boolean;
}

export interface MathLiveEditorModePluginSettings {
	display: boolean;
	blockDisplay: boolean;
	blockMenuIcon: boolean;
	blockKeyboardIcon: boolean;
	inlineDisplay: boolean;
	inlineMenuIcon: boolean;
	inlineKeyboardIcon: boolean;
	macros: string;
	inlineShortcuts: string;
	keybindings: string;
}

export const DEFAULT_SETTINGS: MathLiveEditorModePluginSettings = {
	display: true,
	blockDisplay: true,
	blockMenuIcon: true,
	blockKeyboardIcon: true,
	inlineDisplay: false,
	inlineMenuIcon: false,
	inlineKeyboardIcon: false,
	macros: "",
	inlineShortcuts: "",
	keybindings: "",
};

export class MathLiveEditorModeSettingsTab extends PluginSettingTab {
	plugin: MathLiveInEditorMode;

	constructor(app: App, plugin: MathLiveInEditorMode) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		this.containerEl.empty();

		new Setting(this.containerEl)
			.setName("Display MathLive block")
			.setDesc("Toggle display state of MathLive")
			.addToggle((cb) => {
				cb.setValue(this.plugin.settings.display);
				cb.onChange(async (ev) => {
					this.plugin.settings.display = ev;
					await this.plugin.saveSettings();
					this.display();
					new Notice("Toggle visibility successfully!");
				});
			})
			.addButton((cb) => {
				cb.setButtonText("Set hotkey")
					.setTooltip(`Set toggle hotkey`)
					.onClick(() => {
						// unoffical
						// @ts-ignore
						this.app.setting.openTabById("hotkeys");
						// @ts-ignore
						const tab = this.app.setting.activeTab;
						tab.headerComponent.components[1].inputEl.value = `Toggle MathLive block`;
						tab.updateHotkeyVisibility();
					});
			});

		if (this.plugin.settings.display) {
			new Setting(this.containerEl).setName("Block").setHeading();

			new Setting(this.containerEl)
				.setName("Display block equation")
				.setDesc("Enable MathLive for block equation")
				.addToggle((cb) => {
					cb.setValue(this.plugin.settings.blockDisplay);
					cb.onChange(async (ev) => {
						this.plugin.settings.blockDisplay = ev;
						await this.plugin.saveSettings();
						new Notice(
							"Toggle inline equation display successfully!"
						);
					});
				});

			new Setting(this.containerEl)
				.setName("Display block menu icon")
				.addToggle((cb) => {
					cb.setValue(this.plugin.settings.blockMenuIcon);
					cb.onChange(async (ev) => {
						this.plugin.settings.blockMenuIcon = ev;
						await this.plugin.saveSettings();
						new Notice("Toggle block menu icon successfully!");
					});
				});

			new Setting(this.containerEl)
				.setName("Display block keyboard icon")
				.addToggle((cb) => {
					cb.setValue(this.plugin.settings.blockKeyboardIcon);
					cb.onChange(async (ev) => {
						this.plugin.settings.blockKeyboardIcon = ev;
						await this.plugin.saveSettings();
						new Notice("Toggle block keyboard icon successfully!");
					});
				});

			new Setting(this.containerEl).setName("Inline").setHeading();

			new Setting(this.containerEl)
				.setName("Display inline equation")
				.setDesc("Enable MathLive for inline equation")
				.addToggle((cb) => {
					cb.setValue(this.plugin.settings.inlineDisplay);
					cb.onChange(async (ev) => {
						this.plugin.settings.inlineDisplay = ev;
						await this.plugin.saveSettings();
						new Notice(
							"Toggle inline equation display successfully!"
						);
					});
				});

			new Setting(this.containerEl)
				.setName("Display inline menu icon")
				.addToggle((cb) => {
					cb.setValue(this.plugin.settings.inlineMenuIcon);
					cb.onChange(async (ev) => {
						this.plugin.settings.inlineMenuIcon = ev;
						await this.plugin.saveSettings();
						new Notice("Toggle inline menu icon successfully!");
					});
				});

			new Setting(this.containerEl)
				.setName("Display inline keyboard icon")
				.addToggle((cb) => {
					cb.setValue(this.plugin.settings.inlineKeyboardIcon);
					cb.onChange(async (ev) => {
						this.plugin.settings.inlineKeyboardIcon = ev;
						await this.plugin.saveSettings();
						new Notice("Toggle inline keyboard icon successfully!");
					});
				});

			new Setting(this.containerEl).setName("Macros").setHeading();

			new Setting(this.containerEl)
				.setClass("obsidian-mathlive-codemirror-setting")
				.setName("MathLive macros")
				.setDesc(
					"Using JSON5 format, which supports single quote, trailing comma etc besides basic JSON."
				)
				.addButton((cb) => {
					cb.setIcon("copy");
					cb.setTooltip("Copy \\newcommand style latex");
					cb.onClick(async (ev) => {
						const newcommand = macros2newcommands(
							this.plugin.settings.macros
						);
						if (newcommand !== undefined)
							navigator.clipboard.writeText(newcommand);
						new Notice("Copy newcommand successfully!");
					});
				})
				.addTextArea((cb) => {
					cb.setPlaceholder(
						"{\ncommand1: 'xxx', \ncommand2: 'xxx',\n}"
					);
					cb.setValue(this.plugin.settings.macros);
					cb.onChange(async (ev) => {
						this.plugin.settings.macros = ev;
						await this.plugin.saveSettings();
					});
				});

			new Setting(this.containerEl)
				.setName("Inline shortcuts")
				.setHeading();

			new Setting(this.containerEl)
				.setClass("obsidian-mathlive-codemirror-setting")
				.setName("MathLive inline shortcuts")
				.setDesc("JSON5 format")
				.addTextArea((cb) => {
					cb.setPlaceholder(
						"{\ncommand1: 'xxx', \ncommand2: 'xxx',\n}"
					);
					cb.setValue(this.plugin.settings.inlineShortcuts);
					cb.onChange(async (ev) => {
						this.plugin.settings.inlineShortcuts = ev;
						await this.plugin.saveSettings();
					});
				});

			new Setting(this.containerEl).setName("Keybindings").setHeading();

			new Setting(this.containerEl)
				.setClass("obsidian-mathlive-codemirror-setting")
				.setName("MathLive keybindings")
				.setDesc("JSON5 format")
				.addTextArea((cb) => {
					cb.setPlaceholder(
						"[\nkeybinding1: {xxx}, \nkeybinding2: {xxx},\n]"
					);
					cb.setValue(this.plugin.settings.keybindings);
					cb.onChange(async (ev) => {
						this.plugin.settings.keybindings = ev;
						await this.plugin.saveSettings();
					});
				});
			new Setting(this.containerEl).setName("Force update").setHeading();

			new Setting(this.containerEl)
				.setName("Force update MathLive settings")
				.setDesc(
					"if settings are not updated, press this button to force update settings."
				)
				.addButton((cb) => {
					cb.setButtonText("Force Update");
					cb.setTooltip("Force Update MathLive settings");
					this.plugin.global.forceUpdate = true;
				});
		}
	}
}
