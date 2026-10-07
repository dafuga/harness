import type { JevChoice, JevEvaluation, JevQuestions } from '../core/jevTypes';
import { probabilityValue, recordValue, tokenCount } from './cleanCodeValue';

export class JevResponseValidator {
	validate(input: unknown, questions: JevQuestions): JevEvaluation {
		const raw = recordValue(input);
		if (typeof raw.model !== 'string' || !/^jev-[a-zA-Z0-9.-]+$/.test(raw.model))
			throw new Error('Invalid Jev model');
		const answers = recordValue(raw.answers);
		if (Object.keys(answers).length !== Object.keys(questions).length)
			throw new Error('Missing Jev answers');
		const usage = recordValue(raw.usage);
		return {
			model: raw.model,
			answers: Object.fromEntries(
				Object.entries(questions).map(([key, question]) => [
					key,
					parseChoice(answers[key], Object.keys(question.criteria))
				])
			),
			usage: {
				input_tokens: tokenCount(usage.input_tokens),
				output_tokens: tokenCount(usage.output_tokens)
			}
		};
	}
}

function parseChoice(value: unknown, options: string[]): JevChoice {
	const raw = recordValue(value);
	if (raw.type !== 'choice' || typeof raw.choice !== 'string' || !options.includes(raw.choice))
		throw new Error('Invalid Jev choice');
	const probabilities = recordValue(raw.probabilities);
	if (Object.keys(probabilities).length !== options.length) throw new Error('Invalid Jev options');
	const parsed = Object.fromEntries(
		options.map((key) => [key, probabilityValue(probabilities[key])])
	);
	if (Math.abs(Object.values(parsed).reduce((total, item) => total + item, 0) - 1) > 0.01)
		throw new Error('Invalid Jev distribution');
	if (parsed[raw.choice] < Math.max(...Object.values(parsed)))
		throw new Error('Inconsistent Jev choice');
	return {
		type: 'choice',
		choice: raw.choice,
		confidence: probabilityValue(raw.confidence),
		probabilities: parsed
	};
}
