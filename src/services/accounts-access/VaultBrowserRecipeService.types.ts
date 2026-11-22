// @harness-uid u_xhiaeoubra
import type {
	VaultScriptApproval,
	VerifiedRecipe
} from '../../utils/accounts-access/vaultRecipe.types';
import type { VaultOtpPlan } from '../../utils/accounts-access/vaultOtpRoute.types';

export interface VaultBrowserRecipePage {
	goto(url: string): Promise<unknown>;
	waitForURL(url: string): Promise<void>;
	url(): string;
	locator(selector: string): VaultBrowserRecipeLocator;
	close(): Promise<void>;
}

export interface VaultBrowserRecipeLocator {
	fill(value: string): Promise<void>;
	click(): Promise<void>;
	textContent(): Promise<string | null>;
}

export interface VaultBrowserRecipeConfig {
	newPage(): Promise<VaultBrowserRecipePage>;
	openSecret(): Buffer;
	openOtp?(plan: Extract<VaultOtpPlan, { route: 'phone-entry' }>): Promise<Buffer>;
}

export interface VaultBrowserRecipeInput {
	recipe: VerifiedRecipe;
	approval: VaultScriptApproval;
	script: Uint8Array;
}
