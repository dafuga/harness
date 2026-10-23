import type { RegistryRead } from './UnitRegistryRepository.types';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { SourceTree } from '../../core/development-tooling/sourceTypes';
import type { ComponentManifest } from '../../core/development-tooling/unitTypes';
import {
	defaultUnitsConfig,
	unitsConfigFile,
	unitsConfigSchema,
	unitsDirectory,
	type UnitsConfig
} from '../../core/development-tooling/unitsConfig';
import { fail } from '../../core/development-tooling/errors';
import { stableJson } from '../../utils/development-tooling/stableJson';
import { readTreeTexts } from '../../utils/development-tooling/readTreeTexts';
import {
	ComponentManifestValidator,
	schemaErrors
} from '../../validators/development-tooling/ComponentManifestValidator';

/** Stores unit manifests as one canonical JSON file per unit in the repository. */
export class UnitRegistryRepository {
	private readonly validator = new ComponentManifestValidator();

	constructor(private readonly root: string) {}

	async config(tree: SourceTree): Promise<UnitsConfig> {
		const listed = (await tree.list()).some((entry) => entry.path === unitsConfigFile);
		if (!listed) return defaultUnitsConfig;
		const parsed = unitsConfigSchema.safeParse(parseJson(await tree.read(unitsConfigFile)));
		if (parsed.success) return parsed.data;
		return fail(schemaErrors(parsed.error, unitsConfigFile).join('\n'));
	}

	async read(tree: SourceTree): Promise<RegistryRead> {
		const paths = (await tree.list())
			.map((entry) => entry.path)
			.filter((path) => path.startsWith(`${unitsDirectory}/`) && path.endsWith('.json'));
		const result: RegistryRead = { manifests: [], errors: [], unformatted: [] };
		const texts = await readTreeTexts(tree, paths);
		for (const [index, path] of paths.entries()) {
			const text = texts[index];
			const checked = this.validator.validate(parseJson(text), path);
			result.errors.push(...checked.errors);
			if (!checked.value) continue;
			result.manifests.push(checked.value);
			if (stableJson(checked.value) !== text) result.unformatted.push(checked.value.id);
		}
		return result;
	}

	/** Writes manifests whose canonical content differs and returns their paths. */
	async write(manifests: ComponentManifest[]): Promise<string[]> {
		const written: string[] = [];
		for (const manifest of manifests) {
			const path = this.path(manifest.id);
			const contents = stableJson(manifest);
			if ((await current(join(this.root, path))) === contents) continue;
			await mkdir(dirname(join(this.root, path)), { recursive: true });
			await writeFile(join(this.root, path), contents);
			written.push(path);
		}
		return written;
	}

	async remove(id: string): Promise<void> {
		await rm(join(this.root, this.path(id)), { force: true });
	}

	path(id: string): string {
		return `${unitsDirectory}/${id}.json`;
	}
}

function parseJson(text: string): unknown {
	try {
		return JSON.parse(text) as unknown;
	} catch {
		return undefined;
	}
}

async function current(path: string): Promise<string | undefined> {
	try {
		return await readFile(path, 'utf8');
	} catch {
		return undefined;
	}
}

export type { RegistryRead } from './UnitRegistryRepository.types';
