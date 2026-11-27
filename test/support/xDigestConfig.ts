export function digestConfig() {
	return {
		profile: 'x',
		viewer: { url: 'http://viewer.example:6080', port: 6080, hosts: ['viewer.example'] },
		tracker: { item: '2071a87v4c', command: 'tracker' }
	};
}

export function senderConfig() {
	return {
		source: { host: 'collector', directory: '.local/share/harness-x-digest/out' },
		slack: {
			installation: {
				installationId: 'x-digest',
				project: 'harness',
				environment: 'local',
				workspaceId: 'T1',
				botId: 'B1',
				botUserId: 'U1'
			},
			channel: 'D1',
			secret: { project: 'some-project', name: 'bot-token' }
		},
		tracker: { item: '2071a87v4c', command: 'tracker' }
	};
}
