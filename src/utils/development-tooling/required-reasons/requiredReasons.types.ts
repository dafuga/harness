import type { SourceFile } from '../../../core/development-tooling/sourceTypes';
import type { ComponentManifest } from '../../../core/development-tooling/unitTypes';
import type { WritingVersion } from '../../git-source-history/writing-limits/writingLimits';

export interface ReasonSide {
	index: { files: Map<string, SourceFile> };
	manifests: ComponentManifest[];
	/** The version of the writing limits the revision declares; its reasons are held to that one. */
	writing?: WritingVersion | null;
}

export interface Symbol {
	file: string;
	name: string;
	hash: string;
}
