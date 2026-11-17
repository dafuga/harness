import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { evidenceQuery } from '../../src/utils/verification-evidence/evidenceQuery';
import type { EvidenceView } from '../../src/utils/verification-evidence/evidenceQuery.types';

const UNIT_ID = 'desktop.function.evidence-query';
const TIP = 'c2d07a5f8e61b94d3a0f7c2e95b18d46e0a3f7c9';
const PARENT = '9a4c71e0d2b85f36c1e7a09d4b2f8e6c5a13d7f0';
const FEATURE = 'e71b4c9a0d26f8537b1e4a9c06d2f83b5e7a1c04';
const PROJECT_ID = 'local-5e0c9a21d7b44f83a6c10e2f9b57d3c84a1f06be9d2c75e83f0b6a19c4d27e5f';
const AT = '2026-11-14T16:42:08+00:00';

function viewOf(
	revision: { branch: string; commit: string; tip: string },
	pinned: boolean,
	context: EvidenceView['context']
): EvidenceView {
	const atTip = revision.commit === revision.tip;
	return {
		snapshot: {
			project: { name: 'harness-app', root: '/work/harness-app' },
			revision: { ...revision, atTip },
			branches: [{ name: revision.branch, tip: revision.tip, current: true }],
			commits: [{ hash: revision.commit, subject: 'Show evidence', authoredAt: AT, committedAt: AT }],
			entities: [],
			writable: atTip
		},
		pinned,
		context
	};
}

test('Pins the request to the selected commit beside its branch', () => {
	const view = viewOf({ branch: 'main', commit: PARENT, tip: TIP }, true, { projectId: PROJECT_ID });
	const query = evidenceQuery(view, 'reports.component.evidence-grid');

	expect(query).toEqual({
		entityId: 'reports.component.evidence-grid',
		commit: PARENT,
		branch: 'main',
		mode: 'commit',
		projectId: PROJECT_ID
	});

	recordExampleCases(
		{
			unitId: UNIT_ID,
			symbol: 'evidenceQuery',
			state: 'pins-the-request-to-the-selected-commit-beside-its-branch',
			evidence: 'examples-cases',
			file: 'pins-the-request-to-the-selected-commit-beside-its-branch.json'
		},
		[
			{
				name: 'pinned commit on main with a project id',
				input: { entityId: 'reports.component.evidence-grid', pinned: true, projectId: PROJECT_ID },
				output: query
			}
		]
	);
});

test('Asks only for the branch tip when the view is not pinned', () => {
	const view = viewOf({ branch: 'feature/evidence-grid', commit: FEATURE, tip: FEATURE }, false, {});
	const query = evidenceQuery(view, 'desktop.function.evidence-query');

	expect(query).toEqual({
		entityId: 'desktop.function.evidence-query',
		commit: FEATURE,
		branch: 'feature/evidence-grid',
		mode: 'current'
	});

	recordExampleCases(
		{
			unitId: UNIT_ID,
			symbol: 'evidenceQuery',
			state: 'asks-only-for-the-branch-tip-when-the-view-is-not-pinned',
			evidence: 'examples-cases',
			file: 'asks-only-for-the-branch-tip-when-the-view-is-not-pinned.json'
		},
		[
			{
				name: 'unpinned branch tip on a feature branch',
				input: { entityId: 'desktop.function.evidence-query', pinned: false },
				output: query
			}
		]
	);
});

test('Returns null while no project is shown', () => {
	const view: EvidenceView = { snapshot: null, pinned: false, context: {} };
	const query = evidenceQuery(view, 'desktop.function.evidence-query');

	expect(query).toBeNull();

	recordExampleCases(
		{
			unitId: UNIT_ID,
			symbol: 'evidenceQuery',
			state: 'returns-null-while-no-project-is-shown',
			evidence: 'examples-cases',
			file: 'returns-null-while-no-project-is-shown.json'
		},
		[
			{
				name: 'no snapshot shown',
				input: { snapshot: null, entityId: 'desktop.function.evidence-query' },
				output: query
			}
		]
	);
});
