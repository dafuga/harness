import { expect, test } from 'vitest';
import { render } from 'svelte/server';
import ExplorerPermissionsScreen from '../../../src/components/networking-security/ExplorerPermissionsScreen.svelte';
import { permissionProfiles } from '../../../../../test/support/permissionProfiles';
import { hostProps, words } from '../../entityRender';
const host = (entity?: string) => {
	const props = hostProps('commit', { category: 'pages', screen: 'permissions', entity });
	props.head = { ...props.head, permissions: permissionProfiles };
	return props;
};
test('profile index exposes one revision-scoped page per declared user level', () => {
	const body = render(ExplorerPermissionsScreen, { props: host() }).body;
	expect(words(body)).toMatch(/Users (?:&amp;|&) Permissions/);
	for (const p of permissionProfiles.profiles) expect(body).toContain(`/permissions/${p.id}`);
	expect(body).toContain('/commit/' + 'b'.repeat(40));
});
test('a profile page lists only its endpoint methods, page access and data boundaries', () => {
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
