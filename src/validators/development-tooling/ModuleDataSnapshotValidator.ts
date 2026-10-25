import { z } from 'zod';
import type { ModuleDataSnapshotValidatorResult } from './ModuleDataSnapshotValidator.types';
const identity = z.object({
	id: z.string().min(1),
	kind: z.string().min(1),
	status: z.enum(['active', 'retired'])
});
const snapshot = z.object({
	declarations: z.array(identity),
	registry: z.object({ units: z.array(identity) }),
	modules: z.array(
		z.object({
			id: z.string().min(1),
			kind: z.string().min(1),
			issues: z.array(
				z.object({
					kind: z.enum(['metadata', 'evidence']).optional(),
					field: z.string().min(1),
					message: z.string().min(1),
					repair: z.string().min(1)
				})
			)
		})
	),
	relationships: z.record(z.string(), z.record(z.string(), z.array(z.string()))),
	issues: z.array(z.string())
});
const relations = [
	'pages',
	'layouts',
	'components',
	'functions',
	'configs',
	'services',
	'types',
	'apis',
	'models',
	'usedBy',
	'support'
];
/** Reject incomplete snapshots even when their JSON was re-sealed or a missing report was omitted. */
export class ModuleDataSnapshotValidator {
	validate(input: unknown): ModuleDataSnapshotValidatorResult {
		const parsed = snapshot.safeParse(input);
		if (!parsed.success)
			return {
				valid: false,
				errors: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
			};
		const { declarations, registry, modules, relationships } = parsed.data;
		const known = new Map(registry.units.map((unit) => [unit.id, unit]));
		const active = registry.units.filter((unit) => unit.status === 'active'),
			ids = new Set(active.map((unit) => unit.id));
		const reports = new Map(modules.map((unit) => [unit.id, unit]));
		const errors: string[] = [];
		if (known.size !== registry.units.length || reports.size !== modules.length)
			errors.push('Duplicate module identities.');
		errors.push(...declarationErrors(declarations, known));
		if (modules.length !== ids.size || modules.some((unit) => !ids.has(unit.id)))
			errors.push('Validation reports do not cover exactly the active modules.');
		for (const unit of active) {
			if (reports.get(unit.id)?.kind !== unit.kind)
				errors.push(`${unit.id}: missing validation report.`);
			errors.push(...relationshipErrors(unit.id, relationships, ids));
		}
		return { valid: errors.length === 0, errors };
	}
}

function declarationErrors(
	declarations: Array<{ id: string; kind: string; status: string }>,
	known: Map<string, { kind: string; status: string }>
) {
	const matching =
		declarations.length === known.size &&
		new Set(declarations.map((unit) => unit.id)).size === known.size &&
		declarations.every(
			(unit) => known.get(unit.id)?.kind === unit.kind && known.get(unit.id)?.status === unit.status
		);
	return matching ? [] : ['Declarations and registry do not cover the same modules.'];
}
function relationshipErrors(
	id: string,
	relationships: Record<string, Record<string, string[]>>,
	ids: Set<string>
) {
	const errors: string[] = [];
	const recorded = Object.hasOwn(relationships, id) ? relationships[id] : {};
	for (const field of relations) {
		if (!Object.hasOwn(recorded, field)) errors.push(`${id}: missing relationships.${field}.`);
		else if (recorded[field].some((target) => !ids.has(target)))
			errors.push(`${id}: unknown relationships.${field} target.`);
	}
	return errors;
}
