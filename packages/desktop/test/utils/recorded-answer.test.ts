import { expect, test } from 'vitest';
import type { CacheIdentity } from '../../../collaboration/src/models/Collaboration.types';
import { explorerBehavior } from '../../../reports/src/utils/explorerBehavior';
import { explorerEvidence } from '../../../reports/src/utils/explorerEvidence';
import { recordedAnswer } from '../../src/utils/recordedAnswer';
import { recordedProjection } from '../../src/utils/recordedProjection';
import { feed, head, home, parent, sampleDetail, sampleScope } from '../recorded-sample';

const identity: CacheIdentity = {
	principalId: 'local-filesystem:1',
	projectId: 'local-1',
	repositoryId: 0,
	requestedRef: 'main',
	sourceCommit: head,
	sourceTree: 'f'.repeat(40),
	notesRef: 'refs/notes/harness',
	notesRevision: null,
	evidenceRef: 'refs/heads/harness-evidence',
	evidenceRevision: null,
	historyIndexRevision: null,
	artifactHash: null,
	profile: null
};
const revisions = () => ({ head: sampleDetail(head), parent: sampleDetail(parent) });

test('the answer is the evidence of the entity of its scope, projected, with its behaviour', () => {
	const scope = sampleScope(feed);
	const answer = recordedAnswer({ scope, identity, revisions: revisions() });
	const whole = explorerEvidence(scope, revisions(), { id: feed });
	expect(answer.scope).toBe(scope);
	expect(answer.identity).toBe(identity);
	expect(answer.evidence).toEqual(recordedProjection(whole, feed));
	expect(answer.behavior).toEqual(explorerBehavior(whole));
	expect(answer.behavior.rows).toMatchObject([{ scenario: 'feed-run', change: 'unchanged' }]);
	expect(JSON.stringify(answer)).not.toContain(home);
});

test('the tip alone has no before, whatever revision is given beside it', () => {
	const scope = sampleScope(home, 'current');
	const answer = recordedAnswer({ scope, identity, revisions: revisions() });
	expect([answer.evidence.mode, answer.evidence.before]).toEqual(['current', null]);
	expect(answer.behavior.summary).toBe('not-compared');
});

test('an answer larger than one message may be is refused in words', () => {
	const large = sampleDetail(head);
	large.records[0].problems = ['x'.repeat(17 * 1024 * 1024)];
	const input = { scope: sampleScope(home), identity, revisions: { head: large, parent: null } };
	expect(() => recordedAnswer(input)).toThrow(/16 MiB/);
});
