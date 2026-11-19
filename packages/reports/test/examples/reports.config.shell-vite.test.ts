import { afterEach, beforeEach, test, vi } from 'vitest';
import type { Plugin, UserConfig } from 'vite';
import { existsSync } from 'node:fs';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';

/**
 * The config reads SHELL_FIXTURE_PAGE when its module loads, so each case loads it again with its
 * own environment. Only noncatalog pages are invoked: the catalog page runs buildData through bun.
 */

type ShellConfigModule = { default: () => Promise<UserConfig> };
type FixtureVariable = 'SHELL_FIXTURE_PAGE' | 'SHELL_FIXTURE_OUT';

const unitId = 'reports.config.shell-vite';
const variables: FixtureVariable[] = ['SHELL_FIXTURE_PAGE', 'SHELL_FIXTURE_OUT'];
const saved = new Map<FixtureVariable, string | undefined>();

beforeEach(() => {
	for (const name of variables) saved.set(name, process.env[name]);
});

afterEach(() => {
	for (const [name, value] of saved) {
		if (value === undefined) delete process.env[name];
		else process.env[name] = value;
	}
	saved.clear();
});

/** Loads the config module fresh under the given fixture variables and resolves its config. */
async function loadShellConfig(environment: Partial<Record<FixtureVariable, string>>) {
	for (const name of variables) {
		const value = environment[name];
		if (value === undefined) delete process.env[name];
		else process.env[name] = value;
	}
	vi.resetModules();
	const module =
		(await import('../../src/configs/development-tooling/shellViteConfig')) as ShellConfigModule;
	return module.default();
}

/**
 * Plugin objects in a nested plugin list, skipping the empty entries that conditions leave out.
 * Walks the list as unknown so TypeScript never flattens the recursive PluginOption type.
 */
function collectPlugins(entries: unknown, found: Plugin[] = []): Plugin[] {
	if (Array.isArray(entries)) {
		for (const entry of entries) collectPlugins(entry, found);
	} else if (typeof entries === 'object' && entries !== null) {
		found.push(entries as Plugin);
	}
	return found;
}

/** Names of the plugins the config lists, with the empty entries that its conditions leave out. */
function pluginNames(config: UserConfig): string[] {
	return collectPlugins(config.plugins).map((plugin) => plugin.name);
}

/** Runs the media plugin's bundle hook against a stand-in context and returns what it emitted. */
function mediaEmissions(config: UserConfig): unknown[] {
	const emitted: unknown[] = [];
	const media = collectPlugins(config.plugins).find(
		(plugin) => plugin.name === 'catalog-fixture-media'
	);
	const generate = media?.generateBundle as unknown as (this: unknown) => void;
	generate.call({ emitFile: (file: unknown) => emitted.push(file) });
	return emitted;
}

/** The alias keys a config resolves, and whether each target path exists on disk. */
function aliasSummary(config: UserConfig) {
	const alias = (config.resolve?.alias ?? {}) as Record<string, string>;
	return {
		aliases: Object.keys(alias).sort(),
		targetsPresent: Object.fromEntries(
			Object.entries(alias).map(([find, target]) => [find, existsSync(target)])
		)
	};
}

/** Whether a path the config names exists, relative to the reports package. */
function present(path: string): boolean {
	return existsSync(new URL(`../../${path}`, import.meta.url));
}

test('Resolves the default navbar fixture', async () => {
	const state = 'resolves-the-default-navbar-fixture';
	const config = await loadShellConfig({});
	const summary = {
		build: config.build,
		define: config.define,
		publicDir: config.publicDir,
		logLevel: config.logLevel,
		resolve: config.resolve ?? null,
		pluginNames: pluginNames(config),
		mediaEmissions: mediaEmissions(config)
	};
	expect(summary).toMatchObject({
		build: {
			outDir: 'output/shell-fixture/navbar',
			emptyOutDir: true,
			cssCodeSplit: false,
			lib: {
				entry: 'tests/e2e/support/shell/navbarEntry.ts',
				formats: ['iife'],
				name: 'ShellFixture',
				fileName: 'page'
			}
		},
		define: { 'process.env.NODE_ENV': '"production"' },
		publicDir: false,
		logLevel: 'warn',
		resolve: null,
		mediaEmissions: []
	});
	expect(summary.define).not.toHaveProperty('__COMPONENT_PREVIEW_DATA__');
	expect(summary.pluginNames).toContain('catalog-fixture-media');
	expect(summary.pluginNames).not.toContain('catalog-context-styles');
	expect(present('tests/e2e/support/shell/navbarEntry.ts')).toBe(true);
	recordExampleCases(
		{ unitId, symbol: 'default', state, evidence: 'examples-cases', file: `${state}.json` },
		[
			{
				name: 'default config with SHELL_FIXTURE_PAGE unset builds the navbar fixture',
				input: { SHELL_FIXTURE_PAGE: null, SHELL_FIXTURE_OUT: null },
				output: summary
			}
		]
	);
});

test('Resolves the selected fixture page and output', async () => {
	const state = 'resolves-the-selected-fixture-page-and-output';
	const override = await loadShellConfig({
		SHELL_FIXTURE_PAGE: 'activity',
		SHELL_FIXTURE_OUT: 'output/shell-fixture-check/activity'
	});
	const errors = await loadShellConfig({ SHELL_FIXTURE_PAGE: 'errors' });
	const components = await loadShellConfig({ SHELL_FIXTURE_PAGE: 'components' });
	const cases = {
		activity: { outDir: override.build?.outDir, entry: override.build?.lib },
		errors: { outDir: errors.build?.outDir, entry: errors.build?.lib },
		components: aliasSummary(components)
	};
	expect(cases.activity).toEqual({
		outDir: 'output/shell-fixture-check/activity',
		entry: {
			entry: 'tests/e2e/support/shell/activityEntry.ts',
			formats: ['iife'],
			name: 'ShellFixture',
			fileName: 'page'
		}
	});
	expect(present('tests/e2e/support/shell/activityEntry.ts')).toBe(true);
	expect(cases.errors.outDir).toBe('output/shell-fixture/errors');
	expect(present('tests/e2e/support/shell/errorsEntry.ts')).toBe(true);
	expect(cases.components.aliases).toEqual(
		['$app/navigation', '$app/paths', '$app/state', '$desktop', '$reports', '$shared'].sort()
	);
	expect(Object.values(cases.components.targetsPresent).every(Boolean)).toBe(true);
	recordExampleCases(
		{ unitId, symbol: 'default', state, evidence: 'examples-cases', file: `${state}.json` },
		[
			{
				name: 'SHELL_FIXTURE_PAGE=activity and SHELL_FIXTURE_OUT select its page entry and output',
				input: {
					SHELL_FIXTURE_PAGE: 'activity',
					SHELL_FIXTURE_OUT: 'output/shell-fixture-check/activity'
				},
				output: cases.activity
			},
			{
				name: 'SHELL_FIXTURE_PAGE=errors uses the default output directory for that page',
				input: { SHELL_FIXTURE_PAGE: 'errors' },
				output: cases.errors.outDir
			},
			{
				name: 'components page aliases the $app modules and $desktop, $shared and $reports paths',
				input: { SHELL_FIXTURE_PAGE: 'components' },
				output: cases.components
			}
		]
	);
});
