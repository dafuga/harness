export interface PushOwner {
	db: D1Database;
	actor: string;
}

export interface StoredSubscription {
	id: string;
	endpoint: string;
	p256dh: string;
	auth: string;
	delivered_at: number | null;
}
