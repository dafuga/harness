import type { LoopTemplate } from './loopTemplates';

export const builtInTemplates: LoopTemplate[] = [
	{
		id: 'feature',
		title: 'Feature Delivery',
		summary: 'Spec, implement, test, and verify a user-facing or API feature.',
		steps: [
			{ id: 'spec', title: 'Confirm scope, success criteria, constraints, and proof.' },
			{ id: 'implement', title: 'Implement the smallest complete feature slice.' },
			{ id: 'test', title: 'Add or update focused automated coverage.' },
			{ id: 'verify', title: 'Run the relevant project verification commands.' }
		],
		evaluators: [
			{
				id: 'check',
				title: 'Run the project check script.',
				command: 'bun run check',
				step: 'verify'
			}
		]
	},
	{
		id: 'fix',
		title: 'Bug Fix',
		summary: 'Reproduce, repair, and prove a behavioral defect is fixed.',
		extends: 'feature',
		steps: [
			{ id: 'spec', title: 'Identify the failing behavior and expected replacement behavior.' },
			{ id: 'implement', title: 'Patch the defect without broad refactors.' }
		]
	},
	{
		id: 'refactor',
		title: 'Refactor',
		summary: 'Improve structure while preserving public behavior.',
		extends: 'feature',
		steps: [
			{ id: 'spec', title: 'Name the responsibility boundary and unchanged behavior.' },
			{ id: 'implement', title: 'Extract or reorganize one responsibility at a time.' }
		]
	},
	{
		id: 'visual-change',
		title: 'Visual Change',
		summary: 'Ship a UI change with automated checks and screenshot evidence.',
		extends: 'feature',
		steps: [
			{ id: 'browser-proof', title: 'Exercise the affected UI path and capture fresh evidence.' }
		],
		evaluators: [
			{
				id: 'check',
				title: 'Run the project check script.',
				command: 'bun run check',
				step: 'browser-proof'
			}
		]
	},
	{
		id: 'bug-fix',
		title: 'Regression-First Bug Fix',
		summary: 'Reproduce a bug with a failing test, repair it, and repeat until proof passes.',
		steps: [
			{ id: 'spec', title: 'Identify the failing behavior, expected behavior, and reproduction.' },
			{
				id: 'red',
				title: 'Write and run a failing regression test; record the defect assertion and command.'
			},
			{
				id: 'implement',
				title: 'Implement the smallest repair without weakening the regression test.'
			},
			{
				id: 'green',
				title:
					'Repeat repair and the same unchanged regression test until it passes; record passing proof.'
			},
			{
				id: 'verify',
				title:
					'Run relevant project checks and affected UI browser flows with fresh inspected screenshots; keep pending until proof passes.'
			}
		],
		evaluators: [
			{
				id: 'check',
				title: 'Run the project check script.',
				command: 'bun run check',
				step: 'verify'
			}
		]
	},
	{
		id: 'regression-prevention',
		title: 'Regression Prevention',
		summary:
			'Identify a regression, repair its root cause, and prove an enforced guard detects recurrence.',
		steps: [
			{
				id: 'spec',
				title: 'Identify the regression, prior working behavior, root cause, and evidence.'
			},
			{
				id: 'red',
				title:
					'Write and run a failing regression test that faithfully reproduces the defect; record proof.'
			},
			{
				id: 'propose',
				title: 'Propose a root-cause repair and an automated guard for the identified failure.'
			},
			{
				id: 'implement',
				title:
					'Implement the repair and wire the prevention test or guard into normal project verification.'
			},
			{
				id: 'green',
				title:
					'Repeat repair and the same unchanged regression test until it passes; record passing proof.'
			},
			{
				id: 'guard',
				title:
					'In an isolated fixture or temporary workspace, prove reintroducing the original failure makes the guard fail; restore and prove it passes.'
			},
			{
				id: 'verify',
				title:
					'Repeat until the guard and relevant project checks pass; verify affected UI flows with fresh inspected screenshots and keep pending while proof fails.'
			}
		],
		evaluators: [
			{
				id: 'check',
				title: 'Run the project check script.',
				command: 'bun run check',
				step: 'verify'
			}
		]
	}
];
