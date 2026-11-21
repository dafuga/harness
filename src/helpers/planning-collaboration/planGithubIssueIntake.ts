// @harness-uid u_o6i4mwa3wf
import type {
	GithubIssueIntakeEvent,
	GithubIssueIntakeIssue,
	GithubIssueIntakeOptions,
	GithubIssueIntakeRecord,
	GithubIssueIntakeScope,
	GithubIssueIntakeSource,
	GithubIssueStateEvent
} from './planGithubIssueIntake.types';

const TRACKED_LABEL = 'tracked';
const MAX_TITLE_LENGTH = 300;

/** @pure */
function lowerLabelNames(issue: GithubIssueIntakeIssue): string[] {
	return issue.labels.map(({ name }) => name.toLowerCase());
}

/** @pure */
function sanitizeTitle(value: string): string {
	const printable = [...String(value)].map((char) => (isControl(char) ? ' ' : char)).join('');
	return printable.trim().slice(0, MAX_TITLE_LENGTH);
}

/** @pure */
function isControl(char: string): boolean {
	const code = char.charCodeAt(0);
	return code < 0x20 || code === 0x7f;
}

/** @pure */
function stateEventFrom(event: GithubIssueIntakeEvent): GithubIssueStateEvent | null {
	const time = Date.parse(event.created_at);
	if (!event.id || !Number.isFinite(time)) return null;
	if (event.event === 'closed') return { id: `state:${event.id}`, time, state: 'closed' };
	if (event.event === 'reopened') return { id: `state:${event.id}`, time, state: 'open' };
	return null;
}

/**
 * Labels present when the issue was opened. Label events in the opening second
 * count as creation; later label changes are reversed against the snapshot.
 * @pure
 */
export function labelsAtOpening(
	issue: GithubIssueIntakeIssue,
	timeline: readonly GithubIssueIntakeEvent[]
): Set<string> {
	const labels = new Set(lowerLabelNames(issue));
	const created = Date.parse(issue.created_at);
	const snapshot = Date.parse(issue.updated_at);
	for (const event of [...timeline].reverse()) {
		const time = Date.parse(event.created_at);
		if (!event.label?.name || !(time >= created && time <= snapshot)) continue;
		const label = event.label.name.toLowerCase();
		if (time === created) labels.add(label);
		else if (event.event === 'labeled') labels.delete(label);
		if (event.event === 'unlabeled') labels.add(label);
	}
	return labels;
}

/**
 * Decides whether an issue enters intake and whether its timeline must be read.
 * Returns null when the issue is skipped. Label filters apply only to unmapped issues.
 * Configured labels must already be lowercase.
 * @pure
 */
export function scopeGithubIssueIntake(
	source: GithubIssueIntakeSource,
	issue: GithubIssueIntakeIssue,
	options: GithubIssueIntakeOptions = {}
): GithubIssueIntakeScope | null {
	const mapped = options.mapped === true;
	if (!isIntakeIdentity(issue)) return null;
	if (!mapped && !isEnteringIntake(source, issue, options.backfill === true)) return null;
	if (!mapped && !passesLabelFilters(source, lowerLabelNames(issue))) return null;
	const historical = Date.parse(issue.created_at) < source.enabled_at;
	return { historical, needsTimeline: mapped || !historical };
}

/** @pure */
function isIntakeIdentity(issue: GithubIssueIntakeIssue): boolean {
	return (
		!issue.pull_request && Number.isSafeInteger(issue.id) && Number.isSafeInteger(issue.number)
	);
}

/** @pure */
function isEnteringIntake(
	source: GithubIssueIntakeSource,
	issue: GithubIssueIntakeIssue,
	backfill: boolean
): boolean {
	const created = Date.parse(issue.created_at);
	return created >= source.enabled_at || (backfill && issue.state === 'open');
}

/** @pure */
function passesLabelFilters(source: GithubIssueIntakeSource, labels: string[]): boolean {
	const included = source.include_labels.every((label) => labels.includes(label));
	const excluded = source.exclude_labels.some((label) => labels.includes(label));
	return included && !excluded;
}

/**
 * Plans the intake record for one GitHub issue. The caller reads the timeline only
 * when scope.needsTimeline is true; otherwise any timeline passed is ignored.
 * Callers redact titles and other text before storing them.
 * @pure
 */
export function planGithubIssueIntake(
	source: GithubIssueIntakeSource,
	issue: GithubIssueIntakeIssue,
	timeline: readonly GithubIssueIntakeEvent[],
	options: GithubIssueIntakeOptions = {}
): GithubIssueIntakeRecord | null {
	const scope = scopeGithubIssueIntake(source, issue, options);
	if (!scope) return null;
	const events = scope.needsTimeline ? timeline : [];
	const labels = lowerLabelNames(issue);
	const autoLaunch =
		!scope.historical &&
		source.kind === 'task' &&
		source.auto_launch === 'unlabeled' &&
		issue.state === 'open' &&
		!labels.includes(TRACKED_LABEL) &&
		labelsAtOpening(issue, events).size === 0;
	const url = `https://github.com/${source.target}/issues/${issue.number}`;
	return {
		externalId: String(issue.id),
		key: String(issue.number),
		title: `${source.target} #${issue.number}: ${sanitizeTitle(issue.title)}`,
		url,
		state: issue.state,
		historical: scope.historical,
		autoLaunch,
		syncBack: autoLaunch,
		events: events
			.map(stateEventFrom)
			.filter((event): event is GithubIssueStateEvent => event !== null),
		snapshotAt: Date.parse(issue.updated_at)
	};
}
