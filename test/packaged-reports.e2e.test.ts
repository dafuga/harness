import { existsSync } from 'node:fs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import {
	listening,
	packedInstall,
	running,
	withReportServer,
	type PackedInstall,
	type ServedReports
} from './support/packedReports';

let install: PackedInstall;
let report = '';
beforeAll(async () => {
	install = await packedInstall();
}, 120_000);
afterAll(() => install?.dispose());

test('packed installation serves and finalizes media without a source checkout', async () => {
	const { root, run } = install;
	const begun = await run([
		'report',
		'begin',
		'--project',
		root,
		'--title',
		'Packaged media',
		'--mode',
		'feature',
		'--environment',
		'test'
	]);
	report = (JSON.parse(begun.stdout) as { run: string }).run;
	await recordMedia(root, report, run);
	await run(['report', 'finalize', '--run', report]);
	const manifest = JSON.parse(
		await readFile(join(root, 'store', 'runs', report, 'manifest.json'), 'utf8')
	);
	expect(manifest.state).toBe('finalized');
	expect(manifest.evidence).toHaveLength(2);
	const exports = join(root, 'store', 'runs', report, 'exports');
	for (const file of ['index.html', 'report.pdf', 'report.zip'])
		expect((await readFile(join(exports, file))).length).toBeGreaterThan(100);
	await withReportServer(install, async (server) => {
		expect((await fetch(`${server.url}/api/health`)).status).toBe(200);
		await verifyPackagedAnalytics(server.url);
		const html = await (await fetch(`${server.url}/reports/${report}`)).text();
		expect(html).toContain('Matched fixture transcript');
		expect(html).toContain('<audio');
	});
}, 120_000);

test('the server a test starts is stopped when the test is done with it, passed or failed', async () => {
	const seen: ServedReports[] = [];
	await withReportServer(install, async (server) => {
		seen.push(server);
		expect([await listening(server.url), running(server.pid)]).toEqual([true, true]);
	});
	const failure = withReportServer(install, async (server) => {
		seen.push(server);
		expect(await listening(server.url)).toBe(true);
		throw new Error('an assertion of the test failed');
	});
	await expect(failure).rejects.toThrow('an assertion of the test failed');
	expect(seen).toHaveLength(2);
	for (const server of seen) {
		expect([server.port, await listening(server.url), running(server.pid)]).toEqual([
			server.port,
			false,
			false
		]);
	}
	// Stopping again finds nothing of this store to stop, and stops nothing else.
	const again = await install.run(['report', 'stop', '--port', String(seen[0].port)]);
	expect(JSON.parse(again.stdout)).toMatchObject({ port: seen[0].port, stopped: false });
}, 120_000);

test('the fixture and the environment of the run are gone with it', async () => {
	const { root } = install;
	expect(process.env.PROJECT_REPORTS_HOME).toBe(join(root, 'store'));
	await install.dispose();
	expect(existsSync(root)).toBe(false);
	expect(process.env.PROJECT_REPORTS_HOME).not.toBe(join(root, 'store'));
});

async function recordMedia(
	root: string,
	id: string,
	run: (args: string[]) => Promise<unknown>
): Promise<void> {
	await mkdir(join(root, 'fixtures'));
	const png = join(root, 'fixtures', 'screen.png');
	await writeFile(
		png,
		Buffer.from(
			'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII=',
			'base64'
		)
	);
	const wav = join(root, 'fixtures', 'voice.wav');
	const bytes = Buffer.alloc(44 + 1600);
	bytes.write('RIFF');
	bytes.writeUInt32LE(bytes.length - 8, 4);
	bytes.write('WAVEfmt ', 8);
	bytes.writeUInt32LE(16, 16);
	bytes.writeUInt16LE(1, 20);
	bytes.writeUInt16LE(1, 22);
	bytes.writeUInt32LE(8000, 24);
	bytes.writeUInt32LE(16000, 28);
	bytes.writeUInt16LE(2, 32);
	bytes.writeUInt16LE(16, 34);
	bytes.write('data', 36);
	bytes.writeUInt32LE(1600, 40);
	await writeFile(wav, bytes);
	for (const [name, path] of [
		['screen', png],
		['voice', wav]
	]) {
		await run([
			'report',
			'record',
			'--run',
			id,
			'--kind',
			'evidence',
			'--data',
			JSON.stringify({
				id: name,
				title: name,
				path,
				category: 'Packaged proof',
				status: 'passed',
				transcript: 'Matched fixture transcript'
			})
		]);
	}
}

async function verifyPackagedAnalytics(url: string): Promise<void> {
	const page = await fetch(`${url}/analytics`);
	expect(page.status).toBe(200);
	const html = await page.text();
	expect(html).toContain('Harness Analytics');
	expect(html).toContain('Live CPU usage');
	if (!['darwin', 'linux'].includes(process.platform)) return;
	const response = await fetch(`${url}/api/analytics-cpu`);
	expect(response.status).toBe(200);
	const sample = (await response.json()) as { status: string; logicalCores: number };
	expect(sample.status).toBe('available');
	expect(sample.logicalCores).toBeGreaterThan(0);
}
