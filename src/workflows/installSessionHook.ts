import { copyFile, mkdir, readFile, realpath, writeFile, chmod } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { readSessionCredential, type SessionHookSettings } from './sessionHookConfig';

export interface SessionInstallOptions {
	home: string;
	root: string[];
	credentialFile: string;
	bundle: string;
}

interface HookHandler {
	type: string;
	command?: string;
	[key: string]: unknown;
}
interface HookGroup {
	hooks: HookHandler[];
	[key: string]: unknown;
}
interface HookFile {
	hooks?: Record<string, HookGroup[]>;
	[key: string]: unknown;
}

export async function installSessionHook(options: SessionInstallOptions) {
	const home = resolve(options.home);
	const directory = join(home, 'harness', 'session-checks');
	const bundlePath = join(directory, 'index.js');
	const settingsPath = join(directory, 'settings.json');
	const hooksPath = join(home, 'hooks.json');
	const settings: SessionHookSettings = {
		roots: await Promise.all(options.root.map((root) => realpath(root))),
		credentialFile: await realpath(options.credentialFile)
	};
	await readSessionCredential(settings.credentialFile);
	const bundle = await realpath(options.bundle);
	const hooks = await existingHooks(hooksPath);
	const command = `${quote(process.execPath)} ${quote(bundlePath)} session hook --settings ${quote(settingsPath)}`;
	hooks.hooks ??= {};
	hooks.hooks.SessionStart = updatedGroups(hooks.hooks.SessionStart ?? [], command, bundlePath);
	await mkdir(directory, { recursive: true, mode: 0o700 });
	if (bundle !== bundlePath) await copyFile(bundle, bundlePath);
	await chmod(bundlePath, 0o600);
	await privateJson(settingsPath, settings);
	await privateJson(hooksPath, hooks);
	return { hooksPath, settingsPath, roots: settings.roots, trustRequired: true };
}

function updatedGroups(groups: HookGroup[], command: string, bundlePath: string): HookGroup[] {
	const retained = groups
		.map((group) => ({
			...group,
			hooks: group.hooks.filter(
				(hook) => !(hook.type === 'command' && hook.command?.includes(quote(bundlePath)))
			)
		}))
		.filter((group) => group.hooks.length);
	return [
		...retained,
		{
			matcher: '^(startup|resume|clear)$',
			hooks: [
				{
					type: 'command',
					command,
					async: true,
					timeout: 120,
					statusMessage: 'Reviewing Harness code with Jev',
					additionalContextLimit: 2500
				}
			]
		}
	];
}

async function existingHooks(path: string): Promise<HookFile> {
	let raw: string;
	try {
		raw = await readFile(path, 'utf8');
	} catch (error) {
		if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return {};
		throw error;
	}
	let value: unknown;
	try {
		value = JSON.parse(raw);
	} catch {
		throw new Error('Invalid hook configuration; the existing file was preserved.');
	}
	if (!record(value)) throw new Error('Invalid hook configuration.');
	if (value.hooks !== undefined && !record(value.hooks))
		throw new Error('Invalid hook event configuration.');
	return value;
}

function record(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

async function privateJson(path: string, value: unknown): Promise<void> {
	await writeFile(path, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
	await chmod(path, 0o600);
}

function quote(value: string): string {
	return "'" + value.replaceAll("'", "'\\''") + "'";
}
