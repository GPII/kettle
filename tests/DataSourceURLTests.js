/**
 * Kettle DataSource URL Tests
 *
 * Copyright 2016 Raising The Floor - International
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 *
 * You may obtain a copy of the License at
 * https://github.com/fluid-project/kettle/blob/master/LICENSE.txt
 */

"use strict";

var fluid = require("infusion"),
    fs = require("fs"),
    kettle = fluid.require("%kettle"),
    jqUnit = fluid.require("node-jqunit", require, "jqUnit");

kettle.loadTestingSupport();

require("./shared/SingleRequestTestDefs.js");
require("./shared/DataSourceTestUtils.js");
require("./shared/HTTPMethodsTestDefs.js");

fluid.registerNamespace("kettle.tests.dataSource.URL");

// HTTPS test

// See http://stackoverflow.com/questions/23601989/client-certificate-validation-on-server-side-depth-zero-self-signed-cert-error
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

fluid.defaults("kettle.tests.dataSource.https", {
    // NB, slight misuse of singleRequest.config since we are not using its accompanying testDefs
    gradeNames: ["kettle.tests.singleRequest.config", "kettle.tests.simpleDataSourceTest"],
    name: "HTTPS dataSource test",
    expect: 1, // for assertion inside HTTPMethods get handler
    httpsServerOptions: {
        key: fs.readFileSync(__dirname + "/data/testkey.pem"),
        cert: fs.readFileSync(__dirname + "/data/testkey-cert.pem")
    },
    distributeOptions: {
        serverType: {
            target: "{that kettle.server}.options.members.httpServer",
            record: "@expand:kettle.server.httpsServer({kettle.tests.dataSource.https}.options.httpsServerOptions, {kettle.server}.expressApp)"
        },
        handlerType: {
            target: "{that kettle.app}.options.requestHandlers.testHandler.type",
            record: "kettle.tests.HTTPMethods.get.handler"
        }
    },
    invokers: {
        responseFunc: {
            funcName: "kettle.tests.dataSource.testResponse",
            args: ["{that}.options.expected", "{arguments}.0"]
        }
    },
    expected: {
        message: "GET response"
    },
    components: {
        dataSource: {
            type: "kettle.dataSource.URL",
            options: {
                url: "https://localhost:8081/"
            }
        }
    }
});

// KETTLE-73 sensitive info in error test

kettle.tests.dataSource.testSensitiveErrorResponse = function (expected, data) {
    jqUnit.assertEquals("Received expected status code", expected.statusCode, data.statusCode);
    jqUnit.assertTrue("Expected string should appear", data.message.includes(expected.shouldAppear));
    expected.shouldNotAppear.forEach(function (shouldNotAppear) {
        jqUnit.assertFalse("Unexpected string should not appear", data.message.includes(shouldNotAppear));
    });
};

fluid.defaults("kettle.tests.dataSource.URL.sensitiveError", {
    gradeNames: ["kettle.tests.singleRequest.config", "kettle.tests.simpleDataSourceTest"],
    name: "w. Testing URL dataSource with sensitive info in URL",
    expect: 3,
    components: {
        dataSource: {
            type: "kettle.dataSource.URL",
            options: {
                url: "http://secret-user:secret-password@localhost:8081/notfound?search"
            }
        }
    },
    shouldError: true,
    expected: {
        isError: true,
        statusCode: 404,
        shouldAppear: "SENSITIVE",
        shouldNotAppear: ["secret", "%3F"]
    },
    invokers: {
        errorFunc: {
            funcName: "kettle.tests.dataSource.testSensitiveErrorResponse",
            args: ["{testEnvironment}.options.expected", "{arguments}.0"]
        }
    }
});

// Plain HTTP hangup test

