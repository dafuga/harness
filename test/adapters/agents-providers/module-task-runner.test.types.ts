import type { ModuleTaskRunnerAdapter } from '../../../src/adapters/agents-providers/ModuleTaskRunnerAdapter';

export type Seam = ConstructorParameters<typeof ModuleTaskRunnerAdapter>[0];
