export interface PackageManifest {
	harness?: {
		kind?: string;
		dimension?: string;
	};
	scripts?: Record<string, string>;
	devDependencies?: Record<string, string>;
	dependencies?: Record<string, string>;
}
