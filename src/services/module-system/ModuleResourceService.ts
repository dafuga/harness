import { ModuleCatalogService } from './ModuleCatalogService';
import { moduleTree } from './moduleTree';
import { moduleStateFile } from './moduleDefinition';
import { writeModuleFiles } from './moduleWrites';
import { toCamelCase, toKebabCase, toPascalCase } from '../../helpers/strings/case';
import { validateCodeName } from '../../core/development-tooling/validation';

/** Module-owned templates extend generation without changing the built-in scaffold enum. */
export class ModuleResourceService {
	async generate(root: string, module: string, type: string, requested: string): Promise<string[]> {
		const name = validateCodeName(requested);
		const service = new ModuleCatalogService();
		const state = await service.state(moduleTree(root));
		const installed = state.modules.find((item) => item.definition.id === module);
		if (!installed) throw new Error(`Install module ${module} before generating resources.`);
		const resource = installed.definition.resources.find((item) => item.id === type);
		if (!resource) throw new Error(`Unknown resource type ${module}.${type}.`);
		if (
			state.resources.some(
				(item) =>
					item.module === module &&
					item.type === type &&
					toPascalCase(item.name) === toPascalCase(name)
			)
		)
			throw new Error(`Resource ${name} already exists.`);
		const expand = templateExpansion(name);
		const files = resource.files.map((file) => ({
			path: expand(file.path),
			contents: expand(file.contents)
		}));
		state.resources.push({ module, type, name, files: files.map((file) => file.path) });
		return writeModuleFiles(
			root,
			[...files, { path: moduleStateFile, contents: JSON.stringify(state, null, '\t') + '\n' }],
			[moduleStateFile],
			false
		);
	}
}

function templateExpansion(name: string) {
	const variables: Record<string, string> = {
		name,
		PascalName: toPascalCase(name),
		camelName: toCamelCase(name),
		kebabName: toKebabCase(name)
	};
	const expand = (source: string) =>
		source.replace(/\{\{([A-Za-z]+)\}\}/g, (_, key) => {
			if (!(key in variables)) throw new Error(`Unknown module template variable ${key}.`);
			return variables[key];
		});
	return expand;
}
