

module.exports = function(RED) {
    "use strict";
    var http = require("follow-redirects").http;
    var https = require("follow-redirects").https;
    var urllib = require("url");
    var querystring = require("querystring");


    // This is a config node holding the endpoint for connecting to HASS
    function HassConfigNode(n) {
        RED.nodes.createNode(this,n);
        this.host = n.host;
        this.port = n.port;
        if (this.credentials && this.credentials.accesstoken) {
            this.accesstoken = this.credentials.accesstoken;
        }
    }

    RED.nodes.registerType('hass-config', HassConfigNode, {
        credentials: {
            accesstoken: {type: "password"}
        }
    });


    function HassPostNode(n) {
        RED.nodes.createNode(this,n);

        if (RED.settings.httpRequestTimeout) { this.reqTimeout = parseInt(RED.settings.httpRequestTimeout) || 120000; }
        else { this.reqTimeout = 120000; }
        var node = this;

        node.config = n;
        node.entityid = n.entityid;
        node.endpoint = RED.nodes.getNode(n.endpoint);
        if (node.endpoint.accesstoken) node.accesstoken = node.endpoint.accesstoken;

        var prox, noprox;
        if (process.env.http_proxy != null) { prox = process.env.http_proxy; }
        if (process.env.HTTP_PROXY != null) { prox = process.env.HTTP_PROXY; }
        if (process.env.no_proxy != null) { noprox = process.env.no_proxy.split(","); }
        if (process.env.NO_PROXY != null) { noprox = process.env.NO_PROXY.split(","); }

        this.on("input",function(msg) {
            var preRequestTimestamp = process.hrtime();
            node.status({fill:"blue",shape:"dot",text:"httpin.status.requesting"});

            var entityid = node.entityid || msg.entityid;
            if (!entityid) {
                node.error("No entityid specified", msg);
                return;
            }
            if (msg.entityid && node.entityid && (msg.entityid !== node.entityid)) {
                node.warn(RED._("common.errors.nooverride"));
            }

            var url = node.endpoint.host + ":" + node.endpoint.port + "/api/states/" + entityid;
            if (!url) {
                node.error(RED._("httpin.errors.no-url"),msg);
                return;
            }
            // url must start http:// or https:// 
            if (!((url.indexOf("http://") === 0) || (url.indexOf("https://") === 0))) {
                node.error(RED._("httpin.errors.no-url"),msg);
                return;
            }

            var opts = urllib.parse(url);
            opts.method = "POST";
            opts.headers = {};
            opts.headers['content-type'] = "application/json";
            if (node.accesstoken) {
                opts.headers['Authorization'] = "Bearer " + node.accesstoken;
            }

            var payload = null;
            if (msg.payload) {
                payload = JSON.stringify(msg.payload);
                opts.headers['content-length'] = Buffer.byteLength(payload);
            }
            var urltotest = url;
            var noproxy;
            if (noprox) {
                for (var i in noprox) {
                    if (url.indexOf(noprox[i]) !== -1) { noproxy=true; }
                }
            }
            if (prox && !noproxy) {
                var match = prox.match(/^(http:\/\/)?(.+)?:([0-9]+)?/i);
                if (match) {
                    opts.headers['Host'] = opts.host;
                    var heads = opts.headers;
                    var path = opts.pathname = opts.href;
                    opts = urllib.parse(prox);
                    opts.path = opts.pathname = path;
                    opts.headers = heads;
                    opts.method = method;
                    urltotest = match[0];
                }
                else { node.warn("Bad proxy url: "+process.env.http_proxy); }
            }
            var req = ((/^https/.test(urltotest))?https:http).request(opts,function(res) {
                res.setEncoding('utf8');
                var statusCode = res.statusCode;
                res.on('data',function(chunk) {
                    //node.warn(chunk);
                });
                res.on('end',function() {
                    if ((statusCode !== 200) && (statusCode !== 201)) {
                        node.warn("hass-post: API call " + url + ", statusCode " + statusCode);
                        node.status({fill:"red",shape:"ring",text:"API error " + statusCode});
                    }
                    if (node.metric()) {
                        // Calculate request time
                        var diff = process.hrtime(preRequestTimestamp);
                        var ms = diff[0] * 1e3 + diff[1] * 1e-6;
                        var metricRequestDurationMillis = ms.toFixed(3);
                        node.metric("duration.millis", msg, metricRequestDurationMillis);
                        if (res.client && res.client.bytesRead) {
                            node.metric("size.bytes", msg, res.client.bytesRead);
                        }
                    }
                    node.status({});
                });
            });
            req.setTimeout(node.reqTimeout, function() {
                node.error(RED._("common.notification.errors.no-response"),msg);
                setTimeout(function() {
                    node.status({fill:"red",shape:"ring",text:"common.notification.errors.no-response"});
                },10);
                req.abort();
            });
            req.on('error',function(err) {
                node.error("hass-post error: " + err.toString());
                node.status({fill:"red",shape:"ring",text:err.code});
            });
            if (payload) {
                req.write(payload);
            }
            req.end();
        });
    }

    RED.nodes.registerType("hass-post",HassPostNode);
}
