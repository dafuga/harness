import { expect, test } from '../../../../test/support/browserTest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Report } from '../../src/models/Report.types';
import { ReportRepository } from '../../src/repositories/ReportRepository';
import { ReportExportService } from '../../src/services/ReportExportService';
import { audioFixture } from '../../test/audioFixture';
import { analytics, type Models } from './support/analyticsCli';
import { fixtures, sites } from './support/fixtures';
import { expectRetired } from './support/portableReport';

const home = fixtures.reports;
const id = (name: string) => readFileSync(join(home, name), 'utf8').trim();
const store = new ReportRepository(home);
const foreignTitle = 'Foreign storefront review';
const foreignProject = fixtures.site('beta-project');

// Both applications have recorded analytics into the one store this server reads.
test.beforeAll(() => {
	execFileSync('bun', ['db/seed-data/analytics-e2e.ts']);
});

test('what lists reports is about the hosting application only, whatever the address asks for', async ({
	page,
	request
}) => {
	const foreign = await store.get(id('foreign-id'));
	expect(foreign.project.path).toBe(foreignProject);
	// The hub is gone: each of its addresses leads into the explorer and shows nothing foreign.
	for (const address of [
		'/harness/reports',
		`/harness/reports?project=${foreign.project.id}`,
		`/?project=${foreign.project.id}`
	]) {
		await expectRetired(page, address);
		await expect(page.getByText(foreignTitle)).toHaveCount(0);
		await expect(page.locator('body')).not.toContainText('beta-project');
	}
	await expect(page.getByRole('combobox', { name: 'Project' })).toHaveCount(0);
	// What the hub listed is the answer of the report API: this application's reports and no other's.
	for (const query of ['', `?project=${foreign.project.id}`, '?project=all']) {
		const listed = (await (await request.get(`/api/reports${query}`)).json()) as Report[];
		const titles = listed.map((run) => run.title);
		expect(titles).toContain('Account settings review');
		expect(titles).toContain('Whole-site review');
		expect(titles).not.toContain(foreignTitle);
		expect(JSON.stringify(listed)).not.toContain('beta-project');
	}
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
		await finished(fixtures.site('alpha-checkout'), 'Own finished review'),
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
	const pages = (run: Report) => [`/harness/reports/${run.id}`, `/reports/${run.id}`];
	for (const address of routes(theirs).filter((route) => !pages(theirs).includes(route))) {
		const response = await request.get(address);
		expect([address, response.status()]).toEqual([address, 404]);
		const body = await response.text();
		expect([address, body.includes('Foreign'), body.includes('beta-project')]).toEqual([
			address,
			false,
			false
		]);
	}
	// A page address of the other application's report leads where one that names no report leads.
	const once = (address: string) => request.get(address, { maxRedirects: 0 });
	const unknown = (await once('/harness/reports/no-such-report')).headers().location;
	expect((await once(`/harness/reports/${theirs.id}`)).headers().location).toBe(unknown);
	for (const address of pages(theirs)) {
		const followed = await request.get(address);
		const body = await followed.text();
		expect([
			address,
			followed.status(),
			body.includes('Foreign'),
			body.includes('beta-project')
		]).toEqual([address, 200, false, false]);
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
	await expectRetired(page, `/harness/reports/${theirs.id}`);
	await expect(page.locator('body')).not.toContainText('Foreign finished review');
	// The own report is still read, as the page its export built and the API serves.
	const served = await request.get(`/api/reports/${mine.id}/exports/${mine.exports?.html}`);
	expect(await served.text()).toContain('Own finished review');
});

test("what this site accepts for its own report it refuses for the other application's", async ({
	request,
	baseURL
}) => {
	const begin = (project: string) =>
		store.begin({ project, title: 'Scope control', mode: 'feature', environment: 'local fixture' });
	const [mine, theirs] = [
		await begin(fixtures.site('alpha-checkout')),
		await begin(foreignProject)
	];
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
	// The dashboard is gone: its addresses lead into the explorer whatever project they name.
	for (const address of [
		'/harness/analytics',
		`/harness/analytics?project=${encodeURIComponent(foreignProject)}`,
		`/analytics?project=${encodeURIComponent(foreignProject)}`
	]) {
		await expectRetired(page, address);
		await expect(page.locator('body')).not.toContainText('foreign-author');
		await expect(page.locator('body')).not.toContainText('beta-project');
	}
	await expect(page.getByLabel('Project', { exact: true })).toHaveCount(0);
	// The figures are read with the command line, scoped to the checkouts of this application.
	const scoped = analytics<Models>('models', '--site', sites.own);
	expect(scoped.models.firstTryByAuthor['fixture-author'].response.firstTry.rate).toBe(0.5);
	expect(Object.keys(scoped.models.authors)).toEqual(['fixture-author']);
	// Loops, tasks and reports of the other application are not counted or listed either.
	for (const command of ['models', 'jev', 'loops', 'events']) {
		const text = JSON.stringify(analytics<unknown>(command, '--site', sites.own));
		expect([
			command,
			/storefront|foreign-one|beta-project|foreign-report|foreign-author/.test(text)
		]).toEqual([command, false]);
	}
	expect(Object.keys(analytics<Models>('models').models.authors)).toContain('foreign-author');
});
