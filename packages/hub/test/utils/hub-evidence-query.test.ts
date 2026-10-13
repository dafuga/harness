import { expect, test } from 'vitest';
import { hubArtifactQuery, hubEvidenceQuery } from '../../src/utils/hubEvidenceQuery';

const projectId = 'a6196e55-8746-4bc5-bfeb-5e2c8771e241';
const scope = {
	entityId: 'page.titles',
	commit: 'a'.repeat(40),
	branch: 'feat/a b',
	mode: 'commit'
};
const capture = {
	...scope,
	side: 'before',
	recordId: 'b'.repeat(64),
	scenarioId: 'titles-page',
	state: 'default',
	evidenceId: 'screens',
	sha256: 'c'.repeat(64)
};
function request(fields: Record<string, string>): Request {
	return new Request(`https://fixture.example/api/x?${new URLSearchParams(fields)}`);
}
const code = (read: () => unknown) => {
	try {
		read();
		return 'accepted';
	} catch (error) {
		return (error as { code?: string }).code;
	}
};

test('an evidence read has the fields of its scope, the project of its address, and no other', () => {
	const extra = { ...scope, path: '../secret', projectId: 'another', side: 'after' };
	expect(hubEvidenceQuery(request(extra), projectId)).toEqual({ ...scope, projectId });
});

test('an artifact read has its whole binding, and an optional field that is absent is null', () => {
	const absent = { viewport: null, notesRevision: null, evidenceRevision: null };
	expect(hubArtifactQuery(request(capture), projectId)).toEqual({
		...capture,
		...absent,
		projectId
	});
	const stated = {
		viewport: 'desktop',
		notesRevision: 'd'.repeat(40),
		evidenceRevision: 'e'.repeat(40)
	};
	expect(hubArtifactQuery(request({ ...capture, ...stated, url: 'x' }), projectId)).toEqual({
		...capture,
		...stated,
		projectId
	});
});

test('a field that is missing, empty or not of its pattern is refused as invalid input', () => {
	const wrong: Array<Record<string, string>> = [
		{ entityId: 'Page.Titles' },
		{ entityId: 'page..titles' },
		{ commit: 'A'.repeat(40) },
		{ branch: '' },
		{ branch: 'b'.repeat(256) },
		{ mode: 'tip' },
		{ side: 'both' },
		{ recordId: 'b'.repeat(63) },
		{ scenarioId: 'titles page' },
		{ state: 'default/..' },
		{ evidenceId: '' },
		{ viewport: '' },
		{ viewport: 'Desktop' },
		{ sha256: 'c'.repeat(65) },
		{ notesRevision: 'null' },
		{ evidenceRevision: 'e'.repeat(39) }
	];
	for (const fields of wrong)
		expect(code(() => hubArtifactQuery(request({ ...capture, ...fields }), projectId))).toBe(
			'invalid-input'
		);
	const unmoded = { entityId: scope.entityId, commit: scope.commit, branch: scope.branch };
	expect(code(() => hubEvidenceQuery(request(unmoded), projectId))).toBe('invalid-input');
	expect(code(() => hubEvidenceQuery(request(scope), projectId))).toBe('accepted');
});
