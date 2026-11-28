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
import type { CanaryRow as Row, CanaryWorld } from './needsYouCanaryWorld.types';

const context = () => ({ now: new Date(), node: 'test-node', candidates: [] });
const view = (row: Row) =>
	({ ...row, needs_daniel: Boolean(row.needs_daniel) }) as unknown as CanaryItem;

/** One item write under the real item rules. */
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

function create(rows: Map<string, Row>, body: Record<string, unknown>) {
	const id = `item${rows.size + 1}`;
	const plan = planTrackerItemMutation(
		{ action: 'add', itemId: id, body } as never,
		context() as never
	);
	const row = { ...(plan.fields as Record<string, unknown>), id, notes: [] } as Row;
	rows.set(id, row);
	return row;
}

/** One CLI command line, parsed and applied. */
function command(rows: Map<string, Row>, args: string[]): CanaryItem {
	const { command: verb, request } = nativeTrackerArgs(args);
	const body = JSON.parse(JSON.stringify(request.body ?? {}));
	if (verb === 'add') return view(create(rows, body));
	const row = rows.get(request.path.split('/')[2] ?? '');
	if (!row) throw new Error('no such item');
	if (verb !== 'show') {
		if (!Object.hasOwn(trackerItemTransitions, verb)) throw new Error(`unknown ${verb}`);
		apply(row, verb, body);
	}
	return view(row);
}

/** Each app's `answered_by`, as needs-you-canary-answer-paths.test.ts reads it from the real code. */
const appWrites: Record<string, string> = { web: 'Daniel via Hub', iphone: 'Daniel' };

/** What a surface's tap sends: an answer by Daniel to the open ask carrying `marker`. */
function tapAsk(rows: Map<string, Row>, marker: string, label: string, by?: string) {
	const row = [...rows.values()].find(
		(entry) => entry.needs_daniel && !entry.resolved && String(entry.question).includes(marker)
	);
	if (!row) return false;
	const options = trackerAskOptions(row.options as string);
	const option = options.findIndex((entry) => entry.label === label) + 1;
	const app = /-(web|mac|iphone)\]/.exec(marker)?.[1] ?? '';
	apply(row, 'answer', { option: String(option), by: by ?? appWrites[app] });
	return true;
}

/**
 * An in-memory Tracker behind the real CLI argument parser and the real item rules, so a command
 * the installed CLI would refuse is refused here too. It has no server, sync or notifications.
 */
export function canaryTracker() {
	const rows = new Map<string, Row>();
	const commands: string[][] = [];
	return {
		rows,
		commands,
		tap: (marker: string, label: string, by?: string) => tapAsk(rows, marker, label, by),
		add: (title: string) => create(rows, { title, later: true }).id,
		tracker: async (args: string[]) => {
			commands.push(args);
			return command(rows, args);
		},
		asked: () => [...rows.values()].filter((row) => String(row.title).startsWith('RELEASE CANARY'))
	};
}

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
