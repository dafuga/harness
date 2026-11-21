import { expect, test } from 'vitest';
import { WatchdogPaneService } from '../../../src/services/projects-sessions/WatchdogPaneService';
import { claude, claudeTrust, codex, codexTrust, host, item, pane, run } from './watchdog-fixtures';

const service = new WatchdogPaneService();

test('idlePrompt accepts the active empty composer in each provider', () => {
	expect(service.idlePrompt(pane())).toBe('codex');
	expect(service.idlePrompt(pane({ screen: claude }))).toBe('claude');
});

test('idlePrompt rejects typed text, busy output, other cursors and unsafe captures', () => {
	const captures = [
		pane({ screen: codex.replaceAll('\u001b[2m', '').replaceAll('\u001b[0m', '') }),
		pane({ screen: codex.replace('Worked for a moment', 'esc to cancel') }),
		pane({ x: 3 }),
		pane({ ready: false }),
		pane({ live: false }),
		pane({ screen: null }),
		pane({ screen: codexTrust, y: 6 })
	];
	expect(captures.map((capture) => service.idlePrompt(capture))).toEqual(captures.map(() => null));
});

test('startupPrompt recognizes the active provider menu and only confirms selected detached trust dialogs', () => {
	expect(service.startupPrompt(pane({ screen: codexTrust, cwd: '/tmp/fixture' }))).toEqual({
		cli: 'codex',
		kind: 'folder trust',
		confirmable: true
	});
	expect(service.startupPrompt(pane({ screen: claudeTrust, cwd: '/tmp/fixture' }))).toEqual({
		cli: 'claude',
		kind: 'folder trust',
		confirmable: true
	});
	const wrongSelection = codexTrust.replace('› 1.', '  1.').replace('  2.', '› 2.');
	for (const capture of [
		pane({ screen: wrongSelection, cwd: '/tmp/fixture' }),
		pane({ screen: codexTrust, cwd: '/tmp/fixture', attached: true }),
		pane({ screen: codexTrust, cwd: '/tmp/fixture', ready: false }),
		pane({ screen: codexTrust })
	])
		expect(service.startupPrompt(capture)?.confirmable).toBe(false);
	expect(service.startupPrompt(pane({ screen: `${codexTrust}\n\n${codex}` }))).toBeNull();
	expect(service.startupPrompt(pane({ screen: codexTrust, readable: false }))).toBeUndefined();
});

test('startupPrompt recognizes alert-only menus and returns only their classification', () => {
	const screens = [
		['Choose how you want to use Codex.\n Press enter to continue', 'codex', 'sign-in'],
		['Select login method:\n Claude account with subscription', 'claude', 'sign-in'],
		[
			'Detected a custom API key in your environment\n synthetic-value\n Do you want to use this API key?\n Enter to confirm · Esc to cancel',
			'claude',
			'API key confirmation'
		],
		[
			'In Bypass Permissions mode, Claude Code will not ask for your approval.\n No, exit\n Yes, I accept',
			'claude',
			'permission mode confirmation'
		],
		['Review hooks\n Trust all and continue\n Continue without trusting', 'codex', 'hook trust'],
		['Settings Error\n Continue without these settings', 'claude', 'settings error']
	];
	for (const [screen, cli, kind] of screens) {
		expect(service.startupPrompt(pane({ screen }))).toEqual({ cli, kind, confirmable: false });
	}
});

test('manualItem resolves exact IDs before prefixes and rejects ambiguity across item states', () => {
	const capture = pane({ name: 'auto-abc123', runnerSocket: false });
	const closed = item({ id: 'abc123zxyz', status: 'done' });
	expect(service.manualItem(capture, [item()])?.id).toBe(item().id);
	expect(service.manualItem(capture, [item(), closed])).toBeUndefined();
	expect(service.manualItem(capture, [item({ id: 'abc123' }), item(), closed])?.id).toBe('abc123');
	expect(service.manualItem(capture, [item(), { ...closed, deleted: true }])?.id).toBe(item().id);
	expect(service.manualItem(pane(), [item()])).toBeUndefined();
});

test('isStopped requires a local handoff and a quiet pane, including legacy nudge activity', () => {
	const capture = pane({ name: 'auto-abc123' });
	const stop = {
		node: host,
		at: capture.activity + 1,
		text: 'stopped: handoff; resume from: current branch'
	};
	expect(service.isStopped(capture, [stop], host, 'codex')).toBe(true);
	expect(service.isStopped(capture, [stop], host, null)).toBe(false);
	expect(service.isStopped(capture, [{ ...stop, node: 'peer' }], host, 'codex')).toBe(false);
	expect(service.isStopped(capture, [{ ...stop, at: capture.createdAt - 1 }], host, 'codex')).toBe(
		false
	);
	const earlier = { ...stop, at: capture.activity - 1 };
	const nudge = {
		node: host,
		at: capture.activity + 999,
		text: `watchdog nudge 1/2 sent to ${capture.name} on ${host}`
	};
	expect(service.isStopped(capture, [earlier, nudge], host, 'codex')).toBe(true);
	expect(service.isStopped({ ...capture, screen: '\n\n\n' }, [earlier, nudge], host, null)).toBe(
		true
	);
	expect(service.isStopped(capture, [earlier, { ...nudge, at: nudge.at + 1 }], host, 'codex')).toBe(
		false
	);
});

test('matchesRun requires the exact live pane name on the runner socket', () => {
	expect(service.matchesRun(pane(), run())).toBe(true);
	for (const capture of [
		pane({ live: false }),
		pane({ runnerSocket: false }),
		pane({ name: 'auto-abc123-r9' })
	]) {
		expect(service.matchesRun(capture, run())).toBe(false);
	}
});
