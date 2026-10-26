import type { Snapshot } from './history-source.test.types';
import { createHash } from 'node:crypto';
import { assertCatalogRevision } from './support/historyCatalog';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { expect, test } from 'vitest';
import { scenarioManifestSchema, type ComponentManifest } from '../src/core/unitTypes';
import { recordCapture } from '../src/utils/record-capture/recordCapture';
import { HistoryIndexService } from '../src/cli/program/history-index-service/HistoryIndexService';
import { fixtureSources } from './support/verifyFixture';
import { unitProject } from './support/unitProject';
import { repoAt, type VerifyRepo } from './support/verifyRepo';

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
	await seedTests(repo);
	await repo.git(['init', '-q', '-b', 'main']);
	const first = await repo.commit('feat: first source revision');
	const original = await repo.read('src/utils/slugify.ts');
	const changed = original + '// selected second revision\n';
	await repo.write('src/utils/slugify.ts', changed);
	await repo.write('test/slugify.test.ts', '// second committed test\n' + testText);
	const second = await repo.commit('feat: second source revision');
	await repo.git([
		'commit',
		'--allow-empty',
		'-q',
		'-m',
		'chore: preserve an unchanged source tree'
	]);
	const third = await repo.git(['rev-parse', 'HEAD']);
	await repo.write('test/slugify.test.ts', '// dirty test must never appear\n');
	await repo.write('src/utils/slugify.ts', '// dirty working tree must never appear\n');
	return [
		[first, original, testText],
		[second, changed, '// second committed test\n' + testText],
		[third, changed, '// second committed test\n' + testText]
	];
}

async function assertSource(out: string, commit: string, expected: string, expectedTest: string) {
	assertCatalogRevision(out, commit);
	const media = new Set<string>();
	const detail = JSON.parse(await readFile(join(out, `revisions/${commit}.json`), 'utf8'));
	const units = detail.registry.units as Array<{
		id: string;
		sourceFiles?: Snapshot[];
		testFiles?: Snapshot[];
	}>;
	const files = units.find((item) => item.id === 'function.slugify')?.sourceFiles;
	expect(files, 'owned source is retained with the selected revision').toBeDefined();
	const path = files?.find((item) => item.path === 'src/utils/slugify.ts')?.media;
	expect(await readFile(join(out, path!), 'utf8')).toBe(expected);
	expect(detail.registry.scenarios.map((scenario: { id: string }) => scenario.id)).toContain(
		'slugify'
	);
	const tests = units.find((item) => item.id === 'function.slugify')?.testFiles;
	expect(
		tests?.map((file) => file.path),
		'associated tests are retained at the selected revision'
	).toEqual(['test/declared.test.ts', 'test/slugify.test.ts']);
	const test = tests?.find((file) => file.path === 'test/slugify.test.ts');
	expect(await readFile(join(out, test!.media!), 'utf8')).toBe(expectedTest);
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
	for (const file of units.flatMap((item) => [
		...(item.sourceFiles ?? []),
		...(item.testFiles ?? [])
	])) {
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
		archiveMeasurements(performance.now() - started);
		console.log(
			JSON.stringify({
				workload: 'three commits, including an unchanged tree, with text and gaps',
				method: 'performance.now wall time; whole Vitest process RSS',
				buildMs: performance.now() - started,
				processRssBytes: process.memoryUsage().rss
			})
		);
		const media = new Set<string>();
		for (const [commit, expected, expectedTest] of revisions)
			for (const file of await assertSource(out, commit, expected, expectedTest)) media.add(file);
		expect((await readdir(join(out, 'media'))).map((name) => `media/${name}`).sort()).toEqual(
			[...media].sort()
		);
	} finally {
		await repo.dispose();
	}
}, 120_000);

const testText =
	"import { slugify } from '../src/utils/slugify';\nexport const actual = slugify('Hello');\n";
async function seedTests(repo: VerifyRepo): Promise<void> {
	await repo.write('test/slugify.test.ts', testText);
	await repo.write(
		'test/declared.test.ts',
		'// Declared CLI coverage without a direct implementation import.\n'
	);
	await repo.write('test/unrelated.test.ts', '// A different module must not appear.\n');
	await repo.write(
		'specification/scenarios/slugify.json',
		JSON.stringify(
			scenarioManifestSchema.parse({
				schemaVersion: 1,
				id: 'slugify',
				title: 'Slugify through its command',
				kind: 'headless',
				states: [
					{
						id: 'command',
						title: 'Command usage',
						coverage: 'missing',
						reason:
							'This source-only fixture stores test associations without a verification artifact.'
					}
				],
				viewports: [],
				units: ['function.slugify'],
				tests: [
					{
						id: 'declared',
						kind: 'integration',
						runner: 'command',
						target: 'bun x vitest run declared.test.ts',
						cwd: 'test'
					}
				],
				evidence: []
			})
		)
	);
}

function archiveMeasurements(buildMs: number): void {
	const measurements = ['service.source-archive', 'service.history-index'].flatMap((unit) => [
		{
			unit,
			workload: 'two-commit-source-archive',
			target: 'module',
			samples: 1,
			metric: 'latency-cold-ms',
			unitOfMeasure: 'ms',
			value: buildMs,
			method:
				'Wall time of a complete two-revision history build, including source/test association and archive I/O.'
		},
		{
			unit,
			workload: 'two-commit-source-archive',
			target: 'module',
			samples: 1,
			metric: 'memory-bytes',
			unitOfMeasure: 'bytes',
			value: process.memoryUsage().rss,
			method:
				'Whole Vitest process RSS after the two-revision history build; includes indexing and runner overhead.'
		}
	]);
	recordCapture(
		{
			evidence: 'benchmark',
			kind: 'benchmark',
			state: 'archive',
			file: 'source-archive-workload.json',
			mediaType: 'application/json'
		},
		JSON.stringify({ measurements })
	);
}
