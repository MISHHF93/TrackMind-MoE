import { useMutation } from '@tanstack/react-query';
import { MessageSquare, Send } from 'lucide-react';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { sendChatCompletion, type ChatMessage } from '@/api/agents';
import { Button } from '@/design/components/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/design/components/card';
import { Badge } from '@/design/components/badge';

export function MoEChatPanel(): ReactElement {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'system', content: 'TrackMind MoE assistant — advisory only. Protected actions require human approval.' },
  ]);
  const [input, setInput] = useState('');
  const [open, setOpen] = useState(false);

  const chat = useMutation({
    mutationFn: async (userMessage: string) => {
      const nextMessages: ChatMessage[] = [...messages.filter((m) => m.role !== 'system'), { role: 'user', content: userMessage }];
      const response = await sendChatCompletion(nextMessages);
      const content = response.choices?.[0]?.message?.content ?? 'No response from MoE router.';
      return { response, content, userMessage };
    },
    onSuccess: ({ response, content, userMessage }) => {
      const meta = response.trackmind;
      const enriched = meta
        ? `${content}\n\n[Expert: ${meta.expertDomain ?? 'unknown'} | Confidence: ${meta.confidence ?? 'n/a'} | Policy: ${meta.policyDecision ?? 'advisory'}]`
        : content;
      setMessages((prev) => [...prev, { role: 'user', content: userMessage }, { role: 'assistant', content: enriched }]);
      setInput('');
    },
  });

  if (!open) {
    return (
      <Button className="fixed bottom-4 right-4 z-40 shadow-lg" onClick={() => setOpen(true)}>
        <MessageSquare className="h-4 w-4" />
        TrackMind Assistant
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-4 right-4 z-40 w-[min(24rem,calc(100vw-2rem))] shadow-xl">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">TrackMind Assistant</CardTitle>
            <CardDescription>MoE advisory — no autonomous execution</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Close</Button>
        </div>
        <Badge variant="maroon">Advisory only</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="max-h-56 overflow-y-auto space-y-2 text-sm">
          {messages.filter((m) => m.role !== 'system').map((message, index) => (
            <div key={index} className={`rounded-md p-2 ${message.role === 'user' ? 'bg-[var(--muted)]' : 'border border-[var(--border)]'}`}>
              <p className="text-xs font-semibold uppercase text-[var(--muted-foreground)]">{message.role}</p>
              <p className="whitespace-pre-wrap mt-1">{message.content}</p>
            </div>
          ))}
          {chat.isError ? <p className="text-sm text-[var(--status-critical)]">{(chat.error as Error).message}</p> : null}
        </div>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about race-day operations…"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && input.trim()) chat.mutate(input.trim());
            }}
          />
          <Button size="icon" disabled={!input.trim() || chat.isPending} onClick={() => chat.mutate(input.trim())}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
