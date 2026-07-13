import type { Text } from "@codemirror/state";
import type { InlineWidgetPosition } from "./settings-model";

export interface MathSourceRange {
	from: number;
	to: number;
	isInline: boolean;
}

export interface MathNavigationPositions {
	backwardBoundary: number;
	forwardBoundary: number;
	decorationPosition: number;
	decorationSide: number;
	owningPosition: number;
}

function clampPosition(position: number, doc: Text): number {
	return Math.max(0, Math.min(position, doc.length));
}

export function getMathNavigationPositions(
	doc: Text,
	range: MathSourceRange,
	inlineWidgetPosition: InlineWidgetPosition = "left"
): MathNavigationPositions {
	if (range.isInline) {
		if (inlineWidgetPosition === "left") {
			const openingDelimiter = clampPosition(range.from - 1, doc);
			const afterWidget = clampPosition(range.from, doc);
			return {
				backwardBoundary: openingDelimiter,
				forwardBoundary: afterWidget,
				decorationPosition: openingDelimiter,
				decorationSide: 1,
				owningPosition: openingDelimiter,
			};
		}
		const beforeClosingDelimiter = clampPosition(range.to, doc);
		const afterClosingDelimiter = clampPosition(range.to + 1, doc);
		return {
			backwardBoundary: beforeClosingDelimiter,
			forwardBoundary: afterClosingDelimiter,
			decorationPosition: afterClosingDelimiter,
			decorationSide: -1,
			owningPosition: afterClosingDelimiter,
		};
	}

	const beforeClosingDelimiter = clampPosition(range.to, doc);
	const afterClosingDelimiter = clampPosition(range.to + 2, doc);
	const closingLine = doc.lineAt(afterClosingDelimiter);
	const nextLineStart = closingLine.to < doc.length
		? closingLine.to + 1
		: doc.length;
	const forwardBoundary = afterClosingDelimiter < closingLine.to
		? afterClosingDelimiter
		: nextLineStart;

	return {
		backwardBoundary: beforeClosingDelimiter,
		forwardBoundary,
		decorationPosition: afterClosingDelimiter,
		decorationSide: forwardBoundary === afterClosingDelimiter ? -10 : 10,
		owningPosition: afterClosingDelimiter,
	};
}
