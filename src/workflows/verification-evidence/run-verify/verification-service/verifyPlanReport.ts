// @harness-uid u_ov7k2d8msq
import type { PlannedCheck } from '../../../../utils/verification-evidence/verifyPlan';
import { posix } from 'node:path';

import type { NormalizedCheck, VerifyPlanReport } from './verifyPlanReport.types';
export type { VerifyPlanReport } from './verifyPlanReport.types';

/** Reports compatible command shapes without changing, reordering, or executing planned checks. */
export function verifyPlanReport(
	plan: PlannedCheck[],
	source: VerifyPlanReport['source']
): VerifyPlanReport {
	const grouped = compatibleGroups(plan);
	const { candidates, candidateByCheck } = candidateGroups(grouped);
	const checks = plan.map((check) => reportCheck(check, candidateByCheck, grouped.unknown));
	const candidateChecks = checks.filter((check) => check.decision === 'candidate').length;
	return {
		mode: 'report-only',
		executedChecks: 0,
		note: 'Candidates describe matching command shapes; checks remain uncombined and are not executed.',
		sideEffects:
			'Does not restore evidence or run planned checks; impact analysis may invoke the selected local kernel.',
		source,
		plannedChecks: plan.length,
		candidateGroups: candidates.length,
		candidateChecks,
		singletons: checks.filter((check) => check.decision === 'singleton').length,
		ineligible: checks.filter((check) => check.decision === 'ineligible').length,
		checks,
		candidates
	};
}

function compatibleGroups(plan: PlannedCheck[]) {
	const groups = new Map<string, NormalizedCheck[]>();
	const unknown = new Set<PlannedCheck>();
	for (const check of plan) {
		const template = targetTemplate(check);
		if (!template) {
			unknown.add(check);
			continue;
		}
		const key = JSON.stringify([check.runner, check.cwd, check.timeoutMs, template]);
		groups.set(key, [...(groups.get(key) ?? []), { check, template }]);
	}
	return { groups, unknown };
}

function candidateGroups(grouped: ReturnType<typeof compatibleGroups>) {
	const candidates: VerifyPlanReport['candidates'] = [];
	const candidateByCheck = new Map<PlannedCheck, string>();
	for (const members of grouped.groups.values()) {
		if (members.length < 2) continue;
		const first = members[0];
		if (!first) continue;
		const id = `candidate-${String(candidates.length + 1).padStart(3, '0')}`;
		candidates.push({
			id,
			runner: first.check.runner,
			cwd: first.check.cwd,
			commandTemplate: first.template,
			timeoutMs: first.check.timeoutMs,
			checks: members.map(({ check }) => ({ id: check.id, path: check.target }))
		});
		for (const { check } of members) candidateByCheck.set(check, id);
	}
	return { candidates, candidateByCheck };
}

function reportCheck(
	check: PlannedCheck,
	candidateByCheck: Map<PlannedCheck, string>,
	unknown: Set<PlannedCheck>
) {
	const groupId = candidateByCheck.get(check);
	if (groupId) return { ...checkFields(check), decision: 'candidate' as const, groupId };
	if (unknown.has(check)) {
		return {
			...checkFields(check),
			decision: 'ineligible' as const,
			reason:
				'Could not prove the declared runner and one literal test-file argument match this check; command remains ungrouped.'
		};
	}
	return {
		...checkFields(check),
		decision: 'singleton' as const,
		reason:
			'No other planned check has the same runner, cwd, target-normalized command, and timeout.'
	};
}

function checkFields(check: PlannedCheck) {
	return {
		id: check.id,
		path: check.target,
		runner: check.runner,
		cwd: check.cwd,
		command: check.command,
		timeoutMs: check.timeoutMs
	};
}

/** Replace only one exact file argument that names this check's test target. */
function targetTemplate(check: PlannedCheck): string | undefined {
	if (!/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(check.target)) return undefined;
	const target = posix.normalize(check.target);
	const relative = posix.normalize(posix.relative(check.cwd, target));
	const allowed = new Set([target, relative]);
	const tokens = [...check.command.matchAll(/"[^"\n]*"|'[^'\n]*'|[^\s]+/g)];
	const values = tokens.map((match) => match[0].replace(/^["']|["']$/g, ''));
	if (!hasRunnerInvocation(values, check.runner)) return undefined;
	const matches = tokens.filter((_match, index) => allowed.has(values[index] ?? ''));
	if (matches.length !== 1) return undefined;
	const match = matches[0];
	if (!match) return undefined;
	const index = match.index ?? -1;
	if (index < 0) return undefined;
	return `${check.command.slice(0, index)}{target}${check.command.slice(index + match[0].length)}`;
}

function hasRunnerInvocation(tokens: string[], runner: PlannedCheck['runner']): boolean {
	if (runner === 'vitest') {
		return tokens.some((token, index) => token === 'vitest' && tokens[index + 1] === 'run');
	}
	if (runner === 'playwright') {
		return tokens.some((token, index) => token === 'playwright' && tokens[index + 1] === 'test');
	}
	return false;
}
