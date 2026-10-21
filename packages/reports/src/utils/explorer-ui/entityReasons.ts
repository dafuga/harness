import {
	writingCount,
	writingLimits,
	type WritingLimit
} from '../../../../../src/utils/writing-limits/writingLimits';
import type { HarnessExplanation } from '../../models/explorer-ui/Harness.types';
import { humanize } from './entityContract';

export interface BoundedText {
	text: string;
	/** True when the text is only the start of what was written. */
	cut: boolean;
}

export type ReasonKind = 'simplification' | 'performance';

export interface ReasonAttempts extends BoundedText {
	/** Each outcome the attempts of this kind had, once. */
	outcomes: string[];
}

export interface ReasonUse {
	subject: string;
	kind: ReasonKind;
	outcome: string;
}

export interface EntityReasons {
	behavior: BoundedText;
	simplification: ReasonAttempts;
	performance: ReasonAttempts;
	/** Every behaviour note as it was written, each once, with what it was written about. */
	notes: Array<{ behavior: string; subjects: string[] }>;
	/** Every attempt as it was written, each once, with the outcome it had for each subject. */
	attempted: Array<{ attempt: string; uses: ReasonUse[] }>;
	/** True when the summary says less than the reasons do, so they are offered in full. */
	long: boolean;
}

const kinds: ReasonKind[] = ['simplification', 'performance'];

const mark = '…';

const plain = (text: string) => text.trim().split(/\s+/).join(' ');

const unique = <Item>(items: Item[]) => [...new Set(items)];

/** Whether a text is within a limit, counted the one way every check of writing counts. */
function fits(text: string, limit: WritingLimit): boolean {
	const { words, characters } = writingCount(text);
	return (limit.words === null || words <= limit.words) && characters <= limit.characters;
}

/** The longest start of a text, in whole words, that fits a limit together with its mark. */
function start(text: string, limit: WritingLimit): string {
	const words = text.split(' ');
	const marked = (kept: number) => [...words.slice(0, kept), mark].join(' ');
	let kept = 0;
	while (kept < words.length && fits(marked(kept + 1), limit)) kept += 1;
	if (kept > 0) return marked(kept);
	// A first word longer than the limit is cut by characters, each one whole.
	return [...text].slice(0, limit.characters - 1).join('') + mark;
}

/**
 * Several notes as one text within one limit: each said once, then cut together at a word. The
 * limit holds for what is shown, so notes are never cut one by one and then joined past it.
 */
export function boundedText(notes: string[], limit: WritingLimit): BoundedText {
	const text = unique(notes.map(plain).filter(Boolean)).join(' ');
	return fits(text, limit) ? { text, cut: false } : { text: start(text, limit), cut: true };
}

export /** What several reasons say alike, each text once as it was first written, in that order. */
function alike<Item>(said: Array<{ text: string; of: Item }>): Array<{ text: string; of: Item[] }> {
	const found = new Map<string, { text: string; of: Item[] }>();
	for (const { text, of } of said.filter((entry) => plain(entry.text))) {
		const group = found.get(plain(text)) ?? { text, of: [] };
		found.set(plain(text), { text: group.text, of: [...group.of, of] });
	}
	return [...found.values()];
}

const subject = (reason: HarnessExplanation) =>
	reason.symbol === '*' ? 'the whole entity' : humanize(reason.symbol);

export function attempts(reasons: HarnessExplanation[], kind: ReasonKind): ReasonAttempts {
	const tried = reasons.map((reason) => reason[kind].attempt);
	return {
		...boundedText(tried, writingLimits.attempt),
		outcomes: unique(reasons.map((reason) => humanize(reason[kind].outcome)))
	};
}

export const uses = (reason: HarnessExplanation) =>
	kinds.map((kind) => ({
		text: reason[kind].attempt,
		of: { subject: subject(reason), kind, outcome: humanize(reason[kind].outcome) }
	}));

const same = (one: ReasonUse, other: ReasonUse) =>
	one.subject === other.subject && one.kind === other.kind && one.outcome === other.outcome;

/**
 * The reasons one commit recorded for one entity, summarised to the length of a single reason:
 * one behaviour note and one attempt of each kind, within the limits an author is held to.
 * Nothing is rewritten: every note and attempt stays beside the summary as it was written,
 * each once, with what it is about and each outcome it had. No file of the source is kept.
 */
export function entityReasons(reasons: HarnessExplanation[]): EntityReasons {
	const behavior = boundedText(
		reasons.map((reason) => reason.behavior),
		writingLimits.behavior
	);
	const [simplification, performance] = kinds.map((kind) => attempts(reasons, kind));
	const notes = alike(reasons.map((reason) => ({ text: reason.behavior, of: subject(reason) })));
	return {
		behavior,
		simplification,
		performance,
		notes: notes.map(({ text, of }) => ({ behavior: text, subjects: unique(of) })),
		attempted: alike(reasons.flatMap(uses)).map(({ text, of }) => ({
			attempt: text,
			uses: of.filter((use, position) => of.findIndex((other) => same(use, other)) === position)
		})),
		long: reasons.length > 1 || behavior.cut || simplification.cut || performance.cut
	};
}

export { reasonsTried } from '../../components/explorer-ui/harness/entity-history-row/entityReasons';
export { reasonUses } from '../../components/explorer-ui/harness/entity-reasons/entityReasons';
