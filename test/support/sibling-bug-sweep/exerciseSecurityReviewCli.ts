import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect } from 'vitest';
import type {
	SecurityScanReport,
	SecurityReviewReport
} from '../../../src/workflows/development-tooling/sibling-bug-sweep/securityReviewSchemas.types';
import { runHarness } from '../cli';
import { withTempRepo } from '../temporary';
import type { TemporaryRepo } from '../temporary.types';

const classId = 'sensitive-data-in-logs';
const reviewCommand = ['loop', 'security'];
const scanPath = 'scan.json';
const reviewPath = 'review.json';

export async function exerciseSecurityReviewCli() {
	await withTempRepo(async (repo) => {
		const guide = await runHarness(['info', 'loop'], repo.root);
		expect(guide.stdout).toContain('loop security init');
		const scan = await takeScan(repo);
		const review = await revalidateManually(repo, scan);
		await expectRepairGate(repo, review);
		await expectReviewerCaps(repo);
	});
}

async function takeScan(repo: TemporaryRepo): Promise<SecurityScanReport> {
	await runHarness([...reviewCommand, 'init'], repo.root);
	const description = join(repo.root, 'specification/security/attack-surface.md');
	expect(await readFile(description, 'utf8')).toContain('Trust boundaries and controls');
	await writeFile(description, '# Fixture data classifications\n');
	const second = await runHarness([...reviewCommand, 'init'], repo.root);
	expect(JSON.parse(second.stdout)).toMatchObject({
		attackSurface: { created: false },
		bugClasses: { created: false }
	});
	expect(await readFile(description, 'utf8')).toBe('# Fixture data classifications\n');
	await mkdir(join(repo.root, 'src'));
	await writeFile(join(repo.root, 'src/public.ts'), 'console.log("public fixture message");\n');
	await writeFile(
		join(repo.root, 'src/restricted.ts'),
		'console.log("restricted fixture message");\n'
	);
	repo.git('add', 'src', 'specification');
	repo.git('commit', '-qm', 'feat: add synthetic security review fixture');
	const registry = join(repo.root, 'specification/security/bug-classes.json');
	await writeFile(registry, '{draft registry}');
	const result = await runHarness([...reviewCommand, 'scan', classId], repo.root);
	expect(result.stdout).not.toContain('restricted fixture message');
	const scan = JSON.parse(result.stdout);
	expect(scan).toMatchObject({
		kind: 'security-scan',
		revision: repo.git('rev-parse', 'HEAD'),
		classId,
		totalCandidates: 2,
		candidates: [{ path: 'src/public.ts' }, { path: 'src/restricted.ts' }],
		budget: { reservedMicrousd: 0 }
	});
	await writeFile(join(repo.root, scanPath), result.stdout);
	const timeout = await runHarness(
		[...reviewCommand, 'scan', classId, '--max-duration-ms', '1'],
		repo.root,
		false
	);
	expect(timeout.stderr).toContain('Security review time cap reached.');
	return scan;
}

async function revalidateManually(
	repo: TemporaryRepo,
	scan: SecurityScanReport
): Promise<SecurityReviewReport> {
	const decisionsPath = join(repo.root, 'decisions.json');
	const decisions = scan.candidates.map((site) => ({
		id: site.id,
		impact: 1,
		verdict: site.path === 'src/public.ts' ? 'dismissed' : 'confirmed',
		evidence:
			site.path === 'src/public.ts'
				? 'The value is the public message declared in the fixture.'
				: 'The fixture diagnostic should emit only public fields.'
	}));
	const args = [...reviewCommand, 'revalidate', scanPath, '--decisions', decisionsPath];
	await writeFile(decisionsPath, JSON.stringify({ revision: '0'.repeat(40), classId, decisions }));
	const stale = await runHarness(args, repo.root, false);
	expect(stale.stderr).toContain('must name the exact scanned revision and class');
	await writeFile(decisionsPath, JSON.stringify({ revision: scan.revision, classId, decisions }));
	const result = await runHarness(args, repo.root);
	const review: SecurityReviewReport = JSON.parse(result.stdout);
	expect(review).toMatchObject({
		revision: scan.revision,
		reviewer: 'manual',
		budget: { reservedMicrousd: 0 },
		findings: decisions
	});
	await writeFile(join(repo.root, reviewPath), result.stdout);
	return review;
}

