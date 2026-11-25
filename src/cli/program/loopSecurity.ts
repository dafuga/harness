// @harness-uid u_bupajbnjit
import { resolve } from 'node:path';
import { InvalidArgumentError, type Command } from 'commander';
import { GitAdapter } from '../../adapters/git-source-history/GitAdapter';
import { initSecurityReview } from '../../workflows/development-tooling/sibling-bug-sweep/initSecurityReview';
import { prepareSecurityRepair } from '../../workflows/development-tooling/sibling-bug-sweep/prepareSecurityRepair';
import { scanSecurityClass } from '../../workflows/development-tooling/sibling-bug-sweep/scanSecurityClass';
import { SecurityReviewBudget } from '../../workflows/development-tooling/sibling-bug-sweep/securityReviewBudget';
import { maxSecurityCandidates } from '../../workflows/development-tooling/sibling-bug-sweep/securityReviewSchemas';
import { revalidateSecurityScan } from '../../workflows/development-tooling/sibling-bug-sweep/securityReviewer';
import type { SecurityReviewer } from '../../workflows/development-tooling/sibling-bug-sweep/securityReviewer.types';
import type {
	SecurityReviewFlags,
	SecurityRunFlags,
	SecurityScanFlags
} from './loopSecurity.types';

export function registerLoopSecurityCommands(parent: Command): void {
	const security = parent
		.command('security')
		.description('Review committed code for security control gaps.');
	security
		.command('init')
		.description('Create a starter attack-surface description and security bug class list.')
		.option('--project <path>', 'Repository to initialize.')
		.action(async (flags: { project?: string }) =>
			emit(await initSecurityReview(await securityRoot(flags.project)))
		);
	addBudgetOptions(security.command('scan <class>'))
		.description('Run a read-only sibling sweep using a committed security bug class.')
		.option('--commit <revision>', 'Committed source snapshot to scan.', 'HEAD')
		.option(
			'--review-limit <count>',
			'Maximum candidates included for revalidation.',
			parseReviewLimit,
			48
		)
		.action(scan);
	addBudgetOptions(security.command('revalidate <scan>'))
		.description('Recheck leads from a pinned security scan before preparing any repair.')
		.option('--decisions <file>', 'JSON decisions from a separate manual review.')
		.option('--reviewer <executable>', 'Absolute path to an operator-approved reviewer executable.')
		.option(
			'--reviewer-max-usd <usd>',
			'Verified maximum charge per reviewer invocation.',
			parseUsd
		)
		.action(revalidate);
	addBudgetOptions(security.command('prepare-repair <review> <finding>'))
		.description('Start one Harness red/green loop for a confirmed finding at HEAD.')
		.action(prepare);
}

async function scan(classId: string, flags: SecurityScanFlags) {
	const report = await withBudget(
		flags,
		async (root, budget) =>
			(
				await scanSecurityClass(
					{
						root,
						revision: flags.commit,
						classId,
						limit: flags.reviewLimit
					},
					budget
				)
			).report
	);
	emit(report);
	if (report.skipped.length) process.exitCode = 1;
}

async function revalidate(path: string, flags: SecurityReviewFlags) {
	const reviewer = reviewMethod(flags);
	const report = await withBudget(flags, (root, budget) =>
		revalidateSecurityScan(root, resolve(path), reviewer, budget)
	);
	emit(report);
	if (report.stopReason || report.findings.some(({ verdict }) => verdict === 'not-reviewed'))
		process.exitCode = 1;
}

async function prepare(path: string, finding: string, flags: SecurityRunFlags) {
	emit(
		await withBudget(flags, (root, budget) =>
			prepareSecurityRepair(root, resolve(path), finding, budget)
		)
	);
}

function reviewMethod(flags: SecurityReviewFlags): SecurityReviewer {
	if (flags.decisions && !flags.reviewer && flags.reviewerMaxUsd === undefined)
		return { kind: 'manual', decisionsPath: resolve(flags.decisions) };
	if (flags.reviewer && !flags.decisions && flags.reviewerMaxUsd && flags.maxCostUsd > 0)
		return { kind: 'external', executable: flags.reviewer, maximumMicrousd: flags.reviewerMaxUsd };
	throw new Error(
		'Use --decisions, or supply --reviewer with a verified --reviewer-max-usd and a positive --max-cost-usd.'
	);
}

function addBudgetOptions(command: Command) {
	return command
		.option('--project <path>', 'Repository to review, defaulting to the current project.')
		.option(
			'--max-duration-ms <ms>',
			'Deadline for this run in milliseconds.',
			parseDuration,
			120_000
		)
		.option('--max-cost-usd <usd>', 'Maximum dollars reserved for this run.', parseUsd, 0);
}

async function withBudget<T>(
	flags: SecurityRunFlags,
	action: (root: string, budget: SecurityReviewBudget) => Promise<T>
): Promise<T> {
	const budget = new SecurityReviewBudget({
		maxDurationMs: flags.maxDurationMs,
		maxCostMicrousd: flags.maxCostUsd
	});
	try {
		const root = await securityRoot(flags.project, budget.signal);
		return await action(root, budget);
	} catch (error) {
		budget.checkTime();
		throw error;
	}
}

function securityRoot(project?: string, signal?: AbortSignal) {
	return new GitAdapter(resolve(project ?? process.cwd())).run(['rev-parse', '--show-toplevel'], {
		signal
	});
}

function parseUsd(value: string) {
	if (!/^\d+(?:\.\d{1,6})?$/.test(value))
		throw new InvalidArgumentError('Use a nonnegative USD amount with up to six decimal places.');
	const [dollars, fraction = ''] = value.split('.');
	const amount = Number(dollars) * 1_000_000 + Number(fraction.padEnd(6, '0'));
	if (!Number.isSafeInteger(amount)) throw new InvalidArgumentError('USD amount is out of range.');
	return amount;
}

function parseDuration(value: string) {
	return parsePositiveInteger(value, 2_147_483_647);
}

function parseReviewLimit(value: string) {
	return parsePositiveInteger(value, maxSecurityCandidates);
}

function parsePositiveInteger(value: string, max: number) {
	const count = Number(value);
	if (!/^\d+$/.test(value) || count < 1 || count > max)
		throw new InvalidArgumentError(`Use a whole number from 1 through ${max}.`);
	return count;
}

function emit(result: unknown) {
	console.log(JSON.stringify(result, null, 2));
}
