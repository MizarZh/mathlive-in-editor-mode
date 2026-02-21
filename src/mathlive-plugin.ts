import { syntaxTree } from "@codemirror/language";
import type { Text } from "@codemirror/state";
import {
	Prec,
	RangeSetBuilder,
	StateField,
	Transaction,
	Extension,
} from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, keymap, type KeyBinding } from "@codemirror/view";
import { MathLiveWidget } from "./mathlive-widget";
import { MathLiveEditorModePluginSettings, Global } from "./setting";
import type { MathfieldElement } from "mathlive";

type MathFieldEntry = {
	mfe: HTMLElement;
	from: number;
	to: number;
	isInline: boolean;
};

function isFocusInMathField(): boolean {
	const active = document.activeElement as HTMLElement | null;
	if (active?.closest?.("math-field")) return true;
	if (active?.getRootNode() instanceof ShadowRoot) {
		const host = (active.getRootNode() as ShadowRoot).host;
		if (host?.tagName === "MATH-FIELD") return true;
	}
	return false;
}

function getMathFieldEntries(view: EditorView): MathFieldEntry[] {
	const list = view.dom.querySelectorAll<HTMLElement>("math-field[data-from][data-to]");
	const entries: MathFieldEntry[] = [];
	for (const mfe of Array.from(list)) {
		const from = parseInt(mfe.dataset.from ?? "", 10);
		const to = parseInt(mfe.dataset.to ?? "", 10);
		if (Number.isNaN(from) || Number.isNaN(to)) continue;
		const wrapper = mfe.closest(".obsidian-mathlive-codemirror-wrapper");
		const isInline = wrapper?.classList.contains("inline") ?? false;
		entries.push({ mfe, from, to, isInline });
	}
	return entries;
}

function tryEnter(
	view: EditorView,
	match: (e: MathFieldEntry, head: number, doc: Text) => boolean,
	atStart: boolean
): boolean {
	if (isFocusInMathField()) return false;
	const head = view.state.selection.main.head;
	const doc = view.state.doc;
	for (const e of getMathFieldEntries(view)) {
		if (match(e, head, doc)) {
			e.mfe.focus();
			(e.mfe as MathfieldElement).position = atStart ? 0 : (e.mfe as MathfieldElement).lastOffset;
			return true;
		}
	}
	return false;
}

/** One arrow-key binding: run tryEnter when arrowKeyNavigation is on and match(view) hits. */
function arrowEnterBinding(
	key: string,
	match: (e: MathFieldEntry, head: number, doc: Text) => boolean,
	atStart: boolean,
	settings: MathLiveEditorModePluginSettings
): KeyBinding {
	return {
		key,
		run: (v) => (!settings.arrowKeyNavigation ? false : tryEnter(v, match, atStart)),
	};
}

/** When cursor is at formula boundary, Arrow keys enter MathLive (keymap). Checked at runtime so disabling arrowKeyNavigation takes effect without reload. */
function enterMathLiveOnArrow(
	settings: MathLiveEditorModePluginSettings,
	_global: Global
): Extension {
	return Prec.highest(
		keymap.of([
			arrowEnterBinding(
				"ArrowRight",
				(e, head) => head === (e.isInline ? e.from - 1 : e.to + 2),
				true,
				settings
			),
			arrowEnterBinding(
				"ArrowLeft",
				(e, head) => head === (e.isInline ? e.from : e.to + 3),
				false,
				settings
			),
			arrowEnterBinding(
				"ArrowDown",
				(e, head, doc) => {
					if (e.isInline) return false;
					return doc.lineAt(head).number === doc.lineAt(Math.min(e.to + 2, doc.length)).number;
				},
				true,
				settings
			),
			arrowEnterBinding(
				"ArrowUp",
				(e, head, doc) => {
					if (e.isInline) return false;
					return doc.lineAt(head).number === doc.lineAt(Math.min(e.to + 3, doc.length)).number;
				},
				false,
				settings
			),
		])
	);
}

export const mathliveListFieldWrapper = (
	settings: MathLiveEditorModePluginSettings,
	global: Global
) => {
	const mathliveListField = StateField.define<DecorationSet>({
		create(state): DecorationSet {
			return Decoration.none;
		},
		update(
			oldState: DecorationSet,
			transaction: Transaction
		): DecorationSet {
			const builder = new RangeSetBuilder<Decoration>();
			let begin = -1,
				end = -1,
				isInline = false;

			syntaxTree(transaction.state).iterate({
				enter(node) {
					// console.log(node.type.name);
					// console.log(EditorView.editable);
					// console.log(transaction.state);

					if (node.type.name.contains("formatting-math-begin")) {
						if (node.type.name.contains("math-block"))
							begin = node.from + 2;
						else {
							begin = node.from + 1;
							isInline = true;
						}
					}
					if (
						node.type.name.contains("formatting-math-end") &&
						begin !== -1
					) {
						end = node.from;
						const mathContent = transaction.state.sliceDoc(begin, end);

						if (!isInline) {
							// block
							builder.add(
								end + 2,
								end + 2,
								Decoration.widget({
									widget: new MathLiveWidget(
										{ from: begin, to: end },
										mathContent,
										settings,
										isInline,
										global
									),
									block: true,
									side: 10,
								})
							);
						} else {
							if (settings.inlineDisplay)
								// inline
								builder.add(
									// end + 1,
									// end + 1,
									begin - 1,
									begin - 1,
									Decoration.widget({
										widget: new MathLiveWidget(
											{ from: begin, to: end },
											mathContent,
											settings,
											isInline,
											global
										),
										side: 1,
									})
								);
						}

						begin = end = -1;
						isInline = false;
					}
				},
			});

			return builder.finish();
		},
		provide(field: StateField<DecorationSet>): Extension {
			return [
				EditorView.decorations.from(field),
				enterMathLiveOnArrow(settings, global),
			];
		},
	});
	return mathliveListField;
};
