import type { z } from 'zod';
import type {
	contractItemSchema,
	unitDependencySchema,
	componentManifestSchema,
	scenarioManifestSchema,
	runtimeKinds,
	executionTargetSchema
} from './unitTypes';

export type ContractItem = z.infer<typeof contractItemSchema>;

export type UnitDependency = z.infer<typeof unitDependencySchema>;

export type ComponentManifest = z.infer<typeof componentManifestSchema>;

export type ScenarioManifest = z.infer<typeof scenarioManifestSchema>;

export type RuntimeKind = (typeof runtimeKinds)[number];

export type ExecutionTarget = z.infer<typeof executionTargetSchema>;
