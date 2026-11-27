export type Opening = { opened: (...args: unknown[]) => Promise<{ deviceName: string } | null> };

export interface Asked {
	pairingId: string;
	expiresAt: string;
}
