import { execFileSync } from 'node:child_process';
import { mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, expect, test } from 'vitest';
import { repositoryIdentity, sameRepository, sameSite } from '../../src/utils/repositoryIdentity';

const root = mkdtempSync(join(tmpdir(), 'harness-repository-identity-'));
const user = ['-c', 'user.name=Fixture', '-c', 'user.email=f@harness.invalid'];
const git = (cwd: string, args: string[]) =>
	execFileSync('git', [...user, '-c', 'commit.gpgsign=false', ...args], { cwd, stdio: 'pipe' });
const at = (name: string) => join(root, name);

function repository(name: string): string {
	git(root, ['init', '-q', '-b', 'main', name]);
	writeFileSync(join(at(name), 'README.md'), `# ${name}\n`);
	git(at(name), ['add', '-A']);
	git(at(name), ['commit', '-q', '-m', `feat: ${name}`]);
	return at(name);
}
/** A clone of `from` whose origin is then pointed at the given address. */
function cloned(from: string, name: string, origin?: string): string {
	git(root, ['clone', '-q', from, name]);
	if (origin) git(at(name), ['remote', 'set-url', 'origin', origin]);
	return at(name);
}
afterAll(() => rmSync(root, { recursive: true, force: true }));

test('two applications started from one template are different repositories', () => {
	const template = repository('template');
	const host = cloned(template, 'host-app', 'https://github.com/synthetic/host-app.git');
	const other = cloned(template, 'unrelated-app', 'https://github.com/synthetic/unrelated-app.git');
	// They share every commit of the template, and that decides nothing.
	const head = (directory: string) => String(git(directory, ['rev-parse', 'HEAD'])).trim();
	expect(head(host)).toBe(head(other));
	expect(repositoryIdentity(host)).toMatch(/^[0-9a-f]{64}$/);
	expect(repositoryIdentity(other)).not.toBe(repositoryIdentity(host));
	expect(sameRepository(host, other)).toBe(false);
	expect(sameRepository(host, template)).toBe(false);
});

test('one application is the same through every address, checkout and kind of clone', () => {
	const template = repository('seed');
	const site = cloned(template, 'site', 'https://github.com/Synthetic/site-app.git');
	const identity = repositoryIdentity(site);
	const addresses = [
		'git@github.com:Synthetic/site-app.git',
		'ssh://git@GitHub.com/Synthetic/site-app',
		'https://user@github.com/Synthetic/site-app/',
		'https://github.com:443/Synthetic/site-app.git'
	];
	for (const [index, address] of addresses.entries()) {
		expect([address, repositoryIdentity(cloned(template, `same-${index}`, address))]).toEqual([
			address,
			identity
		]);
	}
	git(site, ['worktree', 'add', '-q', '-b', 'feature', at('site-worktree')]);
	expect(repositoryIdentity(at('site-worktree'))).toBe(identity);
	// A clone of a local checkout is that application, and so is a clone of that clone.
	const local = cloned(site, 'local-clone');
	expect(repositoryIdentity(local)).toBe(identity);
	expect(repositoryIdentity(cloned(local, 'clone-of-clone'))).toBe(identity);
	git(root, ['clone', '-q', '--depth', '1', `file://${site}`, 'shallow']);
	expect(repositoryIdentity(at('shallow'))).toBe(identity);
	renameSync(at('same-0'), at('renamed-checkout'));
	expect(repositoryIdentity(at('renamed-checkout'))).toBe(identity);
	expect(sameRepository(site, at('renamed-checkout'))).toBe(true);
});

test('a repository without a remote is itself: its worktrees and local clones, nothing else', () => {
	const site = repository('offline-site');
	git(site, ['worktree', 'add', '-q', '-b', 'side', at('offline-worktree')]);
	expect(sameRepository(site, at('offline-worktree'))).toBe(true);
	expect(sameRepository(site, cloned(site, 'offline-clone'))).toBe(true);
	// The same name and the same content elsewhere are another repository.
	expect(sameRepository(site, repository('offline-twin'))).toBe(false);
});

test('whatever cannot be attributed is no repository, and never equal to anything', () => {
	const site = repository('known');
	const ambiguous = cloned(site, 'ambiguous');
	git(ambiguous, ['remote', 'rename', 'origin', 'first']);
	git(ambiguous, ['remote', 'add', 'second', 'https://github.com/synthetic/second.git']);
	const orphan = cloned(site, 'orphan', at('deleted-upstream'));
	for (const directory of [ambiguous, orphan, at('missing'), tmpdir()]) {
		expect([directory, repositoryIdentity(directory)]).toEqual([directory, null]);
		expect(sameRepository(site, directory)).toBe(false);
		expect(sameRepository(directory, directory)).toBe(false);
	}
});

test('a site that is no repository is that one directory, and no repository belongs to it', () => {
	const plain = mkdtempSync(join(root, 'plain-'));
	const elsewhere = mkdtempSync(join(root, 'plain-'));
	const site = repository('beside-plain');
	// The directory itself, however it is spelled; nothing beside, inside or above it.
	expect(sameSite(plain, plain)).toBe(true);
	expect(sameSite(plain, `${plain}/`)).toBe(true);
	expect(sameSite(plain, elsewhere)).toBe(false);
	expect(sameSite(plain, root)).toBe(false);
	expect(sameSite(plain, site)).toBe(false);
	expect(sameSite(plain, at('missing'))).toBe(false);
	expect(sameSite(at('missing'), at('missing'))).toBe(false);
	// A repository is a site by its identity alone; a plain directory is never one of its checkouts.
	expect(sameSite(site, site)).toBe(true);
	expect(sameSite(site, plain)).toBe(false);
	const other = cloned(site, 'plain-foreign', 'https://github.com/synthetic/plain-foreign.git');
	expect(sameSite(site, other)).toBe(false);
});
