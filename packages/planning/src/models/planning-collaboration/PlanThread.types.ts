import type { ChangeRecord } from './HostFileChange.types';
import type {
	AgentRef,
	CommitId,
	IsoTime,
	MessageMode,
	NormalizedRegion,
	PlanAuthor,
	PlanViewport,
	Sha256
} from './Planning.types';

export interface ThreadAnchor {
	version: string;
	file: string;
	imageSha256: Sha256;
	state: string;
	viewport: PlanViewport;
	/** `null` anchors the whole image. */
	region: NormalizedRegion | null;
	/** The option holding the image, derived from the stored version, when it has options. */
	option?: string;
}

export type ArtifactReference =
	| { kind: 'image'; version: string; file: string; sha256: Sha256; option?: string }
	| { kind: 'notes'; version: string; sha256: Sha256 }
	| { kind: 'approval'; approvalId: string };

export interface ThreadMessage {
	id: string;
	unitId: string;
	threadId: string;
	/** 1 for the first message of the thread. */
	sequence: number;
	/** SHA-256 of the previous line, or of `thread.json` for the first message. */
	previous: Sha256;
	at: IsoTime;
	author: PlanAuthor;
	mode: MessageMode;
	agent: AgentRef | null;
	body: string;
	references: ArtifactReference[];
	change: ChangeRecord | null;
}

export interface PlanThread {
	id: string;
	unitId: string;
	/** The number shown on the image, counted per unit. */
	pin: number;
	title: string;
	anchor: ThreadAnchor | null;
	/** The revision the reviewer was looking at. */
	viewedRevision: CommitId;
	createdAt: IsoTime;
	createdBy: PlanAuthor;
	/** Derived: the commit that opened the thread. */
	commit: CommitId;
	messages: ThreadMessage[];
}
