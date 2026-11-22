// @harness-uid u_pyec4qoa2y
import { ModuleCatalogService } from './ModuleCatalogService';
import { moduleTree } from './moduleTree';
import { moduleStateFile } from './moduleDefinition';
import { modulePackagePlan, moduleGroupPlan } from './modulePlan';
import { writeModuleFiles } from './moduleWrites';
import { ExpectedCliError } from '../../core/development-tooling/errors';
import { ModuleCatalogGapError } from './ModuleInstallService.types';

/** Installation prepares code and instructions; it never invokes project scripts or providers. */
export class ModuleInstallService {
	async add(root: string, id: string): Promise<string[]> {
		const catalogService = new ModuleCatalogService();
		const catalog = await catalogService.load(root);
		if (catalog.gaps.length) throw new ModuleCatalogGapError(catalog.gaps.join('\n'));
		const entry = catalog.modules.find((item) => item.definition.id === id);
		if (!entry) throw new ExpectedCliError(`Unknown module: ${id}`);
		const state = await catalogService.state(moduleTree(root));
		if (
			entry.installed &&
			(!entry.definition.testing || state.modules.some((item) => item.definition.id === id))
		)
			return [];
		state.modules.push({ definition: entry.definition, source: entry.source });
		const instructions = entry.definition.instructions.map((line) => `- ${line}`).join('\n');
		const files = [
			...entry.definition.setup,
			await modulePackagePlan(root, entry.definition),
			await moduleGroupPlan(root, entry.definition),
			{
				path: `specification/modules/${id}/README.md`,
				contents: `# ${entry.definition.title}\n\n${entry.definition.description}\n\n${instructions}\n`
			},
			{ path: moduleStateFile, contents: JSON.stringify(state, null, '\t') + '\n' }
		];
		return writeModuleFiles(root, files, ['package.json', 'harness.groups.json', moduleStateFile]);
	}
}
