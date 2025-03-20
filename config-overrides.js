module.exports = function override(config, env) {
    // Find the rule that handles JavaScript/JSX files
    const babelLoader = config.module.rules.find(rule => 
      rule.oneOf && rule.oneOf.find(oneOf => 
        oneOf.loader && oneOf.loader.includes('babel-loader')
      )
    );
  
    if (babelLoader && babelLoader.oneOf) {
      // Find the specific babel-loader rule
      const jsRule = babelLoader.oneOf.find(rule => 
        rule.loader && rule.loader.includes('babel-loader')
      );
  
      if (jsRule) {
        // Modify the include to also transpile trails-ui-chatbot
        jsRule.include = undefined;
        jsRule.exclude = /node_modules\/(?!(trails-ui-chatbot)\/).*/;
      }
    }
  
    return config;
  };