import type { UnitFlags } from './generate.types';
import type { Command } from 'commander';
import {
	generateModel,
	generatePiece,
	renderGenerateResult,
	scaffoldKinds
} from '../../workflows/projects-sessions/generate-code/generateCode';
import type { PieceKind } from '../../workflows/projects-sessions/generate-code/generateCode';
import { generateUnit } from './generateUnit';
import { generateElements } from '../../workflows/projects-sessions/generate-code/generateElements';
import { fail } from '../../core/development-tooling/errors';

export function registerGenerateCommand(program: Command): void {
	const command = program.command('generate').alias('g').description('Generate Harness code.');
	command
		.command('elements')
		.option('--force', 'Regenerate canonical native atoms.')
		.description('Install typed HTML, input variant and SVG atom components.')
		.action(async (options: { force?: boolean }) =>
			console.log(renderGenerateResult(await generateElements(options)))
		);

	command
		.command('model <name> [fields...]')
		.option('--adapter <adapter>', 'Persistence adapter: d1, sqlite, or postgres', 'd1')
		.option('--force', 'Overwrite files that already exist.')
		.option('--group <category>', 'Responsibility category folder; creates new categories.')
		.description('Generate an ActiveRecord-like model.')
		.action(runGenerateModel);

	command
		.command('unit <name>')
		.option('--kind <kind>', 'Scaffold shape for the unit source.', 'function')
		.option('--responsibility <text>', 'The one responsibility this unit owns.')
		.option('--level <level>', 'Component composition: molecule or organism.')
		.option('--group <category>', 'Responsibility category folder; creates new categories.')
		.option('--force', 'Overwrite files that already exist.')
		.description('Generate a unit of any kind together with its component manifest.')
		.action(async (name: string, flags: UnitFlags) =>
			console.log(renderGenerateResult(await generateUnit({ name, ...flags })))
		);

	for (const kind of scaffoldKinds) {
		const scaffold = command
			.command(`${kind} <name>`)
			.option('--force', 'Overwrite files that already exist.')
			.option('--group <category>', 'Responsibility category folder; creates new categories.')
			.description(`Generate a ${kind}.`)
			.action((name: string, options: { force?: boolean; group?: string; level?: string }) =>
				runGeneratePiece(kind, name, options)
			);
		if (kind === 'component')
			scaffold.option('--level <level>', 'Composition: molecule or organism.', 'molecule');
	}
}

async function runGenerateModel(
	name: string,
	rawFields: string[],
	options: { adapter: string; force?: boolean; group?: string }
): Promise<void> {
	const result = await generateModel({
		name,
		rawFields,
		adapter: options.adapter,
		force: options.force,
		group: options.group
	});
	console.log(renderGenerateResult(result));
}

async function runGeneratePiece(
	kind: PieceKind,
	name: string,
	options: { force?: boolean; group?: string; level?: string }
): Promise<void> {
	if (options.level && !['molecule', 'organism'].includes(options.level))
		fail('Use --level molecule or organism; native atoms come from generate elements.');
	const result = await generatePiece({
		kind,
		name,
		force: options.force,
		group: options.group,
		level: options.level as 'molecule' | 'organism' | undefined
	});
	console.log(renderGenerateResult(result));
}
