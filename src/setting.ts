import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import ObsidianMathliveCodemirror from "./main";

export interface ObsidianMathliveCodemirrorPluginSettings {
	display: boolean;
}

export const DEFAULT_SETTINGS: ObsidianMathliveCodemirrorPluginSettings = {
	display: true,
};

export class ObsidianMathliveCodemirrorSettingTab extends PluginSettingTab {
	plugin: ObsidianMathliveCodemirror;

	constructor(app: App, plugin: ObsidianMathliveCodemirror) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		this.containerEl.empty();

		new Setting(this.containerEl)
			.setName("Display mathlive block")
			.setDesc("Toggle display state of mathlive block")
			.addToggle((cb) => {
				cb.setValue(this.plugin.settings.display);
				cb.onChange(async (ev) => {
					this.plugin.settings.display = ev;
					await this.plugin.saveSettings();
					new Notice("Toggle successfully!");
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
	}
}
