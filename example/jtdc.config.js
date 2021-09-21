// https://smikhalevski.github.io/jtdc/interfaces/ITsModulesCompilerOptions.html
module.exports = {
  validatorsRendered: true,
  typeGuardsRendered: true,

  // This is the default value
  dialectFactory: require('@jtdc/jtd-dialect').dialectFactory,
};
