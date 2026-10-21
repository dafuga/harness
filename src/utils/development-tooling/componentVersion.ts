import { createHash } from 'node:crypto';
import type { ComponentManifest } from '../../core/development-tooling/unitTypes';
import { stableJson } from './stableJson';

export interface ComponentVersion {
	unit: string;
	/** sha256 of the canonical manifest. */
	manifest: string;
	/** sha256 over the owned source paths and their git blob hashes. */
	source: string;
	/** sha256 of the canonical contract. */
	contract: string;
	/** sha256 of the canonical runtime: default and every execution target. */
	runtime: string;
	files: Array<{ path: string; hash: string }>;
}

/** Identifies exactly which version of a unit was observed, independent of any working tree. */
export function componentVersion(
	manifest: ComponentManifest,
	files: ReadonlyMap<string, { hash: string }>
): ComponentVersion {
	const owned = [...manifest.owns.source].sort().flatMap((path) => {
		const hash = files.get(path)?.hash;
		return hash ? [{ path, hash }] : [];
	});
	return {
		unit: manifest.id,
		manifest: digest(stableJson(manifest)),
		source: digest(owned.map((file) => `${file.path}\0${file.hash}\n`).join('')),
		contract: digest(stableJson(manifest.contract)),
		runtime: digest(stableJson(manifest.runtime)),
		files: owned
	};
}

function digest(text: string): string {
	return createHash('sha256').update(text).digest('hex');
}
