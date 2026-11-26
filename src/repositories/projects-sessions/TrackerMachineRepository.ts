// @harness-uid u_6nfsvjbuup
import type { SqliteDatabase } from '../../core/development-tooling/sqliteTypes';
import type { TrackerResourceSample } from '../../utils/projects-sessions/trackerMachine.types';
import { trackerResourceSample } from './tracker-machine-repository/trackerResourceSample';
import type { TrackerOverloadState } from './TrackerMachineRepository.types';

const minute = 60_000;
const bucket = 5 * minute;
/** Per-minute samples serve the sustained-load and swap-growth checks. */
const recentAge = 30 * minute;
const historyAge = 7 * 24 * 60 * minute;

// These are the tables of the retained Tracker. Samples stay out of the journal.
const schema = `
CREATE TABLE IF NOT EXISTS machines(node TEXT PRIMARY KEY, sample TEXT NOT NULL, sampled_at INTEGER NOT NULL, received_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS machine_recent(node TEXT NOT NULL, at INTEGER NOT NULL, sample TEXT NOT NULL, PRIMARY KEY(node, at));
CREATE TABLE IF NOT EXISTS machine_history(node TEXT NOT NULL, bucket INTEGER NOT NULL, sample TEXT NOT NULL, PRIMARY KEY(node, bucket));
CREATE TABLE IF NOT EXISTS machine_state(node TEXT PRIMARY KEY, over_since INTEGER, calm_since INTEGER, flagged_item TEXT);
`;

/** Resource samples of every computer, kept as local state beside the journal. */
export class TrackerMachineRepository {
	constructor(private readonly database: SqliteDatabase) {
		database.exec(schema);
	}

	record(node: string, sample: TrackerResourceSample, now: number): void {
		const at = Date.parse(sample.at);
		const json = JSON.stringify(sample);
		const latest = this.database.prepare(
			`INSERT INTO machines(node, sample, sampled_at, received_at) VALUES(?, ?, ?, ?)
			ON CONFLICT(node) DO UPDATE SET sample = excluded.sample, sampled_at = excluded.sampled_at,
			received_at = excluded.received_at WHERE excluded.sampled_at >= machines.sampled_at`
		);
		latest.run(node, json, at, now);
		this.database
			.prepare('INSERT OR REPLACE INTO machine_recent(node, at, sample) VALUES(?, ?, ?)')
			.run(node, at, json);
		this.database
			.prepare('INSERT OR REPLACE INTO machine_history(node, bucket, sample) VALUES(?, ?, ?)')
			.run(node, Math.floor(at / bucket), json);
	}

	latest(): Map<string, TrackerResourceSample> {
		const rows = this.database.prepare('SELECT node, sample FROM machines').all() as {
			node: string;
			sample: string;
		}[];
		return new Map(
			rows.flatMap(({ node, sample }) => decode(sample).map((value) => [node, value] as const))
		);
	}

	recent(node: string, now: number): TrackerResourceSample[] {
		const rows = this.database
			.prepare('SELECT sample FROM machine_recent WHERE node = ? AND at >= ? ORDER BY at')
			.all(node, now - recentAge) as { sample: string }[];
		return rows.flatMap(({ sample }) => decode(sample));
	}

	history(node: string, since: number): TrackerResourceSample[] {
		const rows = this.database
			.prepare('SELECT sample FROM machine_history WHERE node = ? AND bucket >= ? ORDER BY bucket')
			.all(node, Math.floor(since / bucket)) as { sample: string }[];
		return rows.flatMap(({ sample }) => decode(sample));
	}

	prune(now: number): void {
		this.database.prepare('DELETE FROM machine_recent WHERE at < ?').run(now - recentAge);
		this.database
			.prepare('DELETE FROM machine_history WHERE bucket < ?')
			.run(Math.floor((now - historyAge) / bucket));
	}

	overloadState(node: string): TrackerOverloadState {
		const row = this.database
			.prepare('SELECT over_since, calm_since, flagged_item FROM machine_state WHERE node = ?')
			.get(node) as TrackerOverloadState | undefined;
		return row ?? { over_since: null, calm_since: null, flagged_item: null };
	}

	saveOverloadState(node: string, state: TrackerOverloadState): void {
		this.database
			.prepare(
				'INSERT OR REPLACE INTO machine_state(node, over_since, calm_since, flagged_item) VALUES(?, ?, ?, ?)'
			)
			.run(node, state.over_since, state.calm_since, state.flagged_item);
	}
}

/** Rows written by an earlier release that no longer match are skipped. */
function decode(json: string): TrackerResourceSample[] {
	const parsed = trackerResourceSample.safeParse(JSON.parse(json));
	return parsed.success ? [parsed.data] : [];
}
