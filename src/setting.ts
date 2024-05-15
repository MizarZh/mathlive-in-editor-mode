import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import ObsidianMathliveCodemirror from "./main";

export interface ObsidianMathliveCodemirrorPluginSettings {
	display: boolean;
	blockDisplay: boolean;
	blockMenuIcon: boolean;
	blockKeyboardIcon: boolean;
	inlineDisplay: boolean;
	inlineMenuIcon: boolean;
	inlineKeyboardIcon: boolean;
}

export const DEFAULT_SETTINGS: ObsidianMathliveCodemirrorPluginSettings = {
	display: true,
	blockDisplay: true,
	blockMenuIcon: true,
	blockKeyboardIcon: true,
	inlineDisplay: false,
	inlineMenuIcon: false,
	inlineKeyboardIcon: false,
};

export class ObsidianMathliveCodemirrorSettingTab extends PluginSettingTab {
	plugin: ObsidianMathliveCodemirror;

	constructor(app: App, plugin: ObsidianMathliveCodemirror) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		this.containerEl.empty();

		this.containerEl.createEl("h1", { text: "General Settings" });

		new Setting(this.containerEl)
			.setName("Display mathlive block")
			.setDesc("Toggle display state of mathlive")
			.addToggle((cb) => {
				cb.setValue(this.plugin.settings.display);
				cb.onChange(async (ev) => {
					this.plugin.settings.display = ev;
					await this.plugin.saveSettings();
					this.display()
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
						tab.headerComponent.components[1].inputEl.value = `Toggle Mathlive Block`;
						tab.updateHotkeyVisibility();
					});
			});

		if (this.plugin.settings.display) {
			this.containerEl.createEl("h1", { text: "Block Settings" });

			new Setting(this.containerEl)
				.setName("Display block equation")
				.setDesc("Enable mathlive for block equation")
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

			this.containerEl.createEl("h1", { text: "Inline Settings" });

			new Setting(this.containerEl)
				.setName("Display inline equation")
				.setDesc("Enable mathlive for inline equation")
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
		}
	}
}
