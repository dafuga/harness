import type { RuntimeEnvironment } from '../../src/core/execution-runtimes/runtimeTypes.types';
import { test } from 'vitest';
import { writeFile } from 'node:fs/promises';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { kernelArtifacts } from '../../src/utils/execution-runtimes/kernelArtifacts';
import type {
	KernelArtifacts,
	KernelBuild
} from '../../src/utils/execution-runtimes/kernelArtifacts.types';

const SHA_WASM = '9c1e4a7b2d6f08e3a5c19b7d4f2e6a80c3d5b9e1f7a2c4d6e8b0f1a3c5d7e9b2';
const SHA_NATIVE = '5e0b7d19c4a6f283e1d5b0c9a7f64e2d8b3c1a95f0e7d62c4b8a3f1e9d05c7b6';
const SHA_SOURCE = 'd4a81f6e0c39b25d7e1a6f4c8b0d3e9a57c2f1b8e6d0a4c93f7b5e2d1a8c6f04';
const SHA_REFERENCE = '1b6e3d0a9f5c72e48d1a0b6c3f9e27d5a4c8b1e0f6d3a92c7e5b4f8d1a0c3e61';

const BUILD_RECORD: KernelBuild = {
	contract: 'impact-kernel/1',
	rustc: 'rustc 1.97.0',
	host: 'x86_64-unknown-linux-gnu',
	wasmOpt: 'wasm-opt version 130',
	wasm: { path: 'target/kernel/impact-kernel.wasm', bytes: 1184213, sha256: SHA_WASM },
	native: { path: 'target/kernel/impact-kernel', bytes: 4917832, sha256: SHA_NATIVE },
	sources: {
		crate: {
			bytes: 58214,
			files: [{ path: 'kernel/src/lib.rs', bytes: 58214, sha256: SHA_SOURCE }]
		},
		reference: {
			bytes: 9120,
			files: [{ path: 'kernel/reference/cases.json', bytes: 9120, sha256: SHA_REFERENCE }]
		}
	}
};

const PLACEHOLDER_ENV = { HARNESS_KERNEL_DIR: '<kernel-dir>' };

function override(directory: string): RuntimeEnvironment {
	return { HARNESS_KERNEL_DIR: directory };
}

async function writeKernel(directory: string, files: Record<string, string>): Promise<void> {
	await Promise.all(
		Object.entries(files).map(([name, text]) => writeFile(`${directory}/${name}`, text))
	);
}

/** Replaces the temporary folder with a placeholder so recorded cases are stable. */
function summarise(artifacts: KernelArtifacts, directory: string) {
	const relative = (value: string | undefined) => value?.replace(directory, '<kernel-dir>');
	return {
		directory: relative(artifacts.directory),
		wasm: relative(artifacts.wasm),
		native: relative(artifacts.native),
		build: artifacts.build && {
			contract: artifacts.build.contract,
			host: artifacts.build.host,
			wasmBytes: artifacts.build.wasm.bytes,
			nativeBytes: artifacts.build.native.bytes
		}
	};
}

test('Locates the build record and kernel files in the override', async () => {
	await withTempDir('kernel-artifacts-', async (directory) => {
		await writeKernel(directory, {
			'build.json': JSON.stringify(BUILD_RECORD),
			'impact-kernel.wasm': 'wasm-bytes',
			'impact-kernel': 'native-bytes'
		});
		const artifacts = kernelArtifacts(override(directory));
		expect(artifacts).toEqual({
			directory,
			wasm: `${directory}/impact-kernel.wasm`,
			native: `${directory}/impact-kernel`,
			build: BUILD_RECORD
		});
		recordExampleCases(
			{
				unitId: 'function.kernel-artifacts',
				symbol: 'kernelArtifacts',
				state: 'locates-the-build-record-and-kernel-files-in-the-override',
				evidence: 'examples-cases',
				file: 'locates-the-build-record-and-kernel-files-in-the-override.json'
			},
			[
				{
					name: 'override holds build.json, Wasm and native files',
					input: PLACEHOLDER_ENV,
					output: summarise(artifacts, directory)
				}
			]
		);
	});
});

test('Reports no artifacts when the override has no build record', async () => {
	await withTempDir('kernel-artifacts-', async (directory) => {
		await writeKernel(directory, { 'impact-kernel.wasm': 'wasm-bytes' });
		const artifacts = kernelArtifacts(override(directory));
		expect(artifacts).toEqual({
			directory: undefined,
			wasm: undefined,
			native: undefined,
			build: undefined
		});
		recordExampleCases(
			{
				unitId: 'function.kernel-artifacts',
				symbol: 'kernelArtifacts',
				state: 'reports-no-artifacts-when-the-override-has-no-build-record',
				evidence: 'examples-cases',
				file: 'reports-no-artifacts-when-the-override-has-no-build-record.json'
			},
			[
				{
					name: 'folder has a Wasm file but no build.json',
					input: PLACEHOLDER_ENV,
					output: summarise(artifacts, directory)
				}
			]
		);
	});
});

test('Leaves native undefined when only the Wasm file exists', async () => {
	await withTempDir('kernel-artifacts-', async (directory) => {
		await writeKernel(directory, {
			'build.json': JSON.stringify(BUILD_RECORD),
			'impact-kernel.wasm': 'wasm-bytes'
		});
		const artifacts = kernelArtifacts(override(directory));
		expect(artifacts.wasm).toBe(`${directory}/impact-kernel.wasm`);
		expect(artifacts.native).toBeUndefined();
		recordExampleCases(
			{
				unitId: 'function.kernel-artifacts',
				symbol: 'kernelArtifacts',
				state: 'leaves-native-undefined-when-only-the-wasm-file-exists',
				evidence: 'examples-cases',
				file: 'leaves-native-undefined-when-only-the-wasm-file-exists.json'
			},
			[
				{
					name: 'build record and Wasm file, no native binary',
					input: PLACEHOLDER_ENV,
					output: summarise(artifacts, directory)
				}
			]
		);
	});
});

test('Throws SyntaxError for a build record that is not JSON', async () => {
	await withTempDir('kernel-artifacts-', async (directory) => {
		await writeKernel(directory, { 'build.json': '{"contract":' });
		expect(() => kernelArtifacts(override(directory))).toThrow(SyntaxError);
		recordExampleCases(
			{
				unitId: 'function.kernel-artifacts',
				symbol: 'kernelArtifacts',
				state: 'throws-syntaxerror-for-a-build-record-that-is-not-json',
				evidence: 'examples-cases',
				file: 'throws-syntaxerror-for-a-build-record-that-is-not-json.json'
			},
			[
				{
					name: 'truncated build.json',
					input: PLACEHOLDER_ENV,
					error: { name: 'SyntaxError' }
				}
			]
		);
	});
});
