import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { recordExampleCases } from '../support/recordExampleCases';
import type { TemporaryRepo } from '../support/temporary.types';

export const unitId = 'function.quote';

export const sourcePath = 'src/quote.ts';

const manifestPath = `specification/units/${unitId}.json`;

export const behavior = 'Returns the quoted amount for a request.';

export const simplification = 'Kept the amount calculation direct.';

export const performance = 'Checked the calculation boundary.';

export function writeFile(root: string, path: string, contents: string): void {
	const fullPath = join(root, path);
	mkdirSync(dirname(fullPath), { recursive: true });
	writeFileSync(fullPath, contents);
}

function manifest(responsibility = 'Quotes an amount.') {
	return {
		schemaVersion: 1,
		id: unitId,
		kind: 'function',
		title: 'quote',
		responsibility,
		responsibilityOrigin: 'declared',
		status: 'active',
		owns: { source: [sourcePath], symbols: ['quote'] },
		contract: { origin: 'declared', inputs: [], outputs: [], errors: [] },
		dependencies: [],
		runtime: {
			kind: 'module',
			entry: sourcePath,
			targets: [{ kind: 'module', entry: sourcePath }]
		},
		scenarios: [],
		budgets: { size: 'frozen', complexity: 'frozen', performance: [] }
	};
}

export function initialize(repo: TemporaryRepo): string {
	writeFile(
		repo.root,
		sourcePath,
		'export function quote(amount: number) { return amount + 1; }\n'
	);
	writeFile(repo.root, manifestPath, JSON.stringify(manifest()));
	writeFile(
		repo.root,
		'harness.verify.json',
		JSON.stringify({
			schemaVersion: 1,
			writing: 2,
			setup: [],
			link: [],
			outputs: [],
			builds: [],
			tools: [],
			runners: {},
			profiles: {},
			checks: [],
			timeouts: { test: 1000 }
		})
	);
	return commit(repo, [sourcePath, manifestPath, 'harness.verify.json'], 'feat: add quote fixture');
}

export function commit(repo: TemporaryRepo, paths: string[], message: string): string {
	repo.git('add', '--', ...paths);
	repo.git('commit', '-m', message);
	return repo.git('rev-parse', 'HEAD');
}

export function reasonInput(
	root: string,
	range: { base: string; symbol: string; recordedAt: string; head?: string }
) {
	const { base, symbol, recordedAt, head } = range;
	return {
		root,
		base,
		...(head ? { head } : {}),
		unit: unitId,
		symbol: [symbol],
		behavior,
		simplification,
		simplificationOutcome: 'improved',
		performance,
		performanceOutcome: 'not-improved',
		now: () => recordedAt
	};
}

export function recordExamples(
	symbol: string,
	state: string,
	cases: Parameters<typeof recordExampleCases>[1]
) {
	recordExampleCases(
		{
			unitId: 'workflow.run-explain',
			symbol,
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
}