fluid.defaults("kettle.tests.dataSource.URL.hangup", {
    gradeNames: ["kettle.tests.singleRequest.config", "kettle.tests.simpleDataSourceTest"],
    mergePolicy: {
        expected: "nomerge"
    },
    name: "x. Testing URL dataSource with server hangup",
    shouldError: true,
    distributeOptions: {
        target: "{that kettle.app}.options.requestHandlers.testHandler.type",
        record: "kettle.tests.dataSource.URL.hangup.handler"
    },
    components: {
        dataSource: {
            type: "kettle.dataSource.URL",
            options: {
                url: "http://localhost:8081/"
            }
        }
    },
    expected: {
        isError: true,
        code: "ECONNRESET",
        message: "socket hang up while executing HTTP GET on url http://localhost:8081/"
    },
    invokers: {
        errorFunc: {
            funcName: "kettle.tests.dataSource.testErrorResponse",
            args: ["{testEnvironment}.options.expected", "{arguments}.0"]
        }
    }
});

fluid.defaults("kettle.tests.dataSource.URL.hangup.handler", {
    gradeNames: "kettle.request.http",
    invokers: {
        handleRequest: {
            funcName: "kettle.tests.dataSource.URL.hangup.handleRequest"
        }
    }
});

kettle.tests.dataSource.URL.hangup.handleRequest = function (request) {
    request.res.socket.destroy();
};

// CouchDB hangup test

fluid.defaults("kettle.tests.dataSource.CouchDB.hangup", {
    gradeNames: "kettle.tests.dataSource.URL.hangup",
    name: "y. Testing CouchDB dataSource with server hangup",
    distributeOptions: {
        target: "{that dataSource}.options.gradeNames",
        record: "kettle.dataSource.CouchDB"
    }
});

// HTTP hangup test

fluid.defaults("kettle.tests.dataSource.URL.notFound", {
    gradeNames: "kettle.tests.dataSource.URL.hangup",
    name: "z. Testing HTTP dataSource with server hangup",
    expected: {
        message: "Cannot GET /notFound while executing HTTP GET on url http://localhost:8081/notFound",
        isError: true,
        statusCode: 404
    },
    distributeOptions: {
        target: "{that dataSource}.options.url",
        record: "http://localhost:8081/notFound"
    }
});

// KETTLE-89 follow redirects

fluid.defaults("kettle.tests.dataSource.URL.redirectingApp", {
    gradeNames: "kettle.app",
    requestHandlers: {
        redirectHandler: {
            type: "kettle.tests.dataSource.URL.redirectingRequestHandler",
            route: "/redirect",
            method: "get"
        }
    }
});

fluid.defaults("kettle.tests.dataSource.URL.redirectingRequestHandler", {
    gradeNames: "kettle.request.http",
    invokers: {
        handleRequest: {
            funcName: "kettle.tests.dataSource.URL.redirectingHandler"
        }
    }
});

kettle.tests.dataSource.URL.redirectingHandler = function (request) {
    jqUnit.assert("GET request successfully received");
    request.events.onSuccess.fire("Moved to /", {
        statusCode: 301,
        headers: {
            Location: "/"
        }
    });
};

fluid.defaults("kettle.tests.dataSource.URL.redirect", {
    gradeNames: ["kettle.tests.singleRequest.config", "kettle.tests.simpleDataSourceTest"],
    name: "KETTLE-89: DataSource support for redirects",
    expect: 2,
    distributeOptions: {
        testHandlerType: {
            target: "{that kettle.app}.options.requestHandlers.testHandler.type",
            record: "kettle.tests.HTTPMethods.get.handler"
        },
        redirectHandler: {
            target: "{that kettle.app}.options.gradeNames",
            record: "kettle.tests.dataSource.URL.redirectingApp"
        }
    },
    invokers: {
        responseFunc: {
            funcName: "kettle.tests.dataSource.testResponse",
            args: ["{that}.options.expected", "{arguments}.0"]
        }
    },
    expected: {
        message: "GET response"
    },
    components: {
        dataSource: {
            type: "kettle.dataSource.URL",
            options: {
                url: "http://localhost:8081/redirect"
            }
        }
    }
});

// Using a DataSource at init time

