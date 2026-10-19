import { createHash } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';

export interface PreviewArguments {
	root: string;
	configFile?: string;
	port: number;
	identity: string;
}

type PreviewOptions = { root: string; configFile?: string; port: number };

/** The app owns its listener; Vite must never move to another port or expose it remotely. */
export function previewArguments(
	args: string[],
	env: NodeJS.ProcessEnv = process.env
): PreviewArguments {
	const options: PreviewOptions = { root: process.cwd(), port: 5588 };
	for (let index = 0; index < args.length; index++) {
		const arg = args[index];
		if (arg === '--' || arg === '--strictPort') continue;
		if (!arg.startsWith('-')) options.root = resolve(arg);
		else applyOption(options, arg, args[++index]);
	}
	options.root = realpathSync(options.root);
	if (!Number.isInteger(options.port) || options.port < 1024 || options.port > 65535)
		throw new Error('Preview port must be from 1024 to 65535.');
	const settings = Object.keys(env)
		.sort()
		.filter(relevant)
		.map((key) => [key, env[key]]);
	const { root, configFile } = options;
	const identity = createHash('sha256')
		.update(JSON.stringify({ root, configFile, settings }))
		.digest('hex');
	return { ...options, identity };
}
function relevant(key: string): boolean {
	return (
		key.startsWith('HARNESS_') || key.startsWith('PROJECT_REPORTS_') || key === 'BODY_SIZE_LIMIT'
	);
}
function applyOption(options: PreviewOptions, arg: string, value: string | undefined): void {
	if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}.`);
	switch (arg) {
		case '--config':
			options.configFile = resolve(value);
			break;
		case '--port':
			options.port = Number(value);
			break;
		case '--host':
			if (value !== '127.0.0.1') throw new Error('Harness previews bind to 127.0.0.1 only.');
			break;
		default:
			throw new Error(`Unsupported managed preview option: ${arg}`);
	}
}
