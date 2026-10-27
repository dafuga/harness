import { z } from 'zod';
import type { ContractCase, ContractRegistry } from '../TestContractService.types';
import {
	caseOutcomeSchema,
	caseFileSchema
} from '../../../core/verification-evidence/caseOutcomeSchema';

const text = z.string().trim().min(1);
const outcome = caseOutcomeSchema;
const capture = z.strictObject({
	evidence: text,
	kind: z.literal('screenshot'),
	state: text,
	viewport: text.optional(),
	sha256: z.string().regex(/^[a-f0-9]{64}$/),
	note: z.string().optional(),
	provenance: z.enum(['fixture', 'actual-capture']).optional(),
	server: z.strictObject({ revision: text, buildId: text }).optional()
});
const execution = z.strictObject({
	revision: text,
	files: z.array(caseFileSchema),
	outcomes: z.array(outcome),
	visual: z.strictObject({ scenario: text, check: text, captures: z.array(capture) }).optional()
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
	if (registry.required) errors.push(...visualExecutionErrors(registry, run, cases, groups));
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

function visualExecutionErrors(
	registry: ContractRegistry,
	run: z.infer<typeof execution>,
	cases: Array<ContractCase & { unit: string }>,
	groups: Map<string, z.infer<typeof outcome>[]>
): string[] {
	const selected = cases.filter(
		(item) => item.expected?.kind === 'screenshot' && run.files.includes(item.test.file)
	);
	const context = visualContext(registry, run, selected, groups);
	const { counts, errors } = visualCounts(context);
	return [...errors, ...missingVisuals(context, counts), ...duplicateVisuals(counts)];
}

function visualContext(
	registry: ContractRegistry,
	run: z.infer<typeof execution>,
	cases: Array<ContractCase & { unit: string }>,
	groups: Map<string, z.infer<typeof outcome>[]>
) {
	const scenario = registry.scenarios.find((item) => item.id === run.visual?.scenario);
	const check = scenario?.tests.find((item) => item.id === run.visual?.check);
	return { run, cases, groups, scenario, check };
}

function visualCounts(context: ReturnType<typeof visualContext>) {
	const counts = new Map<string, number>();
	const errors: string[] = [];
	for (const image of context.run.visual?.captures ?? []) {
		const binding = boundCapture(image, context);
		if (!binding) errors.push('unbound screenshot capture');
		else counts.set(binding, (counts.get(binding) ?? 0) + 1);
	}
	return { counts, errors };
}

function missingVisuals(context: ReturnType<typeof visualContext>, counts: Map<string, number>) {
	return context.cases.flatMap((item) => {
		const attempts = context.groups.get(key(item.test)) ?? [];
		const last = attempts.reduce<(typeof attempts)[number] | undefined>(
			(latest, next) => (!latest || next.retry > latest.retry ? next : latest),
			undefined
		);
		return (item.viewports ?? []).flatMap((viewport) =>
			counts.has(visualKey(item.unit, item.id, viewport, last?.retry ?? 0))
				? []
				: [`${item.unit}/${item.id}: missing case-bound screenshot at ${viewport}`]
		);
	});
}

function duplicateVisuals(counts: Map<string, number>): string[] {
	return [...counts.values()].some((count) => count > 1)
		? ['ambiguous screenshot case evidence']
		: [];
}

function boundCapture(image: z.infer<typeof capture>, context: ReturnType<typeof visualContext>) {
	const note = captureNote(image.note);
	if (note?.revision !== context.run.revision || note.sha256 !== image.sha256) return undefined;
	const matches = context.cases.filter((item) => item.unit === note.unit && item.id === note.case);
	const item = matches.length === 1 ? matches[0] : undefined;
	if (!item || !image.viewport || !caseSlotMatches(image, item, context)) return undefined;
	const retry = boundRetry(note, item, context);
	return retry === undefined ? undefined : visualKey(item.unit, item.id, image.viewport, retry);
}

function caseSlotMatches(
	image: z.infer<typeof capture>,
	item: ContractCase & { unit: string },
	context: ReturnType<typeof visualContext>
): boolean {
	if (!image.viewport || !context.scenario || !context.check) return false;
	if (!context.check.cases?.some((ref) => ref.unit === item.unit && ref.case === item.id))
		return false;
	if (image.state !== item.state || !item.viewports?.includes(image.viewport)) return false;
	return screenshotSlotMatches(image, item, context);
}

function screenshotSlotMatches(
	image: z.infer<typeof capture>,
	item: ContractCase,
	context: ReturnType<typeof visualContext>
): boolean {
	if (image.provenance !== 'actual-capture' || image.server?.revision !== context.run.revision)
		return false;
	return Boolean(
		context.scenario?.evidence.some(
			(slot) =>
				slot.id === image.evidence &&
				slot.kind === 'screenshot' &&
				slot.required &&
				slot.states.includes(item.state) &&
				slot.viewports.includes(image.viewport!)
		)
	);
}

function boundRetry(
	note: NonNullable<ReturnType<typeof captureNote>>,
	item: ContractCase,
	context: ReturnType<typeof visualContext>
): number | undefined {
	const attempts = (context.groups.get(key(item.test)) ?? []).filter(
		(attempt) => attempt.revision === context.run.revision
	);
	const retry =
		note.retry === null && attempts.length === 1 && attempts[0].retry === 0 ? 0 : note.retry;
	if (retry === null) return undefined;
	return attempts.some((attempt) => attempt.retry === retry && attempt.status !== 'skipped')
		? retry
		: undefined;
}

function captureNote(value: string | undefined) {
	try {
		const note: unknown = JSON.parse(value ?? 'null');
		const schema = z.strictObject({
			unit: text,
			case: text,
			revision: text,
			sha256: text,
			retry: z.number().int().nonnegative().optional()
		});
		const parsed = schema.safeParse(note);
		return parsed.success ? { ...parsed.data, retry: parsed.data.retry ?? null } : undefined;
	} catch {
		return undefined;
	}
}

const visualKey = (unit: string, caseId: string, viewport: string, retry: number) =>
	JSON.stringify([unit, caseId, viewport, retry]);
