import type { ConsoleChange } from '../../../utils/consoleManifest';
import type { ConsoleStorage } from '../../../utils/consoleManifest';
import type { ConsoleFileEntry } from '../../../utils/consoleManifest';
import type { BundledSize } from '../../../utils/consoleDataModules';
import type { FileState } from '../../../services/ConsoleChangeService';

export interface ConsoleInstallOptions {
	host: string;
	/** Module of the host that exports the policy, written as the host imports it. */
	policy: string;
	policyExport: string;
	base: string;
	/** Output directory of `harness history build`: bundled into the server, or to be uploaded. */
	data?: string;
	/** Binding of a private object store to read the history from instead of bundling it. */
	bucket?: string;
	/** Path inside that store the index was uploaded under. */
	prefix?: string;
	/** Replace files that hold other content; what they held is saved and the change recorded. */
	update?: boolean;
	/** Leave files that hold other content as the host's own version. */
	keep?: boolean;
}

export interface ConsoleInstallResult {
	host: string;
	base: string;
	policy: string;
	written: string[];
	removed: string[];
	/** Files left as the host's own version. */
	kept: string[];
	/** Files that held other content and were replaced or removed on request. */
	changes: ConsoleChange[];
	data: { revisions: number; media: number; bytes: number } | null;
	storage: ConsoleStorage;
	/** What the bundled history adds to the server; null when nothing is bundled. */
	bundle: BundledSize | null;
	warnings: string[];
}

/** One file to write, or to remove when its contents are null, and what is in the way. */
export interface Step {
	path: string;
	contents: string | null;
	state: FileState;
}

export type Applied = Pick<ConsoleInstallResult, 'written' | 'removed' | 'kept' | 'changes'> & {
	entries: ConsoleFileEntry[];
};
