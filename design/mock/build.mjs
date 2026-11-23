import {createRequire} from 'node:module';
import path from 'node:path';
const DEPS = path.join(process.env.HOME, '.claude/skills/teardown/node_modules');
const esbuild = createRequire(path.join(DEPS, 'x.js'))('esbuild');
await esbuild.build({entryPoints: ['mock.js'], bundle: true, outfile: 'mock.bundle.js', format: 'iife', logLevel: 'warning'});
await esbuild.build({entryPoints: ['logo.js'], bundle: true, outfile: 'logo.bundle.js', format: 'iife', logLevel: 'warning'});
