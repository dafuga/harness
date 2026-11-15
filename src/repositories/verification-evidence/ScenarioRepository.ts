// @harness-uid u_5qi3u7uxnr
import type { ScenarioRead } from './ScenarioRepository.types';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { SourceTree } from '../../core/development-tooling/sourceTypes';
import type { ScenarioManifest } from '../../core/development-tooling/unitTypes';
import { scenariosDirectory } from '../../core/development-tooling/unitsConfig';
import { stableJson } from '../../utils/development-tooling/stableJson';
import { readTreeTexts } from '../../utils/development-tooling/readTreeTexts';
import {
	videoScenarioSourceContext,
	videoScenarioSources
} from '../../validators/verification-evidence/scenario-manifest-validator/videoScenarioSources';
import { ScenarioManifestValidator } from '../../validators/verification-evidence/ScenarioManifestValidator';

/** Stores scenario contracts as one canonical JSON file per scenario. */
export class ScenarioRepository {
	private readonly validator = new ScenarioManifestValidator();

	constructor(private readonly root: string) {}

	async read(tree: SourceTree): Promise<ScenarioRead> {
		const listed = await tree.list();
		const paths = listed
			.map((entry) => entry.path)
			.filter((path) => path.startsWith(`${scenariosDirectory}/`) && path.endsWith('.json'));
		const result: ScenarioRead = { manifests: [], errors: [] };
		const texts = await readTreeTexts(tree, paths);
		for (const [index, path] of paths.entries()) {
			const checked = this.validator.validate(parse(texts[index]), path);
			result.errors.push(...checked.errors);
			if (checked.value) result.manifests.push(checked.value);
		}
		if (result.manifests.some((scenario) => scenario.video)) {
			const context = await videoScenarioSourceContext(
				tree,
				this.root,
				listed.map((entry) => entry.path)
			);
			for (const scenario of result.manifests)
				result.errors.push(...(await videoScenarioSources(context, scenario)));
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

export type { ScenarioRead } from './ScenarioRepository.types';
