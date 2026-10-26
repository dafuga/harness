import type { TaskRunScope } from '../../repositories/agents-providers/ModuleTaskRepository.types';
import type { ModuleData } from '../git-source-history/ModuleDataService.types';

export type ModuleTaskContractSnapshot = Pick<
	ModuleData,
	'declarations' | 'versions' | 'relationships'
> & { sourceCommit: string };

export interface ModuleTaskContractContext {
	scope: TaskRunScope;
	binDirectory: string;
	cleanup(): Promise<void>;
}
