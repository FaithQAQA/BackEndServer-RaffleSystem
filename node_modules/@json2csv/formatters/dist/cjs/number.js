"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function numberFormatter(opts = {}) {
    const { separator, decimals } = opts;
    if (separator) {
        if (decimals) {
            return (value) => value.toFixed(decimals).replace('.', separator);
        }
        return (value) => `${value}`.replace('.', separator);
    }
    if (decimals) {
        return (value) => value.toFixed(decimals);
    }
    return (value) => `${value}`;
}
exports.default = numberFormatter;
//# sourceMappingURL=number.js.map