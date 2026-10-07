import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { runCommand } from './support/cli';

test('packed installation serves and finalizes media without a source checkout', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-packed-'));
	const oldStore = process.env.PROJECT_REPORTS_HOME;
	process.env.PROJECT_REPORTS_HOME = join(root, 'store');
	try {
		await runCommand(
			['bun', 'pm', 'pack', '--ignore-scripts', '--filename', join(root, 'harness.tgz')],
			process.cwd()
		);
		await runCommand(['tar', '-xzf', join(root, 'harness.tgz'), '-C', root], root);
		await runCommand(['bun', 'install', '--ignore-scripts'], join(root, 'package'));
		const cli = join(root, 'package', 'dist', 'index.js');
		const run = (args: string[]) => runCommand(['bun', cli, ...args], root);
		const begin = JSON.parse(
			(
				await run([
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
				])
			).stdout
		);
		await recordMedia(root, begin.run, run);
		await run(['report', 'finalize', '--run', begin.run]);
		const manifest = JSON.parse(
			await readFile(join(root, 'store', 'runs', begin.run, 'manifest.json'), 'utf8')
		);
		expect(manifest.state).toBe('finalized');
		expect(manifest.evidence).toHaveLength(2);
		const exports = join(root, 'store', 'runs', begin.run, 'exports');
		for (const file of ['index.html', 'report.pdf', 'report.zip'])
			expect((await readFile(join(exports, file))).length).toBeGreaterThan(100);
		const port = 22000 + Math.floor(Math.random() * 10000);
		const server = JSON.parse((await run(['report', 'serve', '--port', String(port)])).stdout);
		expect((await fetch(`${server.url}/api/health`)).status).toBe(200);
		expect((await fetch(`${server.url}/analytics`)).status).toBe(200);
		const html = await (await fetch(`${server.url}/reports/${begin.run}`)).text();
		expect(html).toContain('Matched fixture transcript');
		expect(html).toContain('<audio');
		// Leave this task-owned loopback server and its fixture directory available for inspection.
	} finally {
		if (oldStore === undefined) delete process.env.PROJECT_REPORTS_HOME;
		else process.env.PROJECT_REPORTS_HOME = oldStore;
	}
}, 120_000);
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
