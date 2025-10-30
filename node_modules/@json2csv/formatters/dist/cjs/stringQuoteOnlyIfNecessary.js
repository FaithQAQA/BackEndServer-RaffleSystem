"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const string_js_1 = __importDefault(require("./string.js"));
function stringQuoteOnlyIfNecessaryFormatter(opts = {}) {
    const quote = typeof opts.quote === 'string' ? opts.quote : '"';
    const escapedQuote = typeof opts.escapedQuote === 'string'
        ? opts.escapedQuote
        : `${quote}${quote}`;
    const separator = typeof opts.separator === 'string' ? opts.separator : ',';
    const eol = typeof opts.eol === 'string' ? opts.eol : '\n';
    const stringFormatter = (0, string_js_1.default)({ quote, escapedQuote });
    return (value) => {
        if ([quote, separator, eol].some((char) => value.includes(char))) {
            return stringFormatter(value);
        }
        return value;
    };
}
exports.default = stringQuoteOnlyIfNecessaryFormatter;
//# sourceMappingURL=stringQuoteOnlyIfNecessary.js.map