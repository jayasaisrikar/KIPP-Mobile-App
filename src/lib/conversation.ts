import { askKipp, KippError } from './kipp';
import { useAppStore } from '../stores/appStore';
import type { KippTurn, Message } from '../types';

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export type TurnResult = { ok: true; turn: KippTurn } | { ok: false; error: string };

/**
 * One conversation turn shared by typing, push-to-talk and hands-free: record the user's message,
 * ask KIPP, record the reply (with any proposed actions). Speaking the reply is up to the caller.
 */
export async function runTurn(text: string): Promise<TurnResult> {
  const { addMessage, setPhase } = useAppStore.getState();
  const userMsg: Message = { id: newId(), conversationId: 'local', role: 'user', content: text.trim(), createdAt: new Date().toISOString() };
  addMessage(userMsg);
  setPhase('thinking');
  try {
    const turn = await askKipp(useAppStore.getState().messages);
    addMessage({ id: turn.turnId, conversationId: 'local', role: 'assistant', content: turn.reply, emotion: turn.emotion, actions: turn.proposedActions, createdAt: new Date().toISOString() });
    return { ok: true, turn };
  } catch (e) {
    return { ok: false, error: e instanceof KippError ? e.message : 'Something went wrong. Try again.' };
  }
}
