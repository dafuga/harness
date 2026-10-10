import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { expect, test } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
// Type-only imports and exports are erased when compiled, so they reach nothing at run time.
const importPattern =
	/(?:import|export)\s(?!type\s)[^'"]*?from\s+['"]([^'"]+)['"]|import\(['"]([^'"]+)['"]\)/g;

/** Every module reachable from an entry through relative imports, and every package it names. */
function reachable(entry: string): { files: string[]; packages: string[] } {
	const files = new Set<string>();
	const packages = new Set<string>();
	const queue = [resolve(root, entry)];
	while (queue.length > 0) {
		const file = queue.pop() as string;
		if (files.has(file)) continue;
		files.add(file);
		for (const match of readFileSync(file, 'utf8').matchAll(importPattern)) {
			const specifier = match[1] ?? match[2];
			if (!specifier.startsWith('.')) packages.add(specifier);
			else queue.push(`${resolve(dirname(file), specifier)}.ts`);
		}
	}
	return { files: [...files], packages: [...packages].sort() };
}

test.each(['src/lib/edge.ts', 'src/lib/console.ts'])(
	'%s reaches no Node, Bun or process API',
	(entry) => {
		const { files, packages } = reachable(entry);
		expect(files.every((file) => existsSync(file))).toBe(true);
		expect(files.length).toBeGreaterThan(3);
		expect(packages).toEqual([]);
		for (const file of files) {
			// Comments may mention anything; only code can reach an API.
			const source = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
			expect([file, /\b(process\.|Bun\.|Buffer\b|require\()/.test(source)]).toEqual([file, false]);
		}
	}
);

test('the Node entry still offers the process and file-based targets the edge entry leaves out', () => {
	const edge = readFileSync(resolve(root, 'src/lib/edge.ts'), 'utf8');
	const node = readFileSync(resolve(root, 'src/lib/runtime.ts'), 'utf8');
	for (const name of ['ProcessRuntimeAdapter', 'RuntimeServerService', 'UnitRuntimeService']) {
		expect([name, node.includes(name), edge.includes(`{ ${name}`)]).toEqual([name, true, false]);
	}
	for (const name of ['HandlerRuntimeAdapter', 'WasmModuleRuntimeAdapter', 'HttpRuntimeAdapter']) {
		expect([name, node.includes(name), edge.includes(name)]).toEqual([name, true, true]);
	}
});
