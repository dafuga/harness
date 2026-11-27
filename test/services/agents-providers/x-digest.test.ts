import { readdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import type {
	XDigestOutbox,
	XPost,
	XReadResult
} from '../../../src/core/agents-providers/xDigest.types';
import { XDigestOutboxRepository } from '../../../src/repositories/agents-providers/XDigestOutboxRepository';
import { XDigestStateRepository } from '../../../src/repositories/agents-providers/XDigestStateRepository';
import { XDigestService } from '../../../src/services/agents-providers/XDigestService';
import { formatXDigest } from '../../../src/services/agents-providers/x-digest-service/formatXDigest';
import { XDigestConfigValidator } from '../../../src/validators/agents-providers/XDigestConfigValidator';
import { XDigestSenderConfigValidator } from '../../../src/validators/agents-providers/XDigestSenderConfigValidator';
import { digestConfig, senderConfig } from '../../support/xDigestConfig';
import { createTempDirectory } from '../../support/temporary';

const post = (id: string, likes = 0, text = `post ${id}`): XPost => ({
	id,
	author: `user${id}`,
	name: `User ${id}`,
	text,
	likes,
	reposts: 0,
	replies: 0
});
const read: XReadResult = {
	status: 'ok',
	feeds: {
		mentions: [post('1')],
		following: [post('2', 5), post('3', 50)],
		forYou: [post('3', 50), post('4', 1)]
	}
};

async function harness(result: XReadResult = read) {
	const directory = await createTempDirectory('x-digest-');
	const state = new XDigestStateRepository(join(directory, 'state.json'));
	const outbox = new XDigestOutboxRepository(join(directory, 'out'));
	const queued: XDigestOutbox[] = [];
	const asked: string[] = [];
	const world = { result, attended: false, day: '2026-11-27T08:00:00Z' };
	const service = new XDigestService(new XDigestConfigValidator().parse(digestConfig()), {
		reader: { read: async () => world.result },
		state,
		outbox: {
			write: async (entry) => {
				queued.push(entry);
				await outbox.write(entry);
			}
		},
		ask: async (question) => void asked.push(question),
		attended: () => world.attended,
		now: () => new Date(world.day)
	});
	const cleanup = () => rm(directory, { recursive: true, force: true });
	const text = () =>
		queued.flatMap((entry) => ('messages' in entry ? entry.messages : [])).join('\n');
	return { service, queued, text, asked, world, state, directory, cleanup };
}

test('queues new posts once a day, ranked and without repeats', async () => {
	const run = await harness();
	await expect(run.service.run()).resolves.toEqual({
		status: 'queued',
		counts: { mentions: 1, following: 2, forYou: 1 }
	});
	const text = run.text();
	expect(text).toContain('*X digest · 2026-11-27*');
	expect(text.indexOf('/status/3')).toBeLessThan(text.indexOf('/status/2'));
	expect(text.match(/status\/3\|/gu)).toHaveLength(1);
	await expect(run.service.run()).resolves.toEqual({ status: 'already-queued' });
	run.world.day = '2026-11-28T08:00:00Z';
	await expect(run.service.run()).resolves.toMatchObject({
		counts: { mentions: 0, following: 0, forYou: 0 }
	});
	expect(run.text()).toContain('Nothing new.');
	for (const path of ['state.json', 'out/2026-11-28.json'])
		expect((await stat(join(run.directory, path))).mode & 0o077).toBe(0);
	await run.cleanup();
});

test('a dry run and a watched browser queue and remember nothing', async () => {
	const run = await harness();
	await expect(run.service.run({ dryRun: true })).resolves.toMatchObject({ status: 'dry-run' });
	run.world.attended = true;
	await expect(run.service.run()).resolves.toEqual({ status: 'attended' });
	expect(run.queued).toEqual([]);
	expect(await run.state.load()).toEqual({ version: 1, seen: [] });
	await run.cleanup();
});

test('a sign-in or site check asks Daniel once and tells the sender why', async () => {
	const run = await harness({ status: 'signed-out' });
	await run.service.run();
	await run.service.run();
	expect(run.asked).toHaveLength(1);
	expect(run.asked[0]).toContain('http://viewer.example:6080');
	expect(run.queued[0]).toEqual({ version: 1, day: '2026-11-27', blocked: 'signed-out' });
	run.world.result = { status: 'site-check' };
	await run.service.run();
	expect(run.asked[1]).toContain('verify it is you');
	run.world.result = read;
	await run.service.run();
	expect((await run.state.load()).alerted).toBeUndefined();
	await run.cleanup();
});

test('the outbox keeps only the last week', async () => {
	const run = await harness();
	const outbox = new XDigestOutboxRepository(join(run.directory, 'old'));
	for (let day = 1; day <= 10; day++)
		await outbox.write({
			version: 1,
			day: `2026-11-${String(day).padStart(2, '0')}`,
			blocked: 'signed-out'
		});
	const files = (await readdir(join(run.directory, 'old'))).sort();
	expect(files).toHaveLength(7);
	expect(files[0]).toBe('2026-11-04.json');
	await run.cleanup();
});

test('post text cannot ping, link or format in Slack, and long digests are split', () => {
	const hostile = post('7', 0, '<!channel> <https://evil.example|bank> *bold* & https://t.co/a');
	const [message] = formatXDigest({ mentions: [hostile], following: [], forYou: [] }, 'day');
	expect(message).not.toContain('<!channel>');
	expect(message).not.toContain('<https://evil');
	expect(message).not.toContain('https://t.co');
	expect(message).not.toContain('*bold*');
	expect(message.match(/<https:[^>]+>/gu)).toEqual(['<https://x.com/user7/status/7|open>']);
	const many = Array.from({ length: 30 }, (_, index) => post(String(index), 1, 'w'.repeat(400)));
	const messages = formatXDigest({ mentions: many, following: [], forYou: [] }, 'day');
	expect(messages.length).toBeGreaterThan(1);
	expect(messages.every((part) => part.length <= 4000)).toBe(true);
});

test('configs hold no token, and the sender accepts only a direct message', () => {
	const collector = new XDigestConfigValidator();
	expect(collector.parse(digestConfig()).limits.scan).toBe(60);
	expect(() => collector.parse({ ...digestConfig(), slack: {} })).toThrow('Invalid');
	const sender = new XDigestSenderConfigValidator();
	expect(sender.parse(senderConfig()).slack.channel).toBe('D1');
	const channel = senderConfig();
	channel.slack.channel = 'C123';
	expect(() => sender.parse(channel)).toThrow('slack.channel');
	for (const directory of ['out; rm -rf x', '$(id)', 'a/../../b', '-o/x']) {
		const hostile = senderConfig();
		hostile.source.directory = directory;
		expect(() => sender.parse(hostile)).toThrow('source.directory');
	}
	const option = senderConfig();
	option.source.host = '-oProxyCommand=x';
	expect(() => sender.parse(option)).toThrow('source.host');
});
