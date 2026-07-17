import { UIMessage } from 'ai';
import { z } from 'zod';

// Metadata schema for audit trail
const messageMetadataSchema = z.object({
  createdAt: z.number().optional(),
  model: z.string().optional(),
  totalTokens: z.number().optional(),
  userId: z.string().optional(),
  persisted: z.boolean().optional(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

// Data part schemas for transient status updates
export type MyDataParts = {
  searchStatus: {
    message: string;
    level: 'info' | 'warning' | 'error';
  };
};

// Custom UIMessage type
export type MyUIMessage = UIMessage<MessageMetadata, MyDataParts>;
