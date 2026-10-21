import type { HarnessLegacyReport } from '../../../models/Harness.types';
import type { Evidence, Status } from '../../../models/Report.types';

const statuses = ['running', 'passed', 'failed', 'blocked', 'skipped', 'not-proven', 'interrupted'];

const known = (status: string): Status =>
	statuses.includes(status) ? (status as Status) : 'not-proven';

/** Where an earlier report says it belongs: the commit it named, or why it names none. */
export function legacyLink(report: HarnessLegacyReport, commit: string): string {
	if (report.linked === commit) return 'Recorded for this commit';
	if (report.linked) return `Recorded for ${report.linked.slice(0, 7)}`;
	return report.gap ?? 'It names no commit of this repository';
}

/**
 * The files of a report from before Git-backed records, as gallery items. They are shown as
 * what they are: recorded by that report, tied to no build, and never as verification evidence.
 */
export function legacyEvidence(report: HarnessLegacyReport): Evidence[] {
	const recordedFor = report.linked
		? `recorded for ${report.linked.slice(0, 12)}`
		: 'linked to no commit';
	const named = report.linked ? `It named revision ${report.linked}.` : (report.gap ?? '');
	return report.media.map((item, index) => ({
		id: `legacy-${report.id}-${item.id}`,
		title: item.title,
		category: report.title,
		file: (item.media ?? '').replace(/^media\//, ''),
		status: known(item.status),
		capturedAt: item.capturedAt,
		viewport: item.viewport,
		standing: 'Legacy report capture',
		provenance: [
			{ label: 'Standing', value: 'Legacy report capture' },
			{ label: 'Captured from', value: 'not recorded: legacy reports name no build' },
			{ label: 'Recorded by', value: `legacy report ${report.id}, ${recordedFor}` }
		],
		note: [
			`Recorded by legacy report ${report.id} (${report.status}) before records were kept in Git.`,
			named,
			item.gap ?? ''
		]
			.filter(Boolean)
			.join(' '),
		missing: item.media === null,
		mediaType: item.mediaType?.startsWith('audio') ? 'audio' : 'image',
		mimeType: item.mediaType,
		order: index
	}));
}
