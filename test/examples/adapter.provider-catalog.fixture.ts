import type { CatalogPaths, CatalogFiles } from './adapter.provider-catalog.test.types';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ProviderCatalogAdapter } from '../../src/adapters/agents-providers/ProviderCatalogAdapter';
import { withTempDir } from '../support/temporary';

/**
 * ProviderCatalogAdapter lists the models of the openai and harness-claude catalog files. Each
 * state constructs it the way the picker does, over catalog files written into a fresh temporary
 * project laid out as the contract's example. Paths are recorded relative to that project, so the
 * cases are the same on every run. What the adapter was given and what it returned is recorded as
 * the cases of its state.
 */
export const prefix = 'provider-catalog-examples-';

export const catalogFiles = {
	openai: '.codex/models_cache.json',
	claude: '.codex/harness-gateway/claude-models.json'
};

/** The catalog file paths inside one temporary project. */
export function pathsIn(directory: string): CatalogPaths {
	return {
		openai: join(directory, catalogFiles.openai),
		claude: join(directory, catalogFiles.claude)
	};
}

/** Writes each file under the project. A string is written as the raw text it already is. */
export function writeFiles(directory: string, files: CatalogFiles): void {
	for (const [file, contents] of Object.entries(files)) {
		const path = join(directory, file);
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, typeof contents === 'string' ? contents : JSON.stringify(contents));
	}
}

/** Lists the picker models of a fresh project that holds these files. */
export function listWith(files: CatalogFiles) {
	return withTempDir(prefix, (directory) => {
		writeFiles(directory, files);
		return new ProviderCatalogAdapter(pathsIn(directory)).list();
	});
}
