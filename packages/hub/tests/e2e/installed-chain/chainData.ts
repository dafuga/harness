import type { ChainTracker } from './chainTracker.types';

/** Made-up asks, one per path, flagged as `tracker flag --option` flags them. */
export const asks = {
	tap: { id: 'chaintap', agent: 'harbor', question: 'Release the harbor build?' },
	other: { id: 'chainother', agent: 'orchard', question: 'When should orchard ship?' },
	spec: { id: 'chainspec', agent: 'notes', question: 'Approve the notes service spec?' }
};
export const note = { id: 'chaincos', session: 'Chief of Staff', text: 'Check the harbor build.' };
export const spec = { title: 'notes-service.md', heading: 'Notes service' };

const options = {
	tap: ['Release the build', 'Hold the release'],
	other: ['Ship today', 'Ship next week'],
	spec: ['Approve the spec', 'Ask for changes']
};
const markdown = `# ${spec.heading}\n\n| Part | Owner |\n| --- | --- |\n| API | Service |\n`;

export async function seed(tracker: ChainTracker) {
	tracker.add(note.id, { title: 'Run the day', agent: 'cos' });
	for (const key of ['tap', 'other', 'spec'] as const) {
		const { id, agent, question } = asks[key];
		tracker.add(id, { title: question, agent });
		await tracker.post(`/items/${id}/flag`, {
			question,
			options: options[key].map((label, index) => ({
				label,
				effect: 'Made-up effect.',
				...(index === 0 && { recommended: true })
			})),
			...(key === 'spec' && {
				attachments: [{ kind: 'spec', title: spec.title, pr: 7, markdown }]
			})
		});
	}
}
