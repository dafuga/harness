export interface Summary {
	online: boolean;
	devices: { deviceId: string; online: boolean; createdAt: string; lastSeenAt: string | null }[];
}
