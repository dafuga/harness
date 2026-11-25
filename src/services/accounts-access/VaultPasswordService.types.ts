// @harness-uid u_mucsxl7k4y
import type { VerifiedRecipe } from '../../utils/accounts-access/vaultRecipe.types';

export interface VaultPasswordBrowser {
	prepareForm(): Promise<(password: Buffer) => Promise<void>>;
	close(): Promise<void>;
}

export interface VaultPasswordConfig {
	recipe: VerifiedRecipe;
	script: Uint8Array;
	scope: { project: string; environment: string; host: string };
	openBrowser(): Promise<VaultPasswordBrowser>;
	store(password: Buffer): Promise<void>;
}
