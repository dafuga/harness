import { expect, test } from 'vitest';
import { PermissionCatalogService } from '../../../src/services/networking-security/PermissionCatalogService';
import { permissionProfiles } from '../../support/permissionProfiles';
import { measureWorkload } from '../../support/measureWorkload';
const source = (overrides: Record<string, string> = {}) => {
	const entries = Object.fromEntries(
		permissionProfiles.profiles.map(({ source, ...profile }) => [source, JSON.stringify(profile)])
	);
	Object.assign(entries, overrides);
	return {
		list: async () => Object.keys(entries).map((path) => ({ path })),
		read: async (path: string) => entries[path]
	};
};
test('permission catalogs retain every profile, HTTP method, data field and scope at the selected tree', async () => {
	await measureWorkload(
		'service.networking-security-permission-catalog',
		'read-profile-permission-catalog',
		async () => {
			const catalog = await new PermissionCatalogService().at(source());
			expect(catalog.profiles).toEqual(
				[...permissionProfiles.profiles].sort((a, b) => a.id.localeCompare(b.id))
			);
			expect(catalog.gaps).toEqual([]);
		}
	);
});
test('missing declarations stay empty and malformed or mismatched profiles remain explicit gaps', async () => {
	const service = new PermissionCatalogService();
	expect(
		await service.at({
			list: async () => [],
			read: async () => {
				throw new Error('no file');
			}
		})
	).toEqual({ profiles: [], gaps: [] });
	const catalog = await service.at(
		source({
			'specification/permissions/member.json': '{"schemaVersion":1}',
			'specification/permissions/wrong.json': JSON.stringify({
				...permissionProfiles.profiles[0],
				source: undefined
			})
		})
	);
	expect(catalog.profiles.map((p) => p.id)).toEqual(['admin', 'guest']);
	expect(catalog.gaps).toHaveLength(2);
	expect(catalog.gaps.join(' ')).toContain('member.json');
	const unreadable = await service.at({
		list: async () => [{ path: 'specification/permissions/member.json' }],
		read: async () => {
			throw new Error('Fixture read unavailable');
		}
	});
	expect(unreadable.profiles).toEqual([]);
	expect(unreadable.gaps.join(' ')).toContain('specification/permissions/member.json');
});

test('successive source revisions never borrow another profile declaration', async () => {
	const service = new PermissionCatalogService();
	const previous = await service.at(source());
	const { source: _source, ...member } = permissionProfiles.profiles[1];
	const current = await service.at(
		source({
			'specification/permissions/member.json': JSON.stringify({
				...member,
				title: 'Reader',
				grants: []
			})
		})
	);
	expect(previous.profiles.map((profile) => profile.title)).toContain('Member');
	expect(current.profiles.find((profile) => profile.id === 'member')).toMatchObject({
		title: 'Reader',
		grants: []
	});
	expect(previous.profiles.find((profile) => profile.id === 'member')?.grants).toHaveLength(2);
});
