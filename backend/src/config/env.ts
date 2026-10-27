import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env
dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('5000').transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  SESSION_SECRET: z.string().min(16, 'SESSION_SECRET must be at least 16 characters long'),
  NEO4J_URI: z.string().url('NEO4J_URI must be a valid connection URI (e.g., neo4j+s://...)'),
  NEO4J_USERNAME: z.string().min(1, 'NEO4J_USERNAME is required'),
  NEO4J_PASSWORD: z.string().min(1, 'NEO4J_PASSWORD is required'),
  NEO4J_DATABASE: z.string().optional().default('neo4j'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  // Extract only field names that failed validation — NEVER log the received values
  const missingOrInvalid = parsedEnv.error.issues.map((issue) => issue.path.join('.'));
  console.error(
    `[FATAL] Server environment validation failed. Invalid or missing variables: ${missingOrInvalid.join(', ')}`
  );
  process.exit(1);
}

export const env = parsedEnv.data;
