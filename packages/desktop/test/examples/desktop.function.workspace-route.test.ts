import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import {
	isWorkspacePath,
	routeSuffixes,
	workspacePath,
	workspaceRoute
} from '../../src/utils/workspaceRoute';
import type { Outcome, Case, Target } from './desktop.function.workspace-route.test.types';

const commit = 'a'.repeat(40);
const projectUuid = '6f1d2c3b-4a59-4e68-9f70-8a1b2c3d4e5f';
const uriError = { name: 'URIError', message: 'URI malformed' };
const refused = (message: string) => ({ error: { name: 'WorkspaceAddressError', message } });

/** A route with its defaults: the pages category, and no project, branch, commit, entity or section. */
const routeOf = (over: Record<string, unknown>) => ({
	projectId: null,
	branch: null,
	commit: null,
	category: 'pages' as const,
	entityId: null,
	suffix: null,
	...over
});

/** Runs the public entry, checks what it returned or threw, and keeps the case for the trace. */
function attempt(name: string, input: unknown, action: () => unknown, expected: Outcome): Case {
	let result: Outcome;
	try {
		result = { output: action() };
	} catch (error) {
		const { name: errorName, message } = error as Error;
		result = { error: { name: errorName, message } };
	}
	expect(result).toEqual(expected);
	return { name, input, ...result };
}

const readCase = (name: string, path: string, expected: Outcome) =>
	attempt(name, { path }, () => workspaceRoute(path), expected);
const routeCase = (name: string, path: string, over: Record<string, unknown>) =>
	readCase(name, path, { output: routeOf(over) });
const recognizeCase = (name: string, path: string, expected: boolean) =>
	attempt(name, { path }, () => isWorkspacePath(path), { output: expected });
const buildCase = (name: string, target: Target, expected: Outcome) =>
	attempt(name, { target }, () => workspacePath(target), expected);

const recordCases = (symbol: string, state: string, cases: Case[]) =>
	recordExampleCases(
		{
			unitId: 'desktop.function.workspace-route',
			symbol,
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);

test('Resolves project, branch, commit, entity and section, and the pages default', () => {
	const full = `/projects/local-1/harness/branch/feat%2Factivity/commit/${commit}/pages/page%3Aactivity/history`;
	const p = '/projects/p/harness';
	recordCases('workspaceRoute', 'resolves-project-branch-commit-and-entity', [
		routeCase('full address with encoded branch, commit, entity and history', full, {
			projectId: 'local-1',
			branch: 'feat/activity',
			commit,
			entityId: 'page:activity',
			suffix: 'history'
		}),
		routeCase(
			'branch address keeps commit null and details reads as source',
			`${p}/branch/main/services/service.mail/details`,
			{
				projectId: 'p',
				branch: 'main',
				category: 'services',
				entityId: 'service.mail',
				suffix: 'source'
			}
		),
		routeCase('shells category reads as layouts', `${p}/branch/main/shells`, {
			projectId: 'p',
			branch: 'main',
			category: 'layouts'
		}),
		routeCase(
			'relationships remains an accepted older section',
			`${p}/pages/page%3Ax/relationships`,
			{
				projectId: 'p',
				entityId: 'page:x',
				suffix: 'relationships'
			}
		),
		routeCase('unknown section reads as no section', `${p}/pages/page%3Ax/contract`, {
			projectId: 'p',
			entityId: 'page:x'
		}),
		routeCase('project address with no selection defaults to pages', p, { projectId: 'p' })
	]);
});

test('Lists the recognized entity sections in contract order', () => {
	recordCases('routeSuffixes', 'lists-the-recognized-sections', [
		attempt('recognized section list', { export: 'routeSuffixes' }, () => routeSuffixes.join(' '), {
			output:
				'apis designs plan used-in uses relationships evidence examples states history source details'
		})
	]);
});

test('Recognizes workspace prefixes without validating category or commit', () => {
	recordCases('isWorkspacePath', 'recognizes-only-workspace-prefixes', [
		recognizeCase('legacy prefix', '/harness/pages', true),
		recognizeCase('project prefix with no category', '/projects/p/harness', true),
		recognizeCase(
			'unknown category and abbreviated commit are not checked by recognition',
			'/projects/p/harness/branch/main/commit/abc1234/reports',
			true
		),
		recognizeCase('other project section is not a workspace', '/projects/p/members', false),
		recognizeCase('empty project segment is not a workspace', '/projects//harness/pages', false),
		recognizeCase('a longer word is not the harness prefix', '/harnessx/pages', false)
	]);
});

test('Builds encoded links that read back and refuses unpaired surrogates', () => {
	const route = routeOf({
		projectId: projectUuid,
		branch: 'release/1.0',
		entityId: 'page:a/b',
		suffix: 'source'
	});
	const built = `/projects/${projectUuid}/harness/branch/release%2F1.0/pages/page%3Aa%2Fb/source`;
	recordCases('workspacePath', 'builds-encoded-links-and-refuses-unpaired-surrogates', [
		buildCase('encodes project, branch and entity', route, { output: built }),
		readCase('built link reads back to the same route', built, { output: route }),
		buildCase(
			'section is dropped without an entity',
			{ branch: 'main', category: 'pages', suffix: 'history' },
			{ output: '/harness/branch/main/pages' }
		),
		buildCase(
			'builder does not validate a supplied commit',
			{ commit: 'ABC123', category: 'pages' },
			{ output: '/harness/commit/ABC123/pages' }
		),
		buildCase(
			'unpaired surrogate in branch',
			{ branch: 'bad\uD800', category: 'pages' },
			{ error: uriError }
		),
		buildCase(
			'unpaired surrogate in entity',
			{ entityId: 'page:\uDC00', category: 'pages' },
			{ error: uriError }
		)
	]);
});

test('Refuses non-workspace, abbreviated, uppercase and unknown-category addresses', () => {
	const shortCommit = refused('A commit link needs the full commit hash');
	const notWorkspace = refused('Not a workspace address');
	recordCases('workspaceRoute', 'refuses-foreign-short-commit-and-unknown-category', [
		readCase('non-workspace project section', '/projects/p/members', notWorkspace),
		readCase('empty project segment', '/projects//harness/pages', notWorkspace),
		readCase(
			'abbreviated commit',
			'/projects/p/harness/branch/main/commit/abc1234/pages',
			shortCommit
		),
		readCase(
			'uppercase commit hash',
			`/projects/p/harness/commit/${'A'.repeat(40)}/pages`,
			shortCommit
		),
		readCase(
			'unknown catalog category',
			'/projects/p/harness/branch/main/reports',
			refused('Unknown catalog category')
		)
	]);
});

test('Rejects malformed percent escapes in project, branch and entity names', () => {
	recordCases('workspaceRoute', 'rejects-malformed-percent-escapes', [
		readCase('malformed project name', '/projects/%E0%A4%A/harness/pages', { error: uriError }),
		readCase('malformed branch name', '/projects/p/harness/branch/%E0%A4%A/pages', {
			error: uriError
		}),
		readCase('malformed entity name', '/projects/p/harness/pages/page%E0%A4%A/source', {
			error: uriError
		}),
		routeCase(
			'well-formed escapes around the same entity read normally',
			'/projects/p/harness/pages/page%3Aok/source',
			{
				projectId: 'p',
				entityId: 'page:ok',
				suffix: 'source'
			}
		)
	]);
});
