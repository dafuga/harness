import type { z } from 'zod';
import type {
	moduleDefinitionSchema,
	moduleResourceSchema,
	moduleStateSchema
} from './moduleDefinition';

export type ModuleDefinition = z.infer<typeof moduleDefinitionSchema>;
export type ModuleResource = z.infer<typeof moduleResourceSchema>;
export type ModuleState = z.infer<typeof moduleStateSchema>;
export type ModuleInstance = ModuleState['resources'][number];
export interface ModuleEntry {
	definition: ModuleDefinition;
	source: 'builtin' | 'project';
	installed: boolean;
	instances: ModuleInstance[];
}
export interface ModuleCatalog {
	modules: ModuleEntry[];
	gaps: string[];
}
