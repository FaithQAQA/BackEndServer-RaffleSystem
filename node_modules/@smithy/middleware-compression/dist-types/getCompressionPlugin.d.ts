import type { Pluggable } from "@smithy/types";
import type { CompressionMiddlewareConfig } from "./compressionMiddleware";
import type { CompressionPreviouslyResolved, CompressionResolvedConfig } from "./configurations";
/**
 * @internal
 */
export declare const getCompressionPlugin: (config: CompressionResolvedConfig & CompressionPreviouslyResolved, middlewareConfig: CompressionMiddlewareConfig) => Pluggable<any, any>;
