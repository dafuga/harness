import type { VerificationScope } from './verification-targets';

/**
 * Reference checks of the desktop: functions, change notices and creation replies observed by
 * matcher, and the thread and agent views by browser. Every test of a file is listed by name.
 */
export const referenceVerificationScopes: Record<string, VerificationScope> = {
	'agent-references': {
		package: 'desktop',
		vitest: {
			'test/services/project-task.test.ts': {
				'Ask preserves source and a returned answer containing a registered unit reference':
					'reference-functions',
				'a requested registered unit beyond the first 120 is prioritized in the bounded prompt':
					'reference-functions',
				'Change reports actual registered source owners rather than the requested subject':
					'reference-functions',
				'an unexpected Ask write fails and preserves the changed file for review':
					'reference-functions',
				'a scoped project change refuses missing deployment configuration before an agent writes':
					'project-change-boundary'
			},

			'test/entity-references.test.ts': {
				'text is cut into its words and its references, in order, with nothing lost':
					'reference-functions',
				'[[unit:orders]] is text and no reference': 'reference-functions',
				'[[unit:App.Page.Orders]] is text and no reference': 'reference-functions',
				'[[unit:app..orders]] is text and no reference': 'reference-functions',
				'[[unit:app.page.orders.]] is text and no reference': 'reference-functions',
				'[[unit:https://evil.example/x]] is text and no reference': 'reference-functions',
				'[[unit:javascript:alert(1)]] is text and no reference': 'reference-functions',
				'[[unit:../../etc/passwd]] is text and no reference': 'reference-functions',
				'[[unit: app.page.orders]] is text and no reference': 'reference-functions',
				'[[unit:app.page.orders] is text and no reference': 'reference-functions',
				'[[page:app.page.orders]] is text and no reference': 'reference-functions',
				'a reference cut short by the end of a streamed chunk is text until the rest arrives':
					'reference-functions',
				'an overlong id is text, so no reference can hold a whole message': 'reference-functions'
			},
			'test/utils/entity-references.test.ts': {
				'an id is lower-case dotted segments of at most 200 characters': 'reference-functions',
				'a broken marker stays text and the whole reference after it is still read':
					'reference-functions',
				'lines, markup and malformed markers around references join back into the text':
					'reference-functions'
			},
			'test/utils/unit-links.test.ts': {
				'a shell leads under Shells and a pinned commit is kept in the address':
					'reference-functions',
				'a resolver made for one project and commit resolves nothing once another is shown':
					'reference-functions',
				'nothing resolves while the workspace loads': 'reference-functions',
				'a unit removed at the new revision and a draft before the catalog lists it are text':
					'reference-functions',
				'the entity in view is named before its catalog lists it, and only that entity':
					'reference-functions',
				'an id that is not of the unit grammar never resolves, also when a catalog lists it':
					'reference-functions'
			},
			'test/components/reference-text.test.ts': {
				'a reference is one link holding a hidden icon and the unit name, and nothing wraps the text':
					'reference-functions',
				'markup and an overlong unresolved token are shown exactly as text': 'reference-functions',
				'the entity in view is a link before the catalog lists it': 'reference-functions'
			},
			'test/message-references.test.ts': {
				'a unit the agent names is a link to its address, a shell under Shells':
					'reference-functions',
				'at a pinned commit the link keeps the commit it was read at': 'reference-functions',
				'an id the registry does not hold stays the text it was and is no link':
					'reference-functions',
				'a unit of another project stays the text it was and is no link': 'reference-functions',
				'an address stays the text it was and is no link': 'reference-functions',
				'a script stays the text it was and is no link': 'reference-functions',
				'a path stays the text it was and is no link': 'reference-functions',
				'an id in capitals stays the text it was and is no link': 'reference-functions',
				'a reference that is not closed stays the text it was and is no link':
					'reference-functions',
				'markup in agent text is shown as text and never interpreted': 'reference-functions',
				'a message written before references renders exactly its words': 'reference-functions'
			},
			'test/run-context-references.test.ts': {
				'a undefined plan or change prompt names references and its exact promotion boundary':
					'reference-functions',
				'a dev plan or change prompt names references and its exact promotion boundary':
					'reference-functions',
				'a stage plan or change prompt names references and its exact promotion boundary':
					'reference-functions',
				'a preprod plan or change prompt names references and its exact promotion boundary':
					'reference-functions',
				'a prod plan or change prompt names references and its exact promotion boundary':
					'reference-functions',
				'the creation prompt asks the notes to name existing units by registered id':
					'reference-functions'
			},
			'test/utils/reference-prompt.test.ts': {
				'ids are listed once, in order, and an id that is not of the grammar is left out':
					'reference-functions',
				'no id is said as none, and a long list keeps its first hundred and twenty':
					'reference-functions'
			},
			'test/utils/proposal-units.test.ts': {
				'a pages request may name a component, a function and a service, its own catalog first':
					'reference-functions',
				'units the request names come first, as a reference or as a bare id, before the rest':
					'reference-functions',
				'a named unit beyond the bounded list is still listed in the prompt': 'reference-functions',
				'a planned draft is never listed and the prompt holds no source': 'reference-functions'
			},
			'test/utils/changed-units.test.ts': {
				'owned files name their units once each and unowned files are counted': 'change-notice',
				'a directory owns every file under it and a unit owning several files is named once':
					'change-notice',
				'a change of only unowned files, or of no files, says only what is known': 'change-notice',
				'a notice names at most forty units and counts the rest': 'change-notice'
			},
			'test/change-owners.test.ts': {
				'a completed change names the unit owning a changed file and counts the file no unit owns':
					'change-notice'
			},
			'test/change-reply.test.ts': {
				'a completed change keeps the reply of its agent and names the entity it implements':
					'change-notice',
				'a failed change keeps the text its agent streamed before failing': 'change-notice',
				'a cancelled change keeps what was said before the cancellation': 'change-notice',
				'a change whose agent said nothing keeps the notice alone': 'change-notice'
			},
			'test/project-run-references.test.ts': {
				'a pages request is asked with a registered function it names, and its checked notes are said':
					'creation-reply',
				'an answer in plain words is said before the run is refused as no proposal':
					'creation-reply',
				'a broken or fenced JSON answer is never said': 'creation-reply'
			},
			'test/project-agent-said.test.ts': {
				'the text of the own run is kept as it arrives, beside the request as written':
					'creation-reply'
			}
		},
		playwright: {
			'tests/e2e/ui-references.spec.ts': [
				'question',
				'stream',
				'pinned',
				'hosted-comment',
				'agent-reply'
			],
			'tests/e2e/reference-views.spec.ts': [
				'question',
				'stream',
				'pinned',
				'hosted-comment',
				'agent-reply'
			]
		}
	},
	'local-project-chat': {
		package: 'reports',
		vitest: {
			'test/console-workspace.test.ts': {
				'chat references navigate the standalone explorer to scoped entity history':
					'history-navigation'
			},
			'test/console-bridge.test.ts': {
				'a tab retries an unacknowledged start with its original request identity and context':
					'transport-recovery',
				'closing a connecting tab disconnects its late session rather than retaining an orphan':
					'transport-recovery'
			},
			'test/console-agent.test.ts': {
				'owner web chat requires loopback Host, same origin and JSON before invoking its executor':
					'owner-boundary',
				'oversized and malformed payloads never reach the executor': 'owner-boundary'
			},
			'test/preview-lifecycle.test.ts': {
				'the owned preview autonomously recovers after crash': 'route-runtime',
				'the owned preview autonomously recovers after hang': 'route-runtime',
				'the owned preview autonomously recovers after module errors': 'route-runtime',
				'repeated starts on another requested port reuse the same owned preview': 'route-runtime',
				'another history configuration is refused without starting a second preview':
					'route-runtime',
				'an occupied preview port is refused instead of silently choosing another': 'route-runtime',
				'an owner that crashes can be restarted without a stale lock or orphan preview':
					'route-runtime',
				'simultaneous launches elect one owner while the other reuses it': 'route-runtime',
				'a different checkout is refused without affecting the owner': 'route-runtime',
				'normal shutdown releases both the preview and ownership listeners': 'route-runtime',
				'route indexes stay aligned after the normal SvelteKit sync command': 'route-runtime'
			}
		},
		playwright: {}
	}
};
