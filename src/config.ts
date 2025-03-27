import dotenv from 'dotenv';

dotenv.config();

export const config = {
  GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || '',
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || '',
  AWS_REGION: process.env.AWS_REGION || '',
  BEDROCK_MODEL_ID: process.env.BEDROCK_MODEL_ID || '',
  PORT: process.env.PORT || 3000,
};
