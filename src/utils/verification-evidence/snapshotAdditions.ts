export interface SnapshotBounds {
	/** Every path the exported commit contains. */
	tracked: Set<string>;
	/** Declared output patterns: the only places setup and checks may create files. */
	outputs: string[];
	/** Paths shared from the checkout as links, such as installed dependencies. */
	links: Set<string>;
}

export {
	declaredOutput,
	snapshotAdditions
} from '../../adapters/verification-evidence/snapshot-adapter/snapshotAdditions';
