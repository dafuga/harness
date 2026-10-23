export interface FirstTry {
	checks: number;
	firstTry: { numerator: number; denominator: number; rate: number | null };
	tasks: Array<{ task: string; agentModel: string; firstPassed: boolean; report?: string }>;
}

export interface Assessments {
	response: FirstTry;
	cleanCode: FirstTry;
}

export interface Models {
	models: {
		authors: Record<string, number>;
		evaluators: Record<string, number>;
		firstTryByAuthor: Record<string, Assessments>;
	};
}
