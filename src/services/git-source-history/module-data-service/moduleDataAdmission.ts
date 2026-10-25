import { GitAdapter } from '../../../adapters/git-source-history/GitAdapter';
import { ModuleDataRepository } from '../../../repositories/git-source-history/ModuleDataRepository';
/** The selected source revision declares the required metadata protocol. */
export async function moduleDataRequired(root: string, commit: string): Promise<boolean> {
	const text = await new GitAdapter(root).attempt(['show', `${commit}:harness.validation.json`]);
	if (text === undefined) return false;
	if (JSON.parse(text).schemaVersion !== 1)
		throw new Error('Unsupported module validation protocol.');
	return true;
}
export async function committedModuleData(root: string, commit: string) {
	const repository = new ModuleDataRepository(root),
		identity = await repository.identity(commit);
	return repository.read(identity);
}
