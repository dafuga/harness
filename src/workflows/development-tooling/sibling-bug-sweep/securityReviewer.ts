// @harness-uid u_wwerrde2nk
import { fail } from '../../../core/development-tooling/errors';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { redactSource } from '../../../utils/development-tooling/sibling-bug-sweep/reviewCandidates';
import { runLoopEvaluatorProcess } from '../../../utils/execution-runtimes/runLoopEvaluatorProcess';
import type { CandidateContext } from '../../../utils/development-tooling/sibling-bug-sweep/scanCandidates.types';
import type { BugClass } from '../../../core/development-tooling/bug-class/bugClassSchemas.types';
import { scanSecurityClass } from './scanSecurityClass';
import {
	securityDecisionSchema,
	securityDecisionsSchema,
	securityScanSchema
} from './securityReviewSchemas';
import type { SecurityReviewBudget } from './securityReviewBudget';
import type { SecurityDecision, SecurityReviewReport } from './securityReviewSchemas.types';
import type { SecurityReviewer } from './securityReviewer.types';

export async function revalidateSecurityScan(
	root: string,
	scanFile: string,
	reviewer: SecurityReviewer,
	budget: SecurityReviewBudget
): Promise<SecurityReviewReport> {
	const scan = securityScanSchema.parse(await readSecurityJson(scanFile, budget.signal));
	const pinned = await scanSecurityClass({ root, ...scan }, budget);
	assertSameScan(scan, pinned.report);
	const review =
		reviewer.kind === 'manual'
			? { decisions: await manualDecisions(scan, reviewer.decisionsPath, budget) }
			: await externalDecisions(pinned, reviewer, budget);
	return {
		schemaVersion: 1,
		kind: 'security-revalidation',
		revision: scan.revision,
		classId: scan.classId,
		limit: scan.limit,
		reviewer: reviewer.kind,
		budget: budget.summary(),
		findings: scan.candidates.map((site) => ({
			...site,
			verdict: 'not-reviewed',
			evidence: 'No revalidation decision was recorded.',
			impact: 0,
			...review.decisions.get(site.id)
		})),
		...('stopReason' in review ? { stopReason: review.stopReason } : {})
	};
}

async function manualDecisions(
	scan: Awaited<ReturnType<typeof scanSecurityClass>>['report'],
	path: string,
	budget: SecurityReviewBudget
) {
	const input = securityDecisionsSchema.parse(await readSecurityJson(path, budget.signal));
	const rows = input.decisions;
	if (input.revision !== scan.revision || input.classId !== scan.classId)
		fail('Revalidation decisions must name the exact scanned revision and class.');
	const ids = new Set(scan.candidates.map(({ id }) => id));
	const decisions = new Map(
		rows.map((row) => [row.id, { ...row, evidence: redactSource(row.evidence) }])
	);
	if (decisions.size !== rows.length || rows.some(({ id }) => !ids.has(id)))
		fail('Revalidation decisions must have unique IDs from the pinned scan.');
	budget.checkTime();
	return decisions;
}

async function externalDecisions(
	pinned: Awaited<ReturnType<typeof scanSecurityClass>>,
	reviewer: Extract<SecurityReviewer, { kind: 'external' }>,
	budget: SecurityReviewBudget
): Promise<{
	decisions: Map<string, SecurityDecision>;
	stopReason?: SecurityReviewReport['stopReason'];
}> {
	if (!isAbsolute(reviewer.executable))
		fail('Provide the absolute path to a trusted reviewer executable.');
	const decisions = new Map<string, SecurityDecision>();
	const dir = await mkdtemp(join(tmpdir(), 'harness-security-review-'));
	try {
		for (const site of pinned.contexts) {
			try {
				if (!budget.reserve(reviewer.maximumMicrousd)) return { decisions, stopReason: 'cost-cap' };
				const decision = await requestDecision(dir, reviewer, budget, {
					revision: pinned.report.revision,
					attackSurface: redactSource(pinned.attackSurface),
					bugClass: pinned.bugClass,
					site: { ...site, source: redactSource(site.source) }
				});
				budget.checkTime();
				decisions.set(site.id, decision);
			} catch {
				return { decisions, stopReason: budget.timeExpired() ? 'time-cap' : 'reviewer-error' };
			}
		}
		return { decisions };
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
}

async function requestDecision(
	dir: string,
	reviewer: Extract<SecurityReviewer, { kind: 'external' }>,
	budget: SecurityReviewBudget,
	context: { site: CandidateContext; revision: string; attackSurface: string; bugClass: BugClass }
) {
	const result = await runLoopEvaluatorProcess(
		dir,
		[reviewer.executable],
		{
			signal: budget.signal,
			maxBuffer: 16_000,
			input: JSON.stringify({
				schemaVersion: 1,
				maximumMicrousd: reviewer.maximumMicrousd,
				task: 'Independently revalidate this defensive code-review lead. Use only the committed excerpts as evidence. Look for existing controls and safe data before confirming. Mark uncertainty as unconfirmed. Describe the defensive invariant and omit secrets, payloads and exploitation steps.',
				...context
			})
		},
		'Security review'
	);
	if (result.code !== 0) fail('Reviewer process failed.');
	const decision = securityDecisionSchema.parse(JSON.parse(result.stdout.toString('utf8')));
	if (decision.id !== context.site.id) fail('Verdict does not match the reviewed site.');
	return { ...decision, evidence: redactSource(decision.evidence) };
}

function assertSameScan(
	recorded: ReturnType<typeof securityScanSchema.parse>,
	current: typeof recorded
) {
	if (!isDeepStrictEqual({ ...recorded, budget: current.budget }, current))
		fail('The scan report does not match the committed security candidates.');
}

export async function readSecurityJson(path: string, signal?: AbortSignal): Promise<unknown> {
	const text = await readFile(path, { encoding: 'utf8', signal });
	if (Buffer.byteLength(text) > 8_000_000) fail('Security review JSON exceeds 8 MB.');
	return JSON.parse(text);
}
