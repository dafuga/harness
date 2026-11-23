// @harness-uid u_dakcgp2ade
export const codexStartupMenus = [
	{
		cli: 'codex',
		kind: 'resume picker',
		patterns: [
			/^\s*(?:Resume a previous session|Resume session|Select a session to resume)\s*$/im,
			/enter (?:to )?(?:resume|select|continue)|esc (?:to )?(?:back|cancel)/i
		]
	},
	{
		cli: 'codex',
		kind: 'working-directory picker',
		patterns: [
			/^\s*(?:Choose (?:a|the|your) working directory|Select (?:a|the) working directory|Working directory)\s*[:?]?\s*$/im,
			/enter (?:to )?(?:select|continue|confirm)|esc (?:to )?back/i
		]
	},
	{
		cli: 'codex',
		kind: 'agent command center',
		patterns: [
			/^\s*Agent Command Center\s*$/im,
			/enter (?:to )?(?:open|select|continue)|(?:New|Resume) session/i
		]
	}
] as const;
