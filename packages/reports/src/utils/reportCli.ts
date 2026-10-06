import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';
export interface CliOptions {
	operation: string;
	flags: Record<string, string | boolean>;
	positionals: string[];
}
export function reportCli(argv: string[]): CliOptions {
	const [operation, ...rest] = argv;
	const result = parseArgs({
		args: rest,
		strict: false,
		allowPositionals: true,
		options: {
			project: { type: 'string' },
			title: { type: 'string' },
			mode: { type: 'string' },
			environment: { type: 'string' },
			revision: { type: 'string' },
			summary: { type: 'string' },
			acceptance: { type: 'string' },
			run: { type: 'string' },
			kind: { type: 'string' },
			data: { type: 'string' },
			file: { type: 'string' },
			format: { type: 'string' },
			findings: { type: 'string' },
			historical: { type: 'boolean' },
			port: { type: 'string' },
			'dry-run': { type: 'boolean' }
		}
	});
	return {
		operation: operation || '',
		flags: result.values as Record<string, string | boolean>,
		positionals: result.positionals
	};
}
export async function inputData(flags: Record<string, string | boolean>) {
	const raw = flags.file ? await readFile(String(flags.file), 'utf8') : flags.data;
	if (!raw) throw new Error('Provide --data JSON or --file JSON');
	return JSON.parse(String(raw)) as Record<string, unknown>;
}
export function required(flags: Record<string, string | boolean>, name: string) {
	const value = flags[name];
	if (typeof value !== 'string' || !value.trim()) throw new Error(`--${name} is required`);
	return value;
}
