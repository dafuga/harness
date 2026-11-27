// @harness-uid u_jt3ii2kasr
import type { Command } from 'commander';
import { DesignCanvasService } from '../../../services/planning-collaboration/design-canvas-service/DesignCanvasService';
import { artboardOptions } from './artboardOptions';

/** `new`, `add` and `update`: every change is a file in the working tree, landed by a PR. */
export function registerDesignEdits(design: Command): void {
	const service = (command: Command) =>
		new DesignCanvasService(command.optsWithGlobals<{ root: string }>().root);
	design
		.command('new <canvas>')
		.description('Create designs/<canvas>/canvas.json.')
		.option('--title <title>', 'Canvas title.')
		.action((canvas: string, options: { title?: string }, command: Command) => {
			console.log(service(command).create(canvas, options.title));
		});
	for (const [verb, text] of [
		['add', 'Add an artboard from a starter page or an HTML file.'],
		['update', 'Replace an artboard, retitle it, reorder it or place it.']
	] as const) {
		const command = design
			.command(`${verb} <canvas> <artboard>`)
			.description(text)
			.option('--title <title>', 'Artboard title.')
			.option('--from <file>', 'Self-contained HTML to save; - reads standard input.')
			.option('--size <size>', 'desktop, tablet, mobile or WIDTHxHEIGHT.')
			.option('--order <place>', '1-based place in the canvas order.')
			.option('--at <x,y>', 'Hand-place on the canvas; "row" returns it to the row.');
		command.action(async (...[canvas, board, options]: [string, string, unknown, Command]) => {
			const change = await artboardOptions(options as Record<string, string>);
			console.log(service(command)[verb](canvas, board, change));
		});
	}
}
