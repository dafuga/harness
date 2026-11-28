// @harness-uid u_c5mwmd6z6z
export interface ChiefReview {
	at: number;
	actor: string | null;
	generation: string;
	mode: 'review' | 'chief-only' | 'approved';
	fields: Record<string, unknown>;
}

/** The item's review columns before the operation is applied. */
export interface CurrentChiefReview {
	chief_review: string | null;
	chief_answer: string | null;
	needs_daniel: number | null;
	resolved: number | null;
	question?: string | null;
	options?: string | null;
	confirm?: string | null;
	attachments?: string | null;
	attachment_docs?: string | null;
	next_step?: string | null;
}

export interface ChiefReviewContext {
	current?: CurrentChiefReview;
	migrate?: boolean;
}

export interface ChiefReviewAsk {
	flag: boolean;
	blocker: boolean;
	text: string;
}

export interface ChiefReviewHold {
	current: CurrentChiefReview | undefined;
	mode: ChiefReview['mode'];
	/** Daniel already has a flag on the item, which a held ask never touches. */
	keepPublished: boolean;
}

export interface ChiefReviewRow {
	id: string;
	title: string;
	chief_review: string;
	priority: string | null;
	sensitive: number | string | null;
}
