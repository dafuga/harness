// @harness-uid u_kg5hqx4pqr
import type { QaRunbookStep, QaTask } from '../../../core/agents-providers/qaThread.types';
import type { UntrustedValue } from '../../../core/agents-providers/projectAssistant.types';
import { redactSecrets } from '../../../utils/agents-providers/redactSecrets';

const slack = (text: string) =>
	redactSecrets(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

/** Parent message: no emoji, one title line, then the facts a tester needs. */
export function qaParentText(task: QaTask, stagingUrl: string, stagingBranch: string): string {
	const fix = `<${task.fixPrUrl}|Fix PR #${task.fixPr}>`;
	return [
		`*Staging QA · #${task.issue} ${slack(task.title)}*`,
		'',
		`• *Issue and fix* <${task.issueUrl}|Issue #${task.issue}> · ${fix}`,
		`• *Environment* <${stagingUrl}|Staging> (${slack(stagingBranch)})`,
		'• *Report back* React :white_check_mark: for pass or :x: for fail, and reply in this thread with what you observed.'
	].join('\n');
}

export function qaReminderText(task: QaTask): string {
	return `*Staging QA reminder · #${task.issue} ${slack(task.title)}*\nStill waiting for a pass or fail on staging.`;
}

/** Numbered steps, each followed by an indented Expected line. */
export function qaStepsText(steps: readonly QaRunbookStep[]): string {
	return steps
		.map((step, i) => `${i + 1}. ${slack(step.action)}\n    Expected: ${slack(step.expected)}`)
		.join('\n');
}

function asStep(item: UntrustedValue): QaRunbookStep | undefined {
	const { action, expected } = (item ?? {}) as Record<string, UntrustedValue>;
	if (typeof action !== 'string' || typeof expected !== 'string') return undefined;
	if (!action.trim() || !expected.trim()) return undefined;
	return { action: action.trim().slice(0, 300), expected: expected.trim().slice(0, 300) };
}

/** Accepts only a model reply that is a JSON array of {action, expected} with 1 to 12 steps. */
export function parseQaSteps(raw: string): QaRunbookStep[] {
	let data: UntrustedValue;
	try {
		data = JSON.parse(raw.slice(raw.indexOf('['), raw.lastIndexOf(']') + 1));
	} catch {
		return [];
	}
	if (!Array.isArray(data) || data.length === 0 || data.length > 12) return [];
	const steps = data.map(asStep);
	return steps.every((step) => step) ? (steps as QaRunbookStep[]) : [];
}
