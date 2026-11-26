import { nativeTrackerArgs } from '../../src/commands/projects-sessions/tracker-command/nativeTrackerRequest';
import {
	planTrackerItemMutation,
	type TrackerItemSnapshot
} from '../../src/utils/projects-sessions/planTrackerItemMutation';
import { trackerAskOptions } from '../../src/utils/projects-sessions/trackerAskOptions';
import { trackerItemTransitions } from '../../src/utils/projects-sessions/trackerItemTransitions';
import type {
	CanaryItem,
	CanaryOptions,
	CanaryWeb
} from '../../scripts/needs-you-canary/canary.types';

type Row = Record<string, unknown> & { id: string; notes: string[] };

/**
 * An in-memory Tracker behind the real CLI argument parser and the real item rules, so a command
 * the installed CLI would refuse is refused here too. It has no server, sync or notifications.
 */
export function canaryTracker() {
	const rows = new Map<string, Row>();
	const commands: string[][] = [];
	let created = 0;
	const context = () => ({ now: new Date(), node: 'test-node', candidates: [] });
	function apply(row: Row, action: string, body: Record<string, unknown>) {
		const plan = planTrackerItemMutation(
			{ action, item: row as unknown as TrackerItemSnapshot, body } as never,
			context() as never
		);
		const fields = { ...(plan.fields as Record<string, unknown>) };
		if (fields['note+']) row.notes.push(String(fields['note+']));
		delete fields['note+'];
		Object.assign(row, fields);
	}
	function add(body: Record<string, unknown>) {
		const id = `item${++created}`;
		const plan = planTrackerItemMutation(
			{ action: 'add', itemId: id, body } as never,
			context() as never
		);
		const row = { ...(plan.fields as Record<string, unknown>), id, notes: [] } as Row;
		rows.set(id, row);
		return row;
	}
	function run(args: string[]): CanaryItem {
		commands.push(args);
		const { command, request } = nativeTrackerArgs(args);
		const body = JSON.parse(JSON.stringify(request.body ?? {}));
		if (command === 'add') return view(add(body));
		const row = rows.get(request.path.split('/')[2]!);
		if (!row) throw new Error('no such item');
		if (command !== 'show') {
			if (!Object.hasOwn(trackerItemTransitions, command)) throw new Error(`unknown ${command}`);
			apply(row, command, body);
		}
		return view(row);
	}
	const view = (row: Row) =>
		({ ...row, needs_daniel: Boolean(row.needs_daniel) }) as unknown as CanaryItem;
	/** What a surface's tap sends: an answer by Daniel to the ask carrying `marker`. */
	function tap(marker: string, label: string, by?: string) {
		const row = [...rows.values()].find(
			(entry) => entry.needs_daniel && !entry.resolved && String(entry.question).includes(marker)
		);
		if (!row) return false;
		const options = trackerAskOptions(row.options as string);
		const option = options.findIndex((entry) => entry.label === label) + 1;
		apply(row, 'answer', { option: String(option), by });
		return true;
	}
	return {
		rows,
		commands,
		tap,
		add: (title: string) => add({ title, later: true }).id,
		tracker: async (args: string[]) => run(args),
		asked: () => [...rows.values()].filter((row) => String(row.title).startsWith('RELEASE CANARY'))
	};
}

export type CanaryWorld = ReturnType<typeof canaryTracker>;

/** Production Hub as the canary sees it. `rowButtons: false` is the Hub before kthwzz. */
export function canaryHub(
	world: CanaryWorld,
	behaviour: { signedIn?: boolean; rowButtons?: boolean; delivers?: boolean } = {}
) {
	const { signedIn = true, rowButtons = true, delivers = true } = behaviour;
	const state = { closed: false };
	const ask = (marker: string) =>
		world.asked().find((row) => String(row.question).includes(marker) && row.needs_daniel);
	const web: CanaryWeb = {
		signedIn: async () => signedIn,
		row: async (marker) => {
			const row = ask(marker);
			if (!row) return null;
			if (!rowButtons) return [];
			return trackerAskOptions(row.options as string).map((option) => option.label);
		},
		press: async (marker, label) => (delivers ? world.tap(marker, label) : true),
		reload: async () => {},
		close: async () => void (state.closed = true)
	};
	return { web, state };
}

/** Options with a clock that only moves when the canary waits, and a hand that taps on `mac`. */
export function canaryOptions(
	world: CanaryWorld,
	overrides: Partial<CanaryOptions> & { release: string },
	hand?: (question: string) => void
): CanaryOptions {
	let time = Date.parse('2026-11-26T18:00:00Z');
	let nonce = 0;
	return {
		taps: new Set(),
		tracker: world.tracker,
		web: async () => canaryHub(world).web,
		clock: {
			now: () => time,
			wait: async (ms) => {
				time += ms;
				for (const row of world.asked())
					if (row.needs_daniel && !row.resolved) hand?.(String(row.question));
			}
		},
		nonce: () => `n${++nonce}x`,
		pick: () => 1,
		log: () => {},
		...overrides
	};
}
