#!/usr/bin/env bun
import { fileURLToPath } from 'node:url';
import { runCli } from './runCli';
await runCli(fileURLToPath(import.meta.url));
