import { afterEach, expect, test } from 'vitest';
import { mkdtemp, rm, writeFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ReportRepository } from '../src/repositories/ReportRepository';
import type { RecordInput } from '../src/models/Report.types';
import { reportDisplay } from '../src/utils/reportDisplay';

const roots: string[] = [];
async function fixture() {
	const root = await mkdtemp(join(tmpdir(), 'project-reports-'));
	roots.push(root);
	const store = new ReportRepository(root);
	const run = await store.begin({
		project: '/tmp/project-one',
		title: 'Feature proof',
		mode: 'feature',
		environment: 'local'
	});
	return { root, store, run };
}
afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

test('concurrent evidence updates survive and runs remain isolated', async () => {
	const { store, run } = await fixture();
	const second = await store.begin({
		project: '/tmp/project-two',
		title: 'Suite proof',
		mode: 'suite',
		environment: 'local'
	});
	await Promise.all(
		Array.from({ length: 12 }, (_, i) =>
			store.record(run.id, {
				kind: 'check',
				data: { id: `check-${i}`, title: `Test ${i}`, status: 'passed' }
			})
		)
	);
	expect((await store.get(run.id)).checks).toHaveLength(12);
	expect((await store.get(second.id)).checks).toHaveLength(0);
	expect((await store.list()).length).toBe(2);
});

test('finalized history rejects mutation and unfinished runs can be interrupted', async () => {
	const { store, run } = await fixture();
	expect(reportDisplay(run)).toBe('running');
	expect(
		reportDisplay({ ...run, updatedAt: new Date(Date.now() - 16 * 60_000).toISOString() })
	).toBe('interrupted');
	await store.record(run.id, { kind: 'heartbeat', data: {} });
	expect(reportDisplay(await store.get(run.id))).toBe('running');
	await store.record(run.id, {
		kind: 'check',
		data: { id: 'one', title: 'Blocked CI', status: 'blocked' }
	});
	await store.seal(run.id);
	await store.finish(run.id, { pdf: 'report.pdf', zip: 'report.zip', html: 'index.html' });
	expect((await store.get(run.id)).status).toBe('blocked');
	await expect(
		store.record(run.id, { kind: 'summary', data: { text: 'overwrite' } })
	).rejects.toThrow(/final/);
	await expect(store.get('../secret')).rejects.toThrow();
});

test('missing and symlink assets are rejected and secrets are redacted', async () => {
	const { store, run, root } = await fixture();
	await expect(
		store.record(run.id, {
			kind: 'evidence',
			data: { id: 'missing', title: 'Missing', path: join(root, 'missing.png'), category: 'UI' }
		})
	).rejects.toThrow();
	const target = join(root, 'outside.png');
	await writeFile(target, 'private');
	await symlink(target, join(root, 'link.png'));
	await expect(
		store.record(run.id, {
			kind: 'evidence',
			data: { id: 'link', title: 'Link', path: join(root, 'link.png'), category: 'UI' }
		})
	).rejects.toThrow(/symlink/);
	await store.record(run.id, {
		kind: 'check',
		data: {
			id: 'safe',
			title: 'Output',
			status: 'failed',
			output:
				'Authorization: Bearer secret-token\nAPI_KEY=very-secret\nhttps://example.com/?token=abc#secret'
		}
	});
	const data = JSON.stringify(await store.get(run.id));
	expect(data).not.toContain('secret-token');
	expect(data).not.toContain('very-secret');
	expect(data).not.toContain('token=abc');
});

test('an active report can replace its acceptance criteria as the task is clarified', async () => {
	const { store, run } = await fixture();
	await store.record(run.id, {
		kind: 'acceptance' as unknown as RecordInput['kind'],
		data: { items: ['A low-RAM move succeeds without player payment'] }
	});
	expect((await store.get(run.id)).acceptance).toEqual([
		'A low-RAM move succeeds without player payment'
	]);
});
