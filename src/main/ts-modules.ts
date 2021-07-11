import {compileTsDefinitions, ITsDefinitionsCompilerOptions, tsDefinitionsCompilerOptions} from './ts-compiler';
import {parseJtdDefinitions} from './jtd-ast';
import {JtdNode} from './jtd-ast-types';
import {IJtd} from './jtd-types';
import {createMap} from './misc';
import {IValidatorCompilerOptions, validatorCompilerOptions} from './validator-compiler';

export interface IJtdTsModulesOptions<M, C> extends ITsDefinitionsCompilerOptions<M>, IValidatorCompilerOptions<M, C> {

  /**
   * If set to `true` then validator functions are emitted along with type.
   *
   * @default false
   */
  emitsValidators?: boolean;

  /**
   * Callback that additionally modifies the generated TypeScript source. Use this to prepend checker imports or add
   * licence info to each file.
   */
  alterSource?: (source: string, uri: string) => string;
}

export function compileJtdTsModules<M, C>(modules: Record<string, Record<string, IJtd<M>>>, options?: IJtdTsModulesOptions<M, C>): Record<string, string> {
  const tsModules: Record<string, string> = createMap();

  interface IParsedModule<M> {
    uri: string;
    definitions: Record<string, JtdNode<M>>;
    tsExports: Record<string, ITsExport<M>>;
  }

  const parsedModules: Array<IParsedModule<M>> = [];

  const opts = Object.assign({}, validatorCompilerOptions, tsDefinitionsCompilerOptions, options);

  const {
    emitsValidators,
    alterSource,
  } = opts;

  // Parse AST and extract exports
  for (const uri of Object.keys(modules)) {
    const definitions = parseJtdDefinitions(modules[uri]);

    parsedModules.push({
      uri,
      definitions,
      tsExports: getTsExports(definitions, opts),
    });
  }

  for (const {uri, definitions, tsExports} of parsedModules) {

    const tsImports: Record<string, Record<string, ITsExport<M>>> = createMap();

    // Cross-module ref resolver
    opts.resolveExternalRef = (node) => {
      for (const {uri, tsExports} of parsedModules) {
        if (ref in tsExports) {

          const tsExport = tsExports[ref];
          const tsImport = tsImports[uri] ||= {};

          tsImport[ref] = tsExport;

          return tsExport.name;
        }
      }
      return resolveRef(ref, node);
    };

    let source = '';

    // jtdc import of validator runtime
    if (emitsValidators) {
      source += `import ${checkerRuntimeVar} from "${runtimeModulePath}";`
          + `import ${validatorRuntimeVar},{Validator} from "jtdc/lib/validator/runtime";`;
    }

    // Module types
    const typeSource = compileTsDefinitions(definitions, opts);

    // Cross-module type an validator imports
    for (const [uri, tsImport] of Object.entries(tsImports)) {

      // Import types
      source += 'import {'
          + Object.values(tsImport).map((tsExport) => tsExport.name).join(',');

      // Import validators
      if (emitsValidators) {
        source += ',' + Object.entries(tsImport).map(([ref, tsExport]) => renameValidator(ref, tsExport.node)).join(',');
      }
      source += `} from ${JSON.stringify(uri)};`;
    }

    // Type source
    source += typeSource;

    // Validator and checker source
    if (emitsValidators) {
      opts.resolveRef = (ref) => tsExports[ref].name;
      source += compileValidators(definitions, opts);
    }

    if (alterSource) {
      source = alterSource(source, uri);
    }

    tsModules[uri] = source;
  }

  return tsModules;
}

interface ITsExport<M> {

  /**
   * The TypeScript type name.
   */
  name: string;

  /**
   * The node that describes the type.
   */
  node: JtdNode<M>;
}

/**
 * Returns map from ref to a TypeScript type name.
 */
function getTsExports<M>(definitions: Record<string, JtdNode<M>>, options: Required<ITypeDeclarationRenamer<M>>): Record<string, ITsExport<M>> {
  const exports: Record<string, ITsExport<M>> = createMap();

  for (const [ref, node] of Object.entries(definitions)) {
    exports[ref] = {
      name: renameTsType(ref, node, options),
      node,
    };
  }
  return exports;
}
