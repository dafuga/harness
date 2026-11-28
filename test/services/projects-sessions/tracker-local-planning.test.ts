import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { nativeTrackerArgs } from '../../../src/commands/projects-sessions/tracker-command/nativeTrackerRequest';
import { DatabaseSync } from 'node:sqlite';
import { expect, onTestFinished, test } from 'vitest';
import { TrackerItemReadRepository } from '../../../src/repositories/projects-sessions/TrackerItemReadRepository';
import { TrackerLocalApiService } from '../../../src/services/projects-sessions/TrackerLocalApiService';
import { TrackerPersistenceService } from '../../../src/services/projects-sessions/TrackerPersistenceService';
import { createTempDirectory } from '../../support/temporary';

test('projects and journals stage artifacts and sequential promotions', async () => {
	const { id, item, request, stage, artifact, store } = planningFixture();
	expect(await (await request(item)).json()).toMatchObject({ stage: 'idea' });
	expect((await stage('design')).status).toBe(409);
	expect((await stage('unknown')).status).toBe(400);
	expect(
		(await artifact({ links: [{ label: 'Unsafe', url: 'javascript:alert(1)' }] })).status
	).toBe(400);
	const detail = {
		summary: 'Design the project list and item detail.',
		pages: [
			{
				name: 'Projects',
				states: { empty: 'Show an empty list' },
				links: [{ kind: 'image', label: 'Design', url: 'https://example.test/design.png' }]
			}
		]
	};
	expect((await artifact(detail)).status).toBe(200);
	expect(await (await stage('detail')).json()).toMatchObject({
		stage: 'detail',
		planning: {
			artifacts: { detail },
			promotions: [{ stage: 'detail', by: 'fixture-actor', at: '2026-11-21T12:00:00.000Z' }]
		}
	});
	const seq = store.maxSeq();
	expect((await stage('detail')).status).toBe(200);
	expect((await stage('idea')).status).toBe(409);
	expect(store.maxSeq()).toBe(seq);
	expect((await stage('design')).status).toBe(200);
	expect((await stage('build')).status).toBe(200);
	expect(await (await request('/items?stage=build&limit=1')).json()).toMatchObject([
		{ id, stage: 'build' }
	]);
	expect(await (await request('/items?stage=idea')).json()).toEqual([]);
	expect((await request('/items?stage=wrong')).status).toBe(400);
	expect(await (await request('/digest')).json()).toMatchObject({
		due_today: [{ id, stage: 'build' }]
	});
	expect(await (await request('/digest?format=text')).text()).toContain('build');
});

function planningFixture() {
	const database = new DatabaseSync(':memory:');
	onTestFinished(() => database.close());
	const now = () => Date.UTC(2026, 10, 21, 12);
	const store = new TrackerPersistenceService(database, 'fixture-mac', { now });
	const api = new TrackerLocalApiService(store, new TrackerItemReadRepository(database), { now });
	const id = 'olditem001';
	store.appendLocal({
		itemId: id,
		fields: { title: 'Existing design', status: 'open', kind: 'task', due: '2026-11-21' }
	});
	const item = `/items/${id}`;
	const request = (path: string, method = 'GET', payload?: object) =>
		api.handle(
			new Request('http://127.0.0.1' + path, {
				method,
				headers: { 'x-tracker-as': 'fixture-actor' },
				body: JSON.stringify(payload)
			})
		);
	const stage = (next: string) => request(`${item}/stage`, 'POST', { stage: next, by: 'spoofed' });
	const artifact = (value: object) =>
		request(`${item}/artifact`, 'POST', { stage: 'detail', artifact: value });
	return { id, item, request, stage, artifact, store };
}

test('the Tracker artifact command merges delivery links without replacing the build document', async () => {
	const { id, item, request } = planningFixture();
	const existing = {
		summary: 'Existing build details',
		links: [
			{ label: 'PR', url: 'https://example.test/pr/123' },
			{ label: 'Feature video · dev', url: 'https://example.test/first-video' }
		]
	};
	expect(
		(await request(item + '/artifact', 'POST', { stage: 'build', artifact: existing })).status
	).toBe(200);
	const directory = await createTempDirectory('tracker-artifact-');
	onTestFinished(() => rm(directory, { recursive: true, force: true }));
	const file = join(directory, 'artifact.json');
	const link = { label: 'Feature video · dev', url: 'https://example.test/delivery' };
	await writeFile(file, JSON.stringify({ links: [link] }));
	const { request: parsed } = nativeTrackerArgs(['artifact', id, 'build', file, '--merge-links']);
	const updated = await request(parsed.path, parsed.method, parsed.body);
	expect(updated.status).toBe(200);
	expect(await updated.json()).toMatchObject({
		planning: { artifacts: { build: { ...existing, links: [existing.links[0], link] } } }
	});
	expect(
		(
			await request(item + '/artifact', 'POST', {
				stage: 'build',
				merge_links: true,
				artifact: { summary: 'Would replace' }
			})
		).status
	).toBe(400);
});
