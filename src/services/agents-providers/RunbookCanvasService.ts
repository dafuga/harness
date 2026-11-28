// @harness-uid u_kg5hqc5fgh
import { createHash } from 'node:crypto';
import type { RunbookCanvasPorts } from '../../core/agents-providers/runbookCanvas.types';
import { runbookCanvasMarkdown } from './runbook-canvas-service/runbookCanvasMarkdown';

/** Keeps one Slack canvas equal to the repository runbooks. Writes only when content changed. */
export class RunbookCanvasService {
	constructor(
		private readonly ports: RunbookCanvasPorts,
		private readonly options: {
			title: string;
			allowedOrigins: readonly string[];
			channels: readonly string[];
		}
	) {}

	async sync(): Promise<{ status: 'created' | 'updated' | 'unchanged'; canvasId: string }> {
		const runbooks = await this.ports.readRunbooks();
		const markdown = runbookCanvasMarkdown(
			this.options.title,
			runbooks,
			this.options.allowedOrigins
		);
		const digest = createHash('sha256').update(markdown).digest('hex');
		const state = await this.ports.loadState();
		if (state?.digest === digest) return { status: 'unchanged', canvasId: state.canvasId };
		if (state) {
			await this.ports.replace(state.canvasId, markdown);
			if (!state.digest) await this.ports.share(state.canvasId, this.options.channels);
			await this.ports.saveState({ canvasId: state.canvasId, digest });
			return { status: 'updated', canvasId: state.canvasId };
		}
		const canvasId = await this.ports.create(this.options.title, markdown);
		await this.ports.saveState({ canvasId, digest: '' });
		await this.ports.share(canvasId, this.options.channels);
		await this.ports.saveState({ canvasId, digest });
		return { status: 'created', canvasId };
	}
}
