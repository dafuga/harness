import { z } from 'zod';
import type { ContractRegistry } from '../TestContractService.types';

const text = z.string().trim().min(1);
const path = text.refine(
	(value) =>
		!value.startsWith('/') && !value.split('/').some((part) => ['', '.', '..'].includes(part))
);
const outcome = z.strictObject({
	file: path,
	title: text,
	revision: text,
	status: z.enum(['passed', 'failed', 'skipped']),
	retry: z.number().int().nonnegative().default(0)
});
const execution = z.strictObject({
	revision: text,
	files: z.array(path),
	outcomes: z.array(outcome)
});
const key = (item: { file: string; title: string }) => JSON.stringify([item.file, item.title]);

/** A declaration is coverage only when its exact case finished at the tested revision. */
export function executionCaseErrors(registry: ContractRegistry): string[] {
	if (registry.execution === undefined) return [];
	const parsed = execution.safeParse(registry.execution);
	if (!parsed.success) return [`invalid executed case data: ${parsed.error.message}`];
	const run = parsed.data;
	const cases = registry.units
		.filter((unit) => unit.status === 'active')
		.flatMap((unit) => (unit.testing?.cases ?? []).map((item) => ({ ...item, unit: unit.id })));
	const declared = new Set(cases.map((item) => key(item.test)));
	const files = new Set([
		...run.files,
		...run.outcomes.filter((item) => declared.has(key(item))).map((item) => item.file)
	]);
	const { groups, errors } = observedOutcomes(run, declared, registry.required);
	for (const item of cases) {
		if (!files.has(item.test.file)) continue;
		const attempts = groups.get(key(item.test));
		const last = attempts?.reduce((latest, next) => (next.retry > latest.retry ? next : latest));
		if (!last) errors.push(`${item.unit}/${item.id}: missing executed case`);
		else if (last.status !== 'passed')
			errors.push(`${item.unit}/${item.id}: executed case did not pass`);
	}
	return errors;
}

function observedOutcomes(
	run: z.infer<typeof execution>,
	declared: ReadonlySet<string>,
	required: boolean | undefined
) {
	const groups = new Map<string, z.infer<typeof outcome>[]>();
	const errors: string[] = [];
	for (const item of run.outcomes) {
		const id = key(item),
			attempts = groups.get(id) ?? [];
		if (required && !declared.has(id))
			errors.push(`unsupported executed case: ${item.file}: ${item.title}`);
		if (item.revision !== run.revision)
			errors.push(`executed case has wrong revision: ${item.file}: ${item.title}`);
		if (attempts.some((prior) => prior.retry === item.retry))
			errors.push(`duplicate executed case: ${item.file}: ${item.title}`);
		attempts.push(item);
		groups.set(id, attempts);
	}
	return { groups, errors };
}
