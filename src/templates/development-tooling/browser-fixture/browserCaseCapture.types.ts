export interface VisualCase {
	id: string;
	state: string;
	viewports?: string[];
	test: { file: string; title: string };
	expected?: { kind: string; file?: string };
}

export interface VisualScenario {
	id: string;
	units: string[];
	viewports: Array<{ id: string; width: number; height: number; scale?: number }>;
	tests: Array<{
		runner: string;
		target: string;
		cwd?: string;
		cases?: Array<{ unit: string; case: string }>;
	}>;
	evidence: Array<{
		id: string;
		kind: string;
		states: string[];
		viewports: string[];
		required: boolean;
		provenance?: string;
		build?: string;
		capture?: string;
	}>;
}

export interface VisualBinding {
	unit: string;
	item: VisualCase;
	viewport: VisualScenario['viewports'][number];
	evidence: string;
}

export interface VisualBindingRequest {
	root: string;
	scenarioId: string;
	file: string;
	title: string;
	snapshot: string;
	size: { width: number; height: number } | null;
	mode: 'element' | 'full-page' | 'viewport';
}

export interface VisualBindingContext extends VisualBindingRequest {
	scenario: VisualScenario;
	path: string;
	size: { width: number; height: number };
}
