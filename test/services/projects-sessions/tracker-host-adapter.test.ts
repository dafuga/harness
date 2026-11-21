import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { expect, test, vi } from 'vitest';
import { TrackerAdapterSourceRepository } from '../../../src/repositories/projects-sessions/TrackerAdapterSourceRepository';
import { TrackerNativeRuntimeService } from '../../../src/services/projects-sessions/TrackerNativeRuntimeService';
import { withTempDir } from '../../support/temporary';
import { measureWorkload } from '../../support/measureWorkload';

const now = () => 1_800_000_000_000;
const node = 'daniel-primary-mbp';
const adapterId = 'github:example/widgets';
const signal = new AbortController().signal;

test('polls existing GitHub sources only for the designated owner with the isolated CLI profile', () =>
	measureWorkload('service.projects-sessions-tracker-adapter-poll', 'designated-host-poller', () =>
		withTempDir('hnt-adapter-', proveDesignatedPoll)
	));

async function proveDesignatedPoll(root: string) {
	const executable = join(root, 'github');
	const configDirectory = join(root, 'account');
	const events = join(root, 'github.ndjson');
	mkdirSync(configDirectory, { mode: 0o700 });
	writeFileSync(executable, `#!${process.execPath}\n${githubFixture}`, { mode: 0o700 });
	writeFileSync(events, '');
	const database = new DatabaseSync(':memory:');
	const runtime = new TrackerNativeRuntimeService(database, {
		node,
		role: 'hub',
		now,
		hostEffects: {
			adapter: {
				github: { executable, configDirectory },
				leaseFile: join(root, 'adapter-runner.lock')
			}
		}
	});
	vi.stubEnv('GH_TOKEN', 'synthetic unrelated token');
	try {
		seedSource(database);
		await runtime.adapter!.tick(signal);
		expect(readFileSync(events, 'utf8')).toBe('');
		database.prepare('UPDATE adapter_runner SET node = ?').run(node);
		await runtime.adapter!.tick(signal);
		await runtime.adapter!.tick(signal);
		await verifyPolledSource(runtime, { events, configDirectory });
	} finally {
		vi.unstubAllEnvs();
		database.close();
	}
}

function seedSource(database: DatabaseSync) {
	new TrackerAdapterSourceRepository(database).initialize();
	database.exec("INSERT INTO adapter_runner VALUES (1, 'another-node')");
	const config = {
		type: 'github',
		target: 'example/widgets',
		kind: 'task',
		agent: 'fixture',
		project: 'fixture',
		auto_launch: 'never',
		include_labels: [],
		exclude_labels: [],
		computer: 'auto'
	};
	database
		.prepare('INSERT INTO adapter_sources (id, config, enabled_at, cursor) VALUES (?, ?, ?, ?)')
		.run(adapterId, JSON.stringify(config), now() - 30_000, now() - 20_000);
}

async function verifyPolledSource(
	runtime: TrackerNativeRuntimeService,
	{ events, configDirectory }: { events: string; configDirectory: string }
) {
	expect(
		runtime.store.database.prepare('SELECT cursor,last_run,last_error FROM adapter_sources').get()
	).toEqual({ cursor: now(), last_run: now(), last_error: null });
	const listed = await runtime.items.handle(new Request('http://tracker-fixture.invalid/items'));
	expect(await listed.json()).toMatchObject([{ title: 'example/widgets #17: Fixture issue' }]);
	const requests = readFileSync(events, 'utf8')
		.trim()
		.split('\n')
		.map((line) => JSON.parse(line));
	expect(requests.map(({ argv }) => argv.at(-1))).toEqual([
		expect.stringContaining('repos/example/widgets/issues?state=all'),
		'repos/example/widgets/issues/17/timeline?per_page=100',
		expect.stringContaining('repos/example/widgets/issues/comments?since=')
	]);
	for (const { argv, profile, token } of requests) {
		expect(argv.slice(0, 5)).toEqual(['api', '--hostname', 'github.com', '--method', 'GET']);
		expect(profile).toMatch(/\/account$/);
		expect(profile.endsWith(configDirectory)).toBe(true);
		expect(token).toBe(false);
	}
}

const githubFixture = `
const { appendFileSync } = require('node:fs');
const { dirname, join } = require('node:path');
const argv = process.argv.slice(2);
const query = argv.at(-1);
appendFileSync(join(dirname(process.argv[1]), 'github.ndjson'),
  JSON.stringify({ argv, profile: process.env.GH_CONFIG_DIR, token: Boolean(process.env.GH_TOKEN) }) + '\\n');
if (query.includes('/comments') || query.includes('/timeline')) {
  process.stdout.write('[[]]');
} else {
  process.stdout.write(JSON.stringify([[{
    id: 100, number: 17, title: 'Fixture issue', state: 'open', labels: [],
    created_at: new Date(${now() - 10_000}).toISOString(), updated_at: new Date(${now() - 5_000}).toISOString()
  }]]));
}
`;
