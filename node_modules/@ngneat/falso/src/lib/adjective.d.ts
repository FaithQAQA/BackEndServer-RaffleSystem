import { FakeOptions } from './core/core';
/**
 * Generate a random adjective.
 *
 * @category text
 *
 * @example
 *
 * randAdjective()
 *
 * @example
 *
 * randAdjective({ length: 10 })
 *
 */
export declare function randAdjective<Options extends FakeOptions = never>(options?: Options): import("./core/core").Return<string, Options>;
