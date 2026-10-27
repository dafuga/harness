import type { ComponentManifest } from '../../../../../core/development-tooling/unitTypes';
import type { SourceFile } from '../../../../../core/development-tooling/sourceTypes';

export interface VerificationSourceHashes {
	base: ReadonlyMap<string, Pick<SourceFile, 'hash'>>;
	head: ReadonlyMap<string, Pick<SourceFile, 'hash'>>;
}

export interface Side {
	manifests: ComponentManifest[];
	index: { files: ReadonlyMap<string, Pick<SourceFile, 'hash'>> };
}
