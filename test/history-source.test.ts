import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { expect, test } from 'vitest';
import type { ComponentManifest } from '../src/core/unitTypes';
import { HistoryIndexService } from '../src/services/history-index-service/HistoryIndexService';
import { fixtureSources } from './support/verifyFixture';
import { unitProject } from './support/unitProject';
import { repoAt, type VerifyRepo } from './support/verifyRepo';

type Snapshot = { path: string; media: string | null; gap?: string };

async function seedSource(repo: VerifyRepo) {
	for (const [path, text] of Object.entries(fixtureSources)) await repo.write(path, text);
	await repo.harness(['units', 'index', '--write']);
	const unit = await repo.json<ComponentManifest>('specification/units/function.slugify.json');
	await repo.write(
		'specification/units/config.assets.json',
		JSON.stringify({
			...unit,
			id: 'config.assets',
			kind: 'config',
			title: 'Assets',
			owns: { source: ['src/assets', 'src/missing.ts'], symbols: [] }
		})
	);
	await repo.write('src/assets/shared.txt', 'Unicode source: π Ω 🙂\n');
	await repo.write('src/assets/binary.dat', '\0binary\0');
	await repo.git(['init', '-q', '-b', 'main']);
	const first = await repo.commit('feat: first source revision');
	const original = await repo.read('src/utils/slugify.ts');
	const changed = original + '// selected second revision\n';
	await repo.write('src/utils/slugify.ts', changed);
	const second = await repo.commit('feat: second source revision');
	await repo.write('src/utils/slugify.ts', '// dirty working tree must never appear\n');
	return [
		[first, original],
		[second, changed]
	];
}

async function assertSource(out: string, commit: string, expected: string) {
	const media = new Set<string>();
	const detail = JSON.parse(await readFile(join(out, `revisions/${commit}.json`), 'utf8'));
	const units = detail.registry.units as Array<{ id: string; sourceFiles?: Snapshot[] }>;
	const files = units.find((item) => item.id === 'function.slugify')?.sourceFiles;
	expect(files, 'owned source is retained with the selected revision').toBeDefined();
	const path = files?.find((item) => item.path === 'src/utils/slugify.ts')?.media;
	expect(await readFile(join(out, path!), 'utf8')).toBe(expected);
	const assets = units.find((item) => item.id === 'config.assets')?.sourceFiles;
	expect(assets).toContainEqual({
		path: 'src/missing.ts',
		media: null,
		gap: expect.any(String)
	});
	expect(assets).toContainEqual({
		path: 'src/assets/binary.dat',
		media: null,
		gap: expect.any(String)
	});
	for (const file of units.flatMap((item) => item.sourceFiles ?? [])) {
		if (!file.media) continue;
		const bytes = await readFile(join(out, file.media));
		expect(file.media).toBe(`media/${createHash('sha256').update(bytes).digest('hex')}.txt`);
		media.add(file.media);
	}
	return media;
}

test('history archives owned text from each commit, deduplicates it and states source gaps', async () => {
	const project = await unitProject('lib');
	const repo = repoAt(project.root);
	try {
		const revisions = await seedSource(repo);
		const out = join(dirname(repo.root), 'source-history');
		const started = performance.now();
		await new HistoryIndexService(repo.root).build(out, 10, async () => []);
		console.log(
			JSON.stringify({
				workload: 'two committed source trees with text and gaps',
				method: 'performance.now wall time; whole Vitest process RSS',
				buildMs: performance.now() - started,
				processRssBytes: process.memoryUsage().rss
			})
		);
		const media = new Set<string>();
		for (const [commit, expected] of revisions)
			for (const file of await assertSource(out, commit, expected)) media.add(file);
		expect((await readdir(join(out, 'media'))).map((name) => `media/${name}`).sort()).toEqual(
			[...media].sort()
		);
	} finally {
		await repo.dispose();
	}
}, 120_000);
