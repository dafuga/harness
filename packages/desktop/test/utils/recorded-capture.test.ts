import { expect, test } from 'vitest';
import { explorerEvidence } from '../../../reports/src/utils/explorerEvidence';
import { recordedCapture } from '../../src/utils/recordedCapture';
import {
	feed,
	head,
	home,
	output,
	parent,
	sampleDetail,
	sampleScope,
	screen
} from '../recorded-sample';

const revisions = () => ({ head: sampleDetail(head), parent: sampleDetail(parent) });
const evidence = (entity: string) =>
	explorerEvidence(sampleScope(entity), revisions(), { id: entity });
const binding = {
	side: 'after' as const,
	recordId: 'record-aaaa',
	scenarioId: 'home-page',
	state: 'filled',
	evidenceId: 'kept',
	viewport: 'desktop' as string | null,
	sha256: screen
};
const unlisted = /not listed/;

test('a capture is found by the whole of its binding, on the side that lists it', () => {
	const found = recordedCapture(evidence(home), binding);
	expect(found.record).toBe('record-aaaa');
	expect(found.capture).toMatchObject({ kind: 'screenshot', sha256: screen, viewport: 'desktop' });
	const before = recordedCapture(evidence(home), {
		...binding,
		side: 'before',
		recordId: 'record-bbbb'
	});
	expect(before.capture.path).toBe(`evidence/${parent}/screenshot.bin`);
	const run = { ...binding, scenarioId: 'feed-run', viewport: null, sha256: output };
	expect(recordedCapture(evidence(feed), run).capture.kind).toBe('output');
});

test('one field that differs, or a capture of another entity, is not listed', () => {
	const changes = [
		{ recordId: 'record-bbbb' },
		{ side: 'before' as const },
		{ scenarioId: 'feed-run' },
		{ state: 'empty' },
		{ evidenceId: 'other' },
		{ viewport: null },
		{ viewport: 'mobile' },
		{ sha256: output }
	];
	for (const change of changes)
		expect(() => recordedCapture(evidence(home), { ...binding, ...change })).toThrow(unlisted);
	// The output of the feed is recorded by the same record, and is not of the page.
	const run = { ...binding, scenarioId: 'feed-run', viewport: null, sha256: output };
	expect(() => recordedCapture(evidence(home), run)).toThrow(unlisted);
	const alone = explorerEvidence(sampleScope(home, 'current'), revisions(), { id: home });
	expect(() => recordedCapture(alone, { ...binding, side: 'before' })).toThrow(unlisted);
});

test('the bytes of an inherited result are those of the record that produced it', () => {
	const inherited = sampleDetail(head);
	const [record] = inherited.records;
	const [, run] = record.scenarios;
	run.status = 'referenced';
	run.inherited = true;
	run.testedRevision = parent;
	run.origin = { record: 'record-bbbb', commit: parent };
	run.originTests = [{ id: 'feed-run:run', status: 'passed' }];
	const shown = explorerEvidence(
		sampleScope(feed),
		{ head: inherited, parent: sampleDetail(parent) },
		{ id: feed }
	);
	const asked = { ...binding, scenarioId: 'feed-run', viewport: null, sha256: output };
	expect(shown.after.captures[0].inheritedFrom).toBe(parent);
	expect(recordedCapture(shown, asked).record).toBe('record-bbbb');
});
