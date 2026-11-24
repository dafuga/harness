import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { afterEach, expect, test } from 'vitest';

const workspaces: string[] = [];
const common = resolve('deploy/vault/setup/common.sh');
const macos = resolve('deploy/vault/setup/macos.sh');

afterEach(() => {
	for (const path of workspaces.splice(0)) rmSync(path, { recursive: true, force: true });
});

function fixture() {
	const path = mkdtempSync(join(tmpdir(), 'vault-setup-test-'));
	workspaces.push(path);
	const journal = join(path, 'journal');
	const run = (action: 'setup' | 'remove', fault = '') =>
		spawnSync(
			'/bin/bash',
			['test/fixtures/vault-setup/transaction.sh', common, path, action, fault],
			{
				encoding: 'utf8'
			}
		);
	return {
		path,
		journal,
		run,
		status: () => readFileSync(join(journal, 'setup-progress'), 'utf8').trim()
	};
}

test.each(['group', 'account', 'engine'])('setup resumes after interruption at %s', (phase) => {
	const host = fixture();
	expect(host.run('setup', phase).signal).toBe('SIGKILL');
	expect(host.status()).toBe('working:setup:' + phase);
	expect(host.run('setup').status).toBe(0);
	expect(host.run('setup').status).toBe(0);
	expect(host.status()).toBe('ready');
});

test.each(['stop', 'delete-user', 'delete-group'])(
	'remove resumes after interruption at %s',
	(phase) => {
		const host = fixture();
		expect(host.run('setup').status).toBe(0);
		writeFileSync(join(host.path, 'executor-home', 'synthetic-data'), 'keep this');
		expect(host.run('remove', phase).signal).toBe('SIGKILL');
		expect(host.run('remove').status).toBe(0);
		expect(host.run('remove').status).toBe(0);
		expect(host.status()).toBe('absent');
		const [archived] = readdirSync(join(host.journal, 'archive'));
		expect(readFileSync(join(host.journal, 'archive', archived, 'synthetic-data'), 'utf8')).toBe(
			'keep this'
		);
	}
);

test('the failed step is reported and repair respects the original identity', () => {
	const host = fixture();
	const failed = host.run('setup', 'engine-error');
	expect(failed.status).toBe(1);
	expect(failed.stderr).toContain('Vault setup failed at engine. The synthetic engine failed.');
	expect(host.status()).toBe('failed:setup:engine');
	writeFileSync(join(host.journal, 'user'), 'foreign identity');
	expect(host.run('setup').stderr).toContain('existing Vault user does not match');
	expect(host.run('remove').stderr).toContain('existing Vault user does not match');
	expect(readFileSync(join(host.journal, 'user'), 'utf8')).toBe('foreign identity');
});

test('macOS accepts both real dscl forms and requires unambiguous sudo denial text', () => {
	const result = spawnSync(
		'/bin/bash',
		[
			'-c',
			[
				'source "$1"; source "$2"',
				"attribute_matches IsHidden 1 <<< 'dsAttrTypeNative:IsHidden: 1'",
				"attribute_matches IsHidden 1 <<< 'IsHidden: 1'",
				"! attribute_matches IsHidden 1 <<< 'dsAttrTypeNative:IsHidden: 0'",
				"sudo_denied 'User harness-vault is not allowed to run sudo on MacBookPro.'",
				"! sudo_denied 'User harness-vault may run the following commands on MacBookPro:'",
				"! sudo_denied 'sudo: a password is required'",
				"! sudo_denied $'User harness-vault is not allowed to run sudo on MacBookPro.\\n/root/script'"
			].join('\n'),
			'fixture',
			common,
			macos
		],
		{ encoding: 'utf8' }
	);
	expect(result.status, result.stderr).toBe(0);
});
