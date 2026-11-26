// @harness-uid u_mivrfzcqpq
import type { Command } from 'commander';
import { registerDesignEdits } from './design-command/registerDesignEdits';
import { registerDesignOutput } from './design-command/registerDesignOutput';

/** `harness design`: agents author canvases of HTML artboards under `designs/`. */
export class DesignCommand {
	register(program: Command): void {
		const design = program
			.command('design')
			.description('Author, list and render design canvases of HTML artboards in designs/.')
			.option('--root <path>', 'Project root holding designs/.', process.cwd());
		registerDesignEdits(design);
		registerDesignOutput(design);
	}
}
