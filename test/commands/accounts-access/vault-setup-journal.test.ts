import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { resolve, join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { createTempDirectory, withTempDir } from '../../support/temporary';

const workspaces: string[] = [];
const common = resolve('deploy/vault/setup/common.sh');
const macos = resolve('deploy/vault/setup/macos.sh');

afterEach(() => {
	for (const path of workspaces.splice(0)) rmSync(path, { recursive: true, force: true });
});

async function fixture() {
	const path = await createTempDirectory('vlt-');
	workspaces.push(path);
	const journal = join(path, 'journal');
	const run = (action: 'setup' | 'remove', fault = '') =>
		spawnSync(
			'/bin/bash',
			['test/support/vault-setup/transaction.sh', common, path, action, fault],
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

test.each(['group', 'account', 'engine'])(
	'setup resumes after interruption at %s',
	async (phase) => {
		const host = await fixture();
		expect(host.run('setup', phase).signal).toBe('SIGKILL');
		expect(host.status()).toBe('working:setup:' + phase);
		expect(host.run('setup').status).toBe(0);
		expect(host.run('setup').status).toBe(0);
		expect(host.status()).toBe('ready');
	}
);

test.each(['stop', 'delete-user', 'delete-group'])(
	'remove resumes after interruption at %s',
	async (phase) => {
		const host = await fixture();
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

test('the failed step is reported and repair respects the original identity', async () => {
	const host = await fixture();
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

test('macOS checks a real private socket with the system test binary', async () => {
	await withTempDir('vlt-', async (directory) => {
		const socket = join(directory, 'docker.sock');
		const server = createServer();
		await new Promise<void>((listen, reject) => {
			server.once('error', reject).listen(socket, listen);
		});
		try {
			const check = [
				'source "$1"; source "$2"; socket="$3"; executor_id=551',
				'as_executor() { case "$1" in /bin/test) "$@";; /usr/bin/stat) printf 551;; "$docker") :;; *) return 1;; esac; }',
				'verify_engine'
			].join('\n');
			const result = spawnSync('/bin/bash', ['-c', check, 'fixture', common, macos, socket], {
				encoding: 'utf8'
			});
			expect(result.status, result.stderr).toBe(0);
		} finally {
			await new Promise<void>((done) => server.close(() => done()));
		}
	});
});

test('macOS repair leaves matching Directory Services attributes alone', () => {
	const check = [
		'source "$1"; source "$2"',
		'directory_service() {',
		'  case "$1:$3" in',
		"    -read:Password) printf 'Password: *\\n';;",
		"    -read:RealName) printf 'RealName:\\n Harness Vault Executor\\n';;",
		'    -read:IsHidden) return 1;;',
		'    -create:IsHidden) printf \'%s\\n\' "$3=$4";;',
		'    *) return 1;;',
		'  esac',
		'}',
		'ensure_attribute /Users/harness-vault Password "*"',
		'ensure_attribute /Users/harness-vault RealName "Harness Vault Executor"',
		'ensure_attribute /Users/harness-vault IsHidden 1'
	].join('\n');
	const result = spawnSync('/bin/bash', ['-c', check, 'fixture', common, macos], {
		encoding: 'utf8'
	});
	expect(result.status, result.stderr).toBe(0);
	expect(result.stdout.trim()).toBe('IsHidden=1');
});

test.skipIf(process.platform !== 'darwin')(
	'macOS archives managed Vault data when moving a system home is denied',
	async () => {
		await withTempDir('vlt-', async (directory) => {
			const result = spawnSync(
				'/bin/bash',
				['test/support/vault-setup/macos-archive.sh', common, macos, directory],
				{ encoding: 'utf8' }
			);
			expect(result.status, result.stderr).toBe(0);
			expect(result.stdout.trim()).toBe('PASS: legacy home retained; managed data archived.');
		});
	}
);
