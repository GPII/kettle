/*
Kettle config loader.

Copyright 2012-2013 OCAD University

Licensed under the New BSD license. You may not use this file except in
compliance with this License.

You may obtain a copy of the License at
https://github.com/gpii/kettle/LICENSE.txt
*/

(function () {

    "use strict";

    var fluid = require("infusion"),
        fs = require("fs"),
        path = require("path"),
        kettle = fluid.registerNamespace("kettle");

    fluid.registerNamespace("kettle.config");

    /** Returns a suitable environment value {String} by considering, in the following order i) The environment variable
     * NODE_ENV, ii) the supplied argument {String} if any, iii) the final fallback value "development". This value
     * is suitable for appearing as the nodeEnv field in the options to <code>kettle.config.createDefaults</code> etc.
     */
    kettle.config.getNodeEnv = function (outerDefault) {
        return process.env.NODE_ENV || outerDefault || "development";
    };

    kettle.config.getConfigPath = function () {
        return fluid.get(process.argv, "2");
    };

    kettle.config.loadModules = function (modules, prefix) {
        if (!modules || modules.length < 1) {
            return;
        }
        var moduleLoaderFullPath = path.resolve(prefix, "kettleModuleLoader.js");
        var moduleLoader;
        try {
            moduleLoader = require(moduleLoaderFullPath);
        } catch (x) {
            fluid.log("No module loader at path " + moduleLoaderFullPath + " found.");
            return;
        }
        fluid.each(modules, function loadModule(module) {
            fluid.require(module, moduleLoader);
        });
    };

    var createDefaultsImpl = function (prefix, filePath) {
        var fileName = path.basename(filePath),
            filePathPrefix = filePath.slice(0, filePath.indexOf(fileName));
        prefix = path.resolve(prefix, filePathPrefix);
        var fullPath = path.resolve(prefix, fileName),
            configFile = JSON.parse(fs.readFileSync(fullPath)),
            includes = configFile.includes,
            gradeNames = [];
        kettle.config.loadModules(configFile.modules, prefix);
        fluid.each(includes, function loadConfigFromPath(importPath) {
            gradeNames.push(createDefaultsImpl(prefix, importPath));
        });
        configFile.typeName = configFile.typeName ||
            fluid.model.composeSegments("kettle.config", fluid.allocateGuid());
        configFile.options = configFile.options || {};
        configFile.options.gradeNames = fluid.makeArray(
            configFile.options.gradeNames).concat(gradeNames);
        fluid.defaults(configFile.typeName, configFile.options);
        return configFile.typeName;
    };
    
    /** Convert a Kettle "config" as specified by a base path and NODE_ENV value into a set of component defaults
     * constituting a runnable Kettle application. This will recursively load any "modules" specified in the root
     * config file and merge their configuration into the root config.
     * @param options {Object} Contains fields: nodeEnv {String} a NODE_ENV value that will be looked up to a "config" file in the supplied
     * directory by appending the <code>.json</code> suffix
     * configPath {String} A fully qualified directory name holding config files
     * @return {String} the name of a Fluid component which can be invoked to instantiate the Kettle application
     */

    kettle.config.createDefaults = function (options) {
        return createDefaultsImpl(options.configPath, options.nodeEnv + ".json");
    };

    /** Arguments as for <code>kettle.config.createDefaults</code> only the corresponding Kettle application will be run immediately 
     */ 
    kettle.config.makeConfigLoader = function (options) {
        var componentName = kettle.config.createDefaults(options);
        return fluid.invokeGlobalFunction(componentName);
    };

})();
