export interface ActivityHost {
	harness: Record<string, unknown>;
	__projects: {
		data: { projects: Array<{ entities: Array<{ id: string; title: string; category: string }> }> };
	};
	__activityFailed: boolean;
}
