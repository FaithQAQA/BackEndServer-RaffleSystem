'use strict';

var utilConfigProvider = require('@smithy/util-config-provider');
var core = require('@smithy/core');
var protocolHttp = require('@smithy/protocol-http');
var zlib = require('zlib');
var utilUtf8 = require('@smithy/util-utf8');
var util = require('util');
var isArrayBuffer = require('@smithy/is-array-buffer');
var utilMiddleware = require('@smithy/util-middleware');

const NODE_DISABLE_REQUEST_COMPRESSION_ENV_NAME = "AWS_DISABLE_REQUEST_COMPRESSION";
const NODE_DISABLE_REQUEST_COMPRESSION_INI_NAME = "disable_request_compression";
const DEFAULT_DISABLE_REQUEST_COMPRESSION = false;
const NODE_DISABLE_REQUEST_COMPRESSION_CONFIG_OPTIONS = {
    environmentVariableSelector: (env) => utilConfigProvider.booleanSelector(env, NODE_DISABLE_REQUEST_COMPRESSION_ENV_NAME, utilConfigProvider.SelectorType.ENV),
    configFileSelector: (profile) => utilConfigProvider.booleanSelector(profile, NODE_DISABLE_REQUEST_COMPRESSION_INI_NAME, utilConfigProvider.SelectorType.CONFIG),
    default: DEFAULT_DISABLE_REQUEST_COMPRESSION,
};

const NODE_REQUEST_MIN_COMPRESSION_SIZE_BYTES_ENV_NAME = "AWS_REQUEST_MIN_COMPRESSION_SIZE_BYTES";
const NODE_REQUEST_MIN_COMPRESSION_SIZE_BYTES_INI_NAME = "request_min_compression_size_bytes";
const DEFAULT_NODE_REQUEST_MIN_COMPRESSION_SIZE_BYTES = 10240;
const NODE_REQUEST_MIN_COMPRESSION_SIZE_BYTES_CONFIG_OPTIONS = {
    environmentVariableSelector: (env) => utilConfigProvider.numberSelector(env, NODE_REQUEST_MIN_COMPRESSION_SIZE_BYTES_ENV_NAME, utilConfigProvider.SelectorType.ENV),
    configFileSelector: (profile) => utilConfigProvider.numberSelector(profile, NODE_REQUEST_MIN_COMPRESSION_SIZE_BYTES_INI_NAME, utilConfigProvider.SelectorType.CONFIG),
    default: DEFAULT_NODE_REQUEST_MIN_COMPRESSION_SIZE_BYTES,
};

const compressStream = async (body) => body.pipe(zlib.createGzip());

const gzipAsync = util.promisify(zlib.gzip);
const compressString = async (body) => {
    try {
        const compressedBuffer = await gzipAsync(utilUtf8.toUint8Array(body || ""));
        return utilUtf8.toUint8Array(compressedBuffer);
    }
    catch (err) {
        throw new Error("Failure during compression: " + err.message);
    }
};

var CompressionAlgorithm;
(function (CompressionAlgorithm) {
    CompressionAlgorithm["GZIP"] = "gzip";
})(CompressionAlgorithm || (CompressionAlgorithm = {}));
const CLIENT_SUPPORTED_ALGORITHMS = [CompressionAlgorithm.GZIP];

const isStreaming = (body) => body !== undefined && typeof body !== "string" && !ArrayBuffer.isView(body) && !isArrayBuffer.isArrayBuffer(body);

