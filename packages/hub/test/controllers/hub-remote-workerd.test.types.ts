export interface Summary {
	generation: number;
	registeredAt: string;
	devices: Record<string, unknown>[];
}
