export function pairedTrackerData(name: string) {
	const item = {
		id: 'example01',
		title: 'Fixture planning item',
		project: 'fixture',
		status: 'open',
		updatedAt: null,
		dueAt: null,
		stage: 'detail'
	};
	if (name === 'tracker_status') return { needsYou: [item], recent: [], unresolvedFlags: 1 };
	if (name === 'tracker_show')
		return {
			item,
			notes: [],
			flag: null,
			runs: [],
			planning: {
				artifacts: {
					detail: {
						summary: 'Two main pages',
						links: [
							{ label: 'Main page design', url: 'https://example.test/design.png', kind: 'image' }
						]
					}
				},
				promotions: [{ stage: 'detail', by: 'Fixture Planner', at: '2026-11-24T12:00:00.000Z' }]
			}
		};
	return {};
}
