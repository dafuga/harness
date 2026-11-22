import { expect, test } from 'vitest';
import {
	pathMatches,
	vaultGatewayPolicy
} from '../../../src/utils/accounts-access/vaultGatewayPolicy';
import type { VaultGatewayScope } from '../../../src/utils/accounts-access/vaultGatewayPolicy.types';

const scope: VaultGatewayScope = {
	origins: ['https://console.example.test'],
	redirects: ['https://sso.example.test'],
	mode: 'read',
	paths: ['/orgs/*/members', '/orgs/*/settings/**'],
	deny: ['/orgs/*/members/invite'],
	downloads: []
};
const go = (url: string, lease = scope) => vaultGatewayPolicy(lease, { name: 'navigate', url });

test('offers read operations by default and refuses writes on a read-only lease', () => {
	for (const name of ['snapshot', 'screenshot', 'scroll', 'waitFor', 'back', 'reload', 'finish']) {
		expect(vaultGatewayPolicy(scope, { name })).toEqual({ allowed: true });
	}
	for (const name of ['click', 'fill', 'select', 'press', 'submit']) {
		expect(vaultGatewayPolicy(scope, { name })).toMatchObject({
			allowed: false,
			reason: 'The lease is read-only.'
		});
	}
	expect(vaultGatewayPolicy({ ...scope, mode: 'write' }, { name: 'click' })).toEqual({
		allowed: true
	});
});

test('refuses every operation outside the list', () => {
	for (const name of [
		'evaluate',
		'cookies',
		'storage',
		'cdp',
		'devtools',
		'clipboard',
		'upload',
		'shell'
	]) {
		expect(vaultGatewayPolicy({ ...scope, mode: 'write' }, { name })).toMatchObject({
			allowed: false
		});
	}
});

test('allows only approved paths on approved origins', () => {
	expect(go('https://console.example.test/orgs/acme/members')).toEqual({ allowed: true });
	expect(go('https://sso.example.test/anything')).toEqual({ allowed: true });
	expect(go('https://console.example.test/orgs/acme/billing')).toMatchObject({ allowed: false });
	expect(go('https://other.example.test/orgs/acme/members')).toMatchObject({ allowed: false });
	expect(go('https://console.example.test/orgs/acme/members/invite')).toMatchObject({
		allowed: false
	});
	expect(vaultGatewayPolicy(scope, { name: 'navigate' })).toMatchObject({ allowed: false });
});

test('denies key, token, recovery and 2FA pages even when the recipe allows the path', () => {
	const open = { ...scope, paths: ['/**'] };
	for (const path of [
		'/settings/tokens',
		'/orgs/acme/settings/api-keys',
		'/account/security',
		'/settings/two-factor',
		'/user/recovery-codes',
		'/me/Personal_Access_Tokens',
		'/settings?tab=security',
		'/dash#/account/mfa',
		'/settings/%74okens'
	]) {
		expect(go('https://console.example.test' + path, open)).toMatchObject({ allowed: false });
	}
	expect(go('https://console.example.test/orgs/acme/members', open)).toEqual({ allowed: true });
});

test('downloads need a write lease and a listed file type', () => {
	const write = { ...scope, mode: 'write' as const, downloads: ['csv'] };
	expect(vaultGatewayPolicy(write, { name: 'download', fileType: 'csv' })).toEqual({
		allowed: true
	});
	expect(vaultGatewayPolicy(write, { name: 'download', fileType: 'json' })).toMatchObject({
		allowed: false
	});
});

test('matches one-segment and remainder patterns', () => {
	expect(pathMatches('/orgs/*/members', '/orgs/acme/members')).toBe(true);
	expect(pathMatches('/orgs/*/members', '/orgs/acme/members/x')).toBe(false);
	expect(pathMatches('/orgs/*/settings/**', '/orgs/acme/settings/a/b')).toBe(true);
	expect(pathMatches('/orgs/*/settings/**', '/orgs/acme')).toBe(false);
});
