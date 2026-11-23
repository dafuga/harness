// @harness-uid u_nqap4syes6
import { control, shot } from './ios-acceptance-run';
import type { Acceptance } from './ios-acceptance-run';

const show = {
	name: 'tracker_show',
	input: { id: 'testphone1' }
};

function launchTool(refresh: boolean) {
	return `
const plugin = window.Capacitor?.Plugins?.HarnessRemote;
if (!plugin?.trackerTool) return 'no tool';
delete window.harnessTrackerAcceptance;
Promise.resolve(${refresh ? 'plugin.refreshTracker()' : 'undefined'})
	.then(() => plugin.trackerTool(${JSON.stringify(show)}))
	.then((answer) => { window.harnessTrackerAcceptance = answer; })
	.catch(() => { window.harnessTrackerAcceptance = { code: 'toolFailed' }; });
return 'started';`;
}

async function result(run: Acceptance, expected: string, refresh = false) {
	const start = await run.page.evaluate(launchTool(refresh));
	run.record.check(start === 'started', 'the simulator exposes the native Tracker read tool');
	if (start !== 'started') return '';
	// A new invocation after every turn allows the foreground sync to commit independently.
	for (let retry = 0; retry < 12; retry++) {
		const answer = await run.page.until(
			'return JSON.stringify(window.harnessTrackerAcceptance ?? {});',
			'"source"',
			5
		);
		if (answer.includes(expected)) return answer;
		await run.page.evaluate(launchTool(false));
		await new Promise((resolve) => setTimeout(resolve, 250));
	}
	return '';
}

export async function trackerForeground(run: Acceptance): Promise<void> {
	run.record.begin('Tracker replica in native WebKit');
	const initial = await result(run, '"freshness":"current"');
	run.record.check(
		initial.includes('This note was synced'),
		'the paired phone imports notes from the native hub'
	);
	await control(run, '/tracker-finish');
	const finished = await result(run, '"status":"done"', true);
	run.record.check(
		finished.includes('"state":"resolved"'),
		'an explicit delta refresh applies status and flag changes'
	);
}

export async function trackerOffline(run: Acceptance): Promise<void> {
	const saved = await result(run, '"freshness":"stale"');
	run.record.check(
		saved.includes('"status":"done"') && saved.includes('"source":"local_tracker"'),
		'the same Tracker tool reads SQLite after restarting the app while the hub is unreachable'
	);
}

export async function trackerWritePrompt(run: Acceptance): Promise<void> {
	run.record.begin('Tracker write confirmation on iOS');
	await trackerOutboxEmpty(run, 'the separately granted fixture outbox starts empty');
	await run.page.evaluate(`
const plugin = window.Capacitor.Plugins.HarnessRemote;
window.harnessTrackerWrite = 'waiting';
plugin.trackerTool({ name: 'tracker_note', input: { id: 'testphone1', text: 'A simulator note awaiting confirmation' } })
	.then(() => { window.harnessTrackerWrite = 'resolved'; });
return 'requested';`);
	await shot(run, 'tracker-write-confirmation');
	const pending = await run.page.evaluate('return window.harnessTrackerWrite;');
	run.record.check(pending === 'waiting', 'the Tracker write waits for a native confirmation');
}

export async function trackerOutboxEmpty(run: Acceptance, message: string): Promise<void> {
	await run.page.evaluate(`
const plugin = window.Capacitor.Plugins.HarnessRemote;
delete window.harnessTrackerOutbox;
plugin.trackerTool({ name: 'tracker_write_status', input: {} })
	.then((reply) => { window.harnessTrackerOutbox = reply; });
return 'requested';`);
	const result = await run.page.until(
		'return JSON.stringify(window.harnessTrackerOutbox ?? {});',
		'"source"',
		10
	);
	run.record.check(result.includes('"writes":[]'), message);
}
