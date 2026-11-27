import { rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import type { PlatformSendResult } from '../../../src/core/agents-providers/platformAdapter.types';
import { XDigestSendStateRepository } from '../../../src/repositories/agents-providers/XDigestSendStateRepository';
import { XDigestSendService } from '../../../src/services/agents-providers/XDigestSendService';
import { createTempDirectory } from '../../support/temporary';

const day = '2026-11-27';
const file = (extra: object = { messages: ['one', 'two'] }) =>
	JSON.stringify({ version: 1, day, ...extra });

async function harness(sends: PlatformSendResult['status'][] = []) {
	const directory = await createTempDirectory('x-send-');
	const state = new XDigestSendStateRepository(join(directory, 'send.json'));
	const world: { file?: string } = { file: file() };
	const sent: string[] = [];
	const asked: string[] = [];
	const service = new XDigestSendService({
		fetch: async () => world.file,
		state,
		send: async (text) => {
			const status = sends.shift() ?? 'sent';
			const base = { requestId: 'r', auditRecorded: true };
			if (status !== 'sent') return { ...base, status, code: 'provider-refused' };
			sent.push(text);
			return { ...base, status, receipt: { channelId: 'D1', messageId: '1.000001' } };
		},
		ask: async (question) => void asked.push(question),
		now: () => new Date(`${day}T08:05:00Z`)
	});
	const cleanup = () => rm(directory, { recursive: true, force: true });
	return { service, world, sent, asked, directory, cleanup };
}

test('posts the day once', async () => {
	const run = await harness();
	await expect(run.service.run()).resolves.toEqual({ status: 'sent', messages: 2 });
	await expect(run.service.run()).resolves.toEqual({ status: 'already-sent' });
	expect(run.sent).toEqual(['one', 'two']);
	expect((await stat(join(run.directory, 'send.json'))).mode & 0o077).toBe(0);
	await run.cleanup();
});

test('waits for a missing, stale or malformed file and reports a blocked day', async () => {
	const run = await harness();
	for (const text of [
		undefined,
		'not json',
		file().replace(day, '2026-11-26'),
		file({ messages: ['x'.repeat(4001)] }),
		file({ messages: ['x'], channel: 'COTHER' })
	]) {
		run.world.file = text;
		await expect(run.service.run()).resolves.toEqual({ status: 'waiting' });
	}
	run.world.file = file({ blocked: 'signed-out' });
	await expect(run.service.run()).resolves.toEqual({ status: 'blocked', detail: 'signed-out' });
	expect(run.sent).toEqual([]);
	expect(run.asked).toEqual([]);
	await run.cleanup();
});

test('a refused message resumes where it stopped', async () => {
	const run = await harness(['sent', 'refused']);
	await expect(run.service.run()).resolves.toMatchObject({ status: 'send-failed' });
	await expect(run.service.run()).resolves.toMatchObject({ status: 'sent' });
	expect(run.sent).toEqual(['one', 'two']);
	expect(run.asked[0]).toContain('can be retried');
	await run.cleanup();
});

test('an unknown delivery closes the day so nothing is posted twice', async () => {
	const run = await harness(['unknown']);
	await run.service.run();
	await expect(run.service.run()).resolves.toEqual({ status: 'already-sent' });
	expect(run.sent).toEqual([]);
	expect(run.asked[0]).toContain('not re-sent');
	await run.cleanup();
});
