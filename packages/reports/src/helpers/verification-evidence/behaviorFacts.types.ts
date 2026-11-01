import type { ExplorerBehavior } from '../../models/explorer-ui/ExplorerEvidence.types';
export interface BehaviorFact {
	key: string;
	label: string;
	value: string;
	className: string;
}
export interface BehaviorFactOptions {
	durationLabel?: string;
	highlight?: boolean;
}
export type BehaviorScenario = ExplorerBehavior['scenarios'][number];
