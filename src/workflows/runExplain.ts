import { fail } from '../core/errors';
import {
	explanationOutcomes,
	type Explanation,
	type ExplanationOutcome,
	type ReasonStatus
} from '../core/explanationTypes';
import { ExplanationRepository } from '../repositories/ExplanationRepository';
import { ExplanationService, type ReasonReport } from '../services/ExplanationService';
import { requiredReasons } from '../utils/requiredReasons';
import { explanationProblems } from '../utils/writingLimits';
import { GitAdapter } from '../adapters/GitAdapter';
import { ReasonPathService } from '../services/ReasonPathService';
import { commitLoader, openRange, type RevisionRange } from './loadRevisions';

export interface ExplainInput extends RevisionRange {
	all?: boolean;
	unit?: string;
	symbol?: string[];
	behavior?: string;
	simplification?: string;
	simplificationOutcome?: string;
	performance?: string;
	performanceOutcome?: string;
	/** Also writes a reason for a change whose stored reason exceeds the writing limits. */
	replace?: boolean;
	now?: () => string;
}

type Listed = Omit<ReasonStatus, 'from' | 'to'>;

/** Which changes in a range need a reason, and whether each one has it. */
export async function explainReport(
	range: RevisionRange
): Promise<ReasonReport & { root: string }> {
	const { root, base, head } = await openRange(range);
	const known = await new ExplanationRepository(root).all();
	const report = new ExplanationService().report(requiredReasons(base, head), known, head.limited);
	return { ...report, root };
}

/**
 * The same question for a whole range: explained directly, or by the reasons of every step
 * along its history. Recording a reason asks the direct question; checking asks this one.
 */
export async function explainedRange(
	range: RevisionRange
): Promise<ReasonReport & { root: string }> {
	const { root, base, head } = await openRange(range);
	const git = new GitAdapter(root);
	const named = (reference: string) => git.run(['rev-parse', '--verify', `${reference}^{commit}`]);
	const baseCommit = range.base === 'none' ? null : await named(range.base ?? 'HEAD');
	const headCommit = range.head ? await named(range.head) : null;
	const known = await new ExplanationRepository(root).all();
	const service = new ReasonPathService(root, commitLoader(root));
	return { ...(await service.report({ base, head, baseCommit, headCommit }, known)), root };
}

export function listed(report: ReasonReport): Listed[] {
	return report.required.map(({ from: _from, to: _to, ...status }) => status);
}

/**
 * Records a reason for the named symbols, or for everything still unexplained with `all`. With
 * `replace`, a change whose stored reason exceeds the writing limits is open again.
 */
export async function explainAdd(input: ExplainInput): Promise<Explanation[]> {
	const text = reasonText(input);
	const report = await explainReport(input);
	const unexplained = report.required.filter((status) => status.state !== 'explained');
	// A reason over the limits is replaced by a later one for the same exact change: the store
	// only grows, and the latest reason for a change is the one a check relies on.
	const again = input.replace
		? report.overlong.map((reason) => ({ ...reason, state: 'explained' as const }))
		: [];
	const open = [...unexplained, ...again];
	const chosen = input.all ? open : open.filter((status) => selected(status, input));
	if (chosen.length === 0) {
		return fail(
			input.all
				? 'Nothing in this range needs a reason.'
				: `No unexplained change matches ${input.unit ?? '--unit'} ${(input.symbol ?? []).join(', ')}.`
		);
	}
	const recordedAt = input.now?.() ?? new Date().toISOString();
	const entries = chosen.map(({ state: _state, ...reason }) => ({
		...reason,
		...text,
		recordedAt
	}));
	// A new reason is held to the limits wherever it is written, and nothing is stored if it is not.
	const long = [...new Set(entries.flatMap(explanationProblems))];
	if (long.length > 0) return fail(long.join('\n'));
	await new ExplanationRepository(report.root).append(entries);
	return entries;
}

function selected(status: ReasonStatus, input: ExplainInput): boolean {
	const symbols = input.symbol ?? [];
	return status.unit === input.unit && (symbols.length === 0 || symbols.includes(status.symbol));
}

/** A reason always states the behaviour and both attempts, even when an attempt did not help. */
function reasonText(
	input: ExplainInput
): Pick<Explanation, 'behavior' | 'simplification' | 'performance'> {
	const behavior = required(input.behavior, '--behavior', 'what changed in behaviour');
	return {
		behavior,
		simplification: {
			attempt: required(input.simplification, '--simplification', 'what was tried to simplify it'),
			outcome: outcome(input.simplificationOutcome, '--simplification-outcome')
		},
		performance: {
			attempt: required(
				input.performance,
				'--performance',
				'what was tried for performance, including at the invocation boundary, or why nothing applies'
			),
			outcome: outcome(input.performanceOutcome, '--performance-outcome')
		}
	};
}

function required(value: string | undefined, flag: string, meaning: string): string {
	return value?.trim() ? value.trim() : fail(`harness explain add requires ${flag}: ${meaning}.`);
}

function outcome(value: string | undefined, flag: string): ExplanationOutcome {
	const found = explanationOutcomes.find((item) => item === value);
	return found ?? fail(`${flag} must be improved, not-improved or not-applicable.`);
}
