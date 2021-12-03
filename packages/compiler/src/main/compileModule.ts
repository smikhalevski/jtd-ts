import {
  IJtdNodeDict,
  IJtdRefNode,
  IValidatorDialect,
  IValidatorDialectConfig,
  JtdNode,
  RefResolver,
} from '@jtdc/types';
import {compileTypeStatement, ITypeStatementCompilerConfig} from './compileTypeStatement';
import {createMap} from './misc';
import {compileValidatorFunction} from './compileValidatorFunction';
import {ImportResolver} from './linker';

export interface IModuleBuilderConfig<M>
    extends ITypeStatementCompilerConfig<M>,
            IValidatorDialectConfig<M> {

  typeImportResolver: ImportResolver<M>;

  validatorImportResolver: ImportResolver<M>;

  validatorDialect: IValidatorDialect<M, unknown>;
}

export function compileModule<M>(definitions: IJtdNodeDict<M>, config: IModuleBuilderConfig<M>): string {
  const {
    typeImportResolver,
    validatorImportResolver,
    validatorDialect,
  } = config;



  let src = Object.entries(definitions).reduce((src, [name, node]) => {
    src += compileTypeStatement(name, node, typeRefResolver, config);

    if (validatorDialect) {
      src += compileValidatorFunction(name, node, validatorRefResolver, validatorDialect);
    }
    return src;
  }, '');

  src = (validatorDialect ? validatorDialect.runtimeImport() : '')
      + Object.entries(imports).reduce((src, [importPath, importSet]) => src + `import{${Array.from(importSet).join(',')}}from${JSON.stringify(importPath)};`, '')
      + src;



}
