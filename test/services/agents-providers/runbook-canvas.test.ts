import { describe, expect, test } from 'vitest';
import type {
	RunbookCanvasPorts,
	RunbookCanvasState
} from '../../../src/core/agents-providers/runbookCanvas.types';
import { RunbookCanvasService } from '../../../src/services/agents-providers/RunbookCanvasService';
import { runbookCanvasMarkdown } from '../../../src/services/agents-providers/runbook-canvas-service/runbookCanvasMarkdown';

const staging = 'https://staging.example.pages.dev';
const runbook = {
	path: 'docs/qa/runbooks/a.md',
	markdown: `# Company logo\n\n## Steps\n1. Open [staging](${staging}/settings) and [admin](https://internal.example.com/x). See https://internal.example.com/raw.\n\n\`\`\`qa-video\nrecipe: x\n\`\`\`\n\nkey sk-ant-api03-abcdefghijklmnop`
};

describe('runbook canvas markdown', () => {
	test('keeps staging links only, drops video blocks and secrets, lists contents', () => {
		const out = runbookCanvasMarkdown('QA runbooks', [runbook], [staging]);
		expect(out).toContain(`[staging](${staging}/settings)`);
		expect(out).toContain('and admin.');
		expect(out).not.toContain('internal.example.com');
		expect(out).not.toContain('qa-video');
		expect(out).not.toContain('sk-ant');
		expect(out).toContain('- Company logo');
	});
});

describe('RunbookCanvasService', () => {
	test('creates once, then only updates when the content changes', async () => {
		let state: RunbookCanvasState | undefined;
		let current = runbook;
		let shareAttempts = 0;
		const log: string[] = [];
		const ports: RunbookCanvasPorts = {
			readRunbooks: async () => [current],
			loadState: async () => state,
			saveState: async (s) => void (state = s),
			create: async () => (log.push('create'), 'F1'),
			replace: async () => void log.push('replace'),
			share: async (_id, channels) => {
				log.push('share:' + channels.join(','));
				if (shareAttempts++ === 0) throw new Error('Slack refused shares temporarily.');
			}
		};
		const service = new RunbookCanvasService(ports, {
			title: 'QA runbooks',
			allowedOrigins: [staging],
			channels: ['C1']
		});
		await expect(service.sync()).rejects.toThrow('temporarily');
		expect(await service.sync()).toMatchObject({ status: 'updated', canvasId: 'F1' });
		expect((await service.sync()).status).toBe('unchanged');
		current = { ...runbook, markdown: runbook.markdown + '\nmore' };
		expect((await service.sync()).status).toBe('updated');
		expect(log).toEqual(['create', 'share:C1', 'replace', 'share:C1', 'replace']);
	});
});
