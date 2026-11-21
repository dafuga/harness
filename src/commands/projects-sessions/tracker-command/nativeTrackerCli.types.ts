// @harness-uid u_r7qgepnoax
export interface NativeTrackerRequest {
	method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
	path: string;
	body?: Readonly<Record<string, unknown>>;
}

export interface NativeTrackerItem {
	id: string;
	kind: string;
	title: string;
	status: string;
	blocked_reason?: string;
	ignored_reason?: string;
	ignored_until?: string;
	needs_daniel?: boolean;
	resolved?: boolean;
	every?: string;
	every_tz?: string;
	due?: string;
	owner?: string;
	agent?: string;
	auto?: string;
	last_result?: { occurrence: string; status: string };
}
