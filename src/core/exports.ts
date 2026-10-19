

export interface ExportPlan {
	source: string;
	named?: string[];
	types?: string[];
}

export { applyExports, appendMissingExports } from '../workflows/generate-code/exports';
