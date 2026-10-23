import type { ConsoleChange } from '../../utils/development-tooling/consoleManifest';
import type { ConsoleFileEntry } from '../../utils/development-tooling/consoleManifest';

export interface ConsoleUninstallOptions {
	host: string;
	/** Remove generated files the host edited too; what they hold is saved and recorded. */
	update?: boolean;
	/** Leave generated files the host edited in place, as the host's own. */
	keep?: boolean;
}

export interface ConsoleUninstallResult {
	host: string;
	removed: string[];
	/** Files that hold again what the host had there before the install replaced it. */
	restored: string[];
	/** Edited files left in place as the host's own. */
	kept: string[];
	changes: ConsoleChange[];
	/** True when no record is left because nothing of the host was ever changed. */
	clean: boolean;
}

export type Outcome = Omit<ConsoleUninstallResult, 'host' | 'clean'> & {
	entries: ConsoleFileEntry[];
};
