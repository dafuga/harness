import { z } from 'zod';
import { compositionSchema } from './composition';
import { testContractSchema } from '../../services/verification-evidence/test-contract-service/testContractSchema';

export const unitIdPattern = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const identifier = z
	.string()
	.regex(unitIdPattern, 'must be a lowercase dotted or dashed identifier');
const text = z.string().trim().min(1, 'must not be empty');

export const dependencyVias = [
	'import',
	'reexport',
	'dynamic-import',
	'require',
	'url',
	'style-import',
	'process',
	'http',
	'wasm',
	'contract'
] as const;
export const runtimeKinds = ['module', 'wasm', 'process', 'http'] as const;
export const performanceMetrics = [
	'latency-cold-ms',
	'latency-warm-ms',
	'latency-floor-ms',
	'throughput-ops',
	'memory-bytes'
] as const;

/** Performance may drift this far from its baseline; only a recorded approval may change it. */
export const performanceTolerance = 0.05;

export const contractItemSchema = z.strictObject({
	name: text,
	type: text,
	description: z.string().optional(),
	/** Values a person declared as examples of the item; any JSON, kept exactly as written. */
	examples: z.array(z.json()).optional()
});

/** Authored usage, distinct from observed verification evidence. */
export const usageExampleSchema = z
	.strictObject({
		name: text.max(160),
		description: z.string().max(500).optional(),
		call: text.max(16_000).optional(),
		input: z.json(),
		output: z.json().optional(),
		returns: z.literal('void').optional(),
		error: z.json().optional()
	})
	.refine(
		(example) =>
			[
				Object.hasOwn(example, 'output'),
				Object.hasOwn(example, 'error'),
				example.returns === 'void'
			].filter(Boolean).length === 1
	);

/** Reviewed helper declarations, derived at indexing time and pinned with the source. */
export const helperContractSchema = z.strictObject({
	name: text,
	source: text,
	inputs: z.array(contractItemSchema),
	output: z.string().optional(),
	pure: z.literal(true),
	/** Optional for reading historical manifests; current registry checks require examples. */
	examples: z
		.array(usageExampleSchema.refine((example) => Boolean(example.call)))
		.min(1)
		.max(64)
		.optional(),
	consumers: z.array(z.strictObject({ unit: identifier, symbol: text.optional() })).min(2)
});

export const unitDependencySchema = z.strictObject({
	unit: identifier,
	via: z.enum(dependencyVias),
	origin: z.enum(['derived', 'declared']),
	contract: z.string().optional()
});

export const performanceBudgetSchema = z.strictObject({
	workload: identifier,
	metric: z.enum(performanceMetrics),
	/** Execution target the budget applies to; the unit's default target when omitted. */
	target: z.enum(runtimeKinds).optional(),
	tolerance: z
		.number()
		.min(0)
		.max(performanceTolerance, 'cannot exceed the 5% policy; record a reviewer approval instead')
});

/** One way a unit can be executed. */
export const executionTargetSchema = z.strictObject({
	kind: z.enum(runtimeKinds),
	entry: text,
	environment: z.string().optional(),
	/** Exported function a module target calls with a runtime request; defaults to `invoke`. */
	handler: z.string().optional()
});

export const componentManifestSchema = z.strictObject({
	schemaVersion: z.literal(1),
	id: identifier,
	kind: identifier,
	title: text,
	responsibility: text,
	/** `derived` marks the generated placeholder; `declared` marks a statement a person wrote. */
	responsibilityOrigin: z.enum(['derived', 'declared']),
	status: z.enum(['active', 'retired']),
	/** Source-declared atomic composition; absent on older revisions. */
	composition: compositionSchema.optional(),
	/** Committed usage documentation, read from the same source tree as this manifest. */
	documentation: z
		.string()
		.regex(/^(?!\/)(?!.*(?:^|\/)\.{1,2}(?:\/|$))[a-zA-Z0-9_./-]+\.md$/)
		.optional(),
	/** Internal implementation units stay addressable as dependencies but out of public catalogs. */
	catalog: z.strictObject({ visibility: z.enum(['public', 'internal']) }).optional(),
	/** Reviewed controls people intentionally change; other exports are implementation details. */
	configControls: z
		.array(
			z.strictObject({
				source: text,
				name: text,
				audience: z.enum(['user', 'developer', 'operator']),
				purpose: text
			})
		)
		.min(1)
		.optional(),
	retired: z.strictObject({ reason: text, at: text }).optional(),
	/** Retired identities this unit continues; their baselines and history carry over. */
	lineage: z.strictObject({ predecessors: z.array(identifier).min(1) }).optional(),
	owns: z.strictObject({ source: z.array(text), symbols: z.array(text) }),
	contract: z.strictObject({
		origin: z.enum(['derived', 'declared']),
		inputs: z.array(contractItemSchema),
		outputs: z.array(contractItemSchema),
		errors: z.array(contractItemSchema)
	}),
	dependencies: z.array(unitDependencySchema),
	helperContracts: z.array(helperContractSchema).optional(),
	/** `kind` and `entry` name the default execution target; `targets` lists every applicable one. */
	runtime: executionTargetSchema.extend({ targets: z.array(executionTargetSchema).min(1) }),
	scenarios: z.array(identifier),
	/** Authored standardized cases; absent on historical revisions. */
	testing: testContractSchema.optional(),
	/** The one recorded state used to preview a visual unit; never a planning design. */
	preview: z
		.strictObject({ scenario: identifier, state: identifier, viewport: identifier })
		.optional(),
	budgets: z.strictObject({
		size: z.literal('frozen'),
		complexity: z.literal('frozen'),
		performance: z.array(performanceBudgetSchema)
	})
});

export { scenarioManifestSchema } from './scenarioManifest';

export type {
	ContractItem,
	UnitDependency,
	ComponentManifest,
	ScenarioManifest,
	RuntimeKind,
	ExecutionTarget
} from './unitTypes.types';
