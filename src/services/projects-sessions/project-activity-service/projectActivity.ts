import type {
	ActivitySource,
	ActivityRevision
} from '../../../utils/projects-sessions/projectActivity';
import type {
	CommittedFile,
	ProjectActivity,
	WorkItem
} from '../../../core/projects-sessions/activityTypes';
import { loopUsage } from './loopUsage';

/** Reasons that say the same about the same unit are one reason. */
function distinct(reasons: Array<{ unit: string; behavior: string }>) {
	const seen = new Map(reasons.map((item) => [`${item.unit}\n${item.behavior}`, item]));
	return [...seen.keys()].sort().map((key) => {
		const { unit, behavior } = seen.get(key) as { unit: string; behavior: string };
		return { unit, behavior };
	});
}

function work(source: ActivitySource, revision: ActivityRevision): WorkItem {
	const changed = source.changes(revision.commit);
	const reasons = distinct(source.reasons(revision.commit));
	const { commit, subject, author, committedAt, branches } = revision;
	const units = [...new Set(changed.flatMap((change) => source.owners(change.path)))].sort();
	return {
		...{ commit, subject, author, committedAt, branches },
		units: units.slice(0, source.limit.units),
		unitCount: units.length,
		reasons: reasons.slice(0, source.limit.reasons),
		reasonCount: reasons.length,
		files: changed.length
	};
}

/**
 * Each changed path once, at the newest commit that changed it. Within a commit the files a
 * unit owns come first, so that a short list is of source and not of what was written about it.
 */
function files(source: ActivitySource): CommittedFile[] {
	const latest = new Map<string, CommittedFile>();
	for (const { commit, committedAt } of source.revisions) {
		const changed = source
			.changes(commit)
			.map(({ path, status }) => ({ path, status, units: source.owners(path) }));
		const owned = [...changed].sort(
			(left, right) => Number(!left.units.length) - Number(!right.units.length)
		);
		for (const change of owned) {
			if (latest.has(change.path) || latest.size >= source.limit.files) continue;
			latest.set(change.path, { ...change, commit, committedAt });
		}
	}
	return [...latest.values()];
}

/**
 * What a project did, assembled the same way for a history index and for a checkout: its loop
 * types, its newest commits with the units they touched and the reasons noted on them, and
 * each changed file at its latest commit. Only committed work is in it.
 */
export function projectActivity(source: ActivitySource): ProjectActivity {
	const [newest] = source.revisions;
	return {
		schemaVersion: 1,
		kind: source.kind,
		repository: source.repository,
		asOf: newest ? { commit: newest.commit, committedAt: newest.committedAt } : null,
		loops: loopUsage(source.loops),
		work: source.revisions.slice(0, source.limit.work).map((item) => work(source, item)),
		files: files(source)
	};
}
