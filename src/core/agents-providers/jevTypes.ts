import type { ChoiceQuestion } from '@typesafe-ai/sdk';

export interface JevChoice {
	type: 'choice';
	choice: string;
	confidence: number;
	probabilities: Record<string, number>;
}

export interface JevUsage {
	input_tokens: number;
	output_tokens: number;
}

export type JevQuestions = Record<string, ChoiceQuestion>;

export interface JevRequest {
	state: string;
	questions: JevQuestions;
}

export interface JevEvaluation {
	model: string;
	answers: Record<string, JevChoice>;
	usage: JevUsage;
}
