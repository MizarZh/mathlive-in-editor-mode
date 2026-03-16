import { syntaxTree } from "@codemirror/language";
import type { Text } from "@codemirror/state";
import {
	EditorSelection,
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
			{
				key: "ArrowDown",
				run: (view) => {
					if (!settings.arrowKeyNavigation) return false;
					if (isFocusInMathField()) return false;

					/**
					 * ArrowDown behavior goal (block math):
					 *
					 * In Obsidian, a block math segment is effectively presented as 3 "columns" on the same
					 * logical source line:
					 *   1) the source line `$$ ... $$` (CodeMirror text)
					 *   2) the rendered MathJax preview (DOM)
					 *   3) our MathLive widget (DOM decoration)
					 *
					 * The tricky part: Obsidian often *folds* the source line (1) when you are not "in it".
					 * The line only expands when the cursor enters it. That means:
					 * - A normal Down move can jump over the folded source line, visually skipping the formula.
					 * - Users expect: move into the formula line first, then walk wrap-lines (visual lines),
					 *   and only when leaving the *last wrapped visual line* of that formula, enter MathLive.
					 *
					 * Strategy:
					 * - Always attempt a wrap-aware visual move first via `view.moveVertically(...)`.
					 * - If that move crosses logical lines, check whether we skipped a folded formula line.
					 *   If so, land on that line (to force it to expand) instead of moving past it.
					 * - Only enter MathLive when we are leaving a formula line (i.e. Down would cross to the
					 *   next logical line from the last wrapped visual line), or when we can't move further.
					 */

					const doc = view.state.doc;

					/**
					 * Collect block-math MathLive widgets currently rendered in this editor view.
					 * (Inline math is handled differently and is excluded here.)
					 *
					 * Note: We look them up from the DOM because widgets are decorations, not part of the doc.
					 */
					const blockEntries = () =>
						getMathFieldEntries(view).filter((e) => !e.isInline);

					/**
					 * Map a MathLive widget back to its "owning" source line number.
					 *
					 * For block math, the widget is added at `end + 2` (right after the closing `$$`),
					 * so `e.to + 2` lands on the closing delimiter line. Using `lineAt` gives us the
					 * logical line number in the CM document that corresponds to the `$$...$$` line.
					 *
					 * This is the anchor we use to:
					 * - decide whether the cursor is currently "on a formula line"
					 * - detect "skipping" a folded formula line when moving down
					 */
					const owningLine = (e: MathFieldEntry) =>
						doc.lineAt(Math.min(e.to + 2, doc.length)).number;

					/**
					 * Return the block-math widget whose owning source line is `lineNo`, if any.
					 */
					const entryForOwningLine = (lineNo: number) =>
						blockEntries().find((e) => owningLine(e) === lineNo) ?? null;

					/**
					 * Find the next owning formula line number below `lineNo` (closest one), if any.
					 * Used to detect and prevent skipping folded math source lines.
					 */
					const nextOwningLineAfter = (lineNo: number) => {
						let best: number | null = null;
						for (const e of blockEntries()) {
							const l = owningLine(e);
							if (l <= lineNo) continue;
							if (best === null || l < best) best = l;
						}
						return best;
					};

					/**
					 * Enter MathLive for the formula line `lineNo` if it has a widget.
					 * Returns true when we actually entered.
					 */
					const enterMathLiveForOwningLine = (lineNo: number): boolean => {
						const entry = entryForOwningLine(lineNo);
						if (!entry) return false;
						entry.mfe.focus();
						(entry.mfe as MathfieldElement).position = 0;
						return true;
					};

					// 1) Move down by *visual line* (wrap-aware). This respects line wrapping, so for a long
					// `$$...$$` line that wraps visually, Down will traverse each wrapped visual line first.
					const before = view.state.selection.main;
					const next = view.moveVertically(before, true);
					const moved = next.head !== before.head || next.anchor !== before.anchor;
					if (moved) {
						const beforeLine = doc.lineAt(before.head).number;
						const afterLine = doc.lineAt(next.head).number;

						// 2) If the visual move crossed a *logical* line boundary, we are leaving a logical line.
						// This can happen either because:
						// - we were at the last wrapped visual line of a long line, or
						// - Obsidian folded a formula line and CM jumped over it.
						if (afterLine !== beforeLine) {
							const skippedLine = nextOwningLineAfter(beforeLine);
							if (skippedLine !== null && skippedLine < afterLine) {
								// We skipped a formula line that exists between beforeLine and afterLine.
								// Force the cursor onto that formula line so Obsidian expands it,
								// then subsequent Down presses can walk its wrapped visual lines.
								const pos = doc.line(skippedLine).from;
								view.dispatch({
									selection: view.state.selection.replaceRange(
										EditorSelection.cursor(pos)
									),
									scrollIntoView: true,
								});
								return true;
							}

							// No folded formula line was skipped. If the line we're leaving is a formula line,
							// then we must have been on its last wrapped visual line. Enter MathLive now.
							if (enterMathLiveForOwningLine(beforeLine)) return true;
						}

						// 3) Normal case: just move the selection to the computed next visual position.
						view.dispatch({
							selection: view.state.selection.replaceRange(next),
							scrollIntoView: true,
						});
						return true;
					}

					// 4) Can't move down further (bottom of document / viewport constraints).
					// If we're on a formula line, allow Down to enter MathLive.
					return enterMathLiveForOwningLine(doc.lineAt(before.head).number);
				},
			},
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
