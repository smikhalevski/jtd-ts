import {program} from 'commander';
import {compileTsModules, ITsModulesCompilerOptions} from '@jtdc/compiler';
import fs from 'fs';
import path from 'path';
import glob from 'glob';

const CONFIG_PATH = 'jtdc.config.js';

const packageJson = require('../package.json');

program.name('jtdc');
program.version(packageJson.version);
program.description(packageJson.description);

program.requiredOption('-i, --includes <path...>', 'file paths of type definitions');
program.requiredOption('-o, --outDir <dir>', 'an output folder for all emitted files');
program.option('-c, --config <path>', 'config path', CONFIG_PATH);
program.option('-d, --rootDir <dir>', 'the root folder within your source files', '.');
program.option('-v, --validators', 'render validators');
program.option('-g, --typeGuards', 'render validators and type guards');

const opts = program.parse(process.argv).opts();

const cwd = process.cwd();

const outDir = path.resolve(cwd, opts.outDir);
const rootDir = path.resolve(cwd, opts.rootDir);
const configPath = path.join(cwd, opts.config);

let config: ITsModulesCompilerOptions<any, any> = {};

if (fs.existsSync(configPath)) {
  config = require(configPath);
} else if (opts.config !== CONFIG_PATH) {
  console.log('error: Config not found ' + configPath);
  process.exit(1);
}

config.validatorsRendered ||= opts.validators || opts.typeGuards;
config.typeGuardsRendered ||= opts.typeGuards;

const filePaths = new Array<string>().concat(...opts.includes.map((include: string) => glob.sync(include, {cwd: rootDir})));

if (!filePaths.length) {
  console.log('error: No files to compile');
  process.exit(1);
}

const jtdModules = Object.create(null);

for (const filePath of filePaths) {
  jtdModules['.' + path.sep + filePath.replace(/\.[^.]*$/, '')] = require(path.resolve(rootDir, filePath));
}

let tsModules;
try {
  tsModules = compileTsModules(jtdModules, config);
} catch (error: any) {
  console.log('error: ' + error.message);
  process.exit(1);
}

for (const [uri, src] of Object.entries(tsModules)) {
  const filePath = path.resolve(outDir, uri + '.ts');

  fs.mkdirSync(path.dirname(filePath), {recursive: true});
  fs.writeFileSync(filePath, src + '\n', {encoding: 'utf8'});
}
