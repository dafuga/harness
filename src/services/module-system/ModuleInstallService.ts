import { ModuleCatalogService } from './ModuleCatalogService';
import { moduleTree } from './moduleTree';
import { moduleStateFile } from './moduleDefinition';
import { modulePackagePlan, moduleGroupPlan } from './modulePlan';
import { writeModuleFiles } from './moduleWrites';

/** Installation prepares code and instructions; it never invokes project scripts or providers. */
export class ModuleInstallService {
	async add(root: string, id: string): Promise<string[]> {
		const catalogService = new ModuleCatalogService();
		const catalog = await catalogService.load(root);
		if (catalog.gaps.length) throw new Error(catalog.gaps.join('\n'));
		const entry = catalog.modules.find((item) => item.definition.id === id);
		if (!entry) throw new Error(`Unknown module: ${id}`);
		if (entry.installed) return [];
		const state = await catalogService.state(moduleTree(root));
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
