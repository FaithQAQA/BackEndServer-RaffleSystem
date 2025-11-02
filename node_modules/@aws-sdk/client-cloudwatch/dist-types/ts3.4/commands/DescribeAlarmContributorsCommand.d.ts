import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import {
  CloudWatchClientResolvedConfig,
  ServiceInputTypes,
  ServiceOutputTypes,
} from "../CloudWatchClient";
import {
  DescribeAlarmContributorsInput,
  DescribeAlarmContributorsOutput,
} from "../models/models_0";
export { __MetadataBearer };
export { $Command };
export interface DescribeAlarmContributorsCommandInput
  extends DescribeAlarmContributorsInput {}
export interface DescribeAlarmContributorsCommandOutput
  extends DescribeAlarmContributorsOutput,
    __MetadataBearer {}
declare const DescribeAlarmContributorsCommand_base: {
  new (
    input: DescribeAlarmContributorsCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    DescribeAlarmContributorsCommandInput,
    DescribeAlarmContributorsCommandOutput,
    CloudWatchClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  new (
    input: DescribeAlarmContributorsCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    DescribeAlarmContributorsCommandInput,
    DescribeAlarmContributorsCommandOutput,
    CloudWatchClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
export declare class DescribeAlarmContributorsCommand extends DescribeAlarmContributorsCommand_base {
  protected static __types: {
    api: {
      input: DescribeAlarmContributorsInput;
      output: DescribeAlarmContributorsOutput;
    };
    sdk: {
      input: DescribeAlarmContributorsCommandInput;
      output: DescribeAlarmContributorsCommandOutput;
    };
  };
}