const compressionMiddleware = (config, middlewareConfig) => (next, context) => async (args) => {
    if (!protocolHttp.HttpRequest.isInstance(args.request)) {
        return next(args);
    }
    const disableRequestCompression = await config.disableRequestCompression();
    if (disableRequestCompression) {
        return next(args);
    }
    const { request } = args;
    const { body, headers } = request;
    const { encodings, streamRequiresLength } = middlewareConfig;
    let updatedBody = body;
    let updatedHeaders = headers;
    for (const algorithm of encodings) {
        if (CLIENT_SUPPORTED_ALGORITHMS.includes(algorithm)) {
            let isRequestCompressed = false;
            if (isStreaming(body)) {
                if (!streamRequiresLength) {
                    updatedBody = await compressStream(body);
                    isRequestCompressed = true;
                }
                else {
                    throw new Error("Compression is not supported for streaming blobs that require a length.");
                }
            }
            else {
                const bodyLength = config.bodyLengthChecker(body);
                const requestMinCompressionSizeBytes = await config.requestMinCompressionSizeBytes();
                if (bodyLength && bodyLength >= requestMinCompressionSizeBytes) {
                    updatedBody = await compressString(body);
                    isRequestCompressed = true;
                }
            }
            if (isRequestCompressed) {
                if (headers["content-encoding"]) {
                    updatedHeaders = {
                        ...headers,
                        "content-encoding": `${headers["content-encoding"]}, ${algorithm}`,
                    };
                }
                else {
                    updatedHeaders = { ...headers, "content-encoding": algorithm };
                }
                if (updatedHeaders["content-encoding"].includes("gzip")) {
                    core.setFeature(context, "GZIP_REQUEST_COMPRESSION", "L");
                }
                break;
            }
        }
    }
    return next({
        ...args,
        request: {
            ...request,
            body: updatedBody,
            headers: updatedHeaders,
        },
    });
};
const compressionMiddlewareOptions = {
    name: "compressionMiddleware",
    step: "build",
    tags: ["REQUEST_BODY_COMPRESSION", "GZIP"],
    override: true,
    priority: "high",
};

const getCompressionPlugin = (config, middlewareConfig) => ({
    applyToStack: (clientStack) => {
        clientStack.add(compressionMiddleware(config, middlewareConfig), compressionMiddlewareOptions);
    },
});

const resolveCompressionConfig = (input) => {
    const { disableRequestCompression, requestMinCompressionSizeBytes: _requestMinCompressionSizeBytes } = input;
    return Object.assign(input, {
        disableRequestCompression: utilMiddleware.normalizeProvider(disableRequestCompression),
        requestMinCompressionSizeBytes: async () => {
            const requestMinCompressionSizeBytes = await utilMiddleware.normalizeProvider(_requestMinCompressionSizeBytes)();
            if (requestMinCompressionSizeBytes < 0 || requestMinCompressionSizeBytes > 10485760) {
                throw new RangeError("The value for requestMinCompressionSizeBytes must be between 0 and 10485760 inclusive. " +
                    `The provided value ${requestMinCompressionSizeBytes} is outside this range."`);
            }
            return requestMinCompressionSizeBytes;
        },
    });
};

exports.DEFAULT_DISABLE_REQUEST_COMPRESSION = DEFAULT_DISABLE_REQUEST_COMPRESSION;
exports.DEFAULT_NODE_REQUEST_MIN_COMPRESSION_SIZE_BYTES = DEFAULT_NODE_REQUEST_MIN_COMPRESSION_SIZE_BYTES;
exports.NODE_DISABLE_REQUEST_COMPRESSION_CONFIG_OPTIONS = NODE_DISABLE_REQUEST_COMPRESSION_CONFIG_OPTIONS;
exports.NODE_DISABLE_REQUEST_COMPRESSION_ENV_NAME = NODE_DISABLE_REQUEST_COMPRESSION_ENV_NAME;
exports.NODE_DISABLE_REQUEST_COMPRESSION_INI_NAME = NODE_DISABLE_REQUEST_COMPRESSION_INI_NAME;
exports.NODE_REQUEST_MIN_COMPRESSION_SIZE_BYTES_CONFIG_OPTIONS = NODE_REQUEST_MIN_COMPRESSION_SIZE_BYTES_CONFIG_OPTIONS;
exports.NODE_REQUEST_MIN_COMPRESSION_SIZE_BYTES_ENV_NAME = NODE_REQUEST_MIN_COMPRESSION_SIZE_BYTES_ENV_NAME;
exports.NODE_REQUEST_MIN_COMPRESSION_SIZE_BYTES_INI_NAME = NODE_REQUEST_MIN_COMPRESSION_SIZE_BYTES_INI_NAME;
exports.compressionMiddleware = compressionMiddleware;
exports.compressionMiddlewareOptions = compressionMiddlewareOptions;
exports.getCompressionPlugin = getCompressionPlugin;
exports.resolveCompressionConfig = resolveCompressionConfig;
