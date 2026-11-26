export interface TrackerResourceScenario {
	cores: number;
	load: [number, number];
	availableMB: number;
	freePercent: number | null;
	freeGB: number;
	freeInodes?: number;
	inodeFreePercent?: number;
	unreadableVolume?: boolean;
}
