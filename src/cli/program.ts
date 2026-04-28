import { Command } from 'commander';
import { registerAuditCommand } from '../commands/audit';
import { registerGenerateCommand } from '../commands/generate';
import { registerInfoCommand } from '../commands/info';
import { registerNewCommand } from '../commands/new';

export function buildProgram(): Command {
	const program = new Command();

	program
		.name('frame')
		.description('Opinionated Rails-inspired coding frames for humans and agents.')
		.version('0.1.0');

	registerNewCommand(program);
	registerGenerateCommand(program);
	registerInfoCommand(program);
	registerAuditCommand(program);

	return program;
}
