import { Command } from 'commander';
import { registerAuditCommand } from '../commands/audit';
import { registerGenerateCommand } from '../commands/generate';
import { registerInfoCommand } from '../commands/info';
import { registerNewCommand } from '../commands/new';
import { registerVerifyCommand } from '../commands/verify';

export function buildProgram(): Command {
	const program = new Command();

	program
		.name('harness')
		.description('Opinionated Rails-inspired coding harnesses for humans and agents.')
		.version('0.1.0');

	registerNewCommand(program);
	registerGenerateCommand(program);
	registerInfoCommand(program);
	registerAuditCommand(program);
	registerVerifyCommand(program);

	return program;
}
