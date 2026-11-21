import { recordCapture } from '../../../src/utils/reports-media/record-capture/recordCapture';
import type {
	WatchdogItem,
	WatchdogPane,
	WatchdogRun
} from '../../../src/services/projects-sessions/WatchdogPaneService.types';

export const host = 'fixture-mac';
export const now = 3_600_000;
export const minute = 60_000;
export const codex =
	'Worked for a moment\n\n› \u001b[2mAsk a question\u001b[0m\n\n model · ~/fixture\n ? for shortcuts';
export const claude = 'Done\n──────────────\n❯ \n──────────────\n ? for shortcuts';
export const codexTrust =
	'Folder access\n\n/tmp/fixture\n\nTrust this folder?\n\n› 1. Trust and continue\n  2. Back to Agent Command Center\n\n enter continue · esc back';
export const claudeTrust =
	'Accessing workspace:\n\n/tmp/fixture\n\nQuick safety check: Is this a project you trust?\n\n❯ No, exit\n  Yes, I trust this folder\n\n Enter to confirm · Esc to cancel';

export function item(overrides: Partial<WatchdogItem> = {}): WatchdogItem {
	return { id: 'abc123fghj', title: 'Fixture task', status: 'in_progress', ...overrides };
}

export function pane(overrides: Partial<WatchdogPane> = {}): WatchdogPane {
	const name = overrides.name ?? 'auto-abc123-r4';
	return {
		name,
		key: `socket:fixture:${name}`,
		activity: now - 11 * minute,
		createdAt: now - 30 * minute,
		live: true,
		runnerSocket: true,
		readable: true,
		ready: true,
		attached: false,
		currentCommand: 'codex',
		x: 2,
		y: 2,
		screen: codex,
		...overrides
	};
}

export function run(overrides: Partial<WatchdogRun> = {}): WatchdogRun {
	return {
		id: 4,
		itemId: item().id,
		state: 'running',
		tmux: pane().name,
		cli: 'codex',
		startedAt: now - 30 * minute,
		...overrides
	};
}

export function clock(at: number, tick = 0): string {
	return `${String(at).padStart(15, '0')}-${String(tick).padStart(6, '0')}-fixture`;
}

export function recordWatchdogOutcome(state: string, output: unknown): void {
	recordCapture(
		{
			evidence: 'watchdog-decision',
			kind: 'output',
			state,
			file: `watchdog-${state}.json`,
			mediaType: 'application/json'
		},
		JSON.stringify(output)
	);
}
