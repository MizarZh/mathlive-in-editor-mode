/** CodeMirror navigation into MathLive widgets. */
import type { Text } from "@codemirror/state";
import {
	EditorSelection,
	Prec,
	Extension,
} from "@codemirror/state";
import { EditorView, keymap, type KeyBinding } from "@codemirror/view";
import { getMathNavigationPositions } from "./math-boundaries";
import type { MathLiveEditorModePluginSettings } from "./settings-model";
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
export function createMathNavigation(
	settings: MathLiveEditorModePluginSettings
): Extension {
	return Prec.highest(
		keymap.of([
			arrowEnterBinding(
				"ArrowRight",
				(e, head, doc) => head === getMathNavigationPositions(
					doc, e, settings.inlineWidgetPosition
				).backwardBoundary,
				true,
				settings
			),
			arrowEnterBinding(
				"ArrowLeft",
				(e, head, doc) => head === getMathNavigationPositions(
					doc, e, settings.inlineWidgetPosition
				).forwardBoundary,
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
					 * - Detect block widgets that split source and trailing text on one logical line.
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
					const positionsFor = (e: MathFieldEntry) =>
						getMathNavigationPositions(doc, e, settings.inlineWidgetPosition);

					/**
					 * Map a MathLive widget back to its "owning" source line number.
					 *
					 * The shared boundary helper returns the position owned by the closing
					 * delimiter line. Using `lineAt` maps it to the source line for `$$...$$`.
					 *
					 * This is the anchor we use to:
					 * - decide whether the cursor is currently "on a formula line"
					 * - detect "skipping" a folded formula line when moving down
					 */
					const owningLine = (e: MathFieldEntry) =>
						doc.lineAt(positionsFor(e).owningPosition).number;

					/**
					 * Return the block-math widget whose source segment contains `head`, if any.
					 */
					const entryForSourcePosition = (lineNo: number, head: number) =>
						blockEntries().find((e) => {
							if (owningLine(e) !== lineNo) return false;
							const positions = positionsFor(e);
							return positions.forwardBoundary !== positions.decorationPosition ||
								head < positions.decorationPosition;
						}) ?? null;

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
					const enterMathLiveForSourcePosition = (
						lineNo: number,
						head: number
					): boolean => {
						const entry = entryForSourcePosition(lineNo, head);
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
						// A block widget may split one logical line into source and trailing visual lines.
						const crossedSameLineWidget = blockEntries().find((e) => {
							const positions = positionsFor(e);
							return positions.forwardBoundary === positions.decorationPosition &&
								doc.lineAt(before.head).number === owningLine(e) &&
								before.head < positions.decorationPosition &&
								next.head >= positions.decorationPosition;
						});
						if (crossedSameLineWidget) {
							crossedSameLineWidget.mfe.focus();
							(crossedSameLineWidget.mfe as MathfieldElement).position = 0;
							return true;
						}

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
							if (enterMathLiveForSourcePosition(beforeLine, before.head)) return true;
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
					return enterMathLiveForSourcePosition(
						doc.lineAt(before.head).number,
						before.head
					);
				},
			},
			arrowEnterBinding(
				"ArrowUp",
				(e, head, doc) => {
					if (e.isInline) return false;
					const positions = getMathNavigationPositions(
						doc, e, settings.inlineWidgetPosition
					);
					if (doc.lineAt(head).number !== doc.lineAt(positions.forwardBoundary).number) {
						return false;
					}
					return positions.forwardBoundary !== positions.decorationPosition ||
						head >= positions.forwardBoundary;
				},
				false,
				settings
			),
		])
	);
}
