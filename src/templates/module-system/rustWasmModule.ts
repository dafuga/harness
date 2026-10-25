import type { ModuleDefinition } from '../../services/module-system/moduleDefinition.types';
export const rustWasmModule: ModuleDefinition = {
	schemaVersion: 1,
	id: 'rust-wasm',
	version: '1.0.0',
	title: 'Rust WebAssembly',
	description: 'Compiled Rust kernels for measured browser performance workloads.',
	instructions: [
		'Install the wasm32-unknown-unknown target with rustup target add wasm32-unknown-unknown. No toolchain or compiler is installed by module generation.',
		'Generate a kernel, run cargo test --manifest-path src/services/rust-wasm/<name>/Cargo.toml, then bun run build:wasm <name>. Commit its Cargo.lock.',
		'The build publishes static/wasm/<name>.wasm. Import the generated WasmService in browser code, or call it from a Web Worker for CPU-heavy work.',
		'Measure the actual workload against JavaScript before choosing Wasm. Batch boundary crossings; Wasm does not guarantee a speedup.',
		'This bare browser target has no operating-system filesystem or sockets. Keep browser I/O in JavaScript and pass validated data to the kernel.'
	],
	packageScripts: {
		'build:wasm': 'node src/services/rust-wasm/buildWasm.mjs'
	},
	dependencies: {},
	setup: [
		{
			path: 'src/services/rust-wasm/buildWasm.mjs',
			contents:
				"import { spawnSync } from 'node:child_process';\nimport { copyFileSync, mkdirSync } from 'node:fs';\nimport { join } from 'node:path';\nconst name = process.argv[2];\nif (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(name ?? '')) throw new Error('Pass the generated kebab-case kernel name.');\nconst target = join('.cache', 'rust-wasm', name);\nconst result = spawnSync('cargo', ['build', '--manifest-path', `src/services/rust-wasm/${name}/Cargo.toml`, '--target', 'wasm32-unknown-unknown', '--release', '--target-dir', target], { stdio: 'inherit' });\nif (result.error) throw result.error;\nif (result.status !== 0) process.exit(result.status ?? 1);\nmkdirSync('static/wasm', { recursive: true });\ncopyFileSync(join(target, 'wasm32-unknown-unknown/release', name.replaceAll('-', '_') + '.wasm'), `static/wasm/${name}.wasm`);\n"
		}
	],
	resources: [
		{
			id: 'kernel',
			title: 'Rust WebAssembly kernels',
			singular: 'Rust WebAssembly kernel',
			kind: 'wasm',
			instructions: [
				'Keep the Rust ABI and generated TypeScript service aligned. Run cargo tests, build the asset and execute a browser integration test.'
			],
			files: [
				{
					path: 'src/services/rust-wasm/{{kebabName}}/Cargo.toml',
					contents:
						'[package]\nname = "{{kebabName}}"\nversion = "0.1.0"\nedition = "2024"\nrust-version = "1.85"\n[lib]\ncrate-type = ["cdylib", "rlib"]\n[workspace]\n[profile.release]\nlto = true\nopt-level = 3\npanic = "abort"\n'
				},
				{
					path: 'src/services/rust-wasm/{{kebabName}}/src/lib.rs',
					contents:
						'/// Replace this bounded example with the measured numeric hot path.\n#[unsafe(no_mangle)]\npub extern "C" fn sum_squares(limit: u32) -> f64 {\n    if limit > 1_000_000 { return f64::NAN; }\n    (0..limit).map(|value| f64::from(value).powi(2)).sum()\n}\n#[cfg(test)]\nmod tests {\n    #[test]\n    fn numeric_contract_and_boundaries() {\n        assert_eq!(super::sum_squares(4), 14.0);\n        assert_eq!(super::sum_squares(0), 0.0);\n        assert!(super::sum_squares(1_000_001).is_nan());\n    }\n}\n'
				},
				{
					path: 'src/services/rust-wasm/{{PascalName}}WasmService.types.ts',
					contents:
						'export interface {{PascalName}}WasmKernel {\n sum_squares(limit: number): number;\n}\n'
				},
				{
					path: 'src/services/rust-wasm/{{PascalName}}WasmService.ts',
					contents:
						"import type { {{PascalName}}WasmKernel } from './{{PascalName}}WasmService.types';\n/** Load a compiled browser kernel once, retaining retries after a failed load. */\nexport class {{PascalName}}WasmService {\n private kernel: Promise<{{PascalName}}WasmKernel> | undefined;\n constructor(private readonly url = '/wasm/{{kebabName}}.wasm', private readonly transport: typeof globalThis.fetch = globalThis.fetch) {}\n async sumSquares(limit: number): Promise<number> {\n  if (!Number.isInteger(limit) || limit < 0 || limit > 1_000_000) throw new Error('Use an integer from zero to one million.');\n  this.kernel ??= this.load().catch(error => { this.kernel = undefined; throw error; });\n  const result = (await this.kernel).sum_squares(limit);\n  if (!Number.isFinite(result)) throw new Error('Invalid kernel result.');\n  return result;\n }\n private async load(): Promise<{{PascalName}}WasmKernel> {\n  const response = await this.transport(this.url, { signal: AbortSignal.timeout(10_000) });\n  if (!response.ok) throw new Error('Build and publish the Wasm kernel before loading it.');\n  const { instance } = await WebAssembly.instantiate(await response.arrayBuffer());\n  if (typeof instance.exports.sum_squares !== 'function') throw new Error('Unexpected Wasm exports.');\n  return instance.exports as unknown as {{PascalName}}WasmKernel;\n }\n}\n"
				},
				{
					path: 'test/services/rust-wasm/{{kebabName}}.test.ts',
					contents:
						"import { expect, test, vi } from 'vitest';\nimport { {{PascalName}}WasmService } from '../../../src/services/rust-wasm/{{PascalName}}WasmService';\ntest('invalid work is rejected before loading a kernel', async () => {\n const transport = vi.fn();\n await expect(new {{PascalName}}WasmService('/unused.wasm', transport).sumSquares(-1)).rejects.toThrow('integer');\n expect(transport).not.toHaveBeenCalled();\n});\n"
				}
			]
		}
	]
};
