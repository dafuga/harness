import type { TranslationCatalog } from '../../../../../src/core/explorer-ui/Translation.types';
import type { HarnessReview, HarnessUnitLimits } from './HarnessBudget.types';
import type { HarnessLegacyReport } from './HarnessLegacy.types';
import type { Status } from '../reports-media/Report.types';
import type { BrowserDiagnostic } from '../../../../../src/core/browserDiagnostics';
import type { RegressionView } from '../../../../../src/core/regressionTypes';
import type { UnitMetadata } from '../../../../../src/utils/unitMetadata';
import type { PlatformCatalog } from '../../../../../src/core/explorer-ui/Platform.types';
export type * from './HarnessLegacy.types';
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
	changes?: { base: string | null; direct: string[]; added: string[]; removed: string[] } | null;
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
	emitted?: Record<string, number>;
	notes?: Record<string, string>;
}
export interface HarnessIndex {
	sourceRepository?: string;
	branches: Array<{ name: string; head: string }>;
	revisions: HarnessRevisionSummary[];
	units: Array<{ id: string; growth: HarnessGrowthPoint[]; reviews?: HarnessReview[] }>;
	benchmarks: HarnessBenchmark[];
	profiles: Array<{ id: string; platform: string; arch: string; cpu: string; runtime: string }>;
	legacy: HarnessLegacyReport[];
	truncated: boolean;
	problems: string[];
}
export interface HarnessUnit extends HarnessUnitLimits, UnitMetadata {
	preview?: { scenario: string; state: string; viewport: string };
	id: string;
	kind: string;
	status: string;
	title: string;
	responsibility: string;
	dependencies: Array<{ unit: string; via: string }>;
	scenarios: string[];
	owns: { source: string[]; symbols: string[] };
	contract: Record<
		'inputs' | 'outputs' | 'errors',
		Array<{ name: string; type: string; description?: string; examples?: unknown[] }>
	>;
	runtime: { kind: string; targets: Array<{ kind: string; entry: string }> };
	budgets: {
		size: string;
		complexity: string;
		performance: Array<{ workload: string; metric: string; tolerance: number; target?: string }>;
	};
	sourceMeasurements?: HarnessRecord['measurements'];
	version: string;
}
export interface HarnessScenario {
	id: string;
	title: string;
	kind: string;
	units: string[];
	states: Array<{
		id: string;
		title?: string;
		coverage: string;
		reason?: string;
		units?: string[];
	}>;
	viewports: Array<{ id: string; width: number; height: number }>;
	tests: Array<{ id: string; kind: string; runner: string }>;
	evidence?: Array<{ id: string; kind: string; states: string[]; viewports: string[] }>;
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
	tests: Array<{
		id: string;
		kind: string;
		target: string;
		status: Status;
		durationMs: number;
		browserErrors?: BrowserDiagnostic[];
	}>;
	scenarios: Array<{
		id: string;
		status: 'passed' | 'failed' | 'referenced';
		testedRevision: string;
		inherited: boolean;
		origin: { record: string; commit: string };
		originTests?: Array<{ id: string; status: string; browserErrors?: BrowserDiagnostic[] }>;
		states: Array<{ id: string; coverage: string; reason?: string; captures: HarnessCapture[] }>;
	}>;
	measurements: Array<{
		unit: string;
		metric: string;
		callable?: string;
		method?: string;
		/** Exact source revision when the observation records it; absent in older indexes. */
		testedRevision?: string;
		unitOfMeasure: string;
		value: number | null;
		unavailable?: string;
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
			target?: string;
			detail?: string;
		}>;
	};
}
export interface HarnessExplanation {
	unit: string;
	symbol: string;
	file?: string;
	change: string;
	behavior: string;
	simplification: { attempt: string; outcome: string };
	performance: { attempt: string; outcome: string };
}
export interface HarnessRevision {
	platforms?: PlatformCatalog;
	translations?: TranslationCatalog;
	regressions?: RegressionView[];
	commit: string;
	/** Opaque whole-tree identity retained by entity projections, without a cache filename. */
	sourceTree?: string;
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
	sourceImpact?: {
		base: string | null;
		expanded: boolean;
		units: Record<'direct' | 'indirect' | 'added' | 'removed', string[]>;
		scenarios: string[];
		uncertain: Array<{ node: string; reason: string; detail: string }>;
		changed: Array<{ path: string; status: string }>;
	} | null;
	side?: string | null;
	records: HarnessRecord[];
	explanations: HarnessExplanation[];
	rangeReasons?: number;
}
export type HarnessMark = 'direct' | 'indirect' | 'added' | 'removed';
