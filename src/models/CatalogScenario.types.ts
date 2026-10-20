import type { RevisionRegistry } from '../utils/revisionRegistry';
export interface CatalogScenarioAttributes {
	id: string;
	scenarioId: string;
	commit: string;
	title: string;
	data: RevisionRegistry['scenarios'][number];
}
export type CatalogScenarioCreateInput = CatalogScenarioAttributes;
export type CatalogScenarioUpdateInput = Partial<Omit<CatalogScenarioAttributes, 'id'>>;
