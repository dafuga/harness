import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const known = new Map<string, string | null>();

/** A clone of a clone of a clone is followed this far, and no further. */
const maxHops = 5;

function git(directory: string, args: string[]): string | undefined {
	try {
		return execFileSync('git', ['-C', directory, ...args], {
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore']
		}).trim();
	} catch {
		return undefined;
	}
}

/** `host/path` of a network address in any of its spellings; undefined for anything else. */
function networkAddress(url: string): string | undefined {
	const parsed =
		/^[a-z][a-z0-9+.-]*:\/\/(?:[^@/]+@)?([^/:]+)(?::\d+)?\/(.+)$/i.exec(url) ??
		/^(?:[^@/]+@)?([^/:]+):(?!\/)(.+)$/.exec(url);
	if (!parsed) return undefined;
	const path = parsed[2].replace(/\/+$/, '').replace(/\.git$/, '');
	return path ? `${parsed[1].toLowerCase()}/${path}` : undefined;
}

/** The directory a remote names when it is a local path or a file address. */
function localRemote(url: string, directory: string): string | undefined {
	if (url.startsWith('file://')) return fileURLToPath(url);
	if (isAbsolute(url)) return url;
	return url.startsWith('.') ? resolve(directory, url) : undefined;
}

/** The remote a repository came from: `origin`, or its only remote; undefined when unclear. */
function upstream(directory: string): string | undefined {
	const remotes = (git(directory, ['remote']) ?? '').split('\n').filter(Boolean);
	const only = remotes.length === 1 ? remotes[0] : '';
	const name = remotes.includes('origin') ? 'origin' : only;
	return name ? git(directory, ['remote', 'get-url', name]) : undefined;
}

function identify(directory: string, hops: number): string | null {
	const store = git(directory, ['rev-parse', '--path-format=absolute', '--git-common-dir']);
	if (!store || hops > maxHops) return null;
	const remotes = git(directory, ['remote']);
	// With no remote at all the repository is its own origin: its worktrees share this store.
	if (remotes === '') return `local:${realpathSync(store)}`;
	const url = upstream(directory);
	if (!url) return null;
	const local = localRemote(url, directory);
	if (local) return identify(local, hops + 1);
	const address = networkAddress(url);
	return address ? `remote:${address}` : null;
}

/**
 * The identity of the application a checkout belongs to: the repository it was cloned from,
 * named by its remote address whatever protocol spells it, or its own Git store when it has no
 * remote. A local clone is the application it was cloned from. History decides nothing: two
 * applications started from one template share commits and are still different. Null when the
 * directory is no repository or its origin is missing or unclear; null equals nothing.
 */
export function repositoryIdentity(directory: string): string | null {
	if (!known.has(directory)) {
		const identity = identify(directory, 0);
		known.set(directory, identity && createHash('sha256').update(identity).digest('hex'));
	}
	return known.get(directory) ?? null;
}

/** True when both directories are checkouts of one application; an unknown side is never one. */
export function sameRepository(left: string, right: string): boolean {
	const identity = repositoryIdentity(left);
	return identity !== null && identity === repositoryIdentity(right);
}

function realDirectory(directory: string): string | undefined {
	try {
		return realpathSync(directory);
	} catch {
		return undefined;
	}
}

/**
 * True when `directory` belongs to the site hosted at `site`. A site in a repository owns the
 * checkouts of that repository. A site that is no repository at all owns its own directory and
 * nothing else, so a project kept outside Git still sees what was recorded for it.
 */
export function sameSite(site: string, directory: string): boolean {
	if (repositoryIdentity(site) !== null) return sameRepository(site, directory);
	const own = plainSite(site);
	return own !== null && realDirectory(directory) === own;
}

const plain = new Map<string, string | null>();

/**
 * The real directory of a site that is in no repository, decided once: a filter asks this for
 * every recorded event. Inside a repository whose origin is unclear nothing can be attributed,
 * not even by path, so that is null as well.
 */
function plainSite(site: string): string | null {
	if (!plain.has(site)) {
		const own = realDirectory(site);
		const outside = own !== undefined && git(own, ['rev-parse', '--git-dir']) === undefined;
		plain.set(site, outside ? own : null);
	}
	return plain.get(site) ?? null;
}
