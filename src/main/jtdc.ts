import {program} from 'commander';
import {compileJtdTsModules, IJtdTsModulesOptions} from './jtd-ts-modules';
import {IJtdMap} from './jtd-types';
import fs from 'fs';
import path from 'path';
import {ITsJtdMetadata} from './jtd-ts';

const packageJson = require('../package.json');

program.version(packageJson.version);
program.description(packageJson.description);

program
    .requiredOption('--files <paths...>', 'JTD file paths')
    .requiredOption('--out <dir>', 'output directory')
    .option('--validators', 'emit type validators')
    .option('--checkers', 'emit type checkers')
    .option('--dir <dir>', 'modules directory', '.')
    .option('--config <path>', 'config path', './jtdc.config.js');

const cwd = process.cwd();
const opts = program.parse(process.argv).opts();

const out = path.resolve(cwd, opts.out);
const dir = path.resolve(cwd, opts.dir);

const config: IJtdTsModulesOptions<ITsJtdMetadata> = fs.existsSync(path.join(cwd, opts.config)) ? require(opts.config) : {};

config.emitsValidators ||= opts.validators;
config.emitsCheckers ||= opts.checkers;

if (!Array.isArray(opts.files) || opts.files.length === 0) {
  console.log('No files to compile');
  process.exit(1);
}

const modules = opts.files.reduce<Record<string, IJtdMap<ITsJtdMetadata>>>((modules, filePath) => {
  filePath = path.resolve(cwd, filePath);

  if (filePath.startsWith(dir)) {
    modules['./' + filePath.substr(dir.length + 1).replace(/\.(js|json)$/i, '')] = require(filePath);
    return modules;
  }
  console.log('Modules must stored under ' + dir);
  process.exit(1);
}, {});

const moduleMap = compileJtdTsModules(modules, config);

for (const [uri, source] of Object.entries(moduleMap)) {
  const filePath = path.join(out, uri + '.ts');

  fs.mkdirSync(path.dirname(filePath), {recursive: true});
  fs.writeFileSync(filePath, source, {encoding: 'utf8'});
}
