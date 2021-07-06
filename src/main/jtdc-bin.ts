import {program} from 'commander';
import {compileJtdTsModules, IJtdTsModulesOptions} from './jtd-ts-modules';
import {IJtdMap} from './jtd-types';
import fs from 'fs';
import path from 'path';
import {ITsJtdMetadata} from './jtd-ts';

const CONFIG_PATH = 'jtdc.config.js';

const packageJson = require('../package.json');

program.name('jtdc');
program.version(packageJson.version);
program.description(packageJson.description);

program.requiredOption('--files <paths...>', 'file paths of type definitions');
program.requiredOption('--outDir <dir>', 'an output folder for all emitted files');
program.option('--config <path>', 'config path', CONFIG_PATH);
program.option('--rootDir <dir>', 'the root folder within your source files', '.');
program.option('--validators', 'emit type validators');
program.option('--checkers', 'emit type checkers');

const opts = program.parse(process.argv).opts();

const cwd = process.cwd();
const outDir = path.resolve(cwd, opts.outDir);
const rootDir = path.resolve(cwd, opts.rootDir);
const configPath = path.join(cwd, opts.config);
const filePaths: Array<string> = opts.files;

let config: IJtdTsModulesOptions<ITsJtdMetadata> = {};

if (fs.existsSync(configPath)) {
  config = require(configPath);
} else if (opts.config !== CONFIG_PATH) {
  console.log('error: Config not found ' + configPath);
  process.exit(1);
}

config.emitsValidators ||= opts.validators;
config.emitsCheckers ||= opts.checkers;

if (!filePaths.length) {
  console.log('error: No files to compile');
  process.exit(1);
}

const modules = filePaths.reduce<Record<string, IJtdMap<ITsJtdMetadata>>>((modules, filePath) => {
  filePath = path.resolve(cwd, filePath);

  if (!filePath.startsWith(rootDir)) {
    console.log('error: Modules must be under ' + rootDir);
    process.exit(1);
  }

  const uri = '.' + path.sep + path.join(path.dirname(filePath).substr(rootDir.length), path.basename(filePath).replace(/\.[^.]*$/, ''));
  modules[uri] = require(filePath);

  return modules;
}, {});

let tsModules;
try {
  tsModules = compileJtdTsModules(modules, config);
} catch (error) {
  console.log('error: ' + error.message);
  process.exit(1);
}

for (const [uri, source] of Object.entries(tsModules)) {
  const filePath = path.resolve(outDir, uri + '.ts');

  fs.mkdirSync(path.dirname(filePath), {recursive: true});
  fs.writeFileSync(filePath, source + '\n', {encoding: 'utf8'});
}
