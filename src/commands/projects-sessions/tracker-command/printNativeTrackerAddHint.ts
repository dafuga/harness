// @harness-uid u_r7qgepnoax
import type {
	NativeTrackerItem,
	NativeTrackerListener,
	NativeTrackerPick
} from './nativeTrackerCli.types';

const creationCommands = new Set(['add', 'plan', 'goal']);

/** After a task is added, name the model it would get and how to launch it. Best effort. */
export async function printNativeTrackerAddHint(
	command: string,
	item: NativeTrackerItem,
	config: NativeTrackerListener
): Promise<void> {
	if (!creationCommands.has(command)) return;
	if (item.kind !== 'task') return;
	const pick = await readPick(item.id, config);
	if (!pick) return;
	const effort = pick.effort ? ` ${pick.effort}` : '';
	const why = pick.pinned ? 'named on the item' : pick.reason;
	console.log(`  model: ${pick.rung} (${pick.model}${effort}) - ${why}`);
	console.log(
		item.auto
			? '  auto-launch is on: the tracker will start it on the right computer'
			: `  to have the tracker run it on the right computer: tracker launch ${item.id.slice(0, 6)}`
	);
}

async function readPick(
	id: string,
	{ apiPort, node, role }: NativeTrackerListener
): Promise<NativeTrackerPick | undefined> {
	const url = `http://127.0.0.1:${apiPort}/native/v1/items/${encodeURIComponent(id)}/pick`;
	try {
		const response = await fetch(url, {
			headers: { 'x-harness-tracker-node': node, 'x-harness-tracker-role': role },
			redirect: 'error',
			signal: AbortSignal.timeout(5000)
		});
		return response.ok ? ((await response.json()) as NativeTrackerPick) : undefined;
	} catch {
		return undefined;
	}
}
