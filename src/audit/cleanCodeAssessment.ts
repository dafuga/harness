import { cleanCodePrinciples } from './cleanCodeRubric';
import type {
	FileReview,
	JevEvaluation,
	PrincipleAssessment,
	ReviewStatus
} from './cleanCodeTypes';

export function assessCleanCode(
	result: JevEvaluation,
	minConfidence: number
): PrincipleAssessment[] {
	return cleanCodePrinciples.map((principle) => {
		const answer = result.answers[principle.id];
		let status: PrincipleAssessment['status'] = 'needs-review';
		if (answer.confidence >= minConfidence && answer.choice !== 'insufficient_context') {
			status =
				answer.choice === 'not_applicable'
					? 'not-applicable'
					: (answer.choice as 'meets' | 'violates');
		}
		return {
			...answer,
			principle: principle.id,
			title: principle.title,
			guidance: principle.guidance,
			status
		};
	});
}

export function fileReviewStatus(assessments: PrincipleAssessment[]): ReviewStatus {
	if (assessments.some((item) => item.status === 'violates')) return 'violations';
	if (assessments.some((item) => item.status === 'needs-review')) return 'needs-review';
	return 'clean';
}

export function reportReviewStatus(files: FileReview[]): ReviewStatus | 'not-applicable' {
	if (files.length === 0) return 'not-applicable';
	if (files.some((file) => file.status === 'incomplete')) return 'incomplete';
	if (files.some((file) => file.status === 'violations')) return 'violations';
	if (files.some((file) => file.status === 'needs-review')) return 'needs-review';
	return 'clean';
}
