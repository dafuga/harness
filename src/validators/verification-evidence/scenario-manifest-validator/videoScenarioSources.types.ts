// @harness-uid u_hfud4vng54
import type { SourceTree } from '../../../core/development-tooling/sourceTypes';
import type { ComponentManifest } from '../../../core/development-tooling/unitTypes';

export interface VideoScenarioSourceContext {
	tree: SourceTree;
	paths: Set<string>;
	root?: string;
	bounds: Map<string, Promise<void>>;
	texts: Map<string, Promise<string>>;
	owners: Map<string, Promise<ComponentManifest | null>>;
	exports: Map<string, Promise<Set<string>>>;
}
