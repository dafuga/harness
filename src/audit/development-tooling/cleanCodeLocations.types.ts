import type { JevQuestions } from './cleanCodeTypes';
import type { ReviewLocation } from './cleanCodeTypes';

export interface LocationPlan {
	questions: JevQuestions;
	spans: Record<string, ReviewLocation>;
}
