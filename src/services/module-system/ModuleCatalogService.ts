import type { ModuleCatalog, ModuleDefinition, ModuleState } from './moduleDefinition.types';
import type { SourceTree } from '../../core/development-tooling/sourceTypes';
import { moduleDefinitionSchema, moduleStateFile, moduleStateSchema } from './moduleDefinition';
import { builtinModules } from '../../templates/module-system/builtinModules';
import { moduleTree } from './moduleTree';

/** One discovery contract for the CLI and immutable Explorer revision projections. */
export class ModuleCatalogService {
	load(root: string): Promise<ModuleCatalog> {
		return this.at(moduleTree(root));
	}

	async at(
		tree: Pick<SourceTree, 'read'> & { list(): Promise<Array<{ path: string }>> }
	): Promise<ModuleCatalog> {
		const gaps: string[] = [];
		const state = await this.state(tree, gaps);
		const entries = await this.definitions(tree, gaps);
		// Installed definitions are frozen with the project, never upgraded by the indexer's library.
		for (const entry of state.modules) entries.set(entry.definition.id, entry);
		return {
			gaps,
			modules: [...entries.values()]
				.map((entry) => ({
					...entry,
					installed:
						Boolean(entry.definition.includedByDefault) ||
						state.modules.some((installed) => installed.definition.id === entry.definition.id),
					instances: state.resources.filter((instance) => instance.module === entry.definition.id)
				}))
				.sort(
					(a, b) =>
						(a.definition.order ?? 100) - (b.definition.order ?? 100) ||
						a.definition.title.localeCompare(b.definition.title)
				)
		};
	}

	private async definitions(
		tree: Pick<SourceTree, 'read'> & { list(): Promise<Array<{ path: string }>> },
		gaps: string[]
	) {
		const definitions = new Map(
			builtinModules.map((definition) => [
				definition.id,
				{ definition, source: 'builtin' as const }
			])
		);
		const entries = new Map<
			string,
			{ definition: ModuleDefinition; source: 'builtin' | 'project' }
		>(definitions);
		for (const entry of await tree.list()) {
			const match = /^specification\/modules\/([a-z][a-z0-9-]*)\/module\.json$/.exec(entry.path);
			if (!match) continue;
			try {
				const definition = moduleDefinitionSchema.parse(JSON.parse(await tree.read(entry.path)));
				if (definition.id !== match[1] || definitions.has(definition.id))
					throw new Error('Module identity collision');
				entries.set(definition.id, { definition, source: 'project' });
			} catch {
				gaps.push(`Invalid module definition: ${entry.path}`);
			}
		}
		return entries;
	}

	async state(tree: Pick<SourceTree, 'read'>, gaps?: string[]): Promise<ModuleState> {
		let source: string;
		try {
			source = await tree.read(moduleStateFile);
		} catch (error) {
			if (
				(error as { code?: string }).code === 'ENOENT' ||
				/not (?:found|exist)|does not exist/i.test(String(error))
			)
				return emptyState();
			if (gaps) {
				gaps.push('Module installation state could not be read.');
				return emptyState();
			}
			throw error;
		}
		try {
			const state = moduleStateSchema.parse(JSON.parse(source));
			if (new Set(state.modules.map((entry) => entry.definition.id)).size !== state.modules.length)
				throw new Error('Duplicate installation');
			return state;
		} catch {
			if (!gaps) throw new Error('Invalid module installation state.');
			gaps.push('Invalid module installation state.');
			return emptyState();
		}
	}
}

function emptyState(): ModuleState {
	return { schemaVersion: 1, modules: [], resources: [] };
}
