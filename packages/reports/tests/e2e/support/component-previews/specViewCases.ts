import { noop, text, type PreviewCases } from './shared';

const markdown = `# Order notifications

Send one email after an invoice is approved.

| Event | Recipient |
| --- | --- |
| Approved | Customer |
| Rejected | Account owner |

\`\`\`mermaid
flowchart LR
  Approved --> Queued --> Sent
\`\`\`
`;
const attachment = {
	id: 'a'.repeat(64),
	kind: 'spec' as const,
	title: 'order-notifications.md',
	repo: 'example/orders',
	pr: 12,
	path: 'specifications/order-notifications.md',
	ref: 'b'.repeat(40),
	bytes: markdown.length
};
const shown = {
	question: 'Approve the order notification spec?',
	load: async () => ({ markdown }),
	answers: text('<div><button type="button">Approve</button></div>')
};

/** A synthetic spec with a table and a diagram, shared by the three parts of the spec view. */
export const specViewCases: PreviewCases = {
	'reports.component.explorer-ui-explorer-kit-spec-document-view': {
		attachment,
		load: shown.load
	},
	'reports.component.explorer-ui-explorer-kit-view-spec-buttons': {
		attachments: [attachment],
		...shown
	},
	'reports.component.explorer-ui-explorer-kit-view-spec-modal': {
		attachment,
		...shown,
		onclose: noop
	}
};
