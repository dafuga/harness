import { expect, test } from 'vitest';
import { render } from 'svelte/server';
import ExplorerPermissionsScreen from '../../../src/components/networking-security/ExplorerPermissionsScreen.svelte';
import { permissionProfiles } from '../../../../../test/support/permissionProfiles';
import { hostProps, words } from '../../entityRender';
import { commits } from '../../entityUnits';
import { measureWorkload } from '../../../../../test/support/measureWorkload';
import { profileGrants } from '../../../src/components/networking-security/explorer-permissions-screen/profileGrants';
import { permissionProfileLocation } from '../../../src/components/networking-security/explorer-permissions-screen/permissionProfileLocation';
import { permissionUnitLocation } from '../../../src/components/networking-security/explorer-permissions-screen/permissionUnitLocation';
import type { ProfileGrant } from '../../../src/components/networking-security/ExplorerPermissionsScreen.types';
const host = (entity?: string) => {
	const props = hostProps('commit', { category: 'pages', screen: 'permissions', entity });
	props.head = { ...props.head, permissions: permissionProfiles };
	return props;
};
function assertPermissionUnitRoutes() {
	const props = host('member'),
		events: string[] = [];
	const context = {
		get entities() {
			events.push('entities');
			return props.entities;
		},
		get route() {
			events.push('route');
			return props.route;
		}
	};
	const entity = props.entities[0];
	expect(permissionUnitLocation(context, entity.id)).toEqual({
		branch: props.route.branch,
		commit: props.route.commit,
		category: entity.category,
		entity: entity.id
	});
	expect(events).toEqual(['entities', 'route']);
	events.length = 0;
	expect(permissionUnitLocation(context, 'unregistered')).toBeNull();
	expect(events).toEqual(['entities', 'route']);
	const failure = new Error('Route unavailable');
	Object.defineProperty(context, 'route', {
		get: () => {
			throw failure;
		}
	});
	expect(() => permissionUnitLocation(context, 'unregistered')).toThrow(failure);
}
test('profile links propagate host URL generation errors', async () => {
	await measureWorkload(
		'reports.function.networking-security-profile-grants',
		'permission-grant-admission',
		() => {
			const profile = permissionProfiles.profiles[1];
			class GrantList extends Array<ProfileGrant> {}
			const grants = new GrantList(...profile.grants);
			Object.defineProperty(grants, Symbol.iterator, {
				get: () => {
					throw new Error('Iterator must not be read');
				}
			});
			const result = profileGrants({ ...profile, grants }, 'api');
			expect(result).toBeInstanceOf(GrantList);
			expect(result[0]).toBe(profile.grants[1]);
			expect(result).toHaveLength(1);
			const failure = new Error('Filter unavailable');
			Object.defineProperty(grants, 'filter', {
				value: () => {
					throw failure;
				}
			});
			expect(() => profileGrants({ ...profile, grants }, 'api')).toThrow(failure);
		}
	);
	const props = host();
	const error = new Error('navigation unavailable');
	props.lens = {
		...props.lens,
		href: () => {
			throw error;
		}
	};
	expect(() => render(ExplorerPermissionsScreen, { props }).body).toThrow(error);
});
test('profile index exposes one revision-scoped page per declared user level', async () => {
	await measureWorkload(
		'reports.function.networking-security-permission-profile-location',
		'permission-profile-routes',
		() => {
			const route = host('member').route;
			expect(permissionProfileLocation(route, 'member')).toEqual({
				branch: route.branch,
				commit: route.commit,
				category: 'pages',
				screen: 'permissions',
				entity: 'member'
			});
			expect(permissionProfileLocation(route)).toEqual(permissionProfileLocation(route, ''));
			expect(permissionProfileLocation(route)).not.toHaveProperty('entity');
			const failure = new Error('Branch unavailable');
			Object.defineProperty(route, 'branch', {
				get: () => {
					throw failure;
				}
			});
			expect(() => permissionProfileLocation(route)).toThrow(failure);
		}
	);
	const body = render(ExplorerPermissionsScreen, { props: host() }).body;
	expect(words(body)).toMatch(/Users (?:&amp;|&) Permissions/);
	for (const p of permissionProfiles.profiles) expect(body).toContain(`/permissions/${p.id}`);
	expect(body).toContain('/commit/' + commits.middle);
});
test('a profile page lists only its endpoint methods, page access and data boundaries', async () => {
	await measureWorkload(
		'reports.function.networking-security-permission-unit-location',
		'permission-unit-routes',
		assertPermissionUnitRoutes
	);
	const body = render(ExplorerPermissionsScreen, { props: host('member') }).body;
	const shown = words(body);
	for (const text of [
		'Member',
		'app.endpoint.orders',
		'GET',
		'app.model.order',
		'id',
		'total',
		'Own account only',
		'app.page.orders'
	])
		expect(shown).toContain(text);
	expect(shown).not.toContain('All accounts');
	expect(shown).not.toContain('DELETE');
	expect(words(render(ExplorerPermissionsScreen, { props: host('missing') }).body)).toContain(
		'Profile not found'
	);
});
test('API permissions identify permitted profiles and unconfigured endpoints without inferring access', () => {
	const props = host();
	const body = render(ExplorerPermissionsScreen, {
		props: { ...props, endpoint: 'app.endpoint.orders' }
	}).body;
	for (const text of [
		'Member',
		'Administrator',
		'GET',
		'DELETE',
		'Own account only',
		'All accounts',
		'total'
	])
		expect(words(body)).toContain(text);
	expect(
		words(render(ExplorerPermissionsScreen, { props: { ...props, endpoint: 'missing' } }).body)
	).toContain('No access declaration');
});
