import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../../verificationExpect';
import { loadTrackerNodeConfig } from '../../../src/services/projects-sessions/tracker-node-service/trackerNodeConfig';
import { trackerNodeNotifications } from '../../../src/services/projects-sessions/tracker-node-service/trackerNodeNotifications';
import type { TrackerNodeConfig } from '../../../src/services/projects-sessions/tracker-node-service/trackerNodeConfig.types';
import { withTempDir } from '../../support/temporary';

/** A fixed script: records its argv count, its delivery id and its stdin, then exits with `code`. */
function script(root: string, code: number) {
	const path = join(root, `callback-${code}.sh`);
	writeFileSync(
		path,
		[
			'#!/bin/sh',
			`printf '%s' "$#" > "${root}/argc"`,
			`printf '%s' "$TRACKER_DELIVERY_ID" > "${root}/delivery-id"`,
			`cat > "${root}/stdin"`,
			`exit ${code}`,
			''
		].join('\n'),
		{ mode: 0o700 }
	);
	chmodSync(path, 0o700);
	return path;
}

function compose(root: string, notifications: Record<string, unknown>) {
	return trackerNodeNotifications({
		role: 'hub',
		node: 'daniel-primary-mbp',
		notifications: {
			targets: { cos: { url: 'https://cos.invalid/hook' } },
			...notifications
		}
	} as unknown as TrackerNodeConfig);
}

test('a legacy callback command name binds to a fixed script target', () =>
	withTempDir('hnt-cmd-', (root) => {
		const options = compose(root, {
			targets: { cos: { url: 'https://cos.invalid/hook' }, record: { script: script(root, 0) } },
			commandCallbacks: { 'record-fixture': 'record' }
		});
		expect(options?.legacyDestinations?.commands?.get('record-fixture')).toBe('record');
		expect(options?.legacyDestinations?.commands?.get('rm -rf /')).toBeUndefined();
	}));

test('a command callback must name a script target, not an HTTP or tmux target', () =>
	withTempDir('hnt-cmd-kind-', (root) => {
		expect(() =>
			compose(root, {
				targets: { cos: { url: 'https://cos.invalid/hook' } },
				commandCallbacks: { 'record-fixture': 'cos' }
			})
		).toThrow('command callback requires a script target');
		expect(() =>
			compose(root, {
				targets: { cos: { url: 'https://cos.invalid/hook' } },
				commandCallbacks: { 'record-fixture': 'missing' }
			})
		).toThrow('Unknown Tracker notification binding');
	}));

test('a script target must exist and be executable when the node starts', () =>
	withTempDir('hnt-cmd-missing-', (root) => {
		expect(() =>
			compose(root, { targets: { record: { script: join(root, 'absent.sh') } } })
		).toThrow();
	}));

test('delivery runs the fixed script with no arguments and the body on stdin', () =>
	withTempDir('hnt-cmd-send-', async (root) => {
		const options = compose(root, {
			targets: { record: { script: script(root, 0) } },
			commandCallbacks: { 'record-fixture': 'record' }
		});
		const result = await options?.destinations?.send({
			id: 'delivery-1',
			destination: { kind: 'command', id: 'record' },
			body: '{"item":"egzf4m52pt"}'
		} as never);
		expect(result).toEqual({ status: 'sent' });
		expect(readFileSync(join(root, 'argc'), 'utf8')).toBe('0');
		expect(readFileSync(join(root, 'delivery-id'), 'utf8')).toBe('delivery-1');
		expect(readFileSync(join(root, 'stdin'), 'utf8')).toBe('{"item":"egzf4m52pt"}');
	}));

test('a non-zero exit is a transport failure, so the delivery retries', () =>
	withTempDir('hnt-cmd-fail-', async (root) => {
		const options = compose(root, {
			targets: { record: { script: script(root, 3) } }
		});
		await expect(
			options?.destinations?.send({
				id: 'delivery-2',
				destination: { kind: 'command', id: 'record' },
				body: '{}'
			} as never)
		).rejects.toThrow('Tracker notification receipt is uncertain');
	}));

test('the loader accepts a script target and rejects a relative script path', () =>
	withTempDir('hnt-cmd-loader-', (root) => {
		const write = (name: string, targets: unknown, commandCallbacks: unknown) => {
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
					notifications: { targets, commandCallbacks, webhook: undefined }
				}),
				{ mode: 0o600 }
			);
			return path;
		};
		const valid = write(
			'valid',
			{ record: { script: script(root, 0) } },
			{ 'record-fixture': 'record' }
		);
		expect(loadTrackerNodeConfig(valid).notifications?.commandCallbacks?.['record-fixture']).toBe(
			'record'
		);
		const relative = write('relative', { record: { script: 'scripts/record.sh' } }, undefined);
		expect(() => loadTrackerNodeConfig(relative)).toThrow();
	}));
