import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect } from '../verificationExpect';
import { moduleTaskFixture } from './moduleTaskFixture';

export async function verifyOrchestratorRotation(
	mode: 'context-orchestrator' | 'context-preflight'
) {
	const f = await moduleTaskFixture();
	try {
		const brief = join(f.root, 'brief.md');
		await writeFile(brief, 'Verify this disposable Phase 4 orders fixture.');
		await writeFile(join(f.root, 'mode'), mode);
		const result = await f.cli(
			[
				'orchestrate',
				'--tracker=pilot1',
				`--brief=${brief}`,
				'--model=claude-haiku-5-5',
				mode === 'context-preflight' ? '--context-tokens=150000' : '--context-tokens=1500'
			],
			false
		);
		expect(
			result.exitCode,
			'Harness-owned orchestrator resumes without sending oversized input'
		).toBe(0);
		const report = JSON.parse(result.stdout);
		const projected = mode === 'context-preflight';
		const observed = projected ? 138000 : 1900;
		expect(report.sessions).toMatchObject([
			{
				status: 'rotated',
				peakContextTokens: observed,
				usage: { inputTokens: observed, outputTokens: 10 }
			},
			{ status: 'succeeded', usage: { inputTokens: 100, reportedCostUsd: 0.002 } }
		]);
		if (projected) expect(report.sessions[0].preRequestEstimateTokens).toBeGreaterThan(190000);
		expect(report.sessions[0].apiCost).toMatchObject({ basis: 'standard-api-estimate' });
		const notes = await readFile(join(f.root, 'tracker.ndjson'), 'utf8');
		expect(notes).toContain(f.source);
		expect(notes).toContain('resume from');
		expect(notes).not.toContain('Verified orders fixture');
		expect(await readFile(join(f.root, 'src/orders.ts'), 'utf8')).toContain('orders = 2');
	} finally {
		await f.dispose();
	}
}
