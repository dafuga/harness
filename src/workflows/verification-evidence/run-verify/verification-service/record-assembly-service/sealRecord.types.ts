import type { ComponentManifest } from '../../../../../core/development-tooling/unitTypes';
import type { SourceFile } from '../../../../../core/development-tooling/sourceTypes';

export interface Side {
	manifests: ComponentManifest[];
	index: { files: Map<string, SourceFile> };
}
