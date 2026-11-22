// @harness-uid u_xg3ex7hmhj
import type { z } from 'zod';
import type { recipeReview, recipeSchema } from './vaultRecipe';

export type VaultRecipe = z.output<typeof recipeSchema>;
export type VaultRecipeInput = z.input<typeof recipeSchema>;
export type VaultRecipeReview = z.output<typeof recipeReview>;
export type VaultMethodKind = VaultRecipe['methods'][number]['kind'];
export type VaultAction = VaultRecipe['actions'][number];
export type VaultOtpChannel = VaultRecipe['otp'][number];

export interface RecipeReviewer {
	id: string;
	publicKey: string;
}

export interface VerifiedRecipe {
	recipe: VaultRecipe;
	digest: string;
	display: string;
	review: VaultRecipeReview;
}

export interface VaultScriptApproval {
	recipeDigest: string;
	action: string;
	method: VaultMethodKind;
}
