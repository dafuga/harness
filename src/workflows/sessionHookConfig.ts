import { lstat, readFile } from 'node:fs/promises';
import { isAbsolute } from 'node:path';

export interface SessionHookSettings {
	roots: string[];
	credentialFile: string;
}

export interface SessionStartEvent {
	cwd: string;
	session_id: string;
	hook_event_name: 'SessionStart';
	source: 'startup' | 'resume' | 'clear';
}

export function parseSessionEvent(input: string): SessionStartEvent | undefined {
	if (Buffer.byteLength(input) > 32000) throw new Error('Hook input is too large.');
	const event = JSON.parse(input) as Partial<SessionStartEvent> | null;
	if (event?.hook_event_name !== 'SessionStart') return undefined;
	if (!['startup', 'resume', 'clear'].includes(event.source ?? '')) return undefined;
	if (typeof event.cwd !== 'string' || !isAbsolute(event.cwd)) return undefined;
	if (typeof event.session_id !== 'string' || !event.session_id.trim()) return undefined;
	return {
		hook_event_name: 'SessionStart',
		cwd: event.cwd,
		session_id: event.session_id,
		source: event.source as SessionStartEvent['source']
	};
}

export async function readSessionSettings(path: string): Promise<SessionHookSettings> {
	const value = JSON.parse(await readFile(path, 'utf8')) as SessionHookSettings | null;
	if (!value || !Array.isArray(value.roots) || !value.roots.length)
		throw new Error('Session project roots are required.');
	if (value.roots.some((root) => typeof root !== 'string' || !isAbsolute(root)))
		throw new Error('Session roots must be absolute paths.');
	if (typeof value.credentialFile !== 'string' || !isAbsolute(value.credentialFile))
		throw new Error('A project-owned credential file is required.');
	return { roots: value.roots, credentialFile: value.credentialFile };
}

export async function readSessionCredential(path: string): Promise<string> {
	const info = await lstat(path);
	if (!info.isFile() || info.isSymbolicLink() || info.mode & 0o077)
		throw new Error('Credential file must be an owner-only regular file.');
	const contents = await readFile(path, 'utf8');
	const values = [...contents.matchAll(/^\s*(?:export\s+)?HARNESS_JEV_API_KEY\s*=\s*(.*?)\s*$/gm)];
	if (values.length !== 1) throw new Error('Exactly one Harness Jev credential is required.');
	const raw = values[0][1];
	const key = raw.startsWith('"') ? quotedValue(raw) : unquotedValue(raw);
	if (typeof key !== 'string' || !key.trim() || /[\r\n\0]/.test(key))
		throw new Error('The configured credential value is invalid.');
	return key;
}

function quotedValue(raw: string): unknown {
	try {
		return JSON.parse(raw);
	} catch {
		throw new Error('Credential file contains an invalid quoted value.');
	}
}

function unquotedValue(raw: string): string {
	if (raw.startsWith("'") && raw.endsWith("'")) return raw.slice(1, -1);
	return raw.split(/\s+#/)[0].trim();
}
