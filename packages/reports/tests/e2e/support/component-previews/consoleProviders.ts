/** A local provider catalog for the console preview; no provider requests are sent. */
export const consoleProviders = [
	{
		id: 'codex',
		label: 'Codex',
		available: true,
		reason: null,
		version: 'fixture',
		imageGeneration: true,
		models: [
			{
				id: 'gpt-6.1',
				label: 'GPT 6.1',
				efforts: ['medium', 'high'],
				defaultEffort: 'high',
				isDefault: true
			},
			{
				id: 'gpt-6.1-terra',
				label: 'GPT 6.1 Terra',
				efforts: ['medium', 'high'],
				defaultEffort: 'high',
				isDefault: false
			}
		]
	}
];
