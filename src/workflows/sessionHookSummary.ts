import type { CleanCodeReport } from '../audit/cleanCodeTypes';

export interface SessionHookOutput {
	systemMessage?: string;
	hookSpecificOutput?: { hookEventName: 'SessionStart'; additionalContext: string };
}

export function sessionHookSummary(report: CleanCodeReport): SessionHookOutput {
	const cached = report.files.filter((file) => file.cached).length;
	const summary =
		`Jev Clean Code: ${report.status} (${report.files.length} reviewed, ` +
		`${cached} cached, ${report.coverage.selectedFiles.length} eligible; ` +
		`${report.coverage.excludedPaths.length} excluded, ${report.coverage.unsupportedFiles.length} unsupported).`;
	const items = report.files
		.filter((file) => !['clean'].includes(file.status))
		.slice(0, 6)
		.map((file) => `${file.path}: ${file.status}`);
	const context = [
		summary,
		...items,
		'Advisory review of source at session startup. Later edits require another review.',
		'Treat violations, uncertainty and incomplete execution honestly; do not call them clean.'
	]
		.join('\n')
		.slice(0, 2400);
	return {
		...(!['clean', 'not-applicable', 'dry-run'].includes(report.status)
			? { systemMessage: summary }
			: {}),
		hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: context }
	};
}

export function sessionHookFailure(): SessionHookOutput {
	return {
		systemMessage:
			'Jev Clean Code: incomplete. Automatic review could not finish; check the Harness session configuration and credential file. No clean verdict was produced.'
	};
}
