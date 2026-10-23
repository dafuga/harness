/** Environment variables, as `process.env` exposes them. */
export type Environment = Record<string, string | undefined>;

export interface KernelBuild {
	contract: string;
	rustc: string;
	host: string;
	wasmOpt: string | null;
	wasm: KernelFile;
	native: KernelFile;
	sources: Record<'crate' | 'reference', { bytes: number; files: KernelFile[] }>;
}

export interface KernelFile {
	path: string;
	bytes: number;
	sha256: string;
}

export interface KernelArtifacts {
	directory: string | undefined;
	/** Core Wasm module, when built or shipped. */
	wasm: string | undefined;
	/** Native JSON process, when built for this machine. */
	native: string | undefined;
	build: KernelBuild | undefined;
}
