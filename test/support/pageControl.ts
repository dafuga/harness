import { execFileSync } from 'node:child_process';
export default function control() { execFileSync('node', ['scripts/fixture.mjs', 'control'], { stdio: 'inherit' }); }
