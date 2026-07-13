# Repository Overview

This repository contains **MathLive in Editor Mode**, an Obsidian plugin that adds interactive [MathLive](https://github.com/arnog/mathlive) math fields to Obsidian's Markdown editor. It lets users edit the LaTeX inside inline (`$...$`) and block (`$$...$$`) equations through a visual math editor while keeping the Markdown source as the canonical document content.

## Main Features

- Detects inline and block math nodes from Obsidian's CodeMirror syntax tree.
- Adds MathLive fields as CodeMirror decorations without replacing the underlying Markdown.
- Synchronizes MathLive edits back to the exact LaTeX source range, either immediately or when the field loses focus.
- Supports global, block, and inline MathLive visibility controls.
- Can independently hide Obsidian's original MathJax rendering for block and inline equations.
- Supports custom MathLive macros, inline shortcuts, and keybindings written as JSON5.
- Can convert configured MathLive macros into LaTeX `\newcommand` declarations for the clipboard.
- Supports MathLive virtual keyboard policies (`auto`, `manual`, and `sandboxed`) and injects a keyboard collapse button.
- Supports arrow-key navigation between CodeMirror and MathLive fields, including wrapped and folded block-math lines.
- Allows `Escape` to discard the current field edit and restore its initial value.
- Provides an Obsidian command, `Toggle MathLive block`, which can be assigned a hotkey.
- Runs on desktop and mobile according to the manifest, although the README records unresolved tablet/phone input issues.

## Architecture

- `src/main.ts`: plugin lifecycle, settings persistence, command registration, custom element registration, editor extension setup, and MathJax visibility classes.
- `src/mathlive-plugin.ts`: CodeMirror StateField composition and decoration rebuild policy.
- `src/editor-math-navigation.ts`: CodeMirror arrow-key entry into MathLive, including folded and wrapped block handling.
- `src/mathlive-decorations.ts`: syntax-tree scanning and MathLive decoration construction.
- `src/editor-refresh.ts`: settings refresh effect and live EditorView registry.
- `src/mathlive-widget.ts`: MathLive field creation, source synchronization, cancellation, navigation back to CodeMirror, styling, and controller composition.
- `src/mathlive-settings-applier.ts`: applies parsed macros, shortcuts, and keybindings while preserving MathLive defaults.
- `src/mathlive-input-sync.ts`: immediate/deferred source synchronization and Escape cancellation.
- `src/touch-keyboard-controller.ts`: Android backslash handling and touch/system/MathLive keyboard behavior.
- `src/math-boundaries.ts`: shared inline and block formula navigation and decoration positions.
- `src/keyboard-collapse-manager.ts`: virtual-keyboard collapse button injection, retries, observer, timers, and disposal.
- `src/settings-model.ts`: settings schema, defaults, JSON5 parsing, validation, and parsed runtime cache types.
- `src/setting.ts`: Obsidian settings UI, field-level validation display, and debounced save triggers.
- `src/utils.ts`: JSON5 macro conversion to LaTeX `\newcommand` declarations.
- `styles.css`: plugin UI rules, MathJax visibility rules, scoped MathLive part visibility, and bundled KaTeX font data for offline loading.
- `manifest.json` and `versions.json`: Obsidian plugin metadata and compatibility data.
- `esbuild.config.mjs`: TypeScript bundling into `main.js`; Obsidian, Electron, CodeMirror, and Node built-ins remain external.

## Data Flow

1. The plugin loads persisted settings and registers the `math-field` custom element.
2. The CodeMirror extension traverses Obsidian's parsed syntax tree on editor state updates.
3. For each complete math node, it extracts the source range and creates a `MathLiveWidget` decoration.
4. The widget initializes a MathLive field with the current LaTeX and configured behavior.
5. User input dispatches a CodeMirror transaction that replaces only the equation content between delimiters.
6. Later editor transactions rebuild or update decorations so MathLive and Markdown remain synchronized.

## Settings

Default behavior enables MathLive globally and for block equations, disables inline MathLive, places inline widgets on the left, keeps original MathJax visible, updates source immediately, uses automatic virtual-keyboard behavior, and enables arrow-key navigation. Menu and keyboard icons are configurable separately for block and inline fields. Right-side inline placement enables the experimental private CodeMirror focus-preservation path.

Macro, shortcut, and keybinding settings are parsed with JSON5. Invalid values produce an Obsidian notice and are logged to the console. MathLive macros do not automatically affect Obsidian's MathJax renderer; users can copy generated `\newcommand` declarations when MathJax also needs them.

## Development

- Install dependencies: `pnpm install`
- Start the development watcher: `pnpm dev`
- Type-check and create a minified production bundle: `pnpm build`
- Run linting: `pnpm lint`
- Update version metadata and stage it: `pnpm version`

The build entry point is `src/main.ts`, and output is written to `main.js`. There is currently no automated test suite in the repository; verification relies on type-checking, linting, building, and manual testing inside Obsidian.

## Implementation Notes

- Preserve Markdown as the source of truth; widgets must remain editor decorations.
- Keep position metadata (`data-from` and `data-to`) correct after every source edit.
- Avoid replacing a focused MathLive value from CodeMirror updates, because that interrupts active input.
- Arrow navigation depends on exact delimiter-relative positions and special handling for folded or wrapped block equations.
- Settings objects are shared with editor extensions and checked at runtime, allowing most toggles to take effect without re-registering the extension.
- Body classes used to hide MathJax must be removed during plugin unload.

## Non-Public APIs

Only classify a member as non-public here when it is absent from the corresponding public API declarations. HTML structure, CSS selectors, DOM queries/mutations, and shadow-DOM access may be fragile, but are not non-public methods under this definition.

- In right-side mode, `src/mathlive-input-sync.ts` mutates private CodeMirror property `EditorView.inputState.composing` for the MathLive focus lifetime and around source transactions. Public CodeMirror only exposes read-only `EditorView.composing`. Keep feature detection, preserve both prior numeric values, restore on blur and in transaction `finally`, and never leave CodeMirror in composing state.
- `src/setting.ts` uses Obsidian settings internals `app.setting`, `openTabById()`, `activeTab`, `activeTab.headerComponent.components`, and `activeTab.updateHotkeyVisibility()`. None are in the official Obsidian API. Keep failures isolated to the Set hotkey convenience action.

No non-public MathLive method is currently used. `window.mathVirtualKeyboard`, Mathfield APIs, Obsidian `renderMath()`/`finishRenderMath()`, and Obsidian's declared global DOM/string helpers are public for this classification. The commented `app.emulateMobile()` example is not runtime usage.

When adding or removing a non-public member, update this section, `README.md`, and `design.md` together. After Obsidian or CodeMirror upgrades, runtime-test the affected behavior; lint and TypeScript success are insufficient. Prefer a public-API overlay/portal if `inputState.composing` stops working.
