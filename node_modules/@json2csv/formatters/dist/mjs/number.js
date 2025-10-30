export default function numberFormatter(opts = {}) {
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
//# sourceMappingURL=number.js.map