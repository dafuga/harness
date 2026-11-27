import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { TrackerTmuxAdapter } from '../../../src/adapters/projects-sessions/TrackerTmuxAdapter';
import { measureWorkload } from '../../support/measureWorkload';
import { withTempDir } from '../../support/temporary';

test('rechecks the idle pane and sends literal keys only to its unchanged socket identity', () =>
	measureWorkload('adapter.projects-sessions-tracker-tmux', 'pane-identity', () =>
		withTempDir('hnt-tmux-', proveTmuxPaneIdentity)
	));

async function proveTmuxPaneIdentity(root: string) {
	const executable = join(root, 'tmux-fixture');
	const trace = join(root, 'keys.json');
	const layout = join(root, 'layout');
	writeFileSync(executable, `#!${process.execPath}\n${tmuxFixture}`, { mode: 0o700 });
	writeFileSync(layout, 'auto-abc123-r7|1800000000|71|%9|200|1800000000|2|2|0|0|0|0|1|1|codex');
	writeFileSync(
		layout + '-tracker-claude-aqua',
		'auto-def123-r8|1800000000|73|%9|250|1800000000|2|2|0|0|0|0|1|1|claude'
	);
	const tmux = new TrackerTmuxAdapter({ executable, node: 'harbor-mbp-2' });
	const signal = new AbortController().signal;
	const panes = await tmux.scan(signal);
	expect(panes).toHaveLength(2);
	const [pane, aqua] = panes;
	expect(pane).toMatchObject({
		key: 'claude:71:1800000000:200:%9',
		runnerSocket: true,
		ready: true
	});
	expect(aqua).toMatchObject({
		key: 'tracker-claude-aqua:73:1800000000:250:%9',
		runnerSocket: true,
		ready: true
	});
	writeFileSync(layout, readFileSync(layout, 'utf8').replace('|200|', '|201|'));
	expect(await tmux.nudge({ pane, cli: 'codex', message: 'Test check-in' }, signal)).toBe(false);
	const [fresh] = await tmux.scan(signal);
	expect(
		await tmux.nudge({ pane: fresh, cli: 'codex', message: "Don't send; run this" }, signal)
	).toBe(true);
	const keys = JSON.parse(readFileSync(trace, 'utf8'));
	expect(keys.slice(0, 5)).toEqual(['-L', 'claude', 'if-shell', '-F', '-t']);
	expect(keys[5]).toBe('%9');
	expect(keys[6]).toMatch(/201.*%9|%9.*201/);
	expect(keys[7]).toContain("Don'\\''t send; run this");
	expect(keys[7]).toContain('send-keys -t %9 Enter');
	expect(readFileSync(join(root, 'submitted'), 'utf8')).toBe('2');
}

const tmuxFixture = `
const { existsSync, readFileSync, writeFileSync } = require('node:fs');
const { dirname, join } = require('node:path');
const args = process.argv.slice(2);
const dir = dirname(process.argv[1]);
if (args[1] === 'default') {
	process.stderr.write('no server running on fixture');
	process.exit(1);
}
const layout = args[1] === 'claude' ? 'layout' : 'layout-' + args[1];
const raw = readFileSync(join(dir, layout), 'utf8');
const submitted = join(dir, 'submitted');
const keys = join(dir, 'keys.json');
const count = existsSync(submitted) ? Number(readFileSync(submitted, 'utf8')) : 0;
switch (args[2]) {
	case 'list-panes': case 'display-message': process.stdout.write(raw + '\\n'); break;
	case 'capture-pane':
		if (count === 1) process.stdout.write("fixture\\n\\n› Don't send; run this\\n\\n100% context left\\n");
		else if (count === 2) process.stdout.write('fixture\\n\\n• Working (0s · esc to interrupt)\\n');
		else process.stdout.write('fixture\\n\\n› \\n\\n100% context left\\n');
		break;
	case 'if-shell':
		if (count === 0) writeFileSync(keys, JSON.stringify(args));
		writeFileSync(submitted, String(count + 1));
		process.stdout.write('tracker-watchdog-sent\\n');
		break;
	default: process.exit(2);
}
`;
