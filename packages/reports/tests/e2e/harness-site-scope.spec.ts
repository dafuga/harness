import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Report } from '../../src/models/Report.types';
import { ReportRepository } from '../../src/repositories/ReportRepository';
import { ReportExportService } from '../../src/services/ReportExportService';
import { audioFixture } from '../../test/audioFixture';

const home = '/tmp/project-reports-e2e';
const id = (name: string) => readFileSync(join(home, name), 'utf8').trim();
const store = new ReportRepository(home);
const foreignTitle = 'Foreign storefront review';
const foreignProject = '/tmp/beta-project';

// Both applications have recorded analytics into the one store this server reads.
test.beforeAll(() => {
	execFileSync('bun', ['db/seed-data/analytics-e2e.ts']);
});

test('the report hub is about the hosting application only, whatever the address asks for', async ({
	page
}) => {
	const foreign = await store.get(id('foreign-id'));
	expect(foreign.project.path).toBe(foreignProject);
	for (const address of [
		'/harness/reports',
		`/harness/reports?project=${foreign.project.id}`,
		`/?project=${foreign.project.id}`
	]) {
		await page.goto(address);
		await expect(page.getByText('Account settings review', { exact: true })).toBeVisible();
		await expect(page.getByText('Whole-site review', { exact: true })).toBeVisible();
		await expect(page.getByText(foreignTitle)).toHaveCount(0);
		await expect(page.locator('body')).not.toContainText('beta-project');
	}
	// One application, so nothing offers to choose or count projects.
	await expect(page.getByRole('combobox', { name: 'Project' })).toHaveCount(0);
	await expect(page.locator('.hub-stats, .stats')).not.toContainText(/projects/i);
	await expect(page.getByText('Reports of alpha-project')).toBeVisible();
});

/** A finished report with a screenshot and built exports, recorded for the given application. */
async function finished(project: string, title: string): Promise<Report> {
	const run = await store.begin({ project, title, mode: 'feature', environment: 'local fixture' });
	await store.record(run.id, {
		kind: 'evidence',
		data: {
			id: 'view',
			title: `${title} view`,
			category: 'UI',
			phase: 'current',
			viewport: '1440px desktop',
			path: join(home, 'fixture.png'),
			status: 'passed'
		}
	});
	await new ReportExportService(store).finalize(run.id);
	return store.get(run.id);
}

test("every route serves the application's own report and none serves the other application's", async ({
	page,
	request
}) => {
	const [mine, theirs] = [
		await finished('/tmp/alpha-checkout', 'Own finished review'),
		await finished(foreignProject, 'Foreign finished review')
	];
	// Both reports are complete in the store: each has its screenshot and its built exports.
	for (const run of [mine, theirs]) {
		expect(existsSync(join(home, 'runs', run.id, 'assets', run.evidence[0].file))).toBe(true);
		expect(existsSync(join(home, 'runs', run.id, 'exports', run.exports?.html ?? ''))).toBe(true);
	}
	const routes = (run: Report) => [
		`/api/reports/${run.id}`,
		`/harness/reports/${run.id}`,
		`/reports/${run.id}`,
		`/api/reports/${run.id}/assets/${run.evidence[0].file}`,
		`/api/reports/${run.id}/exports/${run.exports?.html}`,
		`/api/reports/${run.id}/exports/${run.exports?.zip}`,
		`/api/replay-video?run=${run.id}`
	];
	for (const address of routes(mine)) {
		expect([address, (await request.get(address)).status()]).toEqual([address, 200]);
	}
	for (const address of routes(theirs)) {
		const response = await request.get(address);
		expect([address, response.status()]).toEqual([address, 404]);
		const body = await response.text();
		expect([address, body.includes('Foreign'), body.includes('beta-project')]).toEqual([
			address,
			false,
			false
		]);
	}
	// The list is the same whatever project the address names.
	const own = (await (await request.get('/api/reports')).json()) as Report[];
	expect(own.some((run) => run.id === mine.id)).toBe(true);
	for (const query of [
		`?project=${theirs.project.id}`,
		'?project=all',
		`?project=${foreignProject}`
	]) {
		const listed = (await (await request.get(`/api/reports${query}`)).json()) as Report[];
		expect([query, listed.map((run) => run.id)]).toEqual([query, own.map((run) => run.id)]);
		expect(JSON.stringify(listed)).not.toContain('beta-project');
	}
	await page.goto(`/harness/reports/${theirs.id}`);
	await expect(page.locator('body')).not.toContainText('Foreign finished review');
});

