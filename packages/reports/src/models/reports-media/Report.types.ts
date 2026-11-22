// @harness-uid u_ejm6j7oia3
import type { VideoCapture } from '../../../../../src/utils/verification-evidence/videoClipSchema.types';
import type { FrameClipReference } from '../../../../../src/services/verification-evidence/FrameFlagService.types';
export type EvidenceVideo = Omit<VideoCapture, 'poster'> & {
	poster: VideoCapture['poster'] & { url?: string };
	sha256: string;
	reference?: FrameClipReference;
	selectedRevision: string;
	freshness: 'current' | 'inherited' | 'stale' | 'historical';
};
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
	state?: string;
	file: string;
	status: Status;
	source?: string;
	capturedAt?: string;
	viewport?: string;
	phase?: 'before' | 'after' | 'current';
	/** Stated in place of the phase when the evidence is more than its report's current capture. */
	standing?: string;
	/** Recorded facts about what produced the evidence and which attempt it belongs to. */
	provenance?: Array<{ label: string; value: string }>;
	comparison?: string;
	checkId?: string;
	order?: number;
	note?: string;
	missing?: boolean;
	storage?: 'r2' | 'r2-evidence';
	mediaType?: 'image' | 'audio' | 'video';
	video?: EvidenceVideo;
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
	/** What a run finalized before exports were removed wrote; retention deletes those files. */
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
