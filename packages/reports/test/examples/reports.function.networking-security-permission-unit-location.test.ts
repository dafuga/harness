import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { permissionUnitLocation } from '../../src/components/networking-security/explorer-permissions-screen/permissionUnitLocation';

test('Links registered units in the shown revision only', () => {
	const host = {
		entities: [
			{
				id: 'reports.component.evidence-grid',
				category: 'components'
			}
		],
		route: {
			branch: 'main',
			commit: '3a7f9c2e1b8d4a6f0e5c7b9d2a4f6e8c1b3d5a70',
			category: 'functions',
			entity: 'reports.function.networking-security-permission-unit-location'
		}
	} as unknown as Parameters<typeof permissionUnitLocation>[0];
	const linked = permissionUnitLocation(host, 'reports.component.evidence-grid');
	const absent = permissionUnitLocation(host, 'reports.model.explorer-types');

	expect(linked).toEqual({
		branch: 'main',
		commit: '3a7f9c2e1b8d4a6f0e5c7b9d2a4f6e8c1b3d5a70',
		category: 'components',
		entity: 'reports.component.evidence-grid'
	});
	expect(absent).toBeNull();
	recordExampleCases(
		{
			unitId: 'reports.function.networking-security-permission-unit-location',
			symbol: 'permissionUnitLocation',
			state: 'links-registered-units-in-the-shown-revision-only',
			evidence: 'examples-cases',
			file: 'links-registered-units-in-the-shown-revision-only.json'
		},
		[
			{
				name: 'registered unit uses its category and shown revision',
				input: {
					id: 'reports.component.evidence-grid',
					branch: 'main',
					commit: '3a7f9c2e1b8d4a6f0e5c7b9d2a4f6e8c1b3d5a70'
				},
				output: linked
			},
			{
				name: 'unregistered unit has no location',
				input: {
					id: 'reports.model.explorer-types',
					branch: 'main',
					commit: '3a7f9c2e1b8d4a6f0e5c7b9d2a4f6e8c1b3d5a70'
				},
				output: absent
			}
		]
	);
});

test('Throws TypeError when the host registry or route is invalid', () => {
	const host = {
		entities: [],
		route: { branch: 'main', commit: 'commit' }
	} as unknown as Parameters<typeof permissionUnitLocation>[0];
	const invalidHosts = [
		null,
		{ entities: null, route: host.route },
		{ entities: undefined, route: host.route },
		{ entities: [], route: null },
		{ entities: [], route: undefined },
		{ entities: {}, route: host.route },
		{ entities: [null], route: host.route }
	] as unknown as Parameters<typeof permissionUnitLocation>[0][];
	const cases = invalidHosts.map((invalidHost, index) => {
		let error: unknown;
		try {
			permissionUnitLocation(invalidHost, 'reports.function.missing');
		} catch (caught) {
			error = caught;
		}
		expect(error).toBeInstanceOf(TypeError);
		return {
			name: `invalid host shape ${index + 1}`,
			input: { entities: index === 0 ? 'null host' : 'invalid', route: 'shown route' },
			error: { name: (error as Error).name, message: (error as Error).message }
		};
	});
	recordExampleCases(
		{
			unitId: 'reports.function.networking-security-permission-unit-location',
			symbol: 'permissionUnitLocation',
			state: 'throws-typeerror-when-the-host-registry-or-route-is-invalid',
			evidence: 'examples-cases',
			file: 'throws-typeerror-when-the-host-registry-or-route-is-invalid.json'
		},
		cases
	);
});
