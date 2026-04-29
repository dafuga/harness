#!/usr/bin/env bun
import { buildProgram } from './cli/program';
import { isExpectedCliError } from './core/errors';

try {
	await buildProgram().parseAsync(process.argv);
} catch (error) {
	if (isExpectedCliError(error)) {
		console.error(`Error: ${error.message}`);
		process.exit(1);
	}

	throw error;
}
