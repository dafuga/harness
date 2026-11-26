export type TrackerAttachmentKind = 'spec' | 'doc' | 'design';

/** What every screen lists about an attachment. It travels with the ask and stays small. */
export interface TrackerAttachment {
	/** SHA-256 of the stored document; for a link-only design, of its address. */
	id: string;
	kind: TrackerAttachmentKind;
	title: string;
	/** GitHub "owner/name", with the pull request, file path and pinned commit. */
	repo?: string;
	pr?: number;
	path?: string;
	ref?: string;
	/** An https page for the same thing, such as a design canvas. */
	url?: string;
	/** UTF-8 bytes of the stored markdown and images; 0 for a link. */
	bytes: number;
}

/** The snapshot taken when the ask was flagged. Images are keyed by the source markdown names. */
export interface TrackerAttachmentDocument {
	markdown: string;
	images?: Record<string, string>;
}

/** What a caller sends with `flag`: the listing plus, for a document, its snapshot. */
export type TrackerAttachmentInput = Omit<TrackerAttachment, 'id' | 'bytes'> &
	Partial<TrackerAttachmentDocument>;
