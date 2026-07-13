import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import type MathLiveInEditorMode from "./main";
import { macros2newcommands } from "./utils";
import type { TouchKeyboardProvider } from "./settings-model";

export class MathLiveEditorModeSettingsTab extends PluginSettingTab {
	plugin: MathLiveInEditorMode;

	constructor(app: App, plugin: MathLiveInEditorMode) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		this.containerEl.empty();

		new Setting(this.containerEl)
			.setName("Toggle MathLive display")
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
				.setName("Hide original block equation")
				.setDesc("When enabled, the original obsidian block equation rendering is hidden in editor mode.")
				.addToggle((cb) => {
					cb.setValue(this.plugin.settings.hideMathJaxBlock);
					cb.onChange(async (ev) => {
						this.plugin.settings.hideMathJaxBlock = ev;
						await this.plugin.saveSettings();
						new Notice(
							ev
								? "Original block equation hidden - only MathLive widgets will be shown"
								: "Original block equation visible - both original block equation and MathLive will be shown"
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
				.setDesc("Show the button that manually opens the MathLive keyboard.")
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
				.setName("Inline MathLive position")
				.setDesc("Place the MathLive field before or after the inline equation.")
				.addDropdown((dropdown) => {
					dropdown
						.addOption("left", "Left")
						.addOption("right", "Right")
						.setValue(this.plugin.settings.inlineWidgetPosition)
						.onChange(async (value) => {
							if (value !== "left" && value !== "right") return;
							this.plugin.settings.inlineWidgetPosition = value;
							await this.plugin.saveSettings();
						});
				});

			new Setting(this.containerEl)
				.setName("Hide original inline equation")
				.setDesc("When enabled, the original obsidian inline equation rendering is hidden in editor mode.")
				.addToggle((cb) => {
					cb.setValue(this.plugin.settings.hideMathJaxInline);
					cb.onChange(async (ev) => {
						this.plugin.settings.hideMathJaxInline = ev;
						await this.plugin.saveSettings();
						new Notice(
							ev
								? "Original inline equation hidden - only MathLive widgets will be shown"
								: "Original inline equation visible - both original inline equation and MathLive will be shown"
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
				.setDesc("Show the button that manually opens the MathLive keyboard.")
				.addToggle((cb) => {
					cb.setValue(this.plugin.settings.inlineKeyboardIcon);
					cb.onChange(async (ev) => {
						this.plugin.settings.inlineKeyboardIcon = ev;
						await this.plugin.saveSettings();
						new Notice("Toggle inline keyboard icon successfully!");
					});
				});


			new Setting(this.containerEl).setName("Macros").setHeading();

				const macrosSetting = new Setting(this.containerEl)
					.setClass("obsidian-mathlive-codemirror-setting")
					.setName("MathLive macros (Not finished yet)")
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
					cb.onChange((ev) => {
						this.plugin.settings.macros = ev;
						this.plugin.scheduleSettingsSave();
						setValidationState(
							macrosSetting,
							this.plugin.global.parsedSettings.errors.macros,
							"Using JSON5 format, which supports single quote, trailing comma etc besides basic JSON."
						);
					});
				});
			setValidationState(
				macrosSetting,
				this.plugin.global.parsedSettings.errors.macros,
				"Using JSON5 format, which supports single quote, trailing comma etc besides basic JSON."
			);

				new Setting(this.containerEl)
					.setName("Inline shortcuts")
					.setHeading();

				const shortcutsSetting = new Setting(this.containerEl)
				.setClass("obsidian-mathlive-codemirror-setting")
				.setName("MathLive inline shortcuts")
				.setDesc("JSON5 format")
				.addTextArea((cb) => {
					cb.setPlaceholder(
						"{\ncommand1: 'xxx', \ncommand2: 'xxx',\n}"
					);
					cb.setValue(this.plugin.settings.inlineShortcuts);
					cb.onChange((ev) => {
						this.plugin.settings.inlineShortcuts = ev;
						this.plugin.scheduleSettingsSave();
						setValidationState(
							shortcutsSetting,
							this.plugin.global.parsedSettings.errors.inlineShortcuts,
							"JSON5 format"
						);
					});
				});
			setValidationState(
				shortcutsSetting,
				this.plugin.global.parsedSettings.errors.inlineShortcuts,
				"JSON5 format"
			);

			new Setting(this.containerEl).setName("Keybindings").setHeading();

			const keybindingsSetting = new Setting(this.containerEl)
				.setClass("obsidian-mathlive-codemirror-setting")
				.setName("MathLive keybindings")
				.setDesc("JSON5 format")
				.addTextArea((cb) => {
					cb.setPlaceholder(
						"[\nkeybinding1: {xxx}, \nkeybinding2: {xxx},\n]"
					);
					cb.setValue(this.plugin.settings.keybindings);
					cb.onChange((ev) => {
						this.plugin.settings.keybindings = ev;
						this.plugin.scheduleSettingsSave();
						setValidationState(
							keybindingsSetting,
							this.plugin.global.parsedSettings.errors.keybindings,
							"JSON5 format"
						);
					});
				});
			setValidationState(
				keybindingsSetting,
				this.plugin.global.parsedSettings.errors.keybindings,
				"JSON5 format"
			);


			new Setting(this.containerEl).setName("Keyboard Settings").setHeading();

			new Setting(this.containerEl)
				.setName("Touch input keyboard")
				.setDesc("Choose what opens automatically after a touch focuses a MathLive field. Mouse and keyboard focus are unaffected.")
				.addDropdown((cb) => {
					cb.addOptions({
						"mathlive": "MathLive",
						"system": "System (experimental)",
						"disabled": "Do not open automatically",
					});
					cb.setValue(this.plugin.settings.touchKeyboardProvider);
					cb.onChange(async (ev) => {
						this.plugin.settings.touchKeyboardProvider = ev as TouchKeyboardProvider;
						await this.plugin.saveSettings();
						this.display();
					});
				});

			new Setting(this.containerEl)
				.setName("Hide MathLive keyboard when leaving field")
				.setDesc("Hide the MathLive keyboard after focus moves outside MathLive fields and keyboard controls.")
				.addToggle((cb) => {
					cb.setValue(this.plugin.settings.hideMathVirtualKeyboardOnBlur);
					cb.onChange(async (ev) => {
						this.plugin.settings.hideMathVirtualKeyboardOnBlur = ev;
						await this.plugin.saveSettings();
					});
				});

			new Setting(this.containerEl)
				.setName("Arrow key navigation between MathLive and editor")
				.setDesc("When enabled, press arrow keys to enter or exit MathLive equation.")
				.addToggle((cb) => {
					cb.setValue(this.plugin.settings.arrowKeyNavigation);
					cb.onChange(async (ev) => {
						this.plugin.settings.arrowKeyNavigation = ev;
						await this.plugin.saveSettings();
					});

				});

			new Setting(this.containerEl).setName("Advanced Settings").setHeading();

			new Setting(this.containerEl)
				.setName("Immediate update")
				.setDesc("When enabled, changes are dispatched immediately on input. When disabled, changes are only dispatched on blur.")
				.addToggle((cb) => {
					cb.setValue(this.plugin.settings.immediateUpdate);
					cb.onChange(async (ev) => {
						this.plugin.settings.immediateUpdate = ev;
						await this.plugin.saveSettings();
						new Notice("Update mode changed successfully!");
					});
				});

			// new Setting(this.containerEl).setName("Force update").setHeading();

			// new Setting(this.containerEl)
			// 	.setName("Force update MathLive settings")
			// 	.setDesc(
			// 		"if settings are not updated, press this button to force update settings."
			// 	)
			// 	.addButton((cb) => {
			// 		cb.setButtonText("Force Update");
			// 		cb.setTooltip("Force Update MathLive settings");
			// 		this.plugin.global.forceUpdate = true;
			// 	});
		}

	}
}

function setValidationState(
	setting: Setting,
	error: string | undefined,
	defaultDescription: string
): void {
	setting.setDesc(error ?? defaultDescription);
	setting.settingEl.classList.toggle("is-invalid", error !== undefined);
}
