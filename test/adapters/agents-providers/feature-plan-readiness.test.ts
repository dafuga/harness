import { expect, test, vi } from 'vitest';
import { FeaturePlanValidator } from '../../../src/validators/agents-providers/FeaturePlanValidator';
import { FeaturePlanReadinessAdapter } from '../../../src/adapters/agents-providers/FeaturePlanReadinessAdapter';

test('FeaturePlanReadinessAdapter.connect from default initialization returns the file name', () => {
	// => 'feature-plan-readiness'
	expect(new FeaturePlanReadinessAdapter().connect()).toBe('feature-plan-readiness');
});

test('FeaturePlanReadinessAdapter.connect from custom initialization returns the configured name', () => {
	// => 'custom'
	expect(new FeaturePlanReadinessAdapter({ name: 'custom' }).connect()).toBe('custom');
});

test('FeaturePlanReadinessAdapter.connect with invalid config throws TypeError', () => {
	const adapter = new FeaturePlanReadinessAdapter(null as never);
	// throws TypeError
	expect(() => adapter.connect()).toThrow(TypeError);
});

function readinessPlan() {
	return {
		feature: 'sample-feature',
		sourceCommit: 'a'.repeat(40),
		revision: 1,
		goal: 'Review pages.',
		tldr: 'Validate every design option.',
		digest: 'b'.repeat(64),
		changes: [],
		tasks: [],
		pages: ['page.first', 'page.second'].map((module, page) => ({
			module,
			selected: `option-${page}-0`,
			options: [0, 1].map((option) => ({
				id: `option-${page}-${option}`,
				version: `v${page + 1}`,
				commit: String(page + option + 1).repeat(40),
				path: `design/${page}-${option}.png`,
				sha256: String(page + option + 1).repeat(64),
				preferred: option === 0
			}))
		}))
	};
}

function readinessFixture() {
	const plan = readinessPlan();
	const dependencies = {
		git: { run: vi.fn().mockResolvedValue(plan.sourceCommit) },
		planning: { readImage: vi.fn().mockResolvedValue({}) },
		requireMetadata: vi.fn().mockResolvedValue({
			commit: plan.sourceCommit,
			registry: { available: true, units: [] },
			relationships: {},
			references: []
		}),
		coverage: {
			validate: vi.fn().mockReturnValue({
				valid: true,
				affectedPages: [],
				missingPages: [],
				errors: []
			})
		},
		validator: {
			validate: vi.fn((input, options) => new FeaturePlanValidator().validate(input, options))
		}
	};
	return {
		plan,
		dependencies,
		adapter: new FeaturePlanReadinessAdapter('/synthetic', dependencies)
	};
}

async function assertValidReadiness() {
	const { plan, dependencies, adapter } = readinessFixture();
	const before = structuredClone(plan);
	await expect(adapter.verify(plan)).resolves.toBeUndefined();
	expect(dependencies.validator.validate).toHaveBeenCalledWith(plan, { requireSelection: true });
	expect(dependencies.git.run.mock.calls).toEqual([
		[['rev-parse', 'HEAD']],
		[['rev-parse', 'HEAD']]
	]);
	expect(dependencies.requireMetadata).toHaveBeenCalledExactlyOnceWith(
		'/synthetic',
		plan.sourceCommit
	);
	expect(dependencies.coverage.validate).toHaveBeenCalledExactlyOnceWith(
		plan,
		await dependencies.requireMetadata.mock.results[0].value
	);
	expect(dependencies.coverage.validate.mock.invocationCallOrder[0]).toBeGreaterThan(
		dependencies.requireMetadata.mock.invocationCallOrder[0]
	);
	expect(dependencies.coverage.validate.mock.invocationCallOrder[0]).toBeLessThan(
		dependencies.planning.readImage.mock.invocationCallOrder[0]
	);
	expect(dependencies.planning.readImage.mock.calls).toEqual(
		plan.pages.flatMap((page) =>
			page.options.map((option) => [
				{
					unitId: page.module,
					version: option.version,
					file: option.path,
					revision: option.commit,
					sha256: option.sha256,
					option: option.id
				}
			])
		)
	);
	expect(plan).toEqual(before);
}

