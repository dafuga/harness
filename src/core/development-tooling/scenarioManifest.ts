import { z } from 'zod';

const identifier = z.string().regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/);
const text = z.string().trim().min(1);

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
				/** Stable unit case IDs executed by this scenario check. */
				cases: z.array(z.strictObject({ unit: identifier, case: identifier })).optional(),
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
			/** A screenshot shows the viewport, full page, or explicitly bounded element. */
			capture: z.enum(['viewport', 'full-page', 'element']).optional(),
			required: z.boolean()
		})
	)
});
