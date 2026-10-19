import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { type ProcessProbes } from "./processProbes";

/** The developer tools in use and the services of theirs that a command may hand over. */
export interface ServiceAuthority {
	/** The developer directory, canonical. */
	root: string;
	/** The signed code that directory is part of, and what its signature must satisfy. */
	rootCode: string;
	rootRequirement: string;
	/** Each service by its exact path inside the directory, and what its running code must satisfy. */
	services: { path: string; requirement: string }[];
}

/**
 * delegated: a vetted service, vouched for, that left its command and is the system's now.
 * protected: possibly a shared service, or not to be told apart; never signalled, never passed.
 * private: the command's own. gone: no longer the process that was followed.
 */
export type Standing = 'delegated' | 'protected' | 'private' | 'gone';

export interface Verdict {
	standing: Standing;
	reason: string;
	executable: string | null;
}

export interface ServiceContext {
	authority: () => ServiceAuthority | null | Promise<ServiceAuthority | null>;
	/** The process group of the command. */
	group: number;
	/** How processes are looked at; the system's own tools unless a test stands in between. */
	probes?: ProcessProbes;
	/** Ends the looks that are under way when the work they belong to is over. */
	signal?: AbortSignal;
}

const xcodeRequirement =
	'identifier "com.apple.dt.Xcode" and anchor apple generic and ' +
	'(certificate leaf[field.1.2.840.113635.100.6.1.9] exists or ' +
	'certificate 1[field.1.2.840.113635.100.6.2.6] exists and ' +
	'certificate leaf[field.1.2.840.113635.100.6.1.13] exists and ' +
	'certificate leaf[subject.OU] = "59GAB85EFG")';

const vetted = [
	{ path: 'usr/bin/ibtoold', requirement: 'identifier "com.apple.ibtool" and anchor apple' }
];

export /** The Xcode a developer directory is part of, with the one service of it that is shared. */
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

export { platformServices, classifyProcess, stillPrivate } from './run-isolated/platformServices';
