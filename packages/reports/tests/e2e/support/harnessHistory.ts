import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fixtures } from './fixtures';

export const home = fixtures.console;

export interface SeededHistory {
	repository: string;
	refs: string;
	/** A source branch that still exists; its name has a slash and a character to encode. */
	keptBranch: string;
	commits: Record<
		| 'unbaselined'
		| 'baseline'
		| 'shout'
		| 'kept'
		| 'paired'
		| 'twin'
		| 'native'
		| 'measured'
		| 'retained'
		| 'grown'
		| 'approved'
		| 'added'
		| 'established'
		| 'removed'
		| 'reordered'
		| 'restated'
		| 'unverified'
		| 'sourceOnly',
		string
	>;
}

interface Capture {
	kind: string;
	sha256: string;
	media: string | null;
}
export interface SeededRevision {
	records: Array<{
		id: string;
		status: string;
		failures: string[];
		scenarios: Array<{
			id: string;
			status: string;
			inherited: boolean;
			origin: { record: string; commit: string };
			states: Array<{ id: string; captures: Capture[] }>;
		}>;
	}>;
}

/** What the seed script recorded about the synthetic history, read fresh for each use. */
export const seeded = (): SeededHistory =>
	JSON.parse(readFileSync(join(home, 'meta.json'), 'utf8')) as SeededHistory;

export const revision = (commit: string): SeededRevision =>
	JSON.parse(
		readFileSync(join(home, 'data/revisions', `${commit}.json`), 'utf8')
	) as SeededRevision;

export const short = (commit: string): string => commit.slice(0, 7);

/** The twelve characters the console shows for a record or a revision in provenance facts. */
export const brief = (id: string): string => id.slice(0, 12);

/** Every ref of the inspected repository; viewing history must leave this unchanged. */
export const currentRefs = (): string =>
	execFileSync('git', ['for-each-ref', '--format=%(refname) %(objectname)'], {
		cwd: seeded().repository,
		encoding: 'utf8'
	}).trim();
