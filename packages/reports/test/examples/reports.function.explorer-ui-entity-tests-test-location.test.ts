import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { testLocation } from '../../src/components/explorer-ui/entity-tests/testLocation';

const COMMIT = '0123456789abcdef0123456789abcdef01234567';
const OTHER_COMMIT = 'fedcba9876543210fedcba9876543210fedcba98';

const mainRoute = { branch: 'main', commit: null, category: 'pages' } as const;

const functionEntity = {
	id: 'reports.function.explorer-ui-entity-tests-test-location',
	category: 'functions'
} as const;

const pageEntity = { id: 'reports.page.example-home', category: 'pages' } as const;

function summarise(location: {
	branch?: unknown;
	commit?: unknown;
	category?: unknown;
	entity?: unknown;
	tab?: unknown;
}) {
	return {
		branch: location.branch,
		commit: location.commit,
		category: location.category,
		entity: location.entity,
		tab: location.tab
	};
}

test('Builds the tests location on the route branch at the given commit', () => {
	const result = testLocation(mainRoute, functionEntity, COMMIT);

	expect(summarise(result)).toMatchObject({
		branch: 'main',
		commit: COMMIT,
		category: 'functions',
		entity: 'reports.function.explorer-ui-entity-tests-test-location',
		tab: 'tests'
	});
	recordExampleCases(
		{
			unitId: 'reports.function.explorer-ui-entity-tests-test-location',
			symbol: 'testLocation',
			state: 'builds-the-tests-location-on-the-route-branch-at-the-given-c',
			evidence: 'examples-cases',
			file: 'builds-the-tests-location-on-the-route-branch-at-the-given-c.json'
		},
		[
			{
				name: 'function entity at the example commit on main',
				input: { route: mainRoute, entity: functionEntity, commit: COMMIT },
				output: summarise(result)
			}
		]
	);
});

test('Replaces the route commit and takes the category of a page entity', () => {
	const routeAtOtherCommit = { ...mainRoute, commit: OTHER_COMMIT };
	const result = testLocation(routeAtOtherCommit, pageEntity, COMMIT);

	expect(summarise(result)).toMatchObject({
		branch: 'main',
		commit: COMMIT,
		category: 'pages',
		entity: 'reports.page.example-home',
		tab: 'tests'
	});
	recordExampleCases(
		{
			unitId: 'reports.function.explorer-ui-entity-tests-test-location',
			symbol: 'testLocation',
			state: 'replaces-the-route-commit-and-takes-the-category-of-a-page-e',
			evidence: 'examples-cases',
			file: 'replaces-the-route-commit-and-takes-the-category-of-a-page-e.json'
		},
		[
			{
				name: 'page entity replaces the commit of a route at another commit',
				input: { route: routeAtOtherCommit, entity: pageEntity, commit: COMMIT },
				output: summarise(result)
			}
		]
	);
});
