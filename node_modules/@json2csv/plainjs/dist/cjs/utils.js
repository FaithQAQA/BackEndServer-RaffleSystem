"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fastJoin = exports.flattenReducer = exports.getProp = void 0;
const rePropName = RegExp(
// Match anything that isn't a dot or bracket.
'[^.[\\]]+' +
    '|' +
    // Or match property names within brackets.
    '\\[(?:' +
    // Match a non-string expression.
    '([^"\'][^[]*)' +
    '|' +
    // Or match strings (supports escaping characters).
    '(["\'])((?:(?!\\2)[^\\\\]|\\\\.)*?)\\2' +
    ')\\]' +
    '|' +
    // Or match "" as the space between consecutive dots or empty brackets.
    '(?=(?:\\.|\\[\\])(?:\\.|\\[\\]|$))', 'g');
function castPath(value) {
    var _a, _b, _c;
    const result = [];
    let match;
    while ((match = rePropName.exec(value))) {
        result.push((_c = (_a = match[3]) !== null && _a !== void 0 ? _a : (_b = match[1]) === null || _b === void 0 ? void 0 : _b.trim()) !== null && _c !== void 0 ? _c : match[0]);
    }
    return result;
}
function getProp(obj, path, defaultValue) {
    if (path in obj) {
        const value = obj[path];
        return value === undefined ? defaultValue : value;
    }
    const processedPath = Array.isArray(path) ? path : castPath(path, obj);
    let currentValue = obj;
    for (const key of processedPath) {
        currentValue = currentValue === null || currentValue === void 0 ? void 0 : currentValue[key];
        if (currentValue === undefined)
            return defaultValue;
    }
    return currentValue;
}
exports.getProp = getProp;
function flattenReducer(acc, arr) {
    try {
        // This is faster but susceptible to `RangeError: Maximum call stack size exceeded`
        Array.isArray(arr) ? acc.push(...arr) : acc.push(arr);
        return acc;
    }
    catch (err) {
        // Fallback to a slower but safer option
        return acc.concat(arr);
    }
}
exports.flattenReducer = flattenReducer;
function fastJoin(arr, separator) {
    let isFirst = true;
    return arr.reduce((acc, elem) => {
        if (elem === null || elem === undefined) {
            elem = '';
        }
        if (isFirst) {
            isFirst = false;
            return `${elem}`;
        }
        return `${acc}${separator}${elem}`;
    }, '');
}
exports.fastJoin = fastJoin;
//# sourceMappingURL=utils.js.map