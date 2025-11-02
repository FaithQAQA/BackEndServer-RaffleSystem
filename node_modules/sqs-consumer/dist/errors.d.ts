declare class SQSError extends Error {
    code: string;
    statusCode: number;
    service: string;
    time: Date;
    retryable: boolean;
    fault: 'client' | 'server';
    constructor(message: string);
}
declare class TimeoutError extends Error {
    constructor(message?: string);
}
export { SQSError, TimeoutError };
