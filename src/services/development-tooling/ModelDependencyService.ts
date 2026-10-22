import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import packageInfo from '../../../package.json';
import type { FileWriteResult } from '../../core/files';

/** SQLite models import the shared runtime as a production dependency. */
export class ModelDependencyService {
	async ensure(root: string): Promise<FileWriteResult[]> {
		const path = join(root, 'package.json');
		const text = await readFile(path, 'utf8').catch((error) => {
			if ((error as { code?: string }).code === 'ENOENT') return undefined;
			throw error;
		});
		if (!text) return [];
		const manifest = JSON.parse(text);
		if (manifest.name === packageInfo.name) return [];
		if (manifest.dependencies?.[packageInfo.name]) return [];
		const version = manifest.devDependencies?.[packageInfo.name] ?? `^${packageInfo.version}`;
		manifest.dependencies = { ...manifest.dependencies, [packageInfo.name]: version };
		if (manifest.devDependencies) delete manifest.devDependencies[packageInfo.name];
		const contents = JSON.stringify(manifest, null, '\t') + '\n';
		await writeFile(path, contents);
		return [{ path: 'package.json', contents, status: 'overwritten' }];
	}
}
