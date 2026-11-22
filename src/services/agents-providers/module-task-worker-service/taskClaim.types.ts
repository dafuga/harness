// @harness-uid u_b4uzqkb2i6
import type { ModuleTask } from '../../../repositories/agents-providers/ModuleTaskRepository.types';

export interface TaskClaimOptions {
	owner: NonNullable<ModuleTask['claim']>['owner'];
	/** Tasks this machine cannot run now; they stay queued for another worker. */
	blocked?: ReadonlySet<string>;
}
