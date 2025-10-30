"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const quote = '"';
const escapedQuote = '""""';
const quoteRegExp = new RegExp(quote, 'g');
function stringExcel(value) {
    return `"=""${value.replace(quoteRegExp, escapedQuote)}"""`;
}
exports.default = stringExcel;
//# sourceMappingURL=stringExcel.js.map