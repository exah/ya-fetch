"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var tslib_1 = require("tslib");
var CONTENT_TYPES = {
    json: 'application/json',
    text: 'text/*',
    formData: 'multipart/form-data',
    arrayBuffer: '*/*',
    blob: '*/*',
};
var ResponseError = /** @class */ (function (_super) {
    tslib_1.__extends(ResponseError, _super);
    function ResponseError(response) {
        var _this = _super.call(this, response.statusText) || this;
        _this.name = 'ResponseError';
        _this.response = response;
        return _this;
    }
    return ResponseError;
}(Error));
exports.ResponseError = ResponseError;
var TimeoutError = /** @class */ (function (_super) {
    tslib_1.__extends(TimeoutError, _super);
    function TimeoutError() {
        var _this = _super.call(this, 'Request timed out') || this;
        _this.name = 'TimeoutError';
        return _this;
    }
    return TimeoutError;
}(Error));
exports.TimeoutError = TimeoutError;
function isAborted(error) {
    return error.name === 'AbortError';
}
exports.isAborted = isAborted;
function isTimeout(error) {
    return error instanceof TimeoutError;
}
exports.isTimeout = isTimeout;
function handleResponse(response) {
    if (response.ok) {
        return response;
    }
    throw new ResponseError(response);
}
function request(baseResource, baseInit) {
    var json = baseInit.json, query = baseInit.query, timeout = baseInit.timeout, _a = baseInit.prefixUrl, prefixUrl = _a === void 0 ? '' : _a, options = tslib_1.__rest(baseInit, ["json", "query", "timeout", "prefixUrl"]);
    var searchParams = query ? '?' + new window.URLSearchParams(query) : '';
    var resource = prefixUrl + baseResource + searchParams;
    var headers = new window.Headers(tslib_1.__assign({}, options.headers));
    var init = tslib_1.__assign(tslib_1.__assign({}, options), { credentials: 'same-origin', headers: headers });
    if (json != null) {
        init.body = JSON.stringify(json);
        headers.set('content-type', CONTENT_TYPES.json);
    }
    if (options.body instanceof window.FormData) {
        headers.set('content-type', CONTENT_TYPES.formData);
    }
    var promise = new Promise(function (resolve, reject) {
        var timerID;
        if (timeout > 0) {
            var controller_1 = new window.AbortController();
            timerID = setTimeout(function () {
                reject(new TimeoutError());
                controller_1.abort();
            }, timeout);
            if (options.signal) {
                options.signal.addEventListener('abort', function () {
                    clearTimeout(timerID);
                    controller_1.abort();
                });
            }
            init.signal = controller_1.signal;
        }
        window
            .fetch(resource, init)
            .then(handleResponse)
            .then(resolve, reject)
            .then(function () { return clearTimeout(timerID); });
    });
    var _loop_1 = function (key, type) {
        promise[key] = function () {
            headers.set('accept', type);
            return promise
                .then(function (response) { return response.clone(); })
                .then(function (response) { return response[key](); });
        };
    };
    for (var _i = 0, _b = Object.entries(CONTENT_TYPES); _i < _b.length; _i++) {
        var _c = _b[_i], key = _c[0], type = _c[1];
        _loop_1(key, type);
    }
    return promise;
}
var mergeOptions = function (left, right) {
    if (left === void 0) { left = {}; }
    if (right === void 0) { right = {}; }
    return (tslib_1.__assign(tslib_1.__assign(tslib_1.__assign({}, left), right), { headers: tslib_1.__assign(tslib_1.__assign({}, left.headers), right.headers) }));
};
function create(baseOptions) {
    var extend = function (options) {
        return create(mergeOptions(baseOptions, options));
    };
    var createMethod = function (method) { return function (resource, options) { return request(resource, mergeOptions(baseOptions, tslib_1.__assign({ method: method }, options))); }; };
    var methods = {
        create: create,
        extend: extend,
        get: createMethod('GET'),
        post: createMethod('POST'),
        put: createMethod('PUT'),
        patch: createMethod('PATCH'),
        head: createMethod('HEAD'),
        delete: createMethod('DELETE'),
    };
    return Object.assign(methods.get, methods);
}
exports.create = create;
exports.default = create();
var api = create();
api
    .get('/post')
    .json()
    .then(function (data) { return console.log(data); });
//# sourceMappingURL=index.js.map