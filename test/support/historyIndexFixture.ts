import { expect } from 'vitest';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { attach, harnessJson } from './historyRepo';
import { baselineRepo, cloneRepo, type VerifyOutcome, type VerifyRepo } from './verifyRepo';
import { evidenceRequested, recordCapture } from '../../src/utils/record-capture/recordCapture';

export interface Summary {
	commit: string;
	coverage: string;
	gaps: string[];
	records: Array<{ id: string; status: string; valid: boolean }>;
	committedAt: string;
	subject: string;
	detail: string;
}
export interface Index {
	schemaVersion: number;
	branches: Array<{ name: string; head: string }>;
	revisions: Summary[];
	units: Array<{ id: string; growth: Array<{ commit: string; 'source-bytes': number }> }>;
	benchmarks: Array<{
		unit: string;
		metric: string;
		workload: string;
		incompatible: boolean;
		series: Array<{
			profile: string;
			unitOfMeasure: string;
			points: Array<{ commit: string; value: number }>;
		}>;
	}>;
	problems: string[];
}
export interface Built {
	out: string;
	digest: string;
	media: { resolved: number; missing: number };
	problems: string[];
	index: Index;
}
export interface Detail {
	commit: string;
	registry: {
		available: boolean;
		units: Array<{
			id: string;
			sourceMeasurements?: Array<{ metric: string; value: number | null; testedRevision: string }>;
			helpers?: Array<{ name: string; source: string; inputs: Array<{ name: string }> }>;
		}>;
		graph: {
			nodes: Array<{ id: string }>;
			edges: Array<{ from: string; to: string; via: string }>;
		};
	};
	comparison: {
		base: string;
		units: { direct: string[]; indirect: string[]; added: string[] };
	} | null;
	records: Array<{
		id: string;
		scenarios: Array<{
			id: string;
			status: string;
			inherited: boolean;
			origin: { record: string; commit: string };
			states: Array<{ captures: Array<{ media: string | null; sha256: string; gap?: string }> }>;
		}>;
	}>;
	explanations: Array<{ unit: string; symbol: string; behavior: string }>;
}

export interface IndexedCommits {
	failed: string;
	baseline: string;
	changed: string;
	unverified: string;
}

export const build = (target: VerifyRepo, out: string, env = {}) =>
	harnessJson<Built>(target, ['history', 'build', '--out', out], env);

export const detail = async (out: string, summary: Summary | undefined) =>
	JSON.parse(await readFile(join(out, summary?.detail ?? ''), 'utf8')) as Detail;

/**
 * A repository with four commits: one whose only record failed, a verified baseline, a verified
 * change that inherits one scenario, and a commit nobody verified. All records are attached.
 */
export async function indexedRepo(): Promise<{
	repo: VerifyRepo;
	commits: IndexedCommits;
	changed: VerifyOutcome;
}> {
	const baseline = await baselineRepo();
	const repo = await cloneRepo(baseline);
	await baseline.dispose();
	const first = await repo.git(['rev-parse', 'HEAD~1']);
	const head = await repo.git(['rev-parse', 'HEAD']);
	await attach(repo, ['--commit', first]);
	await repo.verify();
	await attach(repo);
	const next = await repo.change('src/utils/slugify.ts', (source) =>
		source.replace('toLowerCase', 'toUpperCase')
	);
	const changed = await repo.verify();
	await attach(repo);
	await repo.git(['commit', '-q', '--allow-empty', '-m', 'chore: not verified yet']);
	const unverified = await repo.git(['rev-parse', 'HEAD']);
	return { repo, commits: { failed: first, baseline: head, changed: next, unverified }, changed };
}

export async function expectSourceMeasures(
	detail: Detail,
	commit: string,
	cache: { repo: VerifyRepo; out: string }
): Promise<void> {
	const unit = detail.registry.units.find((unit) => unit.id === 'function.slugify');
	expect(unit?.sourceMeasurements, 'source metrics exist without a verification record').toEqual(
		expect.arrayContaining([
			expect.objectContaining({ metric: 'source-bytes', value: 100, testedRevision: commit }),
			expect.objectContaining({ metric: 'complexity', value: expect.any(Number) })
		])
	);
	await expectLegacySourceMeasures(cache, commit);
}

async function expectLegacySourceMeasures(
	cache: { repo: VerifyRepo; out: string },
	commit: string
): Promise<void> {
	const path = join(cache.out, 'revisions', `${commit}.json`);
	const original = await readFile(path, 'utf8');
	const legacy = JSON.parse(original);
	for (const unit of legacy.registry.units) delete unit.sourceMeasurements;
	const bytes = JSON.stringify(legacy);
	await writeFile(path, bytes);
	const saved = {
		HARNESS_CONSOLE_DATA: process.env.HARNESS_CONSOLE_DATA,
		HARNESS_SITE_ROOT: process.env.HARNESS_SITE_ROOT
	};
	try {
		process.env.HARNESS_CONSOLE_DATA = cache.out;
		process.env.HARNESS_SITE_ROOT = cache.repo.root;
		const { consoleData } =
			await import('../../packages/reports/src/utils/console-server/consoleServer');
		const fresh = JSON.parse((await consoleData.json(`revisions/${commit}.json`))!) as Detail;
		for (const id of ['function.slugify', 'service.title', 'page.titles']) {
			const measures = fresh.registry.units.find((unit) => unit.id === id)?.sourceMeasurements;
			for (const metric of ['source-bytes', 'complexity'])
				expect(
					measures,
					'older prepared revisions gain selected-commit source measurements'
				).toContainEqual(
					expect.objectContaining({ metric, value: expect.any(Number), testedRevision: commit })
				);
		}
		expect(await readFile(path, 'utf8'), 'stored historical evidence is unchanged').toBe(bytes);
		await benchmarkReader(() => consoleData.json(`revisions/${commit}.json`));
	} finally {
		await writeFile(path, original);
		for (const [key, value] of Object.entries(saved)) {
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
	}
}

async function benchmarkReader(read: () => Promise<string | undefined>): Promise<void> {
	if (!evidenceRequested()) return;
	const samples: number[] = [];
	for (let round = 0; round < 5; round++) {
		const start = performance.now();
		for (let iteration = 0; iteration < 20; iteration++) await read();
		samples.push((performance.now() - start) / 20);
	}
	const context = {
		unit: 'reports.function.console-server',
		callable: 'consoleData',
		workload: 'legacy-revision-json',
		target: 'module',
		samples: 100
	};
	const measurements = [
		{
			...context,
			metric: 'latency-warm-ms',
			unitOfMeasure: 'ms',
			value: samples.sort((a, b) => a - b)[2],
			method:
				'Median of five batches of 20 disk-backed legacy-revision reads with source observations cached after the checked cold read.'
		},
		{
			...context,
			metric: 'process-peak-rss-bytes',
			unitOfMeasure: 'bytes',
			value: process.resourceUsage().maxRSS * 1024,
			method:
				'Peak RSS of the whole benchmark process, including Vitest and fixture setup; not memory attributable to this function.'
		}
	];
	recordCapture(
		{
			evidence: 'console-source-benchmark',
			state: 'legacy-revision',
			kind: 'benchmark',
			file: 'console-source-benchmark.json',
			mediaType: 'application/json'
		},
		JSON.stringify({ measurements })
	);
}
