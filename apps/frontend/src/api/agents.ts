import { agentsUrl } from './paths';
import { getTenantContext } from '@/auth/session';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface MoEChatResponse {
  id?: string;
  choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
  trackmind?: {
    expertDomain?: string;
    confidence?: number;
    evidence?: string[];
    limitations?: string[];
    modelVersion?: string;
    promptCardId?: string;
    policyDecision?: string;
    proposedAction?: string;
  };
}

export async function sendChatCompletion(messages: ChatMessage[]): Promise<MoEChatResponse> {
  const tenantContext = getTenantContext();
  const response = await fetch(agentsUrl('/v1/chat/completions'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-trackmind-tenant-id': tenantContext.tenantId,
      'x-trackmind-racetrack-id': tenantContext.racetrackId,
      'x-trackmind-role': tenantContext.role,
    },
    body: JSON.stringify({
      model: 'trackmind-moe',
      messages,
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`MoE router unavailable (${response.status})`);
  }

  return response.json() as Promise<MoEChatResponse>;
}
