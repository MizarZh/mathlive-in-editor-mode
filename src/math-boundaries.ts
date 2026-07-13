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
		const beforeClosingDelimiter = clampPosition(range.to, doc);
		const afterClosingDelimiter = clampPosition(range.to + 1, doc);
		return {
			backwardBoundary: beforeClosingDelimiter,
			forwardBoundary: afterClosingDelimiter,
			decorationPosition: afterClosingDelimiter,
			owningPosition: afterClosingDelimiter,
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
