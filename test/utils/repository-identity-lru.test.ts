import { mkdirSync, realpathSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { BoundedCommandAdapter } from '../../src/adapters/execution-runtimes/BoundedCommandAdapter';
import {
	repositoryIdentity,
	sameSite
} from '../../src/utils/accounts-access/repository-identity/repositoryIdentity';
import { withTempDir } from '../support/temporary';

/**
 * The cache bounds are proved against a scripted Git: the probe is the adapter's `runSync`, so no
 * process is started here. `repository-identity.test.ts` keeps the cases that run the real Git.
 */
const knownBound = 256;
const plainBound = 512;
/** Directory to the origin its scripted repository reports; any other directory is no repository. */
const origins = new Map<string, string>();
const asked = new Map<string, number>();
/** Questions the script has no answer for; the subject swallows a throwing probe, so they are kept. */
const unscripted: string[] = [];
/** How many times Git was asked this question about this directory. */
const probes = (directory: string, question: string) => asked.get(`${directory} ${question}`) ?? 0;
const answer = (text: string) => ({ code: 0, stdout: Buffer.from(`${text}\n`), stderr: '' });

function scriptedGit(command: string, args: string[] = []) {
	const [flag, directory, ...rest] = args;
	const question = rest.join(' ');
	if (command !== 'git' || flag !== '-C') unscripted.push([command, ...args].join(' '));
	asked.set(`${directory} ${question}`, probes(directory, question) + 1);
	const origin = origins.get(directory);
	if (origin === undefined)
		return { code: 128, stdout: Buffer.alloc(0), stderr: 'fatal: not a git repository' };
	if (rest[0] === 'rev-parse') return answer(`${directory}/.git`);
	if (question === 'remote') return answer('origin');
	if (question === 'remote get-url origin') return answer(origin);
	unscripted.push(question);
	return { code: 1, stdout: Buffer.alloc(0), stderr: 'unscripted' };
}

beforeEach(() => {
	origins.clear();
	asked.clear();
	unscripted.length = 0;
	vi.spyOn(BoundedCommandAdapter.prototype, 'runSync').mockImplementation(scriptedGit);
});
afterEach(() => {
	vi.restoreAllMocks();
	expect(unscripted).toEqual([]);
});

const identified = 'rev-parse --path-format=absolute --git-common-dir';
/** A scripted repository of its own, identified once so that it takes a place in the cache. */
function fill(from: number, count: number): void {
	for (let index = from; index < from + count; index++) {
		origins.set(`/scripted/filler-${index}`, `https://github.com/synthetic/filler-${index}.git`);
		repositoryIdentity(`/scripted/filler-${index}`);
	}
}

test('an identity is probed once, kept while recently used and recomputed once evicted', () => {
	const target = '/scripted/target';
	origins.set(target, 'https://github.com/synthetic/cache-v1.git');
	const first = repositoryIdentity(target);
	expect(first).toMatch(/^[0-9a-f]{64}$/);
	// The origin changes; a cached identity does not ask Git again.
	origins.set(target, 'https://github.com/synthetic/cache-v2.git');
	expect(repositoryIdentity(target)).toBe(first);
	// The target and 255 newer keys are exactly the bound: nothing is evicted.
	fill(0, knownBound - 1);
	expect(repositoryIdentity(target)).toBe(first); // this hit makes the target the newest key
	expect(probes(target, identified)).toBe(1);
	// One key more evicts the least recently used: the first filler, not the older target.
	fill(knownBound - 1, 1);
	expect(repositoryIdentity(target)).toBe(first);
	expect(probes(target, identified)).toBe(1);
	expect(probes('/scripted/filler-1', identified)).toBe(1);
	repositoryIdentity('/scripted/filler-0');
	expect(probes('/scripted/filler-0', identified)).toBe(2);
	// A full bound of keys newer than the target's last use evicts it: the new origin is read.
	repositoryIdentity(target);
	fill(knownBound, knownBound);
	const second = repositoryIdentity(target);
	expect(second).toMatch(/^[0-9a-f]{64}$/);
	expect(second).not.toBe(first);
	expect(probes(target, identified)).toBe(2);
});

test('a plain site is resolved once, kept while recently used and resolved again once evicted', () =>
	withTempDir('harness-identity-lru-', (temporary) => {
		const root = realpathSync(temporary); // probes are counted by the real directory
		const outside = 'rev-parse --git-dir';
		const place = (name: string) => {
			mkdirSync(join(root, name));
			return join(root, name);
		};
		/** A plain directory of its own, asked about once so that it takes a place in the cache. */
		const fill = (from: number, count: number) => {
			for (let index = from; index < from + count; index++) {
				const filler = place(`filler-${index}`);
				expect(sameSite(filler, filler)).toBe(true);
			}
		};
		const [before, after] = [place('target-a'), place('target-b')];
		const link = join(root, 'site-link');
		symlinkSync(before, link);
		expect(sameSite(link, before)).toBe(true);
		// The link moves; the cached site is still the directory it named when first asked.
		rmSync(link);
		symlinkSync(after, link);
		expect(sameSite(link, before)).toBe(true);
		// The site and 511 newer keys are exactly the bound: nothing is evicted.
		fill(0, plainBound - 1);
		expect(sameSite(link, before)).toBe(true); // this hit makes the site the newest key
		// One key more evicts the least recently used: the first filler, not the older site.
		fill(plainBound - 1, 1);
		expect(sameSite(link, before)).toBe(true);
		expect(probes(before, outside)).toBe(1);
		const first = join(root, 'filler-0');
		expect(probes(first, outside)).toBe(1);
		expect(sameSite(first, first)).toBe(true);
		expect(probes(first, outside)).toBe(2);
		// A full bound of keys newer than the site's last use evicts it: the moved link is read.
		expect(sameSite(link, before)).toBe(true);
		fill(plainBound, plainBound);
		expect(sameSite(link, after)).toBe(true);
		expect(sameSite(link, before)).toBe(false);
		expect(probes(after, outside)).toBe(1);
	}));
