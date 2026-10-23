import type { ExplorerEvidence } from '../../../models/Explorer.types';
import type { ExplorerBehavior } from '../../../models/Explorer.types';
import type { ExplorerScope } from '../../../models/Explorer.types';
import type { ExplorerEntity } from '../../../models/Explorer.types';
import type { ExplorerLocation } from '../../../models/Explorer.types';
import type { HarnessIndex } from '../../../models/Harness.types';
import type { HarnessRevision } from '../../../models/Harness.types';
import type { EntityLens } from '../../../utils/entityLens';

export type ConsoleAnswer = { evidence: ExplorerEvidence; behavior: ExplorerBehavior };

export interface ViewInput {
	index: HarnessIndex;
	scope: ExplorerScope;
	loaded: { head: HarnessRevision; parent: HarnessRevision | null };
	entities: ExplorerEntity[];
	relations: EntityLens['relations'];
	answers: Map<string, ConsoleAnswer>;
	href: (to: ExplorerLocation) => string;
}
