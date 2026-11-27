export type VaultAction = 'setup' | 'remove';

export interface VaultSetupBridge {
	status(): Promise<string>;
	run(action: VaultAction): Promise<string | null>;
}
