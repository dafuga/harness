import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../../verificationExpect';
import { trackerNodeNotifications } from '../../../src/services/projects-sessions/tracker-node-service/trackerNodeNotifications';
import type { TrackerNodeConfig } from '../../../src/services/projects-sessions/tracker-node-service/trackerNodeConfig.types';
import { withTempDir } from '../../support/temporary';
import {
	clock,
	fixtureItem,
	minute,
	notificationFixture,
	start,
	wire
} from './tracker-notification/fixture';
import { digestTmuxFixture } from './tracker-notification/digestTmuxFixture';

const targets = (tmux: string) => ({
	claude: { cli: 'claude' as const, session: 'cos', tmux },
	codex: { cli: 'codex' as const, session: 'codex-cos', tmux },
	grok: { url: 'https://grok.invalid/digest' }
});

function compose(webhook: string, tmux = process.execPath, suggestions?: string[]) {
	return trackerNodeNotifications({
		role: 'hub',
		node: 'daniel-primary-mbp',
		notifications: { targets: targets(tmux), webhook, suggestions }
	} as unknown as TrackerNodeConfig)!;
}

test('one webhook setting switches the digest between Claude, webhook and Codex targets', () => {
	expect(compose('claude').webhook?.destination).toEqual({ kind: 'command', id: 'claude' });
	expect(compose('codex').webhook?.destination).toEqual({ kind: 'command', id: 'codex' });
	expect(compose('grok').webhook?.destination).toEqual({ kind: 'http', id: 'grok' });
	expect(compose('grok').webhook?.suggestions?.length).toBeGreaterThan(1);
	expect(compose('grok', undefined, ['one']).webhook?.suggestions).toEqual(['one']);
});

test('session targets are digest-only', () => {
	const base = { role: 'hub', node: 'daniel-primary-mbp' };
	const configured = targets(process.execPath);
	for (const extra of [{ chiefOfStaff: 'claude' }, { itemCallbacks: ['codex'] }])
		expect(() =>
			trackerNodeNotifications({
				...base,
				notifications: { targets: configured, ...extra }
			} as unknown as TrackerNodeConfig)
		).toThrow('digest only');
});

test('a session digest is one safe line sent only to an idle composer', () =>
	withTempDir('hnt-digest-', async (root) => {
		const tmux = join(root, 'tmux-fixture');
		const keys = join(root, 'keys.json');
		const mode = join(root, 'mode');
		writeFileSync(tmux, `#!${process.execPath}\n${digestTmuxFixture}`, { mode: 0o700 });
		const { destinations, webhook } = compose('claude', tmux);
		const request = {
			id: 'fixture-digest-id',
			destination: webhook!.destination,
			body: JSON.stringify({
				text: `DONE: first\nNEEDS DANIEL: se‍cond\u001b ${'x'.repeat(9000)}`,
				suggestion: 'play guitar'
			})
		};
		writeFileSync(mode, 'busy');
		expect(await destinations.send(request)).toMatchObject({ status: 'rejected', busy: true });
		expect(existsSync(keys)).toBe(false);
		writeFileSync(mode, 'idle');
		expect(await destinations.send(request)).toEqual({ status: 'sent' });
		const typed: string = JSON.parse(readFileSync(keys, 'utf8')).at(-1);
		expect(typed).toContain('Tracker digest (automated, not typed by Daniel)');
		expect(typed).toContain('DONE: first | NEEDS DANIEL: se cond');
		expect(typed).toContain('Until the next digest: play guitar');
		expect(typed).toContain('digest shortened');
		expect(typed.length).toBeLessThan(5200);
	}));

function finish(f: ReturnType<typeof notificationFixture>, id: string, seq: number, at: number) {
	f.rows.set(id, fixtureItem(id, { status: 'done' }));
	f.ops.push({
		seq,
		item_id: id,
		hlc: clock(at),
		node: 'fixture-peer',
		actor: null,
		fields: { status: 'done' }
	});
}

test('suggestions rotate per delivered digest and a busy target retries soon', async () => {
	let busy = true;
	const f = notificationFixture({
		send: async () => {
			if (!busy) return { status: 'sent' };
			busy = false;
			return { status: 'rejected', error: 'busy', busy: true };
		}
	});
	f.options.webhook!.suggestions = ['play guitar', 'practice Portuguese'];
	const noon = start - 8 * 60 * minute;
	f.at(noon);
	await f.service.tick();
	finish(f, 'a', 1, noon);
	await f.service.tick();
	f.at(noon + 30 * minute);
	await f.service.tick();
	f.at(noon + 31 * minute);
	await f.service.tick();
	expect(f.calls).toHaveLength(1);
	f.at(noon + 32 * minute);
	await f.restart().tick();
	expect(wire(f.calls[1])).toMatchObject({ suggestion: 'play guitar' });
	finish(f, 'b', 2, noon + 33 * minute);
	await f.restart().tick();
	f.at(noon + 63 * minute);
	await f.restart().tick();
	expect(wire(f.calls[2])).toMatchObject({ suggestion: 'practice Portuguese' });

	// A live node holds only asks overnight; other lines still flow, without a suggestion.
	f.options.quietHours = null;
	const night = start + 180 * minute;
	f.at(night);
	finish(f, 'c', 3, night);
	await f.restart().tick();
	f.at(night + 30 * minute);
	await f.restart().tick();
	expect(wire(f.calls[3]).suggestion).toBeUndefined();
});
