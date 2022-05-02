import { App, PluginSettingTab, Setting } from 'obsidian'

import MdxDictionary from './main'

import { saveFormatSetting } from './constants'

export interface MdxDictionarySettings {
  dictPath: string
  fileSavePath: string

  saveFormat: string

  showWordNonexistenceNotice: boolean

  word: string
}

export const MDX_DICTIONARY_DEFAULT_SETTINGS: Partial<MdxDictionarySettings> = {
  dictPath: 'C:/',
  word: 'test',

  saveFormat: 'markdown',
  showWordNonexistenceNotice: false,
}

export class MdxDictionarySettingTab extends PluginSettingTab {
  plugin: MdxDictionary

  constructor(app: App, plugin: MdxDictionary) {
    super(app, plugin)
    this.plugin = plugin
  }

  display(): void {
    const { containerEl } = this
    containerEl.empty()

    new Setting(containerEl)
      .setName('Dictionary or Folder Path')
      .setDesc('absolute path to your dictionary or folder containing them')
      .addText((text) => {
        text
          .setPlaceholder('path/to/your/dictionary')
          .setValue(this.plugin.settings.dictPath)
          .onChange(async (value) => {
            this.plugin.settings.dictPath = value
            await this.plugin.saveSettings()
          })
      })

    new Setting(containerEl)
      .setName('File Save Path')
      .setDesc('with respect to current vault')
      .addText((text) => {
        text
          .setPlaceholder('path/to/your/file')
          .setValue(this.plugin.settings.fileSavePath)
          .onChange(async (value) => {
            this.plugin.settings.fileSavePath = value
            await this.plugin.saveSettings()
          })
      })

    new Setting(containerEl)
      .setName('Save Word As markdown')
      .setDesc('save word as markdown format rather than html')
      .addDropdown((cb) => {
        cb.addOptions(saveFormatSetting)
          .setValue(this.plugin.settings.saveFormat)
          .onChange(async (value) => {
            console.log(value)
            this.plugin.settings.saveFormat = value
            await this.plugin.saveSettings()
          })
      })

    new Setting(containerEl)
      .setName('Show Word Notices')
      .setDesc('')
      .addToggle((cb) => {
        cb.setValue(this.plugin.settings.showWordNonexistenceNotice).onChange(async (value) => {
          this.plugin.settings.showWordNonexistenceNotice = value
          await this.plugin.saveSettings()
        })
      })
  }
}
