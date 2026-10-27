import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import manifest from '../../../specification/units/service.verification-evidence-screenshot-baseline.json';
import { LfsAdapter } from '../../../src/adapters/git-source-history/LfsAdapter';
import { evidenceRef } from '../../../src/core/git-source-history/historyTypes';
import { EvidenceBranchRepository } from '../../../src/repositories/verification-evidence/evidence-branch-repository/EvidenceBranchRepository';
import { ScreenshotBaselineService } from '../../../src/services/verification-evidence/ScreenshotBaselineService';
import { measureWorkload } from '../../support/measureWorkload';
import { screenshotBaselineFixture } from '../../support/screenshotBaselineFixture';
import { runHarness } from '../../support/cli';

const request = (review: {
	id: string;
	unit: string;
	case: string;
	viewport: string;
	file: string;
}) => ({
	id: review.id,
	unit: review.unit,
	case: review.case,
	viewport: review.viewport,
	file: review.file
});
const expected = (id: string) => {
	const found = manifest.testing.cases.find((item) => item.id === id);
	if (!found) throw new Error(`Missing declared case ${id}`);
	return found.expected.value;
};

test('ScreenshotBaselineService.review from empty accepts a reviewed candidate', async () => {
	const fixture = await screenshotBaselineFixture();
	try {
		const service = new ScreenshotBaselineService(fixture.root);
		const review = await measureWorkload(
			'service.verification-evidence-screenshot-baseline',
			'review-candidate',
			() => service.review(fixture.input)
		);
		expect(review).toMatchObject({
			...fixture.input,
			sha256: fixture.sha256,
			bytes: fixture.image.length
		});
		expect(review).toMatchObject(expected('review.empty'));
		expect(review.id).toMatch(/^[a-f0-9]{64}$/);
		const flags = Object.entries(fixture.input).flatMap(([name, value]) => [`--${name}`, value]);
		const cli = await runHarness(
			['history', 'screenshot', 'review', ...flags, '--json'],
			fixture.root
		);
		expect(JSON.parse(cli.stdout)).toMatchObject({ ...fixture.input, ...expected('review.empty') });
		const guidance = await runHarness(['info', 'history'], fixture.root);
		expect(guidance.stdout).toContain(
			'Do not automatically approve a missing or changed screenshot.'
		);
		expect(guidance.stdout).toContain('history screenshot read');
	} finally {
		await fixture.dispose();
	}
}, 60_000);

test('ScreenshotBaselineService.review after review validates each new request', async () => {
	const fixture = await screenshotBaselineFixture({ sibling: true });
	try {
		const service = new ScreenshotBaselineService(fixture.root);
		const first = await service.review(fixture.input);
		const second = await service.review({
			...fixture.input,
			reason: 'A second explicit inspection.'
		});
		expect(second.id).not.toBe(first.id);
		expect(second).toMatchObject(expected('review.reviewed'));
		const sibling = await service.review({ ...fixture.input, case: 'default.secondary' });
		expect(sibling.file).toBe('test/baselines/secondary.png');
		expect((await service.load(request(sibling))).bytes).toEqual(fixture.image);
		await expect(service.review({ ...fixture.input, reviewer: '' })).rejects.toThrow();
		await expect(service.review({ ...fixture.input, record: 'f'.repeat(64) })).rejects.toThrow(
			'source verification is missing'
		);
		await expect(service.review({ ...fixture.input, case: 'unknown' })).rejects.toThrow(
			'case or viewport is not declared'
		);
		await expect(service.review({ ...fixture.input, viewport: 'mobile' })).rejects.toThrow(
			'case or viewport is not declared'
		);
	} finally {
		await fixture.dispose();
	}
}, 60_000);

