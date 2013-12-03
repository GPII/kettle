/**
 * Kettle Session.
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
     * A grade that provides all necessary support for Socket sessions within
     * the kettle.server: cookie parsing, session and session validation
     * middleware.
     */
    fluid.defaults("kettle.use.session.io", {
        gradeNames: ["autoInit", "fluid.eventedComponent"],
        distributeOptions: {
            source: "{that}.options.sessionManagerGradeNames",
            target: "{that sessionManager}.options.gradeNames"
        },
        sessionManagerGradeNames: ["kettle.sessionManager.io"],
        listeners: {
            onRegisterIOHandler: [
                "{that}.checkHandlerSession"
            ]
        }
    });

    fluid.defaults("kettle.sessionManager.io", {
        gradeNames:  ["fluid.eventedComponent", "autoInit"],
        listeners: {
            "{kettle.use.session.io}.events.onRegisterIOHandler":
                "{that}.validateIO",
            "{kettle.server}.requests.events.onNewIORequest":
                "{that}.resolveSessionIOAttributes"
        },
        invokers: {
            validateIO: {
                funcName: "kettle.sessionManager.io.validate",
                args: [
                    "{that}",
                    "{kettle.server}",
                    "{arguments}.0",
                    "{arguments}.1"
                ]
            },
            resolveSessionIOAttributes: {
                funcName: "kettle.sessionManager.io.resolveSessionAttributes",
                args: ["{arguments}.0", "{arguments}.3"]
            }
        }
    });

    fluid.defaults("kettle.gradeLinkageRecord.sessionIO", {
        gradeNames: ["autoInit", "fluid.gradeLinkageRecord"],
        contextGrades: ["kettle.use.session", "kettle.server.io"],
        resultGrades: "kettle.use.session.io"
    });

    /**
     * Resolve the request session attribute member.
     * @param  {Object} socket Web Socket object.
     * @param  {JSON} handler Handler JSON spec.
     */
    kettle.sessionManager.io.resolveSessionAttributes = function (socket, handler) {
        if (handler.useSession === "existing") {
            socket.fluidRequest.events.onRequestSession.fire();
        }
    };

    /**
     * Validate a socket connection for a handler.
     * @param  {Object} that sessionManager.
     * @param  {Object} server kettle.server.
     * @param  {Object} handler Handler spec defind by the kettle.app.
     * @param  {String} context Context for the handler.
     */
    kettle.sessionManager.io.validate = function (that, server, handler, context) {
        var ioHandler = server.ioHandlers[context];
        if (handler.useSession !== "existing") {
            return;
        }
        ioHandler.authorization(function onAuth(handshakeData, callback) {
            if (!handshakeData.headers.cookie) {
                return callback("Session cookie is missing.", false);
            }

            server.cookieParser.parser(handshakeData, {}, fluid.identity);
            var sessionID = handshakeData.signedCookies[that.options.key];
            handshakeData.sessionID = sessionID;

            that.store.load(sessionID, function onLoad(err, session) {
                if (err || !session) {
                    return callback("Session is not found", false);
                }
                handshakeData.session = session;
                return callback(null, true);
            });
        });
    };

    fluid.defaults("kettle.sessionManager.requestSession.io", {
        gradeNames: ["autoInit", "kettle.sessionManager.requestSession"],
        members: {
            session: "{request}.socket.handshake.session"
        }
    });

})();
