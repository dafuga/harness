export type ItemFields = {
	agent: string | null;
	id: string;
	status: string;
	title: string;
	updated: string;
};
export type ItemFlags = {
	due?: string;
	notes?: Record<string, unknown>[];
	extra?: Record<string, unknown>;
};
