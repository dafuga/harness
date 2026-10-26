import { lstat, readdir, realpath } from 'node:fs/promises';
import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import type {
	ModuleTaskProviderConfigAdapterConfig,
	ModuleTaskProviderConfigPaths
} from './ModuleTaskProviderConfigAdapter.types';

export class ModuleTaskProviderConfigAdapter {
	constructor(private readonly config: ModuleTaskProviderConfigAdapterConfig = {}) {}

	connect(): string {
		return this.config.name ?? 'module-task-provider-config';
	}

	async paths(provider: 'codex' | 'claude'): Promise<ModuleTaskProviderConfigPaths> {
		const home = this.config.home ?? homedir();
		const configuredRoot =
			provider === 'codex'
				? (this.config.codexHome ??
					(this.config.home === undefined ? process.env.CODEX_HOME : undefined) ??
					join(home, '.codex'))
				: (this.config.claudeConfigDir ??
					(this.config.home === undefined ? process.env.CLAUDE_CONFIG_DIR : undefined) ??
					join(home, '.claude'));
		const result: ModuleTaskProviderConfigPaths = { readPaths: [], exactReadDirectories: [] };
		const root = await this.canonicalPath(configuredRoot, true);
		if (root) {
			const names =
				provider === 'codex'
					? ['auth.json', 'config.toml']
					: ['.credentials.json', 'settings.json'];
			for (const name of names) await this.addFile(join(root, name), result);
			if (provider === 'codex') await this.addRules(root, result);
		}
		if (provider === 'claude') {
			const canonicalHome = await this.canonicalPath(home, true);
			if (canonicalHome) await this.addFile(join(canonicalHome, '.claude.json'), result);
		}
		return result;
	}

	private async canonicalPath(path: string, directory: boolean): Promise<string | undefined> {
		if (!isAbsolute(path)) throw new Error(`unsafe config path: ${path}`);
		try {
			const metadata = await lstat(path);
			if (metadata.isSymbolicLink() || (metadata.isFile() && metadata.nlink !== 1))
				throw new Error(`unsafe config path: ${path}`);
			if (directory ? !metadata.isDirectory() : !metadata.isFile()) return undefined;
			return await realpath(path);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
			throw error;
		}
	}

	private async addFile(path: string, result: ModuleTaskProviderConfigPaths): Promise<void> {
		const file = await this.canonicalPath(path, false);
		if (file) result.readPaths.push(file);
	}

	private async addRules(root: string, result: ModuleTaskProviderConfigPaths): Promise<void> {
		const rules = await this.canonicalPath(join(root, 'rules'), true);
		if (!rules) return;
		result.exactReadDirectories.push(rules);
		for (const name of (await readdir(rules)).sort()) {
			if (name.endsWith('.rules')) await this.addFile(join(rules, name), result);
		}
	}
}

export type {
	ModuleTaskProviderConfigAdapterConfig,
	ModuleTaskProviderConfigPaths
} from './ModuleTaskProviderConfigAdapter.types';
