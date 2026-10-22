import { afterEach, expect, test, vi } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { RequestEvent } from '@sveltejs/kit';
import { observedTaskOperation } from '../../../test/support/taskProfiles';

const roots: string[] = [];
afterEach(async () => {
	vi.unstubAllEnvs();
	vi.resetModules();
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

/** Actual route handlers over a disposable local store; no live report, credential or network. */
async function site() {
	const root = await mkdtemp(join(tmpdir(), 'harness-report-http-'));
	roots.push(root);
	await mkdir(join(root, 'site'));
	vi.stubEnv('PROJECT_REPORTS_HOME', join(root, 'reports'));
	vi.stubEnv('HARNESS_SITE_ROOT', join(root, 'site'));
	vi.stubEnv('PROJECT_REPORTS_ASSET_STORAGE', 'local');
	vi.stubEnv('HARNESS_OWNER_MODE', 'loopback');
	vi.stubEnv('HARNESS_BIND', '127.0.0.1');
	vi.stubEnv('ADDRESS_HEADER', '');
	vi.resetModules();
	return root;
}

const event = (path: string, params: Record<string, string> = {}) => {
	const url = new URL(path, 'http://127.0.0.1:5588');
	return {
		url,
		request: new Request(url),
		params,
		getClientAddress: () => '127.0.0.1'
	} as RequestEvent;
};

test('health, listing and report reads retain site isolation and actual local export bytes', async () => {
	const root = await site();
	const { ReportRepository } =
		await import('../src/repositories/reports-media/report-repository/ReportRepository');
	const store = new ReportRepository();
	const input = { title: 'Synthetic route fixture', mode: 'suite' as const, environment: 'test' };
	const own = await store.begin({ ...input, project: join(root, 'site') });
	const other = await store.begin({ ...input, project: join(root, 'other-site') });
	const { GET: health } = await import('../src/routes/api/health/+server');
	const response = await observedTaskOperation(
		'reports.endpoint.api-health',
		'source-health-handler',
		health
	);
	expect(await response.json()).toMatchObject({ app: 'project-reports', version: 1 });
	const { GET: list } = await import('../src/routes/api/reports/+server');
	expect((await (await list()).json()).map((run: { id: string }) => run.id)).toEqual([own.id]);
	const { GET: get } = await import('../src/routes/api/reports/[id]/+server');
	expect((await (await get({ params: { id: own.id } })).json()).id).toBe(own.id);
	for (const id of [other.id, 'absent', '../unsafe'])
		await expect(get({ params: { id } })).rejects.toMatchObject({ status: 404 });
	await store.mutateActive(own.id, async (run, directory) => {
		run.exports = { html: 'fixture.html', pdf: 'fixture.pdf', zip: 'fixture.zip' };
		await mkdir(join(directory, 'exports'));
		await writeFile(join(directory, 'exports/fixture.html'), '<p>Synthetic export bytes</p>');
	});
	const { GET: file } = await import('../src/routes/api/reports/[id]/[type]/[file]/+server');
	const exported = await file(
		event('/api/reports/export', { id: own.id, type: 'exports', file: 'fixture.html' })
	);
	expect(await exported.text()).toBe('<p>Synthetic export bytes</p>');
	expect(exported.headers.get('content-disposition')).toContain('attachment');
	await expect(
		file(event('/api/reports/private', { id: other.id, type: 'exports', file: 'fixture.html' }))
	).rejects.toMatchObject({ status: 404 });
});

test('the real server hook admits loopback reads and protects every history handler', async () => {
	await site();
	const { handle } = await import('../src/hooks.server');
	const resolve = vi.fn(async () => new Response('owned response'));
	const response = await observedTaskOperation(
		'reports.entry.hooks-server',
		'source-owner-hook-read',
		() => handle({ event: event('/api/health'), resolve })
	);
	expect(await response.text()).toBe('owned response');
	expect(response.headers.get('cache-control')).toBe('private, no-store');
	expect(resolve).toHaveBeenCalledOnce();
	const denied = { ...event('/harness/data/index.json'), getClientAddress: () => '203.0.113.9' };
	expect((await handle({ event: denied, resolve })).status).toBe(403);
	expect(resolve).toHaveBeenCalledOnce();
	const { GET: data } = await import('../src/routes/harness/data/[...path]/+server');
	const { GET: media } = await import('../src/routes/harness/media/[file]/+server');
	const { GET: exportReport } = await import('../src/routes/harness/export/[commit]/+server');
	for (const handler of [data, media, exportReport])
		expect((await handler(denied)).status).toBe(403);
});

test('activity reports only the disposable site with no invented repository history', async () => {
	await site();
	const { GET } = await import('../src/routes/api/project-activity/+server');
	const response = await GET();
	expect(response.status).toBe(200);
	const shown = await response.json();
	expect(shown.activity.repository).toMatchObject({ name: 'site', head: null, branch: null });
	expect(shown.activity.work).toEqual([]);
	expect(shown.live.worktrees).toEqual([
		{ name: 'site', head: null, branch: null, primary: true, changes: [], truncated: false }
	]);
	expect(response.headers.get('cache-control')).toBe('no-store');
});
