import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeEach, expect, test } from 'vitest';
import { ConsoleInstallService } from '../../src/services/console-install-service/ConsoleInstallService';
import { consoleHostFiles } from '../../src/services/console-install-service/consoleHostFiles';

let root: string;
let host: string;
const service = new ConsoleInstallService();
const options = () => ({
	host,
	base: '/harness',
	policy: '$lib/server/harnessPolicy',
	policyExport: 'harnessPolicy'
});
const commit = 'a'.repeat(40);
const image = `${'b'.repeat(64)}.png`;
const module = 'src/lib/server/harness/console.ts';

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), 'harness-console-storage-'));
	host = join(root, 'host');
	await mkdir(join(host, 'src/routes'), { recursive: true });
	await mkdir(join(host, 'src/lib/server'), { recursive: true });
	await writeFile(join(host, 'svelte.config.js'), 'export default {};\n');
	await writeFile(join(host, 'package.json'), '{"dependencies":{"@dafuga01/harness":"*"}}');
	await writeFile(
		join(host, 'src/lib/server/harnessPolicy.ts'),
		'export const harnessPolicy = () => false;\n'
	);
});
afterAll(() => rm(root, { recursive: true, force: true }));

async function index(mediaBytes = 5): Promise<string> {
	const directory = join(root, 'index');
	for (const folder of ['revisions', 'sides', 'media'])
		await mkdir(join(directory, folder), { recursive: true });
	await writeFile(join(directory, 'index.json'), '{"revisions":[]}');
	await writeFile(join(directory, `revisions/${commit}.json`), '{}');
	await writeFile(join(directory, `sides/${commit}.json`), '{}');
	// Bytes that do not compress, as recorded screenshots and audio do not.
	await writeFile(join(directory, 'media', image), randomBytes(mediaBytes));
	return directory;
}

test('with a bucket nothing of the history is written into the host', async () => {
	const bundled = await service.install({ ...options(), data: await index() });
	expect(bundled.storage).toEqual({ kind: 'bundle' });
	expect(bundled.written).toContain(`src/lib/server/harness/data/sides/${commit}.json.ts`);

	const stored = await service.install({
		...options(),
		data: await index(),
		bucket: 'HARNESS_HISTORY',
		prefix: 'history'
	});
	expect(stored.storage).toEqual({ kind: 'bucket', binding: 'HARNESS_HISTORY', prefix: 'history' });
	// What has to be uploaded is still counted, and what an earlier install bundled is removed.
	expect(stored.data).toMatchObject({ revisions: 1, media: 1 });
	expect(stored.removed.sort()).toEqual([
		'src/lib/server/harness/data/index.json.ts',
		`src/lib/server/harness/data/media/${image}.ts`,
		`src/lib/server/harness/data/revisions/${commit}.json.ts`,
		`src/lib/server/harness/data/sides/${commit}.json.ts`
	]);
	expect(existsSync(join(host, 'src/lib/server/harness/data/index.json.ts'))).toBe(false);
	const server = await readFile(join(host, module), 'utf8');
	expect(server).not.toContain('import.meta.glob');
	expect(server).toContain("consoleStore(bucket, 'history')");
	const manifest = JSON.parse(await readFile(join(host, 'harness.console.json'), 'utf8')) as {
		storage: unknown;
	};
	expect(manifest.storage).toEqual(stored.storage);
});

test('the generated store is opened from the binding of the request and fails closed without it', () => {
	const [server] = consoleHostFiles({
		base: '/harness',
		policyModule: '$lib/server/harnessPolicy',
		policyExport: 'adminOnly',
		bucket: { binding: 'HARNESS_HISTORY', prefix: '' }
	});
	expect(server.contents).toContain("env?.['HARNESS_HISTORY']");
	expect(server.contents).toContain('The HARNESS_HISTORY binding is missing');
	expect(server.contents).toContain(
		'consoleAccess({ policy, data, exporter: consoleExporter, host })'
	);
	expect(server.contents).not.toMatch(/node:|process\.|Buffer\b/);
	// The slot a stamp is written into is part of the host's own emitted code.
	expect(server.contents).toContain(`build: 'harness-build:${'0'.repeat(64)}'`);
});

test('a binding or prefix that is not a plain name is refused before anything is written', async () => {
	for (const bucket of ['history bucket', '1HISTORY', "X'];alert(1);//"]) {
		await expect(service.install({ ...options(), bucket })).rejects.toThrow('--bucket');
	}
	const quoted = { ...options(), bucket: 'HARNESS_HISTORY', prefix: "a'b" };
	await expect(service.install(quoted)).rejects.toThrow('--prefix');
	expect(existsSync(join(host, 'harness.console.json'))).toBe(false);
});

test('bundled history that a Worker cannot hold is reported with its measured size', async () => {
	const small = await service.install({ ...options(), data: await index() });
	expect(small.bundle).toMatchObject({ files: 4, compressedBytes: expect.any(Number) });
	expect(small.warnings).toEqual([]);
	const large = await service.install({ ...options(), data: await index(4 * 1024 * 1024) });
	expect(large.bundle?.compressedBytes).toBeGreaterThan(3 * 1024 * 1024);
	expect(large.warnings).toEqual([
		expect.stringMatching(
			/^The bundled history is \d+\.\d MiB compressed; a Worker script may be 3 MiB on the free plan and 10 MiB on a paid one\. Keep it in a private bucket with --bucket <binding>\.$/
		)
	]);
	const stored = await service.install({
		...options(),
		data: await index(4 * 1024 * 1024),
		bucket: 'HARNESS_HISTORY'
	});
	expect([stored.bundle, stored.warnings]).toEqual([null, []]);
});
