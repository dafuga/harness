import { expect, test } from 'vitest';
import { HostedEvidenceValidator } from '../../src/validators/HostedEvidenceValidator';
import { asked, hubAnswer, type AnswerAt } from '../hosted-evidence-fixture';

const validator = new HostedEvidenceValidator();
const feed = 'service.feed';
const earlier = 'b'.repeat(40);
const unaccepted = /does not accept/;
const another = /another evidence read/;

/** A hub answer with the value at one dotted path replaced, or removed when undefined. */
function changed(path: string, value: unknown, at: Partial<AnswerAt> = {}): unknown {
	const answer = hubAnswer(at) as unknown as Record<string, unknown>;
	const keys = path.split('.');
	const last = keys.pop() as string;
	let target = answer;
	for (const key of keys) target = target[key] as Record<string, unknown>;
	if (value === undefined) delete target[last];
	else target[last] = value;
	return answer;
}

test('the answer of the hub to exactly what was asked is accepted as it is', () => {
	for (const mode of ['commit', 'current'] as const) {
		const answer = hubAnswer({ mode });
		expect(validator.evidence(answer, { ...asked, mode })).toBe(answer);
	}
	const results = hubAnswer({ entityId: feed });
	expect(validator.evidence(results, { ...asked, entityId: feed }).behavior.rows).toHaveLength(1);
	// A repository without notes or evidence refs is read at no revision of either.
	const bare = hubAnswer({ notesRevision: null, evidenceRevision: null });
	expect(validator.evidence(bare, asked).identity).toMatchObject({
		notesRevision: null,
		evidenceRevision: null
	});
	const legacy = changed('identity.collaborationRevision', undefined);
	expect(validator.evidence(legacy, asked)).toBe(legacy);
});

test('an answer of another read than the one that was asked is refused', () => {
	const other: Array<[string, unknown]> = [
		['scope.commit', earlier],
		['scope.mode', 'current'],
		['scope.branch', 'another-branch'],
		['scope.location.entity', feed],
		['identity.projectId', 'q'],
		['identity.sourceCommit', earlier],
		['evidence.mode', 'current'],
		['evidence.after.commit', earlier],
		['behavior.mode', 'current']
	];
	for (const [path, value] of other)
		expect(() => validator.evidence(changed(path, value), asked), path).toThrow(another);
	const wanted = [
		{ projectId: 'q' },
		{ commit: earlier },
		{ entityId: feed },
		{ mode: 'current' as const }
	];
	for (const query of wanted)
		expect(() => validator.evidence(hubAnswer(), { ...asked, ...query })).toThrow(another);
});

test('an answer that is not exactly recorded evidence is refused', () => {
	const malformed: Array<[string, unknown]> = [
		['extra', true],
		['behavior', undefined],
		['scope', null],
		['identity', 'alice'],
		['evidence', []],
		['identity.sourceTree', 'tree'],
		['identity.notesRevision', 'main'],
		['identity.evidenceRevision', 'HEAD'],
		['identity.principalId', ''],
		['identity.repositoryId', '7'],
		['identity.profile', undefined],
		['identity.token', 'secret'],
		['scope.parent', 'HEAD'],
		['scope.atTip', 'yes'],
		['scope.path', '/etc/passwd'],
		['evidence.address', 'https://example.invalid/x'],
		['evidence.after.captures', {}],
		['evidence.after.captures.0.capture.sha256', 'c'.repeat(63)],
		['evidence.after.captures.0.capture.media', 7],
		['evidence.after.captures.0.scenario', null],
		['evidence.after.record.id', 5],
		['evidence.after.gap', 3],
		['evidence.before.commit', 'c'.repeat(40)],
		['evidence.incomparable', 'none'],
		['behavior.summary', 'fine'],
		['behavior.rows', null],
		['behavior.unknown', 1]
	];
	for (const [path, value] of malformed)
		expect(() => validator.evidence(changed(path, value), asked), path).toThrow(unaccepted);
	const results = { ...asked, entityId: feed };
	for (const [path, value] of [
		['behavior.rows.0.change', 'better'],
		['behavior.rows.0.after.sha256', 'HEAD']
	] as const)
		expect(() => validator.evidence(changed(path, value, { entityId: feed }), results)).toThrow(
			unaccepted
		);
	for (const value of [null, undefined, [], 'evidence', 7])
		expect(() => validator.evidence(value, asked)).toThrow(unaccepted);
});

test('the tip alone is never answered as a pair', () => {
	const tip = { ...asked, mode: 'current' as const };
	expect(validator.evidence(hubAnswer({ mode: 'current' }), tip).evidence.before).toBeNull();
	const pair = changed('evidence.before', hubAnswer().evidence.before, { mode: 'current' });
	expect(() => validator.evidence(pair, tip)).toThrow(unaccepted);
});

test('a list or a name longer than an answer may hold is refused', () => {
	const many = Array.from({ length: 5001 }, () => 'x');
	expect(() => validator.evidence(changed('evidence.incomparable', many), asked)).toThrow(
		unaccepted
	);
	expect(validator.evidence(changed('evidence.incomparable', many.slice(1)), asked)).toBeTruthy();
	expect(() => validator.evidence(changed('identity.principalId', 'b'.repeat(301)), asked)).toThrow(
		unaccepted
	);
	expect(validator.evidence(changed('identity.principalId', 'b'.repeat(300)), asked)).toBeTruthy();
});
