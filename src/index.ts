#!/usr/bin/env bun
import { buildProgram } from './cli/program';

await buildProgram().parseAsync(process.argv);
