import { catalogFiles, listWith, prefix, pathsIn, writeFiles } from './adapter.provider-catalog.fixture';
import type { CatalogPaths, CatalogFiles } from './adapter.provider-catalog.test.types';
import { existsSync, rmSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'vitest';
import { ProviderCatalogAdapter } from '../../src/adapters/agents-providers/ProviderCatalogAdapter';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

/** A catalog model as the schema reads it, without a visibility unless one is added. */
function entry(slug: string, displayName: string, levels: string[], defaultLevel: string) {
	return {
		slug,
		display_name: displayName,
		default_reasoning_level: defaultLevel,
		supported_reasoning_levels: levels.map((effort) => ({ effort }))
	};
}

const gpt61 = { ...entry('gpt-6.1', 'GPT 6.1', ['high'], 'high'), visibility: 'list' };
const gptInternal = {
	...entry('gpt-6.0-internal', 'GPT 6.0 internal', ['medium'], 'medium'),
	visibility: 'hide'
};
const gpt62 = entry('gpt-6.2', 'GPT 6.2', ['xhigh'], 'xhigh');
const opus = entry('claude-opus-5-5', 'Claude Opus 5.5', ['xhigh'], 'xhigh');
const sonnet = entry('claude-sonnet-5-5', 'Claude Sonnet 5.5', ['xhigh', 'high', 'medium'], 'high');
const gptDraft = entry('gpt-6.1-draft', 'GPT 6.1 draft', [], 'high');

const gpt61Model = {
	provider: 'openai',
	model: 'gpt-6.1',
	label: 'GPT 6.1',
	efforts: ['high'],
	defaultEffort: 'high',
	source: 'local-catalog'
};
const gpt62Model = {
	provider: 'openai',
	model: 'gpt-6.2',
	label: 'GPT 6.2',
	efforts: ['xhigh'],
	defaultEffort: 'xhigh',
	source: 'local-catalog'
};
const opusModel = {
	provider: 'harness-claude',
	model: 'claude-opus-5-5',
	label: 'Claude Opus 5.5',
	efforts: ['xhigh'],
	defaultEffort: 'xhigh',
	source: 'local-catalog'
};
const sonnetModel = {
	provider: 'harness-claude',
	model: 'claude-sonnet-5-5',
	label: 'Claude Sonnet 5.5',
	efforts: ['xhigh', 'high', 'medium'],
	defaultEffort: 'high',
	source: 'local-catalog'
};

/** The catalog paths relative to the project, so recorded cases do not carry a temporary path. */
function relativePaths(directory: string, paths: CatalogPaths): CatalogPaths {
	return {
		openai: relative(directory, paths.openai),
		claude: relative(directory, paths.claude)
	};
}

/** What the adapter was given: the catalog paths and the files that were on disk. */
function recordedInput(files: CatalogFiles) {
	return { paths: catalogFiles, files };
}

/** Lists a fresh project holding these files and returns the case of what went in and came out. */
async function listedCase(name: string, files: CatalogFiles) {
	return { name, input: recordedInput(files), output: await listWith(files) };
}

test('Constructs over catalog paths that do not exist yet', async () => {
	await withTempDir(prefix, (directory) => {
		const paths = pathsIn(directory);
		const adapter = new ProviderCatalogAdapter(paths);
		const held = JSON.parse(JSON.stringify(adapter)) as { paths: CatalogPaths };
		expect(held).toEqual({ paths });
		expect(existsSync(join(directory, '.codex'))).toBe(false);
		recordExampleCases(
			{
				unitId: 'adapter.provider-catalog',
				symbol: 'ProviderCatalogAdapter.constructor',
				state: 'constructs-over-catalog-paths-that-do-not-exist-yet',
				evidence: 'examples-cases',
				file: 'constructs-over-catalog-paths-that-do-not-exist-yet.json'
			},
			[
				{
					name: 'catalog files not yet written under the project',
					input: { paths: catalogFiles },
					output: { paths: relativePaths(directory, held.paths) }
				}
			]
		);
	});
});

test('Lists openai then claude models and omits visibility hide', async () => {
	const both = await listedCase('openai hide entry omitted and claude listed after it', {
		[catalogFiles.openai]: { models: [gpt61, gptInternal] },
		[catalogFiles.claude]: { models: [opus] }
	});
	const hideSpelled = await listedCase('visibility Hide is not exactly hide, so it is kept', {
		[catalogFiles.openai]: { models: [{ ...gpt62, visibility: 'Hide' }] }
	});
	const levels = await listedCase('efforts keep file order and the catalog default', {
		[catalogFiles.claude]: { models: [sonnet] }
	});
	expect(both.output).toEqual([gpt61Model, opusModel]);
	expect(hideSpelled.output).toEqual([gpt62Model]);
	expect(levels.output).toEqual([sonnetModel]);
	recordExampleCases(
		{
			unitId: 'adapter.provider-catalog',
			symbol: 'ProviderCatalogAdapter.list',
			state: 'lists-openai-then-claude-models-and-omits-visibility-hide',
			evidence: 'examples-cases',
			file: 'lists-openai-then-claude-models-and-omits-visibility-hide.json'
		},
		[both, hideSpelled, levels]
	);
});

test('Contributes no models for a missing or invalid catalog', async () => {
	const absent = await listedCase('openai catalog file absent', {
		[catalogFiles.claude]: { models: [opus] }
	});
	const neither = await listedCase('neither catalog file exists', {});
	const notJson = await listedCase('claude catalog is not valid JSON', {
		[catalogFiles.openai]: { models: [gpt61] },
		[catalogFiles.claude]: '{"models": ['
	});
	const invalid = await listedCase('one openai entry fails the schema, so its file drops', {
		[catalogFiles.openai]: { models: [gpt61, gptDraft] },
		[catalogFiles.claude]: { models: [opus] }
	});
	expect(absent.output).toEqual([opusModel]);
	expect(neither.output).toEqual([]);
	expect(notJson.output).toEqual([gpt61Model]);
	expect(invalid.output).toEqual([opusModel]);
	recordExampleCases(
		{
			unitId: 'adapter.provider-catalog',
			symbol: 'ProviderCatalogAdapter.list',
			state: 'contributes-no-models-for-a-missing-or-invalid-catalog',
			evidence: 'examples-cases',
			file: 'contributes-no-models-for-a-missing-or-invalid-catalog.json'
		},
		[absent, neither, notJson, invalid]
	);
});

test('Reads the catalog files again on every list call', async () => {
	await withTempDir(prefix, async (directory) => {
		const adapter = new ProviderCatalogAdapter(pathsIn(directory));
		const first = {
			[catalogFiles.openai]: { models: [gpt61] },
			[catalogFiles.claude]: { models: [opus] }
		};
		const rewritten = { [catalogFiles.openai]: { models: [gpt62] } };
		writeFiles(directory, first);
		const firstCall = await adapter.list();
		writeFiles(directory, rewritten);
		const secondCall = await adapter.list();
		rmSync(join(directory, catalogFiles.claude));
		const thirdCall = await adapter.list();
		expect(firstCall).toEqual([gpt61Model, opusModel]);
		expect(secondCall).toEqual([gpt62Model, opusModel]);
		expect(thirdCall).toEqual([gpt62Model]);
		recordExampleCases(
			{
				unitId: 'adapter.provider-catalog',
				symbol: 'ProviderCatalogAdapter.list',
				state: 'reads-the-catalog-files-again-on-every-list-call',
				evidence: 'examples-cases',
				file: 'reads-the-catalog-files-again-on-every-list-call.json'
			},
			[
				{ name: 'first call with both files', input: recordedInput(first), output: firstCall },
				{
					name: 'second call after the openai file is rewritten',
					input: recordedInput({ ...first, ...rewritten }),
					output: secondCall
				},
				{
					name: 'third call after the claude file is removed',
					input: recordedInput(rewritten),
					output: thirdCall
				}
			]
		);
	});
});
