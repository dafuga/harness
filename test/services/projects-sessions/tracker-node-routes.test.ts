import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../../verificationExpect';
import { loadTrackerNodeConfig } from '../../../src/services/projects-sessions/tracker-node-service/trackerNodeConfig';
import { trackerNodeNotifications } from '../../../src/services/projects-sessions/tracker-node-service/trackerNodeNotifications';
import type { TrackerNodeConfig } from '../../../src/services/projects-sessions/tracker-node-service/trackerNodeConfig.types';
import { withTempDir } from '../../support/temporary';

const targets = {
	cos: { url: 'https://cos.invalid/hook' },
	coder: { url: 'https://coder.invalid/hook' }
};

function compose(notifications: Record<string, unknown>, role = 'hub') {
	return trackerNodeNotifications({
		role,
		node: 'daniel-primary-mbp',
		notifications: { targets, ...notifications }
	} as unknown as TrackerNodeConfig);
}

test('bot routes and per-event unrouted rules reach the webhook', () => {
	const options = compose({
		webhook: 'cos',
		routes: { coder: { target: 'coder', aliases: ['codex'] } },
		unrouted: { recurring_due: 'cos', changed: 'drop' }
	});
	expect(options?.webhook?.routes).toEqual({
		coder: { destination: { kind: 'http', id: 'coder' }, aliases: ['codex'] }
	});
	expect(options?.webhook?.unrouted).toEqual({ recurring_due: 'cos', changed: 'drop' });
});

test('without routes or unrouted rules the webhook keeps its defaults', () => {
	const webhook = compose({ webhook: 'cos' })?.webhook;
	expect(webhook?.routes).toBeUndefined();
	expect(webhook?.unrouted).toBeUndefined();
	expect(webhook?.suggestions?.length).toBeGreaterThan(1);
});

test('routes and unrouted rules need a webhook', () => {
	expect(() => compose({ routes: { coder: { target: 'coder' } } })).toThrow(
		'bot routes require a webhook'
	);
	expect(() => compose({ unrouted: { done: 'drop' } })).toThrow('bot routes require a webhook');
});

test('a route must name a configured target', () => {
	expect(() => compose({ webhook: 'cos', routes: { coder: { target: 'missing' } } })).toThrow(
		'Unknown Tracker notification binding'
	);
});

test('the loader accepts routes and rejects unknown unrouted events', () =>
	withTempDir('hnt-routes-', (root) => {
		const write = (name: string, notifications: unknown) => {
			const path = join(root, `${name}.json`);
			writeFileSync(
				path,
				JSON.stringify({
					version: 1,
					node: 'daniel-primary-mbp',
					role: 'hub',
					database: join(root, 'tracker.db'),
					apiPort: 7701,
					syncPort: 7702,
					legacyFenceFile: join(root, 'fence.json'),
					syncSecretFile: join(root, 'secret'),
					notifications
				}),
				{ mode: 0o600 }
			);
			return path;
		};
		const valid = write('valid', {
			targets,
			webhook: 'cos',
			routes: { coder: { target: 'coder', aliases: ['codex'] } },
			unrouted: { recurring_due: 'cos' }
		});
		expect(loadTrackerNodeConfig(valid).notifications?.routes?.coder?.target).toBe('coder');
		const unknownEvent = write('unknown-event', {
			targets,
			webhook: 'cos',
			unrouted: { nightly: 'cos' }
		});
		expect(() => loadTrackerNodeConfig(unknownEvent)).toThrow();
		const unknownAction = write('unknown-action', {
			targets,
			webhook: 'cos',
			unrouted: { due: 'queue' }
		});
		expect(() => loadTrackerNodeConfig(unknownAction)).toThrow();
	}));
