import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { AccountMatchCase, SavedEntry } from './credential-vault-account-match.e2e.test.types';

const darwin = process.platform === 'darwin';
const workspace = mkdtempSync(join(tmpdir(), 'vault-account-match-'));
const binary = join(workspace, 'match');
const entry = (service: string, username: string, domain?: string): SavedEntry => ({
	service,
	username,
	domain
});
const github: Omit<AccountMatchCase, 'entries'> = { service: 'github', site: 'github.com' };

function resolve(value: AccountMatchCase) {
	const output = execFileSync(binary, { input: JSON.stringify([value]), encoding: 'utf8' });
	return (JSON.parse(output) as unknown[])[0];
}

beforeAll(() => {
	if (!darwin) return;
	execFileSync('xcrun', [
		'swiftc',
		'packages/desktop/ios/App/App/Vault/Picker/VaultAccountMatch.swift',
		'test/support/credential-vault/iosAccountMatch.swift',
		'-parse-as-library',
		'-o',
		binary
	]);
}, 60_000);
afterAll(() => rmSync(workspace, { recursive: true, force: true }));

describe.skipIf(!darwin)('Harness iOS vault logins offered for a site', () => {
	test('a saved login under another name is offered when no account is named', () => {
		const entries = [entry('github.com', 'sample-user', 'github.com')];
		expect(resolve({ ...github, entries })).toEqual({
			kind: 'choose',
			offered: ['github.com|sample-user']
		});
	});

	test('every account on the site is offered, the exact service name first', () => {
		const entries = [
			entry('work-code', 'work-user', 'https://www.GitHub.com/login'),
			entry('GitHub', 'named-user'),
			entry('gist', 'gist-user', 'gist.github.com'),
			entry('github', 'main-user'),
			entry('mail', 'mail-user', 'example.com')
		];
		expect(resolve({ ...github, entries })).toEqual({
			kind: 'choose',
			offered: ['github|main-user', 'work-code|work-user', 'gist|gist-user', 'GitHub|named-user']
		});
	});

	test('a saved parent domain answers a request for its subdomain', () => {
		const entries = [entry('chat', 'sample@example.com', 'slack.com')];
		const request = { service: 'slack', site: 'sample.slack.com', entries };
		expect(resolve(request)).toEqual({ kind: 'choose', offered: ['chat|sample@example.com'] });
	});

	test('lookalike, sibling and bare suffix domains are never offered', () => {
		const entries = [
			entry('a', 'u', 'evilgithub.com'),
			entry('b', 'u', 'github.com.example.net'),
			entry('c', 'u', 'com'),
			entry('github', 'u2', undefined),
			entry('GitHub', 'u3', 'example.org'),
			entry('github.example.net', 'u4')
		];
		expect(resolve({ ...github, entries })).toEqual({ kind: 'choose', offered: ['github|u2'] });
		const sibling = [entry('x', 'u', 'other.sample.test')];
		expect(resolve({ service: 'y', site: 'login.sample.test', entries: sibling })).toEqual({
			kind: 'missing',
			offered: []
		});
	});
});

describe.skipIf(!darwin)('Harness iOS vault account naming and adding', () => {
	test('a named account selects its one saved login without a picker', () => {
		const entries = [entry('github', 'other-user'), entry('code', 'Sample-User', 'github.com')];
		expect(resolve({ ...github, account: 'sample-user', entries })).toEqual({
			kind: 'ready',
			offered: ['code|Sample-User']
		});
	});

	test('a named account saved under another username still offers the saved logins', () => {
		const entries = [entry('code', 'sample@example.com', 'github.com')];
		expect(resolve({ ...github, account: 'sample-user', entries })).toEqual({
			kind: 'choose-account-missing',
			offered: ['code|sample@example.com']
		});
	});

	test('without a site only the service name matches, in any letter case', () => {
		const entries = [entry('GitHub', 'a'), entry('code', 'b', 'github.com')];
		expect(resolve({ service: 'github', entries })).toEqual({
			kind: 'choose',
			offered: ['GitHub|a']
		});
	});

	test('nothing saved for the site is the only case that asks to add a login', () => {
		const entries = [entry('mail', 'u', 'example.com')];
		expect(resolve({ ...github, entries })).toEqual({ kind: 'missing', offered: [] });
	});
});
