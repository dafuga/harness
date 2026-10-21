import { hostedEvidenceFields } from './hostedEvidenceFields';
import { regressionViewSchema } from '../../../../../src/core/regressionTypes';
const { s, sha, array, names, obj, bool, num, scenario, unit } = hostedEvidenceFields;
import { hostedEvidenceRecord as record } from './hostedEvidenceRecord';
const changes = obj({
	direct: names,
	indirect: names,
	added: names,
	removed: names
}).strict();
const uncertain = array(obj({ node: s, reason: s, detail: s }).strict());
const attempt = obj({ attempt: s, outcome: s }).strict();
export const hostedEvidenceDetail = obj({
	commit: sha,
	registry: obj({
		available: bool,
		gap: s.optional(),
		units: array(unit),
		scenarios: array(scenario),
		graph: obj({
			edges: array(obj({ from: s, to: s, via: s }).strict())
		}).strict()
	}).strict(),
	comparison: obj({
		base: sha.nullable(),
		record: s,
		units: changes,
		scenarios: names,
		uncertain
	})
		.strict()
		.nullable(),
	sourceImpact: obj({
		base: sha.nullable(),
		expanded: bool,
		units: changes,
		scenarios: names,
		uncertain,
		changed: array(obj({ path: s, status: s }).strict())
	})
		.strict()
		.nullable()
		.optional(),
	side: s.nullable().optional(),
	records: array(record),
	explanations: array(
		obj({
			unit: s,
			symbol: s,
			file: s.optional(),
			change: s,
			behavior: s,
			simplification: attempt,
			performance: attempt
		}).strict()
	),
	rangeReasons: num.optional(),
	regressions: array(regressionViewSchema).optional()
}).strict();
