// @harness-uid u_b4uzqkb2i6
import type { ModuleTask } from '../../../repositories/agents-providers/ModuleTaskRepository.types';

export interface TaskClaimOptions {
	owner: NonNullable<ModuleTask['claim']>['owner'];
	/** Tasks that passed this machine's preflight; others stay queued. All tasks when omitted. */
	runnable?: ReadonlySet<string>;
}
