import { spawn } from 'node:child_process';
import { realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { ModuleTaskSandboxAdapter } from '../../adapters/agents-providers/ModuleTaskSandboxAdapter';
import type { SandboxProcess } from '../../adapters/agents-providers/ModuleTaskSandboxAdapter.types';
import type { ModuleTaskToolBrokerScope } from '../../adapters/agents-providers/ModuleTaskToolBrokerAdapter.types';
const limit = 1024 * 1024;
/** @pure */
export function moduleTaskBrokerContracts(textToFormat: string): string {
	if (typeof textToFormat !== 'string')
		throw new TypeError('moduleTaskBrokerContracts expects text');
	return textToFormat.trim();
}
export function brokerUnitId(value: unknown): string {
	if (
		typeof value !== 'string' ||
		value.length > 200 ||
		!/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)+$/.test(value)
	)
		throw new Error('Invalid unit ID');
	return value;
}
export function brokerKind(value: unknown): string {
	if (typeof value !== 'string' || value.length > 100 || !/^[a-z][a-z0-9-]*$/.test(value))
		throw new Error('Invalid unit kind');
	return value;
}
function record(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error('Invalid contract response');
	return value as Record<string, unknown>;
}
function text(value: unknown): string {
	if (typeof value !== 'string') throw new Error('Invalid contract text');
	return value;
}
function jsonExample(value: unknown, parents = new Set<object>()): unknown {
	if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	if (typeof value !== 'object' || !value || parents.has(value))
		throw new Error('Invalid JSON example');
	if (!Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value)))
		throw new Error('Invalid JSON example');
	parents.add(value);
	const entries = Object.getOwnPropertyDescriptors(value);
	if (
		Object.getOwnPropertySymbols(value).length ||
		Object.values(entries).some((entry) => !('value' in entry))
	)
		throw new Error('Invalid JSON example');
	const result = Array.isArray(value)
		? Array.from(value, (item) => jsonExample(item, parents))
		: Object.fromEntries(
				Object.entries(entries).map(([key, entry]) => [key, jsonExample(entry.value, parents)])
			);
	parents.delete(value);
	return result;
}
function contractFields(value: unknown) {
	const result: Record<string, unknown> = {};
	const source = record(value);
	for (const key of ['inputs', 'outputs', 'errors']) {
		if (source[key] === undefined) continue;
		if (!Array.isArray(source[key])) throw new Error('Invalid contract fields');
		result[key] = source[key].map((item: unknown) => {
			const field = record(item);
			const projected: Record<string, unknown> = Object.fromEntries(
				['name', 'type', 'description']
					.filter((name) => field[name] !== undefined)
					.map((name) => [name, text(field[name])])
			);
			if ('examples' in field) {
				if (!Array.isArray(field.examples)) throw new Error('Invalid examples array');
				projected.examples = jsonExample(field.examples);
			}
			return projected;
		});
	}
	return result;
}
function references(value: unknown): string[] {
	if (value === undefined) return [];
	if (!Array.isArray(value)) throw new Error('Invalid contract references');
	return value.map((item) =>
		brokerUnitId(typeof item === 'string' ? item : (record(item).unit ?? record(item).id))
	);
}
function dependencies(value: unknown) {
	if (value === undefined) return [];
	if (!Array.isArray(value)) throw new Error('Invalid contract dependencies');
	return value.map((item) => {
		const dependency = record(item);
		return { unit: brokerUnitId(dependency.unit), via: text(dependency.via) };
	});
}
export function projectBrokerContract(value: unknown, unitId: string) {
	const response = record(value);
	const source = record(response.manifest ?? value);
	if (brokerUnitId(source.id) !== unitId) throw new Error('Contract identity mismatch');
	return {
		id: unitId,
		kind: brokerKind(source.kind),
		title: text(source.title),
		responsibility: text(source.responsibility),
		contract: contractFields(source.contract),
		dependencies: dependencies(source.dependencies ?? response.dependencies),
		consumers: references(response.consumers ?? source.consumers)
	};
}
export function projectBrokerList(value: unknown, kind?: string) {
	if (!Array.isArray(value)) {
		const envelope = record(value);
		if (
			typeof envelope.sourceCommit !== 'string' ||
			!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(envelope.sourceCommit)
		)
			throw new Error('Invalid contracts source revision');
		value = envelope.units;
	}
	if (!Array.isArray(value)) throw new Error('Invalid contracts list');
	return value.map((item) => {
		const source = record(item);
		const itemKind = brokerKind(source.kind);
		if (kind !== undefined && kind !== itemKind) throw new Error('Contract kind mismatch');
		return {
			id: brokerUnitId(source.id),
			kind: itemKind,
			responsibility: text(source.responsibility)
		};
	});
}
function validateArguments(argv: string[]): void {
	if (argv[0] !== 'units') throw new Error('Unsupported CLI operation');
	if (argv[1] === 'show' && argv.length === 4 && argv[3] === '--json') {
		brokerUnitId(argv[2]);
		return;
	}
	if (argv[1] === 'list' && argv.length === 3 && argv[2] === '--json') return;
	if (argv[1] === 'list' && argv.length === 5 && argv[2] === '--json' && argv[3] === '--kind') {
		brokerKind(argv[4]);
		return;
	}
	throw new Error('Unsupported CLI operation');
}

function runCli(process: SandboxProcess): Promise<unknown> {
	return new Promise((resolve, reject) => {
		const child = spawn(process.command, process.args, {
			cwd: process.cwd,
			env: process.env,
			shell: false,
			stdio: ['ignore', 'pipe', 'pipe'],
			detached: true
		});
		const chunks: Buffer[] = [];
		let size = 0;
		let failed = false;
		const stop = () => {
			failed = true;
			try {
				if (child.pid) globalThis.process.kill(-child.pid, 'SIGKILL');
			} catch {
				child.kill('SIGKILL');
			}
		};
		const timer = setTimeout(stop, 10_000);
		child.stdout.on('data', (chunk: Buffer) => {
			size += chunk.length;
			if (size > limit) stop();
			else chunks.push(chunk);
		});
		child.stderr.on('data', (chunk: Buffer) => {
			size += chunk.length;
			if (size > limit) stop();
		});
		child.on('error', () => {
			failed = true;
		});
		child.on('close', (code) => {
			clearTimeout(timer);
			if (failed || code !== 0) {
				reject(new Error('Sandboxed contract CLI failed'));
				return;
			}
			try {
				resolve(
					JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)))
				);
			} catch {
				reject(new Error('Invalid contract CLI JSON'));
			}
		});
	});
}

export async function invokeBrokerCli(
	scope: ModuleTaskToolBrokerScope,
	argv: string[]
): Promise<unknown> {
	validateArguments(argv);
	const isolated = await new ModuleTaskSandboxAdapter().prepare({
		cwd: scope.root,
		files: [...scope.files],
		snapshot: scope.snapshot,
		scratch: scope.scratch,
		binDirectory: scope.binDirectory,
		readPaths: [await realpath(process.execPath), scope.binDirectory],
		protectedPaths: [],
		argv: [join(scope.binDirectory, 'harness'), ...argv]
	});
	try {
		return await runCli(isolated);
	} finally {
		await isolated.cleanup();
	}
}
