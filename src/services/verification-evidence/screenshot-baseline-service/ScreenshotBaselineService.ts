import { createHash } from 'node:crypto';
import { fail } from '../../../core/development-tooling/errors';
import { EvidenceBranchRepository } from '../../../repositories/verification-evidence/evidence-branch-repository/EvidenceBranchRepository';
import { canonicalJson } from '../../../utils/development-tooling/canonicalJson';
import { screenshotCandidate } from './screenshotCandidate';
import {
	screenshotBaselineRequestSchema,
	screenshotReviewInputSchema,
	screenshotReviewSchema
} from './baselineSchemas';
import type {
	ScreenshotBaseline,
	ScreenshotBaselineRequest,
	ScreenshotCandidate,
	ScreenshotReview,
	ScreenshotReviewBody,
	ScreenshotReviewInput
} from './ScreenshotBaselineService.types';

/** Explicit reviews retain the original screenshot and its complete tested provenance. */
export class ScreenshotBaselineService {
	private readonly evidence: EvidenceBranchRepository;

	constructor(private readonly root: string) {
		this.evidence = new EvidenceBranchRepository(root);
	}

	/** Explicitly retain a named review of one intact captured case. */
	async review(input: ScreenshotReviewInput): Promise<ScreenshotReview> {
		const requested = screenshotReviewInputSchema.parse(input);
		const candidate = await screenshotCandidate(this.root, requested);
		const body = reviewBody(requested, candidate, new Date().toISOString());
		const review = screenshotReviewSchema.parse({ ...body, id: digest(canonicalJson(body)) });
		await this.evidence.add(
			`screenshot-baselines/${review.id}`,
			[{ path: 'review.json', content: { bytes: canonicalJson(review) } }],
			`chore: retain screenshot review ${review.id.slice(0, 7)}`,
			'review.json'
		);
		return review;
	}

	/** Return only the original bytes for the exact reviewed unit, case, viewport and file. */
	async load(input: ScreenshotBaselineRequest): Promise<ScreenshotBaseline> {
		const requested = screenshotBaselineRequestSchema.parse(input);
		const tip = await this.evidence.tip();
		const bytes =
			tip &&
			(await this.evidence.tree.read(tip, `screenshot-baselines/${requested.id}/review.json`));
		if (!bytes) return fail('The screenshot review is missing from Git evidence.');
		const review = parseReview(bytes);
		const { id, ...body } = review;
		if (id !== requested.id || digest(canonicalJson(body)) !== id)
			return fail('The screenshot review does not match its identity.');
		if (
			review.unit !== requested.unit ||
			review.case !== requested.case ||
			review.viewport !== requested.viewport ||
			review.file !== requested.file
		)
			return fail('The screenshot review belongs to a different case or viewport.');
		const candidate = await screenshotCandidate(this.root, reviewInput(review));
		const refreshed = reviewBody(reviewInput(review), candidate, review.reviewedAt);
		if (canonicalJson(refreshed) !== canonicalJson(body))
			return fail('The screenshot review no longer matches its original evidence.');
		return { review, bytes: Buffer.from(candidate.bytes) };
	}
}

function parseReview(bytes: Buffer): ScreenshotReview {
	try {
		return screenshotReviewSchema.parse(JSON.parse(bytes.toString('utf8')));
	} catch {
		return fail('The screenshot review is invalid.');
	}
}

function reviewInput(review: ScreenshotReview): ScreenshotReviewInput {
	const { commit, record, unit, scenario, evidence, viewport, reviewer, reason } = review;
	return {
		commit,
		record,
		unit,
		case: review.case,
		scenario,
		evidence,
		viewport,
		reviewer,
		reason
	};
}

function reviewBody(
	input: ScreenshotReviewInput,
	candidate: ScreenshotCandidate,
	reviewedAt: string
): ScreenshotReviewBody {
	const { record, capture, contract, caseStatus } = candidate;
	return {
		...input,
		schemaVersion: 1,
		reviewedAt,
		tree: record.source.tree,
		recordStatus: record.status,
		profile: record.profile.id,
		state: contract.state,
		file: contract.file,
		testFile: contract.testFile,
		testTitle: contract.testTitle,
		caseStatus,
		captureStatus: capture.status,
		capturePath: capture.path,
		sha256: capture.sha256,
		bytes: capture.bytes,
		buildId: capture.server!.buildId
	};
}

const digest = (text: string) => createHash('sha256').update(text).digest('hex');
export type {
	ScreenshotBaseline,
	ScreenshotBaselineRequest,
	ScreenshotReview,
	ScreenshotReviewInput
} from './ScreenshotBaselineService.types';
