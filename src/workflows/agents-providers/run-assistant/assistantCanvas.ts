// @harness-uid u_4qr6yj2aj3
import { readFile, rename, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import type { GitHubAppAdapter } from '../../../adapters/agents-providers/GitHubAppAdapter';
import type { AssistantSlackMediaAdapter } from '../../../adapters/agents-providers/AssistantSlackMediaAdapter';
import { RunbookCanvasService } from '../../../services/agents-providers/RunbookCanvasService';
import type { AssistantCanvasConfig } from './readAssistantConfig.types';

const stateSchema = z.object({ canvasId: z.string().regex(/^F[A-Z0-9]+$/), digest: z.string() });
const gitRef = z.object({ commit: z.object({ sha: z.string().regex(/^[0-9a-f]{40}$/) }) });
const directoryEntry = z.object({ name: z.string(), type: z.string() });
const file = z.object({ content: z.string(), encoding: z.literal('base64') });

export function assistantCanvas(
	options: AssistantCanvasConfig,
	github: GitHubAppAdapter,
	slack: AssistantSlackMediaAdapter,
	statePath: string
) {
	const loadState = async () => {
		try {
			return stateSchema.parse(JSON.parse(await readFile(statePath, 'utf8')));
		} catch (error) {
			if ((error as { code?: string }).code === 'ENOENT') return undefined;
			throw error;
		}
	};
	const service = new RunbookCanvasService(
		{
			readRunbooks: () => readRunbooks(github, options),
			loadState,
			saveState: async (state) => {
				const next = statePath + '.new';
				await writeFile(next, JSON.stringify(state), { mode: 0o600 });
				await rename(next, statePath);
			},
			create: (title, markdown) => slack.create(title, markdown),
			replace: (id, markdown) => slack.replace(id, markdown),
			share: (id, channels) => slack.share(id, channels)
		},
		options
	);
	return { service, loadState };
}

async function readRunbooks(github: GitHubAppAdapter, config: AssistantCanvasConfig) {
	const revision = gitRef.parse(
		await github.read(github.repoPath + '/branches/' + encodeURIComponent(config.branch))
	).commit.sha;
	const root = github.repoPath + '/contents/' + config.directory;
	const query = { ref: revision };
	const entries = z.array(directoryEntry).parse(await github.read(root, query));
	const names = entries
		.filter((entry) => entry.type === 'file' && /^[a-zA-Z0-9_-]+\.md$/.test(entry.name))
		.map((entry) => entry.name)
		.sort();
	const runbooks = [];
	for (const name of names) {
		const data = file.parse(await github.read(root + '/' + name, query));
		runbooks.push({ path: name, markdown: Buffer.from(data.content, 'base64').toString('utf8') });
	}
	return runbooks;
}
