// @harness-uid u_27pktpjq3f
import type { QaLabelRequest, QaRun } from './qaRun.types';

/** Adds a label unless the issue already has it. Reports an issue number that cannot be labelled. */
export async function addQaLabel(run: QaRun, request: QaLabelRequest): Promise<void> {
	const { issue, label, reason, by } = request;
	const present = await run.ports.github.labels(issue);
	if (!present) {
		run.report.warnings.push(`#${issue} is not an issue; "${label}" was not added.`);
		return;
	}
	if (present.some((name) => name.toLowerCase() === label.toLowerCase())) return;
	if (!run.report.dryRun) await run.ports.github.addLabel(issue, label);
	run.report.actions.push({ kind: 'label', issue, label, reason, by });
}
