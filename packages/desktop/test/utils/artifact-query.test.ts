import { expect, test } from 'vitest';
import { mediaFile } from '../../../reports/src/utils/harnessEvidence';
import { artifactQuery } from '../../src/utils/artifactQuery';
import { commits, data, ids, pinned, scopeOf } from '../evidence-fixture';

const scope = scopeOf(ids.page, commits.tip);
const result = data.results[`${ids.page}|commit|${commits.tip}`];
const shot = (side: 'before' | 'after') =>
	result.evidence[side]!.captures.find(
		(item) => item.state === 'default' && item.capture.viewport === 'desktop'
	)!;

test('a capture is asked for by the binding of the side that lists it', () => {
	const after = shot('after');
	expect(artifactQuery(result, scope, 'after', mediaFile(after.capture))).toEqual({
		...scope,
		side: 'after',
		recordId: 'rec-cccccc-0000',
		scenarioId: 'orders-page',
		state: 'default',
		evidenceId: 'screens',
		viewport: 'desktop',
		sha256: after.capture.sha256,
		notesRevision: pinned.notes,
		evidenceRevision: pinned.evidence
	});
	const before = artifactQuery(result, scope, 'before', mediaFile(shot('before').capture));
	expect(before).toMatchObject({ side: 'before', recordId: 'rec-bbbbbb-0000' });
});

test('what a side does not list is not asked for, whatever name is given', () => {
	const file = mediaFile(shot('after').capture);
	expect(artifactQuery(result, scope, 'before', file)).toBeNull();
	for (const name of ['', '../../etc/passwd', 'https://example.invalid/a.png'])
		expect(artifactQuery(result, scope, 'after', name)).toBeNull();
	const first = data.results[`${ids.page}|commit|${commits.first}`];
	expect(artifactQuery(first, scopeOf(ids.page, commits.first), 'before', file)).toBeNull();
});

test('a headless result has no viewport, absent pins stay null, and unstored bytes are not asked for', () => {
	const found = data.results[`${ids.filter}|current|${commits.tip}`];
	const output = found.evidence.after.captures.find((item) => item.capture.kind === 'output')!;
	const file = mediaFile(output.capture);
	const local = { ...found, identity: { ...found.identity, notesRevision: null } };
	expect(artifactQuery(local, scopeOf(ids.filter), 'after', file)).toMatchObject({
		viewport: null,
		evidenceId: 'output',
		notesRevision: null,
		evidenceRevision: pinned.evidence
	});
	const lost = structuredClone(found);
	for (const item of lost.evidence.after.captures) item.capture.media = null;
	expect(artifactQuery(lost, scopeOf(ids.filter), 'after', file)).toBeNull();
});
