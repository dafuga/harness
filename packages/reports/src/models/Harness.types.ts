import type { Status } from './Report.types';

/** The parts of the history index and revision files the console reads. */
export interface HarnessRecordSummary {
	id: string;
	status: 'passed' | 'failed';
	profile: string;
	finishedAt: string;
	base: string | null;
	valid: boolean;
	problems: string[];
}
export interface HarnessRevisionSummary {
	commit: string;
	parents: string[];
	subject: string;
	author: string;
	committedAt: string;
	branches: string[];
	retained: boolean;
	coverage: 'verified' | 'failed' | 'invalid' | 'unverified';
	gaps: string[];
	records: HarnessRecordSummary[];
	legacy: string[];
}
export interface HarnessSeries {
	profile: string;
	unitOfMeasure: string;
	method: string;
	points: Array<{ commit: string; record: string; value: number }>;
}
export interface HarnessBenchmark {
	unit: string;
	workload: string;
	metric: string;
	target: string | null;
	incompatible: boolean;
	series: HarnessSeries[];
}
export interface HarnessGrowthPoint {
	commit: string;
	record: string;
	'source-bytes'?: number;
	complexity?: number;
	dependencies?: number;
	/** Per metric: why it has no value here, or what its value leaves out. */
	notes?: Record<string, string>;
}
export interface HarnessLegacyMedia {
	id: string;
	title: string;
	status: string;
	mediaType?: string;
	capturedAt?: string;
	viewport?: string;
	media: string | null;
	gap?: string;
}
/** A report from before Git-backed records, exactly as it was recorded. */
export interface HarnessLegacyReport {
	id: string;
	title: string;
	mode: string;
	environment: string;
	status: string;
	startedAt: string;
	revision: string | null;
	/** The commit of this repository the report names, or null with `gap`. */
	linked: string | null;
	gap?: string;
	summary: string;
	checks: Array<{ id: string; title: string; status: string }>;
	media: HarnessLegacyMedia[];
}
export interface HarnessIndex {
	branches: Array<{ name: string; head: string }>;
	revisions: HarnessRevisionSummary[];
	units: Array<{ id: string; growth: HarnessGrowthPoint[] }>;
	benchmarks: HarnessBenchmark[];
	profiles: Array<{ id: string; platform: string; arch: string; cpu: string; runtime: string }>;
	legacy: HarnessLegacyReport[];
	truncated: boolean;
	problems: string[];
}
export interface HarnessUnit {
	id: string;
	kind: string;
	status: string;
	title: string;
	responsibility: string;
	dependencies: Array<{ unit: string; via: string }>;
	scenarios: string[];
	owns: { source: string[]; symbols: string[] };
	contract: Record<'inputs' | 'outputs' | 'errors', Array<{ name: string; type: string }>>;
	runtime: { kind: string; targets: Array<{ kind: string; entry: string }> };
	budgets: {
		size: string;
		complexity: string;
		performance: Array<{ workload: string; metric: string; tolerance: number; target?: string }>;
	};
	version: string;
}
export interface HarnessScenario {
	id: string;
	title: string;
	kind: string;
	units: string[];
	states: Array<{ id: string; coverage: string; reason?: string }>;
	viewports: Array<{ id: string; width: number; height: number }>;
	tests: Array<{ id: string; kind: string; runner: string }>;
}
export interface HarnessCapture {
	evidence: string;
	kind: string;
	state: string;
	viewport?: string;
	status: 'passed' | 'failed';
	path: string;
	sha256: string;
	mediaType: string;
	capturedAt: string;
	provenance?: string;
	/** The build that served the capture, as the capture itself recorded it. */
	server?: { buildId: string; revision: string };
	transcript?: string;
	durationSeconds?: number;
	media: string | null;
	gap?: string;
}
export interface HarnessRecord {
	id: string;
	status: 'passed' | 'failed';
	valid: boolean;
	problems: string[];
	source: { commit: string; base: string | null };
	profile: string;
	startedAt: string;
	finishedAt: string;
	gates?: Record<string, 'passed' | 'failed'>;
	failures: string[];
	tests: Array<{ id: string; kind: string; target: string; status: Status; durationMs: number }>;
	scenarios: Array<{
		id: string;
		status: 'passed' | 'failed' | 'referenced';
		testedRevision: string;
		inherited: boolean;
		origin: { record: string; commit: string };
		states: Array<{ id: string; coverage: string; reason?: string; captures: HarnessCapture[] }>;
	}>;
	measurements: Array<{
		unit: string;
		metric: string;
		unitOfMeasure: string;
		value: number | null;
		unavailable?: string;
		/** What the value leaves out, when only part of the unit could be measured. */
		partial?: string;
		workload: string | null;
		profile: string | null;
		target?: string;
	}>;
	budgets: {
		findings: Array<{
			unit: string;
			metric: string;
			status: string;
			baseline: number | null;
			measured: number | null;
			detail?: string;
		}>;
	};
}
export interface HarnessExplanation {
	unit: string;
	symbol: string;
	/** The file the explained change is in; reasons of one unit may differ in this alone. */
	file?: string;
	change: string;
	behavior: string;
	simplification: { attempt: string; outcome: string };
	performance: { attempt: string; outcome: string };
}
export interface HarnessRevision {
	commit: string;
	registry: {
		available: boolean;
		gap?: string;
		units: HarnessUnit[];
		scenarios: HarnessScenario[];
		graph: { edges: Array<{ from: string; to: string; via: string }> };
	};
	comparison: {
		base: string | null;
		record: string;
		units: Record<'direct' | 'indirect' | 'added' | 'removed', string[]>;
		scenarios: string[];
		uncertain: Array<{ node: string; reason: string; detail: string }>;
	} | null;
	/** What the commit changed against its first parent, computed from source when indexed. */
	sourceImpact?: {
		base: string | null;
		expanded: boolean;
		units: Record<'direct' | 'indirect' | 'added' | 'removed', string[]>;
		scenarios: string[];
		uncertain: Array<{ node: string; reason: string; detail: string }>;
		changed: Array<{ path: string; status: string }>;
	} | null;
	/** Path of the stored side of this revision's source tree; null when it could not be read. */
	side?: string | null;
	records: HarnessRecord[];
	explanations: HarnessExplanation[];
}
export type HarnessMark = 'direct' | 'indirect' | 'added' | 'removed';