async function expectRepairGate(repo: TemporaryRepo, review: SecurityReviewReport) {
	const [dismissed, confirmed] = review.findings;
	const args = [...reviewCommand, 'prepare-repair', reviewPath];
	const rejected = await runHarness([...args, dismissed.id], repo.root, false);
	expect(rejected.stderr).toContain('uniquely confirmed');
	const result = await runHarness([...args, confirmed.id], repo.root);
	const { state } = JSON.parse(result.stdout);
	expect(state).toMatchObject({
		name: `security-${classId}-${confirmed.id}`,
		templateLineage: ['bug-fix'],
		steps: ['spec', 'coverage', 'red', 'implement', 'green', 'siblings', 'verify'].map((id) => ({
			id,
			status: 'pending'
		}))
	});
	const twice = await runHarness([...args, confirmed.id], repo.root, false);
	expect(twice.stderr).toContain('already exists');
	await assertRedProofRequired(repo.root, state.name);
	repo.git('commit', '--allow-empty', '-qm', 'chore: advance the fixture revision');
	const stale = await runHarness([...args, confirmed.id], repo.root, false);
	expect(stale.stderr).toContain('The finding is stale.');
}

async function assertRedProofRequired(root: string, name: string) {
	await runHarness(
		['loop', 'complete', name, 'spec', '--evidence', 'Review the fixture policy.'],
		root
	);
	await runHarness(
		['loop', 'complete', name, 'coverage', '--evidence', 'Add a policy assertion.'],
		root
	);
	const skipped = await runHarness(
		['loop', 'complete', name, 'red', '--evidence', 'Unrecorded assertion'],
		root,
		false
	);
	expect(skipped.stderr).toContain('loop record');
}

async function expectReviewerCaps(repo: TemporaryRepo) {
	const script = join(repo.root, 'reviewer');
	const log = join(repo.root, 'reviewer.log');
	const env = {
		HARNESS_RESOURCES_HOME: join(repo.root, 'resources'),
		HARNESS_RESOURCE_LEASE: ''
	};
	await writeFile(
		script,
		[
			'#!/usr/bin/env bun',
			'import { appendFile } from "node:fs/promises";',
			'const { attackSurface, maximumMicrousd, site } = await Bun.stdin.json();',
			'if (attackSurface !== "# Fixture data classifications\\n" || maximumMicrousd !== 1000) process.exit(2);',
			`await appendFile(${JSON.stringify(log)}, site.id + "\\n");`,
			'console.log(JSON.stringify({ id: site.id, impact: 0, verdict: "dismissed", evidence: "The fixture is public." }));'
		].join('\n'),
		{ mode: 0o755 }
	);
	const args = [
		...reviewCommand,
		'revalidate',
		scanPath,
		'--reviewer',
		script,
		'--reviewer-max-usd',
		'0.001'
	];
	const result = await runHarness([...args, '--max-cost-usd', '0.001'], repo.root, false, env);
	expect(result.exitCode).toBe(1);
	expect(JSON.parse(result.stdout)).toMatchObject({
		budget: { maxCostMicrousd: 1000, reservedMicrousd: 1000 },
		stopReason: 'cost-cap',
		findings: [{ verdict: 'dismissed' }, { verdict: 'not-reviewed' }]
	});
	expect((await readFile(log, 'utf8')).trim().split('\n')).toHaveLength(1);
	const complete = await runHarness([...args, '--max-cost-usd', '0.002'], repo.root, true, env);
	expect(JSON.parse(complete.stdout)).toMatchObject({
		budget: { reservedMicrousd: 2000 },
		findings: [{ verdict: 'dismissed' }, { verdict: 'dismissed' }]
	});
	await writeFile(script, '#!/usr/bin/env bun\nawait Bun.sleep(15_000);\n');
	const expired = await runHarness(
		[...args, '--max-cost-usd', '0.002', '--max-duration-ms', '2000'],
		repo.root,
		false,
		env
	);
	expect(JSON.parse(expired.stdout)).toMatchObject({
		budget: { reservedMicrousd: 1000 },
		stopReason: 'time-cap',
		findings: [{ verdict: 'not-reviewed' }, { verdict: 'not-reviewed' }]
	});
}
