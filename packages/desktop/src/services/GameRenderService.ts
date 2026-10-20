import { readFile, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { createDecartClient } from '@decartai/sdk';
import { DecartAdapter } from '../../../game/src/adapters/DecartAdapter';
import type { RenderSessionRequest } from '../../../game/src/models/Game.types';
import type { ProjectSessionService } from './ProjectSessionService';
import { gitRead } from '../utils/gitRead';
const renderers = new Map<string, DecartAdapter>();

export class GameRenderService {
	constructor(
		private session: ProjectSessionService,
		private transportReady = () => false
	) {}
	async start(input: RenderSessionRequest) {
		this.session.assertProject(input.projectId);
		const { root } = await this.session.mutable();
		if (this.session.busy) throw new Error('Wait for the current run.');
		if (!this.transportReady())
			throw new Error(
				'Live AI is blocked until a credential-safe provider transport is available.'
			);
		let adapter = renderers.get(root);
		if (!adapter) {
			const key = await projectCredential(root);
			adapter = new DecartAdapter(createDecartClient({ apiKey: key }).tokens);
			renderers.set(root, adapter);
		}
		return adapter.start(input);
	}
}
async function projectCredential(root: string): Promise<string> {
	try {
		const tracked = (await gitRead(root, ['ls-files', '--', '.env.local'])).trim();
		const ignored = (await gitRead(root, ['check-ignore', '.env.local'])).trim();
		if (tracked || !ignored) throw new Error('Credential file must be ignored.');
		const file = join(root, '.env.local');
		const stat = await lstat(file);
		if (!stat.isFile() || stat.isSymbolicLink())
			throw new Error('Credential file must be regular.');
		const text = await readFile(file, 'utf8');
		const key = text.match(/^HARNESS_GAME_DECART_API_KEY=["']?([^\s"']+)["']?\s*$/m)?.[1];
		if (key) return key;
	} catch {
		/* No credentials from other projects or the ambient environment. */
	}
	throw new Error(
		'Configure a project-owned HARNESS_GAME_DECART_API_KEY in this project’s ignored .env.local.'
	);
}
