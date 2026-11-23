import type { wasmAdapter } from '../../src/audit/development-tooling/adapters/wasm';

export type ArtifactExample = {
	name: string;
	relativePath: string;
	extension: '.abi' | '.wasm';
	contents: string;
	companion?: { extension: '.cpp'; contents: string };
	expected: ReturnType<typeof wasmAdapter.audit>;
};
