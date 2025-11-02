/// <reference types="node" />
import { SQSClient, Message } from '@aws-sdk/client-sqs';
import { EventEmitter } from 'events';
export interface ConsumerOptions {
    queueUrl?: string;
    attributeNames?: string[];
    messageAttributeNames?: string[];
    stopped?: boolean;
    batchSize?: number;
    visibilityTimeout?: number;
    waitTimeSeconds?: number;
    authenticationErrorTimeout?: number;
    pollingWaitTimeMs?: number;
    terminateVisibilityTimeout?: boolean;
    heartbeatInterval?: number;
    sqs?: SQSClient;
    region?: string;
    handleMessageTimeout?: number;
    shouldDeleteMessages?: boolean;
    handleMessage?(message: Message): Promise<void>;
    handleMessageBatch?(messages: Message[]): Promise<void>;
}
interface Events {
    response_processed: [];
    empty: [];
    message_received: [Message];
    message_processed: [Message];
    error: [Error, void | Message | Message[]];
    timeout_error: [Error, Message];
    processing_error: [Error, Message];
    stopped: [];
}
export declare class Consumer extends EventEmitter {
    private queueUrl;
    private handleMessage;
    private handleMessageBatch;
    private handleMessageTimeout;
    private attributeNames;
    private messageAttributeNames;
    private stopped;
    private batchSize;
    private visibilityTimeout;
    private waitTimeSeconds;
    private authenticationErrorTimeout;
    private pollingWaitTimeMs;
    private terminateVisibilityTimeout;
    private heartbeatInterval;
    private sqs;
    private shouldDeleteMessages;
    constructor(options: ConsumerOptions);
    emit<T extends keyof Events>(event: T, ...args: Events[T]): boolean;
    on<T extends keyof Events>(event: T, listener: (...args: Events[T]) => void): this;
    once<T extends keyof Events>(event: T, listener: (...args: Events[T]) => void): this;
    get isRunning(): boolean;
    static create(options: ConsumerOptions): Consumer;
    start(): void;
    stop(): void;
    private handleSqsResponse;
    private processMessage;
    private receiveMessage;
    private deleteMessage;
    private executeHandler;
    private changeVisibilityTimeout;
    private emitError;
    private poll;
    private processMessageBatch;
    private deleteMessageBatch;
    private executeBatchHandler;
    private changeVisibilityTimeoutBatch;
    private startHeartbeat;
}
export {};
