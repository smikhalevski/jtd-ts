import {ImportResolver} from './module-types';
import {die} from './misc';
import * as path from 'path';

export type PathAdapter = Pick<typeof path,
    | 'sep'
    | 'dirname'
    | 'resolve'
    | 'relative'>;

/**
 * Returns an import resolver that uses `pathAdapter` to resolve module paths.
 *
 * The returned resolver ignores file extensions when looking up a module.
 */
export function createImportResolver(pathAdapter: PathAdapter): ImportResolver<unknown> {
  return (node, filePath, modules) => {
    const [path, name] = node.ref.split('#');

    const baseDir = pathAdapter.dirname(filePath);
    const modulePath = stripExtension(pathAdapter.resolve(baseDir, decodeURI(path)));

    for (const module of modules) {
      if (stripExtension(pathAdapter.resolve(module.filePath)) === modulePath) {
        const exports = module.exports[decodeURI(name)];
        if (exports) {
          return [exports, '.' + pathAdapter.sep + stripExtension(pathAdapter.relative(baseDir, modulePath))];
        }
        break;
      }
    }

    die(`Cannot resolve reference to ${node.ref} from ${filePath}`);
  };
}

export function stripExtension(filePath: string): string {
  return filePath.replace(/\.\w+$/, '');
}
