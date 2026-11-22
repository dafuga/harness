import type { PrincipleAssessment } from '../../src/audit/development-tooling/cleanCodeTypes';

export const sideEffects: PrincipleAssessment = {
	type: 'choice',
	choice: 'violates',
	confidence: 0.93,
	probabilities: { meets: 0.03, violates: 0.93, not_applicable: 0.02, insufficient_context: 0.02 },
	principle: 'side-effects',
	title: 'Explicit side effects',
	guidance:
		'Make side effects explicit in names and contracts; ordinary UI event handlers and command operations may mutate.',
	status: 'violates'
};

export const meaningfulNames: PrincipleAssessment = {
	type: 'choice',
	choice: 'meets',
	confidence: 0.9,
	probabilities: { meets: 0.9, violates: 0.05, not_applicable: 0.02, insufficient_context: 0.03 },
	principle: 'meaningful-names',
	title: 'Meaningful names',
	guidance:
		'Name identifiers after their domain purpose; retain conventional framework and short local names when clear.',
	status: 'meets'
};

const asyncBoundaries: PrincipleAssessment = {
	type: 'choice',
	choice: 'not_applicable',
	confidence: 0.95,
	probabilities: { meets: 0.01, violates: 0.01, not_applicable: 0.95, insufficient_context: 0.03 },
	principle: 'async-boundaries',
	title: 'Clear asynchronous behavior',
	guidance:
		'Make completion, cancellation and shared-state ownership explicit where concurrent behavior exists.',
	status: 'not-applicable'
};

export const loadAssessments = [sideEffects, meaningfulNames, asyncBoundaries];
