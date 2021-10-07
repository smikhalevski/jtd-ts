import {ImportResolver} from './module-types';
import {die} from './misc';
import * as path from 'path';

export const nodeImportResolver: ImportResolver<unknown> = (node, fromPath, modules) => {
  const [modulePath, name] = node.ref.split('#');
  const baseDir = path.dirname(fromPath);

  if (!name) {
    die('Invalid reference format: ' + node.ref);
  }

  const p = path.resolve(baseDir, stripExtension(decodeURI(modulePath)));

  for (const module of modules) {
    if (stripExtension(module.path) === p) {
      const exports = module.exports[name];
      if (exports) {
        return [exports, '.' + path.sep + stripExtension(path.relative(baseDir, p))];
      }
      break;
    }
  }
  die(`Unresolved reference ${node.ref} in ${fromPath}`);
};

function stripExtension(path: string): string {
  return path.replace(/\.[-\w]+$/, '');
}
