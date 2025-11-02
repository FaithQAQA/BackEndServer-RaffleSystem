import { FakeOptions } from './core/core';
/**
 * Generate a random noun.
 *
 * @category text
 *
 * @example
 *
 * randNoun()
 *
 * @example
 *
 * randNoun({ length: 10 })
 *
 */
export declare function randNoun<Options extends FakeOptions = never>(options?: Options): import("./core/core").Return<string, Options>;
