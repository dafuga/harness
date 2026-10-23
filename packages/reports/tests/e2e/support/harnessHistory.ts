import type { SeededHistory, SeededRevision } from './harnessHistory.types';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fixtures } from './fixtures';

export const home = fixtures.console;

/** What the seed script recorded about the synthetic history, read fresh for each use. */
export const seeded = (): SeededHistory =>
	JSON.parse(readFileSync(join(home, 'meta.json'), 'utf8')) as SeededHistory;

export const revision = <T = SeededRevision>(commit: string): T =>
	JSON.parse(readFileSync(join(home, 'data/revisions', `${commit}.json`), 'utf8')) as T;

export const short = (commit: string): string => commit.slice(0, 7);

/** The twelve characters the console shows for a record or a revision in provenance facts. */
export const brief = (id: string): string => id.slice(0, 12);

/** Every ref of the inspected repository; viewing history must leave this unchanged. */
export const currentRefs = (): string =>
	execFileSync('git', ['for-each-ref', '--format=%(refname) %(objectname)'], {
		cwd: seeded().repository,
		encoding: 'utf8'
	}).trim();

export type { SeededHistory, SeededRevision } from './harnessHistory.types';
