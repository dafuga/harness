import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { permissionProfileLocation } from '../../src/components/networking-security/explorer-permissions-screen/permissionProfileLocation';

const UNIT_ID = 'reports.function.networking-security-permission-profile-location';
const PERMISSIONS_KEYS = ['branch', 'commit', 'category', 'screen'];
type Route = Parameters<typeof permissionProfileLocation>[0];

function makeRoute(fields: object): Route {
	return fields as Route;
}

const mainRoute = makeRoute({
	branch: 'main',
	commit: '5e0d7a2c9b41f8e36d02a7c5b9e14f6d3a8c1b27',
	category: 'apis',
	entity: 'reports.endpoint.api-project-activity',
	tab: 'permissions'
});
const planningRoute = makeRoute({
	branch: 'planning/evidence-grid',
	commit: 'b74c1e09a2d5f63b8e0c17a4d92f5e8b1c60d3a7',
	category: 'pages',
	screen: 'permissions'
});
const nullBranchRoute = makeRoute({
	branch: null,
	commit: 'd19f3a6e0c84b27f5a1d9e63c0b78f2a4e15d9c6',
	category: 'pages',
	screen: 'permissions',
	entity: 'guest'
});

test('Links a route to the Pages permissions screen', () => {
	const linked = permissionProfileLocation(mainRoute, 'billing-admin');
	const planning = permissionProfileLocation(planningRoute);
	const nullBranch = permissionProfileLocation(nullBranchRoute, 'guest');
	expect([linked, planning, nullBranch]).toEqual([
		{
			branch: 'main',
			commit: '5e0d7a2c9b41f8e36d02a7c5b9e14f6d3a8c1b27',
			category: 'pages',
			screen: 'permissions',
			entity: 'billing-admin'
		},
		{
			branch: 'planning/evidence-grid',
			commit: 'b74c1e09a2d5f63b8e0c17a4d92f5e8b1c60d3a7',
			category: 'pages',
			screen: 'permissions'
		},
		{
			branch: null,
			commit: 'd19f3a6e0c84b27f5a1d9e63c0b78f2a4e15d9c6',
			category: 'pages',
			screen: 'permissions',
			entity: 'guest'
		}
	]);
	recordExampleCases(
		{
			unitId: UNIT_ID,
			symbol: 'permissionProfileLocation',
			state: 'links-a-route-to-the-pages-permissions-screen',
			evidence: 'examples-cases',
			file: 'links-a-route-to-the-pages-permissions-screen.json'
		},
		[
			{
				name: 'main route with billing-admin profile keeps branch and commit',
				input: { route: mainRoute, entity: 'billing-admin' },
				output: linked
			},
			{
				name: 'planning route without profile has no entity field',
				input: { route: planningRoute },
				output: planning
			},
			{
				name: 'null branch is copied as null with guest profile',
				input: { route: nullBranchRoute, entity: 'guest' },
				output: nullBranch
			}
		]
	);
});

test('Omits the entity field for an empty or missing profile id', () => {
	const empty = permissionProfileLocation(mainRoute, '');
	const missing = permissionProfileLocation(planningRoute);
	expect(Object.keys(empty)).toEqual(PERMISSIONS_KEYS);
	expect(Object.keys(missing)).toEqual(PERMISSIONS_KEYS);
	recordExampleCases(
		{
			unitId: UNIT_ID,
			symbol: 'permissionProfileLocation',
			state: 'omits-the-entity-field-for-an-empty-or-missing-profile-id',
			evidence: 'examples-cases',
			file: 'omits-the-entity-field-for-an-empty-or-missing-profile-id.json'
		},
		[
			{
				name: 'empty string profile id leaves no entity field',
				input: { route: mainRoute, entity: '' },
				output: empty
			},
			{
				name: 'omitted profile id leaves no entity field',
				input: { route: planningRoute },
				output: missing
			}
		]
	);
});

test('Propagates input access failures and rejects a null route', () => {
	const failing = makeRoute({
		get branch(): string {
			throw new Error('branch unavailable');
		},
		commit: 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678'
	});
	const nullRoute = null as unknown as Route;
	expect(() => permissionProfileLocation(failing, 'guest')).toThrow('branch unavailable');
	expect(() => permissionProfileLocation(nullRoute)).toThrow(TypeError);
	recordExampleCases(
		{
			unitId: UNIT_ID,
			symbol: 'permissionProfileLocation',
			state: 'propagates-input-access-failures-and-rejects-a-null-route',
			evidence: 'examples-cases',
			file: 'propagates-input-access-failures-and-rejects-a-null-route.json'
		},
		[
			{
				name: 'branch getter that throws propagates its error unchanged',
				input: { route: { branch: 'getter throws', commit: 'a1b2c3d4' }, entity: 'guest' },
				error: 'Error: branch unavailable'
			},
			{
				name: 'null route fails with a TypeError when reading branch',
				input: { route: null },
				error: 'TypeError'
			}
		]
	);
});
