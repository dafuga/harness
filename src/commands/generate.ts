import { Command } from 'commander';
import { parseFields } from '../core/fields';
import { ensureParents, renderFileList, writePlannedFiles } from '../core/files';
import { adapterTypeFiles } from '../templates/adapterTypes';
import { modelFiles, type AdapterName } from '../templates/model';
import { pieceFiles, type PieceKind } from '../templates/pieces';

const adapters = ['d1', 'sqlite', 'postgres'];

export function registerGenerateCommand(program: Command): void {
	const command = program.command('generate').alias('g').description('Generate Frame code.');

	command
		.command('model <name> [fields...]')
		.option('--adapter <adapter>', 'Persistence adapter: d1, sqlite, or postgres', 'd1')
		.description('Generate an ActiveRecord-like model.')
		.action(generateModel);

	for (const kind of ['controller', 'service', 'decorator', 'component', 'test', 'feature', 'migration']) {
		command
			.command(`${kind} <name>`)
			.description(`Generate a ${kind}.`)
			.action((name: string) => generatePiece(kind as PieceKind, name));
	}
}

async function generateModel(
	name: string,
	rawFields: string[],
	options: { adapter: string }
): Promise<void> {
	const adapter = normalizeAdapter(options.adapter);
	const files = [...adapterTypeFiles(), ...modelFiles({ name, fields: parseFields(rawFields), adapter })];
	await ensureParents(process.cwd(), files);
	await writePlannedFiles(process.cwd(), files);
	console.log(`Generated model "${name}".\n${renderFileList(files)}`);
}

async function generatePiece(kind: PieceKind, name: string): Promise<void> {
	const files = pieceFiles(kind, name);
	await ensureParents(process.cwd(), files);
	await writePlannedFiles(process.cwd(), files);
	console.log(`Generated ${kind} "${name}".\n${renderFileList(files)}`);
}

function normalizeAdapter(value: string): AdapterName {
	if (adapters.includes(value)) {
		return value as AdapterName;
	}

	throw new Error(`Unsupported adapter "${value}". Use d1, sqlite, or postgres.`);
}
