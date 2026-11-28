// @harness-uid u_c5mwmd6z6z
export interface ChiefReview {
	at: number;
	actor: string | null;
	generation: string;
	mode: 'review' | 'chief-only' | 'approved';
	fields: Record<string, unknown>;
}

export interface ChiefReviewRow {
	id: string;
	title: string;
	chief_review: string;
	priority: string | null;
	sensitive: number | string | null;
}
