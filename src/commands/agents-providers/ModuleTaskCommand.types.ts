import type { ModuleTaskServerService } from '../../services/agents-providers/ModuleTaskServerService';

export interface WorkerFlags {
	worker: string;
	modules?: string;
	once?: boolean;
	watch?: boolean;
	json?: boolean;
}
export interface ServeFlags {
	input: string;
	worker: string;
	module?: string[];
	once?: boolean;
	json?: boolean;
}
export type TaskServer = Pick<ModuleTaskServerService, 'run'>;
