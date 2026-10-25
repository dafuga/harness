import type { UnitDocumentation } from '../../../../../src/utils/unit-documentation/unitDocumentation';
import type { ExplorerEvidence, ExplorerScope } from '../../models/explorer-ui/Explorer.types';

export interface EntityExamplesProps {
	documentation?: UnitDocumentation;
	/** Names how a service is constructed before its authored calls. */
	setupTitle?: string;
	/** Revision-bound generated media remains distinct from authored expectations. */
	recorded?: { evidence: ExplorerEvidence; scope: ExplorerScope; mediaBase: string };
}
