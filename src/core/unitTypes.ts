import { z } from 'zod';

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
	description: z.string().optional()
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
	/** `kind` and `entry` name the default execution target; `targets` lists every applicable one. */
	runtime: executionTargetSchema.extend({ targets: z.array(executionTargetSchema).min(1) }),
	scenarios: z.array(identifier),
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

export const scenarioManifestSchema = z.strictObject({
	schemaVersion: z.literal(1),
	id: identifier,
	title: text,
	kind: z.enum(['ui', 'headless', 'audio']),
	units: z.array(identifier).min(1),
	states: z
		.array(
			z.strictObject({
				id: identifier,
				title: text,
				coverage: z.enum(['required', 'missing', 'inapplicable']),
				reason: z.string().optional(),
				/**
				 * The units this state shows. A unit that some state names is covered only by the
				 * states that name it; a unit no state names is covered by every state.
				 */
				units: z.array(identifier).min(1).optional()
			})
		)
		.min(1),
	viewports: z.array(
		z.strictObject({
			id: identifier,
			width: z.number().int().positive(),
			height: z.number().int().positive(),
			/** Device pixel ratio of the capture; pixel dimensions are multiplied by it. */
			scale: z.number().positive().optional()
		})
	),
	tests: z
		.array(
			z.strictObject({
				id: identifier,
				kind: z.enum(['unit', 'integration', 'e2e']),
				runner: z.enum(['vitest', 'playwright', 'command']),
				target: text,
				cwd: z.string().optional(),
				/** Hard limit for this check; the configured default applies when omitted. */
				timeoutMs: z.number().int().positive().optional()
			})
		)
		.min(1),
	evidence: z.array(
		z.strictObject({
			id: identifier,
			kind: z.enum(['screenshot', 'audio', 'output', 'assertions', 'trace', 'benchmark']),
			states: z.array(identifier),
			viewports: z.array(identifier),
			provenance: z.enum(['fixture', 'actual-capture']).optional(),
			/** The declared build whose server must have produced these captures. */
			build: identifier.optional(),
			/** A screenshot shows exactly the viewport, or the full page at viewport width. */
			capture: z.enum(['viewport', 'full-page']).optional(),
			required: z.boolean()
		})
	)
});

export type ContractItem = z.infer<typeof contractItemSchema>;
export type UnitDependency = z.infer<typeof unitDependencySchema>;
export type ComponentManifest = z.infer<typeof componentManifestSchema>;
export type ScenarioManifest = z.infer<typeof scenarioManifestSchema>;
export type RuntimeKind = (typeof runtimeKinds)[number];
export type ExecutionTarget = z.infer<typeof executionTargetSchema>;
