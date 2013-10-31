/**
 * Kettle io.
 *
 * Copyright 2013 OCAD University
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 *
 * You may obtain a copy of the License at
 * https://github.com/gpii/kettle/LICENSE.txt
 */

/*global require*/

(function () {

    "use strict";

    var fluid = require("infusion"),
        kettle = fluid.registerNamespace("kettle");

    /**
     * A grade that can be applied to the kettle.server component that extends
     * its capabilities to support socket.io.
     */
    fluid.defaults("kettle.server.io", {
        gradeNames: ["autoInit", "fluid.littleComponent"],
        distributeOptions: {
            source: "{that}.options.requestsGradeNames",
            target: "{that requests}.options.gradeNames"
        },
        requestsGradeNames: ["kettle.requests.io"],
        members: {
            httpServer: {
                expander: {
                    func: "kettle.server.io.httpServer",
                    args: "{that}.server"
                }
            }
        },
        ioOptions: {
            set: {
                "log level": 4
            }
        },
        invokers: {
            registerHandlers: {
                funcName: "kettle.server.io.registerHandlers",
                args: "{that}"
            },
            listen: {
                funcName: "kettle.server.io.listen",
                args: "{that}"
            },
            stop: {
                funcName: "kettle.server.io.stop",
                args: "{that}"
            }
        }
    });

    kettle.server.io.finalInit = function (that) {
        fluid.log("Initializing the socket.io.");
        // TODO: this does not work if we try to declare io as the component
        // member.
        that.io = require("socket.io").listen(that.httpServer);
        fluid.each(that.options.ioOptions.set, function (val, key) {
            that.io.set(key, val);
        });
    };

    /**
     * Create an HTTP server.
     * @param  {Object} server Express server.
     * @return {Object}        HTTP Server
     */
    kettle.server.io.httpServer = function (server) {
        fluid.log("Initializing the HTTP server.");
        // In order to use express and socket.io together on the same port we
        // need to initialize the express app and then use to to create an
        // instance of the http server that socket.io will get attached to as
        // well (as per socket.io documentation).
        return require("http").createServer(server);
    };

    /**
     * Start listening on the port.
     * @param  {Object} that kettle.server.
     */
    kettle.server.io.listen = function (that) {
        var port = that.options.port;
        that.httpServer.listen(port, function () {
            fluid.log("Kettle Server is running on port: ", port);
            that.events.onListen.fire();
        });
    };

    /**
     * Stop listening on the port.
     * @param  {Object} that kettle.server.
     */
    kettle.server.io.stop = function (that) {
        var port = that.options.port;
        fluid.log("Stopping Kettle Server on port: ", port);
        that.httpServer.close(function () {
            delete that.httpServer;
            delete that.server;
            delete that.io;
            fluid.log("Kettle Server on port: ", port, " is stopped.");
        });
    };

    /**
     * Register a handler for a socket connection.
     * @param  {Object} that kettle.server.
     * @param  {Object} handler  Handler spec defind by the kettle.app.
     * @param  {String} context  Context for the handler.
     */
    kettle.server.io.registerHandler = function (that, handler, context) {
        var ioHandler = that.io.of(handler.route);
        if (handler.needSession) {

        }
        ioHandler.on("connection", function (socket) {
            socket.on("message", function onMessage(data, send) {
                that.requests.createIO(socket);
                var request = socket.fluidRequest;
                request.data = data;
                request.send = send;
                request.handlerContext = fluid.model.composeSegments(
                    "kettle.requests.request.handler", context);
                request.events.handle.fire();
            });
        });
    };

    /**
     * Register handler of all types including express and socket.io handlers.
     * @param  {Object} that     kettle.server.
     */
    kettle.server.io.registerHandlers = function (that) {
        fluid.each(that.options.handlers, function register(handler, context) {
            if (!handler) {
                return;
            }
            if (!kettle.server.validateHandler(handler, that)) {
                return;
            }
            if (handler.type === "io") {
                kettle.server.io.registerHandler(that, handler, context);
            } else {
                kettle.server.registerHandler(that, handler, context);
            }
        });
    };

})();