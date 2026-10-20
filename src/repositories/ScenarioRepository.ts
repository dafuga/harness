import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { SourceTree } from '../core/sourceTypes';
import type { ScenarioManifest } from '../core/unitTypes';
import { scenariosDirectory } from '../core/unitsConfig';
import { stableJson } from '../utils/stableJson';
import { readTreeTexts } from '../utils/readTreeTexts';
import { ScenarioManifestValidator } from '../validators/ScenarioManifestValidator';

export interface ScenarioRead {
	manifests: ScenarioManifest[];
	errors: string[];
}

/** Stores scenario contracts as one canonical JSON file per scenario. */
export class ScenarioRepository {
	private readonly validator = new ScenarioManifestValidator();

	constructor(private readonly root: string) {}

	async read(tree: SourceTree): Promise<ScenarioRead> {
		const paths = (await tree.list())
			.map((entry) => entry.path)
			.filter((path) => path.startsWith(`${scenariosDirectory}/`) && path.endsWith('.json'));
		const result: ScenarioRead = { manifests: [], errors: [] };
		const texts = await readTreeTexts(tree, paths);
		for (const [index, path] of paths.entries()) {
			const checked = this.validator.validate(parse(texts[index]), path);
			result.errors.push(...checked.errors);
			if (checked.value) result.manifests.push(checked.value);
		}
		return result;
	}

	async write(manifest: ScenarioManifest): Promise<string> {
		const path = `${scenariosDirectory}/${manifest.id}.json`;
		await mkdir(dirname(join(this.root, path)), { recursive: true });
		await writeFile(join(this.root, path), stableJson(manifest));
		return path;
	}
}

function parse(text: string): unknown {
	try {
		return JSON.parse(text) as unknown;
	} catch {
		return undefined;
	}
}
