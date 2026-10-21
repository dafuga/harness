import { z } from 'zod';
import { hostedEvidenceFields } from './hostedEvidenceFields';
const { s, name, sha, hash, array, names, obj, bool, num, mode, passed, capture, scenario } =
	hostedEvidenceFields;
import { hostedEvidenceRecord as record } from './hostedEvidenceRecord';
import { hostedEvidenceDetail as detail } from './hostedEvidenceDetail';
const standing = z.enum(['passed', 'failed', 'stale', 'missing', 'incomplete', 'inapplicable']);
const coverage = obj({
	scenario: name,
	title: s,
	kind: s,
	standing,
	reasons: names,
	tests: array(obj({ id: s, status: s.nullable() }).strict()),
	inheritedFrom: sha.nullable(),
	states: array(
		obj({
			state: name,
			declared: s,
			standing,
			reasons: names,
			slots: array(
				obj({
					evidence: s,
					kind: s,
					viewport: s.nullable(),
					capture: capture.nullable(),
					standing,
					reason: s.nullable()
				}).strict()
			)
		}).strict()
	)
}).strict();
const side = obj({
	commit: sha,
	detail: detail.nullable(),
	record: record.nullable(),
	gap: s.nullable(),
	coverage: array(coverage),
	captures: array(
		obj({
			scenario: name,
			state: name,
			capture,
			standing: z.enum(['fresh', 'inherited', 'rejected', 'unvalidated']),
			usable: bool,
			current: bool,
			inheritedFrom: sha.nullable()
		}).strict()
	)
}).strict();
const change = z.enum(['unchanged', 'differs', 'changed', 'added', 'removed', 'unknown']);
export const hostedEvidenceSchema = obj({
	identity: obj({
		principalId: name,
		projectId: name,
		repositoryId: num.int().nonnegative(),
		requestedRef: name,
		sourceCommit: sha,
		sourceTree: sha,
		notesRef: z.literal('refs/notes/harness'),
		notesRevision: sha.nullable(),
		evidenceRef: z.literal('refs/heads/harness-evidence'),
		evidenceRevision: sha.nullable(),
		historyIndexRevision: s.nullable(),
		collaborationRevision: sha.nullable().optional(),
		artifactHash: hash.nullable(),
		profile: s.nullable()
	}).strict(),
	scope: obj({
		location: obj({
			branch: name.nullable(),
			commit: sha.nullable(),
			category: name.nullable(),
			entity: name.nullable()
		}).strict(),
		mode,
		branch: name.nullable(),
		tip: sha.nullable(),
		commit: sha,
		atTip: bool,
		parent: sha.nullable(),
		summary: obj({
			commit: sha,
			parents: array(sha),
			subject: s,
			author: s,
			committedAt: s,
			branches: names,
			retained: bool,
			coverage: z.enum(['verified', 'failed', 'invalid', 'unverified']),
			gaps: names,
			records: array(
				obj({
					id: s,
					status: passed,
					profile: s,
					finishedAt: s,
					base: sha.nullable(),
					valid: bool,
					problems: names
				}).strict()
			),
			legacy: names,
			changes: obj({
				base: sha.nullable(),
				direct: names,
				added: names,
				removed: names
			})
				.strict()
				.nullable()
				.optional()
		}).strict()
	}).strict(),
	evidence: obj({
		mode,
		scenarios: array(scenario),
		after: side,
		before: side.nullable(),
		initial: s.nullable(),
		incomparable: names
	}).strict(),
	behavior: obj({
		mode,
		rows: array(
			obj({
				scenario: s,
				state: s,
				evidence: s,
				kind: s,
				before: capture.nullable(),
				after: capture.nullable(),
				change,
				differences: names
			}).strict()
		),
		summary: z.enum([...change.options, 'not-compared']),
		reason: s.nullable(),
		scenarios: array(
			obj({
				id: s,
				title: s,
				before: s.nullable(),
				after: s.nullable()
			}).strict()
		)
	}).strict()
}).strict();
