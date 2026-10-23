export type EvidenceStatus = 'idle' | 'planned' | 'unavailable' | 'loading' | 'ready' | 'failed';

export interface EvidenceNotice {
	text: string;
	/** True for what went wrong, so that it is announced as such. */
	alert: boolean;
}