test('ScreenshotBaselineService.review rejects damaged source evidence', async () => {
	for (const [options, message] of [
		[{ snapshotFailed: true }, 'snapshot and registry must both have passed'],
		[{ skipped: true }, 'case did not execute'],
		[{ wrongBuild: true }, 'matching served build and revision'],
		[{ bindingCase: 'default.mobile' }, 'valid case binding'],
		[{ corruptImage: true }, 'PNG cannot be decoded'],
		[{ duplicate: true }, 'screenshot is missing or ambiguous'],
		[{ provenance: 'fixture' as const }, 'matching served build and revision']
	] as const) {
		const fixture = await screenshotBaselineFixture(options);
		try {
			const service = new ScreenshotBaselineService(fixture.root);
			if ('snapshotFailed' in options) {
				await expect(service.review(fixture.input)).rejects.toMatchObject(
					expected('review.damaged')
				);
				await expect(
					new ScreenshotBaselineService(join(fixture.root, 'missing')).review(fixture.input)
				).rejects.toBeInstanceOf(Error);
			} else await expect(service.review(fixture.input)).rejects.toThrow(message);
		} finally {
			await fixture.dispose();
		}
	}
}, 120_000);

test('ScreenshotBaselineService.load from reviewed returns the original bytes', async () => {
	const fixture = await screenshotBaselineFixture();
	try {
		const service = new ScreenshotBaselineService(fixture.root);
		const review = await service.review(fixture.input);
		const loaded = await measureWorkload(
			'service.verification-evidence-screenshot-baseline',
			'load-reviewed-candidate',
			() => service.load(request(review))
		);
		expect(loaded.review).toEqual(review);
		expect(loaded.bytes).toEqual(fixture.image);
		expect({
			reviewMatches: loaded.review.id === review.id,
			originalBytes: loaded.bytes.equals(fixture.image)
		}).toEqual(expected('load.reviewed'));
		await expect(service.load({ ...request(review), viewport: 'mobile' })).rejects.toThrow(
			'different case or viewport'
		);
		await expect(
			service.load({ ...request(review), file: 'test/baselines/other.png' })
		).rejects.toThrow('different case or viewport');
		const output = join(fixture.root, 'reviewed.png');
		const flags = Object.entries(request(review)).flatMap(([name, value]) => [`--${name}`, value]);
		const args = ['history', 'screenshot', 'read', ...flags, '--out', output, '--json'];
		const cli = await runHarness(args, fixture.root);
		expect(JSON.parse(cli.stdout)).toEqual({ id: review.id, sha256: fixture.sha256, out: output });
		expect(await readFile(output)).toEqual(fixture.image);
		const collision = await runHarness(args, fixture.root, false);
		expect(collision.exitCode).not.toBe(0);
		expect(await readFile(output)).toEqual(fixture.image);
	} finally {
		await fixture.dispose();
	}
}, 60_000);

test('ScreenshotBaselineService.load from empty refuses a missing review', async () => {
	const fixture = await screenshotBaselineFixture();
	try {
		const service = new ScreenshotBaselineService(fixture.root);
		await expect(
			service.load({
				id: 'f'.repeat(64),
				unit: fixture.input.unit,
				case: fixture.input.case,
				viewport: fixture.input.viewport,
				file: 'test/baselines/desktop.png'
			})
		).rejects.toMatchObject(expected('load.empty'));
	} finally {
		await fixture.dispose();
	}
}, 60_000);

test('ScreenshotBaselineService.load rejects damaged original evidence', async () => {
	const fixture = await screenshotBaselineFixture();
	try {
		const service = new ScreenshotBaselineService(fixture.root);
		const review = await service.review(fixture.input);
		await writeFile(await new LfsAdapter(fixture.root).path(fixture.sha256), 'changed');
		const error: unknown = await service.load(request(review)).catch((failure: unknown) => failure);
		expect(error).toMatchObject(expected('load.damaged'));
		expect(error).toHaveProperty(
			'message',
			expect.stringContaining('source verification is not intact')
		);
		await writeFile(await new LfsAdapter(fixture.root).path(fixture.sha256), fixture.image);
		const evidence = new EvidenceBranchRepository(fixture.root);
		const tip = (await evidence.tip())!;
		const altered = await evidence.tree.commit({
			parents: [tip],
			files: [
				{ path: `screenshot-baselines/${review.id}/review.json`, content: { bytes: '{broken' } }
			],
			message: 'chore: damage synthetic review'
		});
		expect(await evidence.tree.advance(evidenceRef, altered, tip)).toBe(true);
		await expect(service.load(request(review))).rejects.toThrow('screenshot review is invalid');
	} finally {
		await fixture.dispose();
	}
}, 60_000);
