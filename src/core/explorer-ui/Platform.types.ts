import type { platformIds } from './PlatformValues';

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
export { platformIds } from './PlatformValues';