async function assertInvalidSelections() {
	for (const selected of [undefined, 'missing-option']) {
		const { plan, dependencies, adapter } = readinessFixture();
		const invalid = { ...plan, pages: [{ ...plan.pages[0], selected }, plan.pages[1]] };
		const before = structuredClone(invalid);
		await expect(adapter.verify(invalid)).rejects.toThrow();
		expect(dependencies.validator.validate).toHaveBeenCalledWith(invalid, {
			requireSelection: true
		});
		expect(dependencies.requireMetadata).not.toHaveBeenCalled();
		expect(dependencies.planning.readImage).not.toHaveBeenCalled();
		expect(invalid).toEqual(before);
	}
}

async function assertSourceAndMetadataGates() {
	for (const gate of ['stale', 'git', 'metadata', 'changed-during-read'] as const) {
		const { plan, dependencies, adapter } = readinessFixture();
		const before = structuredClone(plan);
		const failure = new Error(`synthetic ${gate} failure`);
		if (gate === 'stale') dependencies.git.run.mockResolvedValue('c'.repeat(40));
		if (gate === 'git') dependencies.git.run.mockRejectedValue(failure);
		if (gate === 'metadata') dependencies.requireMetadata.mockRejectedValue(failure);
		if (gate === 'changed-during-read')
			dependencies.git.run
				.mockResolvedValueOnce(plan.sourceCommit)
				.mockResolvedValue('c'.repeat(40));
		if (gate === 'git' || gate === 'metadata')
			await expect(adapter.verify(plan)).rejects.toBe(failure);
		else await expect(adapter.verify(plan)).rejects.toThrow();
		if (gate !== 'changed-during-read')
			expect(dependencies.planning.readImage).not.toHaveBeenCalled();
		if (gate === 'stale' || gate === 'git')
			expect(dependencies.requireMetadata).not.toHaveBeenCalled();
		expect(plan).toEqual(before);
	}
}

async function assertArtifactFailures() {
	for (const message of [
		'missing image',
		'wrong option',
		'invalid PNG',
		'hash mismatch',
		'API failure'
	]) {
		const { plan, dependencies, adapter } = readinessFixture();
		const before = structuredClone(plan);
		const failure = new Error(message);
		dependencies.planning.readImage.mockResolvedValueOnce({}).mockRejectedValueOnce(failure);
		await expect(adapter.verify(plan)).rejects.toBe(failure);
		expect(dependencies.planning.readImage).toHaveBeenCalledTimes(2);
		expect(plan).toEqual(before);
	}
}

async function assertCoverageFailures() {
	for (const errors of [
		['Missing affected page design: page.checkout', 'Missing affected page design: page.account'],
		['Unresolved graph reference: src/dynamic.ts'],
		['Invalid committed module metadata: registry unavailable']
	]) {
		const { plan, dependencies, adapter } = readinessFixture();
		dependencies.coverage.validate.mockReturnValue({
			valid: false,
			affectedPages: [],
			missingPages: [],
			errors
		});
		const failure = await adapter.verify(plan).then(
			() => null,
			(error: unknown) => error
		);
		expect(failure).toBeInstanceOf(Error);
		for (const detail of errors) expect((failure as Error).message).toContain(detail);
		expect(dependencies.coverage.validate).toHaveBeenCalledExactlyOnceWith(
			plan,
			await dependencies.requireMetadata.mock.results[0].value
		);
		expect(dependencies.planning.readImage).not.toHaveBeenCalled();
	}
}

test('FeaturePlanReadinessAdapter.verify requires committed source and every selected design binding', async () => {
	await assertCoverageFailures();
	await assertValidReadiness();
	await assertInvalidSelections();
	await assertSourceAndMetadataGates();
	await assertArtifactFailures();
});
