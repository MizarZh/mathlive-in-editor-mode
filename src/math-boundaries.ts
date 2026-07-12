import type { Text } from "@codemirror/state";

export interface MathSourceRange {
	from: number;
	to: number;
	isInline: boolean;
}

export interface MathNavigationPositions {
	backwardBoundary: number;
	forwardBoundary: number;
	decorationPosition: number;
	owningPosition: number;
}

function clampPosition(position: number, doc: Text): number {
	return Math.max(0, Math.min(position, doc.length));
}

export function getMathNavigationPositions(
	doc: Text,
	range: MathSourceRange
): MathNavigationPositions {
	if (range.isInline) {
		const openingDelimiter = clampPosition(range.from - 1, doc);
		// Inline widgets are anchored at the opening delimiter. These are the
		// CodeMirror positions immediately before and after that visual widget.
		const afterWidget = clampPosition(range.from, doc);
		return {
			backwardBoundary: openingDelimiter,
			forwardBoundary: afterWidget,
			decorationPosition: openingDelimiter,
			owningPosition: openingDelimiter,
		};
	}

	const beforeClosingDelimiter = clampPosition(range.to, doc);
	const afterClosingDelimiter = clampPosition(range.to + 2, doc);
	const closingLine = doc.lineAt(afterClosingDelimiter);
	const nextLineStart = closingLine.to < doc.length
		? closingLine.to + 1
		: doc.length;

	return {
		backwardBoundary: beforeClosingDelimiter,
		forwardBoundary: nextLineStart,
		decorationPosition: afterClosingDelimiter,
		owningPosition: afterClosingDelimiter,
	};
}
