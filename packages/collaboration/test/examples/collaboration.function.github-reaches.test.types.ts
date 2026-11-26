export type TransportCall =
	| { method: 'check' }
	| { method: 'request'; path: string; statuses: number[] };

export type ReachabilityExample = {
	name: string;
	input: { tip: string; commit: string };
	comparison?: { status: number; data: unknown | null };
};
