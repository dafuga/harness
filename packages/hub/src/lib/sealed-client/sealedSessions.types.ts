// @harness-uid u_thdvp7j4r2
export interface SealedSession {
	id: string;
	scope: string;
	streamId: string;
	title: string;
	status: string;
	transcript: string;
	storedCounters: ReadonlySet<string>;
}

export interface SessionStatus {
	kind: 'session';
	runId: string;
	streamId: string;
	status: string;
	details?: unknown;
}

export interface TranscriptSegment {
	kind: 'transcript';
	runId: string;
	index: number;
	data: string;
	streamId?: string;
	throughCounter?: string;
}

export type SessionPayload = Partial<
	Omit<SessionStatus, 'kind'> & Omit<TranscriptSegment, 'kind'> & { kind: string }
>;

export type SessionRecord = SessionStatus | TranscriptSegment;
