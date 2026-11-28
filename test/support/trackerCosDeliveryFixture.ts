import { expect, vi } from 'vitest';
import { withTempDir } from './temporary';
import { claudePaneFixture } from './claudePaneFixture';
import { trackerCosRound } from '../../src/services/projects-sessions/tracker-native-runtime-service/trackerCosRound';
import { trackerWatchdogPort } from '../../src/services/projects-sessions/tracker-native-runtime-service/trackerWatchdogPort';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { TrackerItemReadRepository } from '../../src/repositories/projects-sessions/TrackerItemReadRepository';
import { TrackerPersistenceService } from '../../src/services/projects-sessions/TrackerPersistenceService';
import { watchCosDelivery } from '../../src/services/projects-sessions/tracker-native-runtime-service/trackerCosDelivery';
import type { TrackerWatchdogAlert } from '../../src/services/projects-sessions/tracker-native-runtime-service/trackerHostWatchdog.types';

export const minute = 60_000;
export const hour = 60 * minute;
/** Noon in Lisbon, inside the 08:00 to 22:00 send window. */
export const noon = Date.UTC(2026, 10, 26, 12);

export function alert(kind: string, at: number): TrackerWatchdogAlert {
	return {
		id: `fixture:worker0001:${kind}:${at}`,
		item_id: 'worker0001',
		host: 'fixture-hub',
		kind,
		reason: `Synthetic ${kind} alert.`,
		identity: `${kind}:${at}`,
		at
	};
}

/** Nov 27 primary Mac queue, in recorded order. Item IDs and message text are replaced. */
export function recordedDependencyQueue(): TrackerWatchdogAlert[] {
	const lengths = [259, 204, 261, 222, 252, 244, 592, 325];
	const times = [1311, 3632, 6040, 6673, 9927, 13050, 15454, 15699];
	return lengths.map((length, index) => {
		const at = 1795783170000 + times[index];
		const item_id = `recorded0${index}`;
		const reason = 'CoS: credential/access dependency. '.padEnd(length, 'x');
		return {
			...alert('cos-message', at),
			id: `primary:${item_id}:cos-message:${at}`,
			item_id,
			reason,
			identity: reason
		};
	});
}

export async function cosDeliveryFixture(
	prove: (ports: {
		store: TrackerPersistenceService;
		items: TrackerItemReadRepository;
	}) => void | Promise<void>,
	node = 'fixture-hub'
) {
	const database = new DatabaseSync(':memory:');
	const store = new TrackerPersistenceService(database, node, { now: () => noon });
	const items = new TrackerItemReadRepository(database);
	try {
		await prove({ store, items });
	} finally {
		database.close();
	}
}

export function round(
	store: TrackerPersistenceService,
	pending: readonly TrackerWatchdogAlert[],
	now: number
) {
	watchCosDelivery(store, pending, now);
}

/** The open decisions Daniel's apps list under "needs you". */
export function alarmAsks(items: TrackerItemReadRepository, now: number) {
	return items.digest(now).daniel_decisions;
}

/** A pane driver that fails every request, as a host with no working tmux would. */
export function brokenDriver(root: string) {
	const executable = join(root, 'broken-driver');
	writeFileSync(executable, `#!${process.execPath}\nprocess.exit(1);\n`, { mode: 0o700 });
	return executable;
}

export function writeAcceptedPrompts(
	root: string,
	rows: { line: string; reference: string }[],
	timestamp: string
) {
	const heading = 'Tracker watchdog alerts for Chief of Staff. Review these items. ';
	const legacy = rows
		.slice(0, 4)
		.map(({ line }) => line)
		.join(' | ');
	const queued = rows.slice(4);
	const refs = queued.map(({ reference }) => reference).join(',');
	const directory = join(root, '-fixture-cos');
	mkdirSync(directory);
	const file = join(directory, '11111111-1111-4111-a111-111111111111.jsonl');
	const flag = 'NEW FLAG TRIAGE (automated, flag-triage.py, not typed by Daniel): fixture';
	const prompts = [
		{
			type: 'user',
			timestamp,
			message: {
				role: 'user',
				content: `<pasted_content id="recorded">\n${heading}${legacy}\n</pasted_content>${flag}`
			}
		},
		{
			type: 'queue-operation',
			operation: 'enqueue',
			timestamp,
			content: `${heading}Watchdog receipts: ${refs} || ${queued.map(({ line }) => line).join(' | ')}`
		}
	];
	writeFileSync(file, prompts.map((prompt) => JSON.stringify(prompt)).join('\n') + '\n');
}

export function readCosPrompts(root: string): string[] {
	return readFileSync(join(root, 'commands'), 'utf8')
		.trim()
		.split('\n')
		.map((line) => JSON.parse(line).text)
		.filter((text): text is string => typeof text === 'string');
}

export function proveLiveTurnDelivery() {
	return cosDeliveryFixture(({ store, items }) =>
		withTempDir('hnt-cos-live-turn-', async (root) => {
			const executable = join(root, 'tmux-fixture');
			writeFileSync(executable, `#!${process.execPath}\n${claudePaneFixture}`, { mode: 0o700 });
			const mode = (value: string) => writeFileSync(join(root, 'mode'), value);
			const started = performance.now();
			let clock = noon;
			const date = vi
				.spyOn(Date, 'now')
				.mockImplementation(() => clock + performance.now() - started);
			const driver = trackerWatchdogPort(
				{ tmux: executable, chiefOfStaff: true },
				'daniel-primary-mbp'
			);
			let queue = [alert('alert', clock - 16 * minute)];
			const watchdog = trackerCosRound(
				store,
				{ ...driver, peers: undefined },
				{ now: () => clock, local: () => queue }
			);
			const tick = () => watchdog.run(AbortSignal.timeout(18_000), false);
			try {
				mode('busy');
				await tick();
				expect(alarmAsks(items, clock), 'a live mid-turn CoS is not a delivery outage').toEqual([]);
				await nextTick('idle');
				expect(readCosPrompts(root)).toHaveLength(1);

				await nextTick('busy', 'alert');
				await nextTick('idle');
				expect(readCosPrompts(root), 'idle retry bypasses the routine cadence').toHaveLength(2);

				await nextTick('busy', 'idle');
				clock += 29 * minute;
				await tick();
				expect(alarmAsks(items, clock)).toEqual([]);
				clock += minute;
				await tick();
				const [alarm] = alarmAsks(items, clock);
				expect(alarm).toBeDefined();
				await nextTick('idle');
				expect(readCosPrompts(root)).toHaveLength(3);
				expect(alarmAsks(items, clock)).toEqual([]);
				expect(items.getStored(alarm.id)).toMatchObject({ status: 'done', needs_daniel: false });
			} finally {
				date.mockRestore();
			}

			async function nextTick(state: 'busy' | 'idle', kind?: string) {
				clock += minute;
				if (kind) queue = [alert(kind, clock)];
				mode(state);
				await tick();
			}
		})
	);
}
