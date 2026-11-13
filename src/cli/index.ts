#!/usr/bin/env bun
// @harness-uid u_lt35mxvvrg
import { fileURLToPath } from 'node:url';
import { runCli } from './runCli';
await runCli(fileURLToPath(import.meta.url));
