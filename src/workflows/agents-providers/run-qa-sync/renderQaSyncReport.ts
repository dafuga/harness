// @harness-uid u_scqa7s6mr2
import type { QaSyncAction, QaSyncReport } from '../../../core/agents-providers/qaSync.types';

/** @pure A short human summary: one line per action, warning and error. */
export function renderQaSyncReport(report: QaSyncReport): string {
	const mode = report.dryRun ? 'dry run, nothing written; would do' : 'did';
	return [
		`QA sync: ${report.threads} thread(s); ${mode} ${report.actions.length} action(s).`,
		...report.actions.map(line),
		...report.warnings.map((warning) => `warning: ${warning}`),
		...report.errors.map((error) => `error: ${error}`)
	].join('\n');
}

function line(action: QaSyncAction): string {
	return action.kind === 'label'
		? `label #${action.issue} "${action.label}" (${action.reason} by ${action.by})`
		: `note ${action.item} for #${action.issue}:\n  ${action.text.replaceAll('\n', '\n  ')}`;
}
