import type { ModuleTaskService } from '../src/services/agents-providers/ModuleTaskService';

export type Prepared = ReturnType<ModuleTaskService['prepare']> & {
	files: string[];
	role: 'implementation' | 'verification';
};

export type ProjectWork = (service: ModuleTaskService) => Promise<void>;