fluid.defaults("kettle.tests.dataSource.URL.init", {
    gradeNames: ["kettle.tests.singleRequest.config", "fluid.test.testEnvironment"],
    name: "FLUID-6148: DataSource during init",
    distributeOptions: {
        testHandlerType: {
            target: "{that kettle.app}.options.requestHandlers.testHandler.type",
            record: "kettle.tests.HTTPMethods.get.handler"
        }
    },
    invokers: {
        responseFunc: {
            funcName: "kettle.tests.dataSource.testResponse",
            args: ["{that}.options.expected", "{arguments}.0"]
        }
    },
    expected: {
        message: "GET response"
    },
    components: {
        dataSource: {
            type: "kettle.dataSource.URL",
            options: {
                url: "http://localhost:8081/"
            }
        },
        testCaseHolder: {
            type: "fluid.test.testCaseHolder",
            options: {
                modules: [{
                    name: "DataSource during init",
                    tests: [{
                        name: "Resource model is initialised",
                        sequence: [{
                            listener: "fluid.identity",
                            event: "{resourceLoader}.events.onCreate"
                        }, {
                            funcName: "kettle.tests.dataSource.URL.init.check",
                            args: "{kettle.tests.dataSource.URL.init}"
                        }]
                    }]
                }]
            }
        },
        resourceHolder: {
            type: "fluid.modelComponent",
            createOnEvent: "{testEnvironment}.server.events.onListen",
            options: {
                gradeNames: "fluid.resourceLoader",
                resources: {
                    dataSourceResource: {
                        dataSource: "{dataSource}"
                    }
                },
                model: "{that}.resources.dataSourceResource.parsed"
            }
        }
    }
});

kettle.tests.dataSource.URL.init.check = function (root) {
    jqUnit.assertDeepEq("Model should have been initialised from resource", root.options.expected, root.resourceHolder.model);
};

// Special chars test

fluid.defaults("kettle.tests.dataSource.URL.set.specialChars", {
    gradeNames: ["kettle.tests.singleRequest.config", "kettle.tests.simpleDataSourceTest"],
    name: "HTTPS dataSource set with special chars test",
    expect: 1, // for assertion inside HTTPMethods put handler
    distributeOptions: {
        handlerType: {
            target: "{that kettle.app}.options.requestHandlers.testHandler.type",
            record: "kettle.tests.HTTPMethods.put.handler"
        },
        handlerMethod: {
            target: "{that kettle.app}.options.requestHandlers.testHandler.method",
            record: "put"
        }
    },
    dataSourceMethod: "set",
    dataSourceModel: {
        test: "Gerät"
    },
    components: {
        dataSource: {
            type: "kettle.dataSource.URL",
            options: {
                url: "http://localhost:8081/",
                writable: true
            }
        }
    },
    invokers: {
        responseFunc: {
            funcName: "jqUnit.assertDeepEq",
            args: ["The data with special chars is successfully received", "{that}.options.dataSourceModel", "{arguments}.0"]
        }
    }
});

jqUnit.test("GPII-2147: Testing that localhost is properly replaced by 127.0.0.1 in prepareRequestOptions", function () {
    var userStaticOptions = {
        protocol: "http:",
        hostname: "localhost",
        pathname: "/preferences/sammy"
    };
    var returned = fluid.dataSource.URL.prepareRequestOptions({}, undefined, {}, kettle.dataSource.URL.requestOptions, {}, userStaticOptions, undefined);
    jqUnit.assertEquals("hostname is 127.0.0.1", returned.hostname, "127.0.0.1");
});


fluid.test.runTests([
    "kettle.tests.dataSource.URL.redirect",
    "kettle.tests.dataSource.URL.init",
    "kettle.tests.dataSource.URL.sensitiveError",
    "kettle.tests.dataSource.https",
    "kettle.tests.dataSource.URL.hangup",
    "kettle.tests.dataSource.CouchDB.hangup",
    "kettle.tests.dataSource.URL.notFound",
    "kettle.tests.dataSource.URL.set.specialChars"
]);
