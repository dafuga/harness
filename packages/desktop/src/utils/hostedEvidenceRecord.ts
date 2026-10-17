import { z } from 'zod';
import { browserDiagnosticSchema } from '../../../../src/core/browserDiagnostics';
import { hostedEvidenceFields } from './hostedEvidenceFields';
const { s, name, sha, array, names, obj, bool, num, passed, capture } = hostedEvidenceFields;
export const hostedEvidenceRecord = obj({
	id: name,
	status: passed,
	valid: bool,
	problems: names,
	source: obj({ commit: sha, base: sha.nullable() }).strict(),
	profile: s,
	startedAt: s,
	finishedAt: s,
	gates: z.record(z.string(), passed).optional(),
	failures: names,
	tests: array(
		obj({
			id: s,
			kind: s,
			target: s,
			status: z.enum([
				'running',
				'passed',
				'failed',
				'blocked',
				'skipped',
				'not-proven',
				'interrupted'
			]),
			durationMs: num,
			browserErrors: array(browserDiagnosticSchema).optional()
		}).strict()
	),
	scenarios: array(
		obj({
			id: name,
			status: z.enum(['passed', 'failed', 'referenced']),
			testedRevision: sha,
			inherited: bool,
			origin: obj({ record: s, commit: sha }).strict(),
			originTests: array(
				obj({ id: s, status: s, browserErrors: array(browserDiagnosticSchema).optional() }).strict()
			).optional(),
			states: array(
				obj({
					id: name,
					coverage: s,
					reason: s.optional(),
					captures: array(capture)
				}).strict()
			)
		}).strict()
	),
	measurements: array(
		obj({
			unit: s,
			metric: s,
			unitOfMeasure: s,
			value: num.nullable(),
			unavailable: s.optional(),
			partial: s.optional(),
			workload: s.nullable(),
			profile: s.nullable(),
			target: s.optional()
		}).strict()
	),
	budgets: obj({
		findings: array(
			obj({
				unit: s,
				metric: s,
				status: s,
				baseline: num.nullable(),
				measured: num.nullable(),
				target: s.optional(),
				detail: s.optional()
			}).strict()
		)
	}).strict()
}).strict();
