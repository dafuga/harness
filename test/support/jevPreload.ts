interface MockRequest {
	model: string;
	questions: Record<string, { criteria: Record<string, unknown> }>;
}

globalThis.fetch = Object.assign(
	async (_url: URL | RequestInfo, init?: RequestInit): Promise<Response> => {
		const scenario = process.env.TEST_JEV_SCENARIO ?? 'meets';
		if (scenario === 'offline-only') throw new Error('Unexpected API call');
		if (scenario === 'unauthorized')
			return Response.json({ error: 'synthetic-test-key' }, { status: 401 });
		const request = JSON.parse(String(init?.body)) as MockRequest;
		const answers = Object.fromEntries(
			Object.entries(request.questions).map(([id, question]) => {
				const choices = Object.keys(question.criteria);
				const choice = mockChoice(choices, scenario);
				return [
					id,
					{
						type: 'choice',
						choice,
						confidence: scenario === 'uncertain' ? 0.3 : 0.97,
						probabilities: Object.fromEntries(
							choices.map((option) => [option, option === choice ? 1 : 0])
						)
					}
				];
			})
		);
		return Response.json({
			model: request.model,
			answers,
			usage: { input_tokens: 100, output_tokens: 20 }
		});
	},
	{ preconnect() {} }
);

function mockChoice(choices: string[], scenario: string): string {
	if (!choices.includes('meets')) return choices[0];
	if (scenario === 'violates' || scenario === 'uncertain') return 'violates';
	return 'meets';
}
