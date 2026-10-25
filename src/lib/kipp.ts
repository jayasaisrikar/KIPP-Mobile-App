import { Platform } from 'react-native';
import { kippTurnSchema } from './schemas';
import { getApiKey } from './secrets';
import { useAppStore } from '../stores/appStore';
import type { KippTurn, Message } from '../types';

export class KippError extends Error {}

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function localIsoNow() {
  const d = new Date();
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const pad = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, '0');
  const local = new Date(d.getTime() + off * 60000).toISOString().slice(0, 19);
  return `${local}${sign}${pad(off / 60)}:${pad(off % 60)}`;
}

function systemPrompt() {
  const { user, memories, tasks, reminders, events } = useAppStore.getState();
  const tz = user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const mem = user?.memoryEnabled === false ? [] : memories.filter((m) => !m.deletedAt).slice(0, 30);
  const openTasks = tasks.filter((t) => t.status === 'todo').slice(0, 20);
  const upcoming = reminders.filter((r) => r.enabled && r.triggerAt > new Date().toISOString()).slice(0, 10);
  const style = { concise: 'Keep replies to one or two short sentences.', balanced: 'Keep replies brief and warm.', detailed: 'Give helpful detail when useful.' }[user?.responseStyle || 'balanced'];
  const persona = { calm: 'calm and gentle', balanced: 'friendly, dry-witted', playful: 'playful and upbeat' }[user?.personality || 'balanced'];

  return `You are KIPP, a small companion assistant on the user's phone. Personality: ${persona}. ${style}
User: ${user?.nickname || user?.displayName || 'friend'}. Timezone: ${tz}. Current local time: ${localIsoNow()}.
${mem.length ? `Known memories:\n${mem.map((m) => `- [${m.category}] ${m.text}`).join('\n')}` : 'No saved memories.'}
${openTasks.length ? `Open tasks:\n${openTasks.map((t) => `- ${t.title}${t.dueDate ? ` (due ${t.dueDate})` : ''}`).join('\n')}` : 'No open tasks.'}
${events.length ? `Calendar (next days):\n${events.slice(0, 15).map((e) => `- ${e.title} at ${e.start}${e.allDay ? ' (all day)' : ''}`).join('\n')}` : 'No calendar events (or calendar not connected).'}
${upcoming.length ? `Upcoming reminders:\n${upcoming.map((r) => `- ${r.title} at ${r.triggerAt}`).join('\n')}` : 'No upcoming reminders.'}

You can propose actions; the user must approve each one. Tools and args:
- "task.create": {"title": string, "notes"?: string, "dueDate"?: ISO-8601 with offset}
- "reminder.create": {"title": string, "triggerAt": ISO-8601 with offset, in the future}
- "calendar.event.create": {"title": string, "start": ISO-8601 with offset, "end"?: ISO-8601 with offset}
- "memory.save": {"text": string, "category": "Preferences"|"Projects"|"People"|"Other", "sensitive": boolean}${user?.memoryEnabled === false ? ' (memory is disabled — do not propose this)' : ''}
Resolve relative times ("at 6", "tomorrow") against the current local time. Only propose actions the user asked for.

Respond with ONLY a JSON object, no markdown:
{"reply": string, "emotion": "neutral"|"happy"|"curious"|"skeptical"|"concerned", "intent": "chat"|"task"|"reminder"|"calendar"|"memory", "proposedActions": [{"id": string, "tool": string, "args": object, "requiresConfirmation": true}]}`;
}

function extractJson(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { return null; }
}

// Reasoning models (e.g. Muse Spark) spend output tokens thinking before they answer, so budgets stay generous.
async function chat(messages: { role: string; content: string }[], maxTokens = 4096) {
  const apiKey = await getApiKey();
  if (!apiKey) throw new KippError('Add your OpenCode Go API key in You → Settings to talk to KIPP.');
  const { llm: { baseUrl, model }, conversationId, setConversationId } = useAppStore.getState();
  // OpenCode Go routes by a stable per-conversation session id.
  const sessionId = conversationId ?? newId();
  if (!conversationId) setConversationId(sessionId);
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, 'x-opencode-session': sessionId };
  if (Platform.OS !== 'web') headers['User-Agent'] = 'kipp-companion/1.0';
  // OpenCode Go serves Grok, GPT Luna and Muse Spark via the Responses API; others via chat/completions.
  const useResponses = /^(muse|gpt|grok)/i.test(model);
  const url = `${baseUrl.replace(/\/$/, '')}/${useResponses ? 'responses' : 'chat/completions'}`;
  const body = useResponses
    ? { model, input: messages, max_output_tokens: maxTokens, reasoning: { effort: 'low' } }
    : { model, messages, temperature: 0.4, max_tokens: maxTokens };
  let res: Response;
  try {
    res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  } catch {
    throw new KippError("Couldn't reach the model. Check your connection.");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (res.status === 401 || res.status === 403 || /credential|api key|unauthori/i.test(text)) throw new KippError('The API key was rejected. Check it in You → Settings.');
    throw new KippError(`Model error ${res.status}${text ? `: ${text.slice(0, 160)}` : ''}`);
  }
  const data = await res.json();
  const content: string | undefined = useResponses ? responsesText(data) : data?.choices?.[0]?.message?.content;
  if (!content) {
    const reason = data?.incomplete_details?.reason ?? data?.choices?.[0]?.finish_reason ?? data?.status;
    if (__DEV__) console.warn('[KIPP] empty model reply', JSON.stringify(data).slice(0, 1000));
    throw new KippError(`The model returned an empty reply${reason ? ` (${reason})` : ''}.`);
  }
  return content;
}

function responsesText(data: any): string | undefined {
  if (typeof data?.output_text === 'string' && data.output_text) return data.output_text;
  const parts = (data?.output ?? [])
    .filter((o: any) => o?.type === 'message')
    .flatMap((o: any) => o.content ?? [])
    .filter((c: any) => c?.type === 'output_text' && typeof c.text === 'string')
    .map((c: any) => c.text);
  return parts.length ? parts.join('') : undefined;
}

export async function askKipp(history: Message[]): Promise<KippTurn> {
  const content = await chat([
    { role: 'system', content: systemPrompt() },
    ...history.slice(-20).map((m) => ({ role: m.role, content: m.content })),
  ]);
  const parsed = kippTurnSchema.safeParse(extractJson(content));
  if (!parsed.success) {
    return { turnId: newId(), reply: content.trim(), emotion: 'neutral', intent: 'chat', proposedActions: [] };
  }
  return {
    turnId: newId(),
    reply: parsed.data.reply,
    emotion: parsed.data.emotion,
    intent: parsed.data.intent,
    proposedActions: parsed.data.proposedActions.map((a) => ({ ...a, id: newId(), state: 'proposed' as const })),
  };
}

export async function testConnection() {
  await chat([{ role: 'user', content: 'Reply with the single word: ok' }], 1024);
}
