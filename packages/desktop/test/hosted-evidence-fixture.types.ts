export interface Pins {
	notesRevision: string | null;
	evidenceRevision: string | null;
}

export interface AnswerAt extends Pins {
	principalId: string;
	projectId: string;
	mode: 'current' | 'commit';
	entityId: string;
}

export interface HubState {
	/** Who the kept session says it is, and who the hub says that session is. */
	principal: string;
	actor: string;
	/** What every project route answers when it is not 200, with the public code it states. */
	status: number;
	error: string;
	/** The revisions the hub reads notes and evidence at. */
	notes: string | null;
	evidence: string | null;
	/** Stands in for the evidence answer, for a test that sends something else. */
	answer: ((projectId: string) => unknown) | null;
	artifact: { bytes: Uint8Array; mediaType: string };
	seen: Array<{ url: string; authorization: string | undefined }>;
}
