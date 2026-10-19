import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { GitAdapter } from '../adapters/GitAdapter';
import { fail } from '../core/errors';
import { LegacyImportService, type LegacyImport } from "../services/legacy-import-service/LegacyImportService";

export interface ImportOptions {
	root?: string;
	/** Directory of the old report store; it is only read. */
	from?: string;
	/** Project id or name to import when runs were made in another directory. */
	project?: string;
}

/** Imports this repository's legacy reports into Git history, exactly as they were recorded. */
export async function importReports(options: ImportOptions = {}): Promise<LegacyImport> {
	const root = resolve(options.root ?? process.cwd());
	if (!(await new GitAdapter(root).isRepository())) {
		return fail('harness history needs a Git repository.');
	}
	if (!options.from) return fail('--from must name the legacy report store to read.');
	const store = resolve(options.from);
	if (!existsSync(store)) return fail(`${store} does not exist.`);
	return new LegacyImportService(root).import(store, options.project);
}

export function renderImport(result: LegacyImport): string {
	const lines = result.imported.map((item) => {
		const link = item.linked ? `linked to ${item.linked.slice(0, 12)}` : 'unlinked';
		const state = item.created ? 'imported' : 'already imported';
		return `  ${item.id}: ${item.status}, ${item.startedAt}, ${link}, ${item.media} media, ${state}`;
	});
	const skipped = result.skipped.map((item) => `  ${item.id}: skipped, ${item.reason}`);
	return [
		`${result.imported.length} legacy reports of this repository:`,
		...lines,
		...skipped
	].join('\n');
}
