import { z } from 'zod';
const s = z.string().max(1000000),
	name = z.string().min(1).max(300);
const sha = z.string().regex(/^[a-f0-9]{40}$/),
	hash = z.string().regex(/^[a-f0-9]{64}$/);
const array = <T extends z.ZodTypeAny>(item: T) => z.array(item).max(5000);
const names = array(s),
	obj = z.object,
	bool = z.boolean(),
	num = z.number().finite();
const mode = z.enum(['current', 'commit']);
const passed = z.enum(['passed', 'failed']);
const capture = obj({
	evidence: name,
	kind: name,
	state: name,
	viewport: name.optional(),
	status: passed,
	path: s,
	sha256: hash,
	mediaType: name,
	capturedAt: s,
	provenance: s.optional(),
	server: obj({ buildId: s, revision: sha }).strict().optional(),
	transcript: s.optional(),
	durationSeconds: num.optional(),
	media: s.nullable(),
	gap: s.optional()
}).strict();
const scenario = obj({
	id: name,
	title: s,
	kind: name,
	units: names,
	states: array(
		obj({
			id: name,
			coverage: s,
			reason: s.optional(),
			units: names.optional()
		}).strict()
	),
	viewports: array(obj({ id: name, width: num, height: num }).strict()),
	tests: array(obj({ id: name, kind: name, runner: name }).strict()),
	evidence: array(
		obj({ id: name, kind: name, states: names, viewports: names }).strict()
	).optional()
}).strict();
const contractItem = obj({
	name: s,
	type: s,
	description: s.optional()
}).strict();
const unit = obj({
	id: name,
	kind: name,
	status: s,
	title: s,
	responsibility: s,
	dependencies: array(obj({ unit: s, via: s }).strict()),
	scenarios: names,
	owns: obj({ source: names, symbols: names }).strict(),
	contract: obj({
		inputs: array(contractItem),
		outputs: array(contractItem),
		errors: array(contractItem)
	}).strict(),
	runtime: obj({
		kind: s,
		targets: array(obj({ kind: s, entry: s }).strict())
	}).strict(),
	budgets: obj({
		size: s,
		complexity: s,
		performance: array(
			obj({
				workload: s,
				metric: s,
				tolerance: num,
				target: s.optional()
			}).strict()
		)
	}).strict(),
	version: s,
	emitted: obj({
		limits: z.record(z.string(), num),
		unmeasured: z.record(z.string(), s).optional()
	})
		.strict()
		.optional(),
	limits: obj({
		metrics: z.record(z.string(), num),
		unmeasured: z.record(z.string(), s).optional()
	})
		.strict()
		.optional()
}).strict();

export const hostedEvidenceFields = {
	s,
	name,
	sha,
	hash,
	array,
	names,
	obj,
	bool,
	num,
	mode,
	passed,
	capture,
	scenario,
	unit
};
