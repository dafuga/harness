// @harness-uid u_ca6ytzpzbs
import { InvalidArgumentError, type Command } from 'commander';
import { DesignCanvasService } from '../../../services/planning-collaboration/design-canvas-service/DesignCanvasService';
import { trackerStage } from '../../../utils/projects-sessions/trackerPlanning';
import { listDesigns } from './listDesigns';
import { renderDesign } from './renderDesign';

/** `list`, `render` and `attach`: reading a canvas, proving it and showing it on a plan. */
export function registerDesignOutput(design: Command): void {
	const root = (command: Command) => command.optsWithGlobals<{ root: string }>().root;
	design
		.command('list [canvas]')
		.description("List the canvases, or one canvas's artboards and any problem in them.")
		.option('--json', 'Print JSON only.')
		.action((canvas: string | undefined, options: { json?: boolean }, command: Command) => {
			console.log(listDesigns(new DesignCanvasService(root(command)), canvas, options.json));
		});
	design
		.command('render <canvas>')
		.description('Write PNG screenshots of artboards with Playwright.')
		.option('--out <folder>', 'Output folder (default output/designs/<canvas>).')
		.option('--theme <theme>', 'light, dark or both.', themeOption, 'both')
		.option('--artboard <name>', 'Only this artboard.')
		.action(async (canvas: string, options: Record<string, string>, command: Command) => {
			const written = await renderDesign(new DesignCanvasService(root(command)), canvas, options);
			console.log(written.join('\n'));
		});
	design
		.command('attach <canvas>')
		.description("Add a committed, pushed canvas to a tracker item's planning stage.")
		.requiredOption('--item <id>', 'Tracker item id.')
		.option('--stage <stage>', 'idea, detail, design or build.', 'detail')
		.option('--viewer <url>', 'Hub project address, https://hub/projects/<id>.')
		.action(async (canvas: string, options: Record<string, string>, command: Command) => {
			const { attachCanvas } =
				await import('../../../services/planning-collaboration/design-canvas-service/attachCanvas');
			const service = new DesignCanvasService(root(command));
			const artifact = attachCanvas(service.read(canvas), {
				root: service.root,
				item: options.item,
				stage: trackerStage(options.stage),
				viewer: options.viewer
			});
			console.log(`Attached ${canvas} to ${options.item} (${artifact.pages?.length} pages).`);
		});
}

function themeOption(value: string): string {
	if (!['light', 'dark', 'both'].includes(value))
		throw new InvalidArgumentError('Expected light, dark or both.');
	return value;
}
