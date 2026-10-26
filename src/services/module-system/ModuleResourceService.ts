import { moduleGroupConfig } from '../../configs/development-tooling/moduleGroupsConfig';
import { moduleGroupPlan } from './modulePlan';
import { ModuleCatalogService } from './ModuleCatalogService';
import { ModuleScaffoldService } from './ModuleScaffoldService';
import { ModulePackageService } from './ModulePackageService';
import type {
	ModuleResourceRequest,
	ModuleResource,
	ModuleState,
	ModuleResourcePlan
} from './moduleDefinition.types';
import { moduleTree } from './moduleTree';
import { moduleStateFile } from './moduleDefinition';
import { writeModuleFiles } from './moduleWrites';
import { toCamelCase, toKebabCase, toPascalCase } from '../../helpers/strings/case';
import { validateCodeName } from '../../core/development-tooling/validation';

/** Included and installed capabilities share resource admission, generators and persisted instances. */
export class ModuleResourceService {
	async generate(
		root: string,
		module: string,
		type: string,
		requested: string | ModuleResourceRequest
	): Promise<string[]> {
		const request = typeof requested === 'string' ? { name: requested } : requested;
		const { entry, resource, state } = await resourceAdmission(root, module, type);
		const name =
			resource.generator?.kind === 'dependency' ? request.name : validateCodeName(request.name);
		if (
			state.resources.some(
				(item) =>
					item.module === module &&
					item.type === type &&
					toPascalCase(item.name) === toPascalCase(name)
			)
		)
			throw new Error(`Resource ${name} already exists.`);
		if (!state.modules.some((item) => item.definition.id === module))
			state.modules.push({ definition: entry.definition, source: entry.source });
		const plan = await resourcePlan(root, resource, { ...request, name });
		const { generated, files } = plan;
		state.resources.push({
			module,
			type,
			name,
			files: [...generated, ...files.map((file) => file.path)]
		});
		return persistResource(root, state, plan);
	}
}
function templateExpansion(name: string, group?: string) {
	const variables: Record<string, string> = {
		name,
		group: group ?? toKebabCase(name),
		PascalName: toPascalCase(name),
		camelName: toCamelCase(name),
		snakeName: toKebabCase(name).replaceAll('-', '_'),
		kebabName: toKebabCase(name)
	};
	return (source: string) =>
		source.replace(/\{\{([A-Za-z]+)\}\}/g, (_, key) => {
			if (!(key in variables)) throw new Error(`Unknown module template variable ${key}.`);
			return variables[key];
		});
}

async function resourceAdmission(root: string, module: string, type: string) {
	const service = new ModuleCatalogService(),
		catalog = await service.load(root);
	if (catalog.gaps.length) throw new Error(catalog.gaps.join('\n'));
	const entry = catalog.modules.find((item) => item.definition.id === module && item.installed);
	if (!entry) throw new Error(`Install module ${module} before generating resources.`);
	const resource = entry.definition.resources.find((item) => item.id === type);
	if (!resource) throw new Error(`Unknown resource type ${module}.${type}.`);
	return { entry, resource, state: await service.state(moduleTree(root)) };
}
async function resourcePlan(
	root: string,
	resource: ModuleResource,
	request: ModuleResourceRequest
): Promise<ModuleResourcePlan> {
	const expand = templateExpansion(request.name, request.group);
	const dependency = resource.generator?.kind === 'dependency';
	const files = dependency
		? [await new ModulePackageService().plan(root, request.name)]
		: resource.files.map((file) => ({ path: expand(file.path), contents: expand(file.contents) }));
	const grouped = resource.files.some(
		(file) => file.path.includes('{{group}}') || file.contents.includes('{{group}}')
	);
	if (grouped) {
		const id = request.group ?? toKebabCase(request.name);
		const title = id
			.split('-')
			.map((word) => word[0].toUpperCase() + word.slice(1))
			.join(' ');
		const group = moduleGroupConfig.parse({ id, title, terms: [id] });
		files.push(await moduleGroupPlan(root, group));
	}

	const generated =
		resource.generator?.kind === 'scaffold'
			? await new ModuleScaffoldService().generate(root, resource, request)
			: [];
	return {
		files,
		generated,
		replace: [
			moduleStateFile,
			...(dependency ? ['package.json'] : []),
			...(grouped ? ['harness.groups.json'] : [])
		]
	};
}
async function persistResource(
	root: string,
	state: ModuleState,
	plan: ModuleResourcePlan
): Promise<string[]> {
	const writes = await writeModuleFiles(
		root,
		[...plan.files, { path: moduleStateFile, contents: JSON.stringify(state, null, '\t') + '\n' }],
		plan.replace,
		false
	);
	return [...plan.generated, ...writes];
}
