// @harness-uid u_7l2fel4x2m
/** The device's design preference, as the composers read and change it. */
export interface AgentSettingsStore {
	readonly designOptions: number;
	/** False when the last change could not be kept on this device. */
	readonly saved: boolean;
	load(): void;
	setDesignOptions(value: number): boolean;
}
