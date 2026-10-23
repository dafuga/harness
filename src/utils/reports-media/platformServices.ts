import type { Verdict, ServiceContext, ServiceAuthority, Facts } from './platformServices.types';
import { execFileSync } from 'node:child_process';
import { realpathSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { TrackedProcess } from '../development-tooling/processDescendants';
import { processProbes, type ProcessProbes } from '../development-tooling/processProbes';

const xcodeRequirement =
	'identifier "com.apple.dt.Xcode" and anchor apple generic and ' +
	'(certificate leaf[field.1.2.840.113635.100.6.1.9] exists or ' +
	'certificate 1[field.1.2.840.113635.100.6.2.6] exists and ' +
	'certificate leaf[field.1.2.840.113635.100.6.1.13] exists and ' +
	'certificate leaf[subject.OU] = "59GAB85EFG")';

const vetted = [
	{ path: 'usr/bin/ibtoold', requirement: 'identifier "com.apple.ibtool" and anchor apple' }
];

/** Names of the shared service and of the tools that start it: never signalled under any path. */
const guarded = ['ibtoold', 'ibtool', 'actool'];

const vouched = new Set<string>();

const gone: Verdict = { standing: 'gone', reason: 'it ended', executable: null };

export const sameTime = (one: string, other: string) =>
	one.replace(/\s+/g, ' ') === other.replace(/\s+/g, ' ');

export const named = (...names: string[]) => names.some((name) => guarded.includes(basename(name)));

export const probing = (context: ServiceContext) =>
	context.probes ?? processProbes({ signal: context.signal });

/** The Xcode a developer directory is part of, with the one service of it that is shared. */
function authorityAt(selected: string): ServiceAuthority | null {
	try {
		const root = realpathSync(selected.trim());
		const rootCode = /^(.+\.app)\/Contents\/Developer$/.exec(root)?.[1];
		const tools = { rootRequirement: xcodeRequirement, services: vetted };
		return rootCode ? { root, rootCode, ...tools } : null;
	} catch {
		return null;
	}
}

/** Xcode as selected on this machine; null when there is none. Starts a tool and waits for it. */
export function macAuthority(): ServiceAuthority | null {
	try {
		const selected = execFileSync('xcode-select', ['-p'], { stdio: ['ignore', 'pipe', 'ignore'] });
		return authorityAt(selected.toString());
	} catch {
		return null;
	}
}

/**
 * The services this machine's platform shares between commands, with the tools that vouch for
 * them. Read without blocking, for use while other processes are being waited for.
 */
export async function platformServices(): Promise<ServiceAuthority | null> {
	const { ok, out } = await processProbes().ran('xcode-select', ['-p']);
	return ok ? authorityAt(out) : null;
}

/** What a remembered answer is bound to: where the tools are and the files that sign them. */
function imprint(authority: ServiceAuthority): string | null {
	try {
		const files = ['Contents/Info.plist', 'Contents/_CodeSignature/CodeResources'];
		const stats = files.map((file) => statSync(join(authority.rootCode, file)));
		const marks = stats.map((stat) => `${stat.dev}:${stat.ino}:${stat.mtimeMs}:${stat.size}`);
		return [authority.rootCode, authority.rootRequirement, ...marks].join('|');
	} catch {
		return null;
	}
}

/** The tools are one canonical signed bundle that satisfies what is asked of it. */
async function rootVouched(authority: ServiceAuthority, probes: ProcessProbes): Promise<boolean> {
	const key = imprint(authority);
	if (!key || !canonical(authority)) return false;
	if (vouched.has(key)) return true;
	const check = ['--verify', '--ignore-resources', `-R=${authority.rootRequirement}`];
	if ((await probes.ran('codesign', [...check, authority.rootCode])).ok) vouched.add(key);
	return vouched.has(key);
}

/** Tools that are gone, moved or reached through a link are not canonical. */
function canonical(authority: ServiceAuthority): boolean {
	try {
		const real = realpathSync(authority.rootCode) === authority.rootCode;
		return real && authority.root === join(authority.rootCode, 'Contents/Developer');
	} catch {
		return false;
	}
}

function exists(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

/** Why the program is not a vetted service that is vouched for; null when it is. */
async function unvouched(pid: number, live: string, context: ServiceContext) {
	const authority = await context.authority();
	const probes = probing(context);
	if (!authority) return 'no developer tools vouch for it';
	const service = authority.services.find((item) => join(authority.root, item.path) === live);
	if (!service) return 'it is not the vetted service of the tools in use';
	if (!(await rootVouched(authority, probes))) return 'the developer tools are not vouched for';
	const check = ['--verify', `-R=${service.requirement}`, String(pid)];
	const running = await probes.ran('codesign', check);
	return running.ok ? null : 'its running code does not carry the vetted signature';
}

/** Why the process has not left its command for the system; null when it has. */
function unreleased(known: TrackedProcess, seen: Facts, context: ServiceContext): string | null {
	const apart = seen.group !== context.group && seen.group === known.pid && seen.terminal === '??';
	if (!apart) return 'it has not left the session and group of the command';
	return seen.parent === 1 ? null : 'the system has not adopted it';
}

const protect = (reason: string, executable: string | null): Verdict => ({
	standing: 'protected',
	reason,
	executable
});

/** A process named like the service: delegated only when everything holds, else protected. */
async function candidate(
	known: TrackedProcess,
	seen: Facts,
	live: string,
	context: ServiceContext
) {
	const refusal = (await unvouched(known.pid, live, context)) ?? unreleased(known, seen, context);
	if (refusal) return protect(refusal, live);
	const still = await probing(context).facts(known.pid);
	if (!still || !sameTime(still.started, known.started))
		return protect('it changed while it was looked at', live);
	const reason = 'vetted service, vouched for, left the command, adopted by the system';
	return { standing: 'delegated' as const, reason, executable: live };
}

/**
 * How one process stands. Only a process named like the shared service or its launchers is
 * looked into further, so an ordinary leftover costs two reads and no signature check. Whatever
 * cannot be read or told apart is protected: it is not signalled, and it does not pass.
 */
export async function classifyProcess(
	known: TrackedProcess,
	context: ServiceContext
): Promise<Verdict> {
	const probes = probing(context);
	const seen = await probes.facts(known.pid);
	if (!seen) return exists(known.pid) ? protect('its state could not be read', null) : gone;
	if (!sameTime(seen.started, known.started)) return gone;
	const live = await probes.executable(known.pid);
	if (!live) return protect('its program could not be read', null);
	if (named(live, seen.name)) return candidate(known, seen, live, context);
	return { standing: 'private', reason: "the command's own", executable: live };
}

export { stillPrivate } from './run-isolated/stillPrivate';

export type { ServiceAuthority, Standing, Verdict, ServiceContext } from './platformServices.types';
