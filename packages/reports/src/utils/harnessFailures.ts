export interface FailureCause {
	/** The failure as recorded; for a cause several subjects share, the words they share. */
	text: string;
	count: number;
	/** The first subjects a shared cause was recorded for; empty for a failure of its own. */
	subjects: string[];
}

export interface FailureSummary {
	total: number;
	/** True when the failures are few enough to be read as they are, without a summary. */
	plain: boolean;
	/** The causes that are shown, in the order they first occur. */
	causes: FailureCause[];
	/** Causes beyond those shown; like every failure they are in the complete list. */
	more: number;
}

const few = 5;
const named = 3;
const about = /^(\S+): (.+)$/s;

/** Every sentence that is said about a subject, with the subjects it is said about in order. */
function subjectsOf(failures: string[]): Map<string, string[]> {
	const said = new Map<string, string[]>();
	for (const failure of failures) {
		const [, subject, text] = about.exec(failure) ?? [];
		if (subject) said.set(text, [...(said.get(text) ?? []), subject]);
	}
	return said;
}

/**
 * What the failures of a record come to: how many there are and what caused them. Failures that
 * say the same thing about different subjects, as every unit without a baseline does, are one
 * cause with its count and the first subjects; a failure nothing else shares keeps its own
 * words. Nothing is left out of the count, and the complete list stays with the record.
 */
export function harnessFailures(failures: string[]): FailureSummary {
	const said = subjectsOf(failures);
	const causes = new Map<string, FailureCause>();
	for (const failure of failures) {
		const text = about.exec(failure)?.[2] ?? failure;
		const subjects = said.get(text) ?? [];
		// One subject is no pattern: the failure stands as it was recorded.
		if (subjects.length < 2) causes.set(failure, { text: failure, count: 1, subjects: [] });
		else causes.set(text, { text, count: subjects.length, subjects: subjects.slice(0, named) });
	}
	const plain = failures.length <= few;
	const shown = [...causes.values()].slice(0, plain ? causes.size : few);
	return { total: failures.length, plain, causes: shown, more: causes.size - shown.length };
}
