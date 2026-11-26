export interface HealthFixtureRequest {
	method: string;
	path: string;
	body: Record<string, unknown>;
	headers: Record<string, string | string[] | undefined>;
}

export interface HealthFixtureState {
	status: Record<string, unknown>;
	itemStatus: string;
	requests: HealthFixtureRequest[];
}
