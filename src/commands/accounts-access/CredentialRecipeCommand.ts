// @harness-uid u_ydbpwntlfp
import type { Command } from 'commander';
import { resolve } from 'node:path';
import {
	credentialRecipeDigest,
	verifyCredentialRecipe
} from '../../workflows/accounts-access/runCredentialRequest';
import type { CredentialCommandOptions as Options } from './CredentialCommand.types';

const print = (value: unknown) => console.log(JSON.stringify(value, null, 2));

/** `harness credential recipe digest|verify`: the digest the phone shows and the review check. */
export class CredentialRecipeCommand {
	register(credential: Command): void {
		const recipe = credential.command('recipe').description('Check Credential Vault site recipes.');
		recipe
			.command('digest <file>')
			.description('Print the recipe digest Harness iOS shows before approval.')
			.action((file: string) => print(credentialRecipeDigest(resolve(file))));
		const verify = recipe.command('verify <file>').description('Verify a recipe review signature.');
		this.options(verify).action((file: string, options: Options) => {
			const {
				recipe: checked,
				digest,
				display
			} = verifyCredentialRecipe(this.files(file, options));
			print({ site: checked.site, revision: checked.revision, digest, display });
		});
	}

	options(command: Command): Command {
		return command
			.requiredOption('--review <file>', 'Recipe review envelope JSON.')
			.requiredOption('--reviewers <file>', 'Trusted reviewer keys JSON.');
	}

	files(recipe: string, options: Options) {
		const review = resolve(options.review ?? '');
		return { recipe: resolve(recipe), review, reviewers: resolve(options.reviewers ?? '') };
	}
}
