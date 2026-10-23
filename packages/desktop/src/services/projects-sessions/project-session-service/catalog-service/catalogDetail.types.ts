import type { GitSourceAdapter } from '../git-source-adapter/GitSourceAdapter';
import type { PlanningPort } from '../../../../models/planning-collaboration/PlanningPort.types';
import type { PlanRecord } from '../../../../models/planning-collaboration/PlanningPort.types';
import type { CatalogEntity } from '../../../../models/development-tooling/Desktop.types';
import type { ComponentManifest } from '../../../../../../../src/lib/contracts';

export interface DetailContext {
	source: GitSourceAdapter;
	planning: PlanningPort;
}

export interface DetailData {
	id: string;
	revision: string;
	items: CatalogEntity[];
	units: ComponentManifest[];
	plan: PlanRecord | undefined;
}