test("what this site accepts for its own report it refuses for the other application's", async ({
	request,
	baseURL
}) => {
	const begin = (project: string) =>
		store.begin({ project, title: 'Scope control', mode: 'feature', environment: 'local fixture' });
	const [mine, theirs] = [await begin('/tmp/alpha-checkout'), await begin(foreignProject)];
	const directory = join(home, 'runs', theirs.id);
	const before = [
		await readFile(join(directory, 'manifest.json'), 'utf8'),
		await readdir(directory)
	];
	const image = {
		name: 'shot.png',
		mimeType: 'image/png',
		buffer: readFileSync(join(home, 'fixture.png'))
	};
	const tone = () => ({ name: 'tone.wav', mimeType: 'audio/wav', buffer: audioFixture() });
	const uploads = (reportId: string) =>
		[
			[
				'/api/report-screenshot-upload',
				{ reportId, title: 'Scope proof', viewport: 'desktop', before: image, after: image }
			],
			['/api/report-audio-upload', { reportId, title: 'Scope tone', audio: tone() }],
			[
				'/api/report-audio-comparison',
				{ reportId, title: 'Scope pair', before: tone(), after: tone() }
			]
		] as const;
	const send = (address: string, multipart: Record<string, unknown>) =>
		request.post(address, { headers: { Origin: baseURL ?? '' }, multipart: multipart as never });
	// The very same valid screenshots and audio: accepted for the own report, absent for the other.
	for (const [address, multipart] of uploads(mine.id)) {
		expect([address, (await send(address, multipart)).status()]).toEqual([address, 201]);
	}
	for (const [address, multipart] of uploads(theirs.id)) {
		const response = await send(address, multipart);
		expect([address, response.status()]).toEqual([address, 404]);
		expect(await response.text()).not.toContain('beta-project');
	}
	expect((await store.get(mine.id)).evidence.length).toBeGreaterThanOrEqual(5);
	expect([
		await readFile(join(directory, 'manifest.json'), 'utf8'),
		await readdir(directory)
	]).toEqual(before);
});

test('analytics count the hosting application only, and a project parameter changes nothing', async ({
	page
}) => {
	for (const address of [
		'/harness/analytics',
		`/harness/analytics?project=${encodeURIComponent(foreignProject)}`,
		`/analytics?project=${encodeURIComponent(foreignProject)}`
	]) {
		await page.goto(address);
		await expect(page.getByTestId('response-first-try')).toContainText('50%');
		await expect(page.getByText('fixture-author').first()).toBeVisible();
		await expect(page.getByText('foreign-author')).toHaveCount(0);
		// Loops and tasks of the other application are not counted or listed either.
		await expect(page.locator('body')).not.toContainText('storefront');
		await expect(page.locator('body')).not.toContainText('foreign-one');
		await expect(page.locator('body')).not.toContainText('beta-project');
		await expect(page.locator('body')).not.toContainText('foreign-report');
	}
	await expect(page.getByLabel('Project', { exact: true })).toHaveCount(0);
	// The CPU panel says what is the whole machine and what is this application's.
	await expect(
		page.getByRole('heading', { name: 'Agents working in this repository' })
	).toBeVisible();
	await expect(
		page.getByText('The machine total above covers everything on this computer.')
	).toBeVisible();
});
