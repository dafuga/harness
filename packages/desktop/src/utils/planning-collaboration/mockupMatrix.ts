import type { RunContext } from '../../models/development-tooling/RunContext.types';
import { beforeState, mockupHtml } from './mockupSource';
import type { MockupCapture, MockupSource } from './mockupSource.types';
import { mockupPng } from './mockupPng';

const heights = new Map([
	[390, 844],
	[834, 1194],
	[1440, 900],
	[1920, 1080]
]);

function captures(source: MockupSource): MockupCapture[] {
	const states = [
		{ id: 'default', options: source.options, before: source.before },
		...source.states
	];
	const result = source.options.flatMap((_, option) =>
		states.flatMap((state) =>
			source.widths.flatMap((width) => {
				const base = {
					option,
					viewport: { width, height: heights.get(width) ?? 900 },
					scheme: state.id === 'dark' ? ('dark' as const) : ('light' as const)
				};
				const after = {
					...base,
					state: state.id,
					html: mockupHtml(state.options[option], source.projectCss)
				};
				if (!state.before) return [after];
				return [
					after,
					{
						...base,
						state: beforeState + state.id,
						html: mockupHtml(state.before, source.projectCss)
					}
				];
			})
		)
	);
	if (result.length > 160)
		throw new Error('The requested sizes, states and options exceed 160 screenshots.');
	return result;
}

export async function mockupMatrix(context: RunContext, source: MockupSource, prompt: string) {
	const matrix = captures(source);
	context.emit({
		runId: context.id,
		kind: 'status',
		phase: 'generating',
		detail: `Rendering ${matrix.length} screenshots in headless Playwright`
	});
	const bytes = await context.renderMockups(matrix, context.signal);
	if (bytes.length !== matrix.length)
		throw new Error('The renderer did not return every requested screenshot.');
	return source.options.map(({ direction }, option) => ({
		direction,
		prompt,
		revisedPrompt: null,
		images: matrix.flatMap((slot, at) => {
			if (slot.option !== option) return [];
			const viewport = `width-${slot.viewport.width}` as const;
			return [
				{
					state: slot.state,
					viewport,
					bytes: mockupPng(bytes[at], `${option} ${viewport} ${slot.state}`)
				}
			];
		})
	}));
}
