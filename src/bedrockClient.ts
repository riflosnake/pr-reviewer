import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import { config } from "./config.js";

export const bedrockClient = new BedrockRuntimeClient({
  region: config.AWS_REGION,
  credentials: {
    accessKeyId: config.AWS_ACCESS_KEY_ID!,
    secretAccessKey: config.AWS_SECRET_ACCESS_KEY!,
  },
});