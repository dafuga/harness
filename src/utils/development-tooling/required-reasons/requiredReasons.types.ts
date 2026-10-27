import type { SourceBlock } from '../sourceBlocks';
import type { ComponentManifest } from '../../../core/development-tooling/unitTypes';
import type { WritingVersion } from '../../git-source-history/writing-limits/writingLimits';

export interface ReasonFile {
	hash: string;
	blocks: Array<Pick<SourceBlock, 'name' | 'hash'>>;
}

export interface CompactReasonManifest {
	id: ComponentManifest['id'];
	status: ComponentManifest['status'];
	owns: Pick<ComponentManifest['owns'], 'source'>;
	declarationHash: string;
}

export type ReasonManifest = ComponentManifest | CompactReasonManifest;

export interface ReasonSide {
	index: { files: ReadonlyMap<string, ReasonFile> };
	manifests: ReasonManifest[];
	/** The version of the writing limits the revision declares; its reasons are held to that one. */
	writing?: WritingVersion | null;
}

export interface Symbol {
	file: string;
	name: string;
	hash: string;
}
