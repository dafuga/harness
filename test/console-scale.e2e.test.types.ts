export type Installed = {
	bundle: { files: number; bytes: number; compressedBytes: number } | null;
	warnings: string[];
};
