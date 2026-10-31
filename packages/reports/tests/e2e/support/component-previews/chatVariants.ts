import type { PreviewCases } from './shared';
import { text } from './shared';

const conversation = text(`<div style="padding-bottom: 10px">
	<p>You: Please review the activity panel.</p>
	<p>Agent: I will check the recorded states and their screenshots.</p>
	<p>You: Include desktop, tablet and mobile.</p>
	<p>Agent: The populated and empty views are ready.</p>
	<p>You: Does the refresh failure keep the last reading?</p>
	<p>Agent: Yes. The warning remains next to that reading.</p>
	<p>You: Please verify the final result.</p>
	<p>Agent: I am checking the tablet layout.</p>
	<p>You: Confirm the labels remain readable.</p>
	<p>Agent: The fields fit and the labels are visible.</p>
	<p>You: Check the recorded history as well.</p>
	<p>Agent: History is ready for this revision.</p>
	<p>You: Keep the earlier reading if refresh fails.</p>
	<p>Agent: The warning explains that the last reading is retained.</p>
	<p>You: Summarize the result when finished.</p>
	<p>Agent: The activity panel is ready for review.</p>
</div>`);

/** Chat state fixtures stay beside report catalog variants instead of the generic router. */
export function chatVariantProps(id: string, props: PreviewCases[string], variant: string) {
	if (id === 'reports.component.console-chat') return props;
	if (id !== 'reports.component.floating-chat') return null;
	if (variant === 'closed') return { ...props, open: false };
	if (variant === 'notice')
		return { ...props, notice: 'Agent suggestions appear when a provider connects.' };
	if (variant === 'following' || variant === 'not-following')
		return { ...props, children: conversation, follow: variant === 'following' };
	return variant === 'navigation'
		? {
				...props,
				navigation: text(
					'<nav aria-label="Project chat" style="padding:var(--hx-space-8) var(--hx-space-14);border-bottom:var(--hx-border-thin) solid var(--hx-color-border)"><a href="/harness" style="color:var(--hx-color-primary);text-decoration:underline;text-underline-offset:var(--hx-space-2)">Project activity</a></nav>'
				)
			}
		: null;
}
