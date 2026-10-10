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
import { openRange, type RevisionRange } from './loadRevisions';

export interface ExplainInput extends RevisionRange {
	all?: boolean;
	unit?: string;
	symbol?: string[];
	behavior?: string;
	simplification?: string;
	simplificationOutcome?: string;
	performance?: string;
	performanceOutcome?: string;
	now?: () => string;
}

type Listed = Omit<ReasonStatus, 'from' | 'to'>;

/** Which changes in a range need a reason, and whether each one has it. */
export async function explainReport(
	range: RevisionRange
): Promise<ReasonReport & { root: string }> {
	const { root, base, head } = await openRange(range);
	const known = await new ExplanationRepository(root).all();
	const report = new ExplanationService().report(requiredReasons(base, head), known);
	return { ...report, root };
}

export function listed(report: ReasonReport): Listed[] {
	return report.required.map(({ from: _from, to: _to, ...status }) => status);
}

/** Records a reason for the named symbols, or for everything still unexplained with `all`. */
export async function explainAdd(input: ExplainInput): Promise<Explanation[]> {
	const text = reasonText(input);
	const report = await explainReport(input);
	const open = report.required.filter((status) => status.state !== 'explained');
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
