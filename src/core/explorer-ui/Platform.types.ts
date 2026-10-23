/** Deployment declarations are public repository metadata, never host credential values. */
export const platformIds = ['web', 'ios', 'android', 'desktop'] as const;
export type PlatformId = (typeof platformIds)[number];
export type PlatformStatus = 'configured' | 'setup-required' | 'not-configured';

export interface PlatformEntry {
	id: PlatformId;
	runtime: string;
	status: PlatformStatus;
	summary: string;
	configuration: Array<{ name: string; value: string; description?: string }>;
	commands: Array<{ name: string; command: string }>;
	requirements: string[];
	/** Repository-relative configuration and build files, linked at the selected commit. */
	sources: string[];
}

export interface PlatformCatalog {
	entries: PlatformEntry[];
	/** Missing and invalid manifests are explicit; no other revision supplies their settings. */
	gap?: string;
}
