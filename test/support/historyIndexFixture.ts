import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { attach, harnessJson } from './historyRepo';
import { baselineRepo, cloneRepo, type VerifyOutcome, type VerifyRepo } from './verifyRepo';

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
