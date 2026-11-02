// @harness-uid u_5qi3u7uxnr
import type { ScenarioManifest } from '../../core/development-tooling/unitTypes';

export interface ScenarioRead {
	manifests: ScenarioManifest[];
	errors: string[];
}
