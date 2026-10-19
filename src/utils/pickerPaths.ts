import { homedir } from 'node:os';
import { join } from 'node:path';

export function pickerPaths() {
	const root = process.env.CODEX_HOME ?? join(homedir(), '.codex');
	return {
		home: process.env.HARNESS_PICKER_HOME ?? join(root, 'harness', 'picker'),
		catalogs: {
			openai: join(root, 'models_cache.json'),
			claude: join(root, 'harness-gateway', 'claude-models.json')
		}
	};
}
