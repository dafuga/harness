export type Status =
	| 'running'
	| 'passed'
	| 'failed'
	| 'blocked'
	| 'skipped'
	| 'not-proven'
	| 'interrupted';
export interface Check {
	id: string;
	title: string;
	status: Status;
	command?: string;
	output?: string;
	durationMs?: number;
	group?: string;
	counts?: Record<string, number>;
}
export interface Evidence {
	id: string;
	title: string;
	category: string;
	file: string;
	status: Status;
	source?: string;
	capturedAt?: string;
	viewport?: string;
	phase?: 'before' | 'after' | 'current';
	comparison?: string;
	checkId?: string;
	order?: number;
	note?: string;
	missing?: boolean;
	storage?: 'r2' | 'r2-evidence';
	mediaType?: 'image' | 'audio';
	mimeType?: string;
	durationSeconds?: number;
	transcript?: string;
}
export interface Finding {
	id: string;
	title: string;
	detail: string;
	status: Status;
	evidenceIds?: string[];
}
export interface Coverage {
	id: string;
	title: string;
	status: Status;
	viewport?: string;
	detail?: string;
}
export interface Exports {
	html: string;
	pdf: string;
	zip: string;
}
export interface Report {
	schemaVersion: 1;
	id: string;
	project: { id: string; name: string; path: string };
	title: string;
	mode: 'feature' | 'suite';
	environment: string;
	revision?: string;
	historical: boolean;
	startedAt: string;
	updatedAt: string;
	summary: string;
	status: Status;
	state: 'active' | 'finalizing' | 'finalized';
	checks: Check[];
	evidence: Evidence[];
	findings: Finding[];
	coverage: Coverage[];
	acceptance: string[];
	exports?: Exports;
}
export interface BeginInput {
	project: string;
	title: string;
	mode: 'feature' | 'suite';
	environment: string;
	revision?: string;
	historical?: boolean;
	summary?: string;
	acceptance?: string[];
}
export interface RecordInput {
	kind: 'check' | 'evidence' | 'finding' | 'coverage' | 'acceptance' | 'summary' | 'heartbeat';
	data: Record<string, unknown>;
}
