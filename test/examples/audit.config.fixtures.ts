import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { filterIgnoredFindings } from '../../src/audit/development-tooling/config';
import type { AuditFinding } from '../../src/audit/development-tooling/types';

export const defaultLimits = {
	maxFileLines: 220,
	maxFunctionLines: 55,
	maxClassLines: 120,
	maxMethodLines: 35,
	maxNestingDepth: 4,
	maxParameters: 4,
	maxComplexity: 10,
	maxClassesPerFile: 1
};

export const suppliedConfig = {
	cleanCode: { mode: 'advisory', minConfidence: 0.9, exclude: ['src/generated/'] },
	ignore: [
		{ path: 'src/legacy/', rule: 'small-file', reason: 'Scheduled for the billing rewrite.' },
		{ path: '   ', reason: 'Blank paths are discarded.' }
	],
	limits: { maxFileLines: 300 }
};

export const ignoreRules = [
	{ path: 'src/legacy/', rule: 'small-file', reason: 'Scheduled for the billing rewrite.' },
	{ path: 'src/reports/summary.ts', reason: 'Tracked in the reports cleanup.' }
];

export const findings: AuditFinding[] = [
	{
		path: 'src/legacy/parser.ts',
		rule: 'small-file',
		message: 'File has 340 lines. Limit is 300.'
	},
	{ path: 'src/legacy/parser.ts', rule: 'max-complexity', message: 'Complexity 14; limit 10.' },
	{ path: 'src/reports/summary.ts', rule: 'max-classes-per-file', message: '2 classes; limit 1.' },
	{ path: 'src/billing/invoices.ts', rule: 'small-file', message: '412 lines; limit 300.' }
];

export function createProjectRoot(parent: string, name: string): string {
	const root = join(parent, name);
	mkdirSync(root, { recursive: true });
	return root;
}

export function writeConfig(parent: string, name: string, config: object | string): string {
	const root = createProjectRoot(parent, name);
	const contents =
		typeof config === 'string' ? config : (JSON.stringify(config, null, 2) ?? 'null');
	writeFileSync(join(root, 'harness.audit.json'), contents);
	return root;
}

export function errorSummary(call: () => unknown) {
	try {
		call();
		return { name: 'NoError', message: 'Call returned normally.' };
	} catch (error) {
		if (!(error instanceof Error)) return { name: typeof error, message: String(error) };
		const code = 'code' in error ? error.code : undefined;
		return {
			name: error.name,
			message: error.message,
			...(typeof code === 'string' ? { code } : {})
		};
	}
}

export function findingSummary(items: AuditFinding[]) {
	return items.map(({ path, rule }) => ({ path, rule }));
}

export function partitionSummary(result: ReturnType<typeof filterIgnoredFindings>) {
	return {
		activeFindings: findingSummary(result.activeFindings),
		ignoredFindings: findingSummary(result.ignoredFindings)
	};
}
