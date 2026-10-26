import type { UnitsConfig } from './unitsConfig.types';
import { z } from 'zod';

export const unitsConfigFile = 'harness.units.json';
export const unitsDirectory = 'specification/units';
export const scenariosDirectory = 'specification/scenarios';
export const budgetsLedger = 'specification/budgets/ledger.ndjson';
/** Benchmark workloads: changing one changes what every measurement of it means. */
export const workloadsDirectory = 'specification/workloads';

const text = z.string().min(1);

export const unitsConfigSchema = z.strictObject({
	schemaVersion: z.literal(1),
	/** Revision-bound adoption: historical revisions without this keep their original policy. */
	testing: z.literal(1).optional(),
	workspaces: z.array(z.strictObject({ name: z.string(), root: text })).min(1),
	tests: z.array(text),
	global: z.array(text),
	ignored: z.array(text),
	references: z.array(
		z.strictObject({
			from: text,
			specifier: text,
			to: z.string().optional(),
			external: z.string().optional(),
			reason: text
		})
	)
});

/** Files whose change can affect every unit and therefore every test. */
export const defaultGlobalFiles = [
	'package.json',
	'bun.lock',
	'bun.lockb',
	'tsconfig.json',
	'vitest.config.ts',
	'vite.config.ts',
	'svelte.config.js',
	'playwright.config.ts',
	'eslint.config.js',
	'eslint.harness-rules.js',
	'harness.audit.json',
	'harness.groups.json',
	unitsConfigFile,
	'harness.verify.json',
	'tailwind.config.js',
	'postcss.config.js',
	'.prettierrc',
	'Cargo.toml',
	'Cargo.lock',
	'rust-toolchain.toml',
	'test/setup.ts'
];

export const defaultUnitsConfig: UnitsConfig = {
	schemaVersion: 1,
	workspaces: [{ name: '', root: '.' }],
	tests: ['test/', 'tests/', 'src/routes/**/__harness/**/*.svelte'],
	global: [],
	ignored: ['**/*.md', 'specification/features/', 'specification/loops/', '.gitignore'],
	references: []
};

/** Minimal glob: a trailing slash is a prefix, `**` crosses folders and `*` stays in one. */
export function pathMatches(path: string, pattern: string): boolean {
	if (pattern.endsWith('/')) return path.startsWith(pattern);
	if (!pattern.includes('*')) return path === pattern;
	const source = pattern
		.split('**/')
		.map((part) => part.split('*').map(escapePattern).join('[^/]*'))
		.join('(?:.*/)?');
	return new RegExp(`^${source}$`).test(path);
}

function escapePattern(value: string): string {
	return value.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
}

export type { UnitsConfig } from './unitsConfig.types';
