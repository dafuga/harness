import { resolve } from 'node:path';
import { GitAdapter } from '../adapters/GitAdapter';
import { fail } from '../core/errors';
import {
	HistoryIndexService,
	type BuiltHistory
} from '../services/history-index-service/HistoryIndexService';
import { LegacyHistoryService } from '../services/LegacyHistoryService';

export interface BuildOptions {
	root?: string;
	/** Output directory for the index, the revision details and the media. */
	out?: string;
	/** Newest commits to include; older ones are left out and the index says so. */
	limit?: string;
}

/** Builds the portable history index from the Git refs of this repository. */
export async function buildHistory(options: BuildOptions = {}): Promise<BuiltHistory> {
	const root = resolve(options.root ?? process.cwd());
	if (!(await new GitAdapter(root).isRepository())) {
		return fail('harness history needs a Git repository.');
	}
	if (!options.out) return fail('--out must name the directory to build the history into.');
	const limit = Number(options.limit ?? 2000);
	if (!Number.isInteger(limit) || limit < 1)
		return fail('--limit must be a positive whole number.');
	const out = resolve(root, options.out);
	const legacy = new LegacyHistoryService(root);
	return new HistoryIndexService(root).build(out, limit, (media) => legacy.entries(media));
}

export function renderBuild(built: BuiltHistory): string {
	const { revisions } = built.index;
	const count = (coverage: string) => revisions.filter((item) => item.coverage === coverage).length;
	return [
		`History index written to ${built.out} (${built.digest.slice(0, 12)}).`,
		`${revisions.length} commits: ${count('verified')} verified, ${count('failed')} failed, ${count('invalid')} invalid, ${count('unverified')} without evidence.`,
		`Media: ${built.media.resolved} resolved, ${built.media.missing} missing.`,
		...built.problems.map((problem) => `  ${problem}`)
	].join('\n');
}
