import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { gameGuide } from '../../src/guides/game-authoring/game';

const safetyRules = (rules: string[]): string[] =>
	rules.filter((rule) => rule.includes('AI rendering') || rule.includes('HARNESS_GAME_DECART_API_KEY'));

test('Describes the game authoring guide', () => {
	const output = {
		topic: gameGuide.topic,
		summary: gameGuide.summary,
		stepCount: gameGuide.steps.length,
		ruleCount: gameGuide.rules.length,
		antiPatternCount: gameGuide.antiPatterns.length,
		exampleCommands: gameGuide.exampleCommands
	};

	expect(output.topic).toBe('game');
	expect(output.stepCount).toBe(4);
	expect(output.ruleCount).toBe(6);
	expect(output.antiPatternCount).toBe(2);
	expect(output.exampleCommands).toContain('harness new game adventure --dimension 3d');

	recordExampleCases(
		{
			unitId: 'guide.game',
			symbol: 'gameGuide',
			state: 'describes-the-game-authoring-guide',
			evidence: 'examples-cases',
			file: 'describes-the-game-authoring-guide.json'
		},
		[{ name: 'topic, counts and example commands', input: 'gameGuide', output }]
	);
});

test('Keeps AI rendering opt-in and API keys out of the project', () => {
	const output = safetyRules(gameGuide.rules);

	expect(output).toContain('AI rendering is off by default; keep rendering experiments explicitly opt-in.');
	expect(output).toContain(
		'Set HARNESS_GAME_DECART_API_KEY in the project-owned ignored .env.local; never commit it.'
	);
	expect(gameGuide.antiPatterns).toContain('Do not use generated pixels as game state.');

	recordExampleCases(
		{
			unitId: 'guide.game',
			symbol: 'gameGuide',
			state: 'keeps-ai-rendering-opt-in-and-api-keys-out-of-the-project',
			evidence: 'examples-cases',
			file: 'keeps-ai-rendering-opt-in-and-api-keys-out-of-the-project.json'
		},
		[{ name: 'safety rules from rules list', input: 'gameGuide.rules', output }]
	);
});
