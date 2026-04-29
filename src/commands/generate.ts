import type { Command } from 'commander';
import { generateModel, generatePiece, renderGenerateResult, scaffoldKinds } from '../workflows/generateCode';
import type { PieceKind } from '../workflows/generateCode';

export function registerGenerateCommand(program: Command): void {
	const command = program.command('generate').alias('g').description('Generate Frame code.');

	command
		.command('model <name> [fields...]')
		.option('--adapter <adapter>', 'Persistence adapter: d1, sqlite, or postgres', 'd1')
		.option('--force', 'Overwrite files that already exist.')
		.description('Generate an ActiveRecord-like model.')
		.action(runGenerateModel);

	for (const kind of scaffoldKinds) {
		command
			.command(`${kind} <name>`)
			.option('--force', 'Overwrite files that already exist.')
			.description(`Generate a ${kind}.`)
			.action((name: string, options: { force?: boolean }) => runGeneratePiece(kind, name, options));
	}
}

async function runGenerateModel(
	name: string,
	rawFields: string[],
	options: { adapter: string; force?: boolean }
): Promise<void> {
	const result = await generateModel({
		name,
		rawFields,
		adapter: options.adapter,
		force: options.force
	});
	console.log(renderGenerateResult(result));
}

async function runGeneratePiece(
	kind: PieceKind,
	name: string,
	options: { force?: boolean }
): Promise<void> {
	const result = await generatePiece({ kind, name, force: options.force });
	console.log(renderGenerateResult(result));
}
