import {
	generateModel,
	generatePiece
} from '../../workflows/projects-sessions/generate-code/generateCode';
import type { ModuleResource, ModuleResourceRequest } from './moduleDefinition.types';
/** Module declarations delegate to the same scaffold workflows as harness generate. */
export class ModuleScaffoldService {
	async generate(
		root: string,
		resource: ModuleResource,
		request: ModuleResourceRequest
	): Promise<string[]> {
		const generator = resource.generator;
		if (generator?.kind !== 'scaffold') throw new Error('A scaffold generator is required.');
		const common = { root, name: request.name, group: request.group };
		const result =
			generator.scaffold === 'model'
				? await generateModel({ ...common, rawFields: [], adapter: 'sqlite' })
				: await generatePiece({ ...common, kind: generator.scaffold, level: generator.level });
		return result.writes.map((write) => write.path);
	}
}
