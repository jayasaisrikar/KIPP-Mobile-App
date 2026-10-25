import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import Storage from '../lib/storage';
import type { UserProfile, Message, Memory, Task, Reminder, ConnectedAccount, Device, CalendarEvent } from '../types';

export type LlmSettings = { baseUrl: string; model: string };

export const DEFAULT_LLM: LlmSettings = {
  baseUrl: 'https://opencode.ai/inference/go/openai/v1',
  model: 'muse-spark-1.3-contributor',
};

type AppState = {
  user: UserProfile | null;
  setUser: (u: UserProfile | null) => void;
  onboardingDone: boolean;
  setOnboardingDone: (v: boolean) => void;
  conversationId: string | null;
  setConversationId: (id: string | null) => void;
  messages: Message[];
  setMessages: (m: Message[]) => void;
  addMessage: (m: Message) => void;
  memories: Memory[];
  setMemories: (m: Memory[]) => void;
  addMemory: (m: Memory) => void;
  tasks: Task[];
  setTasks: (t: Task[]) => void;
  addTask: (t: Task) => void;
  reminders: Reminder[];
  setReminders: (r: Reminder[]) => void;
  addReminder: (r: Reminder) => void;
  events: CalendarEvent[];
  setEvents: (e: CalendarEvent[]) => void;
  accounts: ConnectedAccount[];
  setAccounts: (a: ConnectedAccount[]) => void;
  device: Device | null;
  setDevice: (d: Device | null) => void;
  recording: boolean;
  setRecording: (v: boolean) => void;
  phase: 'idle' | 'listening' | 'thinking' | 'speaking' | 'action';
  setPhase: (p: AppState['phase']) => void;
  voiceEnabled: boolean;
  setVoiceEnabled: (v: boolean) => void;
  reducedMotion: boolean;
  setReducedMotion: (v: boolean) => void;
  llm: LlmSettings;
  setLlm: (l: Partial<LlmSettings>) => void;
  reset: () => void;
};

const initialData = {
  user: null,
  onboardingDone: false,
  conversationId: null,
  messages: [],
  memories: [],
  tasks: [],
  reminders: [],
  accounts: [],
  events: [],
  device: null,
  recording: false,
  phase: 'idle' as const,
  voiceEnabled: true,
  reducedMotion: false,
  llm: DEFAULT_LLM,
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      ...initialData,
      setUser: (user) => set({ user }),
      setOnboardingDone: (onboardingDone) => set({ onboardingDone }),
      setConversationId: (conversationId) => set({ conversationId }),
      setMessages: (messages) => set({ messages }),
      addMessage: (m) => set((s) => ({ messages: [...s.messages, m] })),
      setMemories: (memories) => set({ memories }),
      addMemory: (m) => set((s) => ({ memories: [m, ...s.memories] })),
      setTasks: (tasks) => set({ tasks }),
      addTask: (t) => set((s) => ({ tasks: [t, ...s.tasks] })),
      setReminders: (reminders) => set({ reminders }),
      addReminder: (r) => set((s) => ({ reminders: [...s.reminders, r].sort((a, b) => a.triggerAt.localeCompare(b.triggerAt)) })),
      setAccounts: (accounts) => set({ accounts }),
      setEvents: (events) => set({ events }),
      setDevice: (device) => set({ device }),
      setRecording: (recording) => set({ recording }),
      setPhase: (phase) => set({ phase }),
      setVoiceEnabled: (voiceEnabled) => set({ voiceEnabled }),
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
      setLlm: (l) => set((s) => ({ llm: { ...s.llm, ...l } })),
      reset: () => set(initialData),
    }),
    {
      name: 'kipp-app',
      storage: createJSONStorage(() => Storage),
      // Transient UI state is not persisted.
      partialize: ({ phase, recording, ...rest }) => rest,
      version: 1,
      // v1: beam-free stopped working; move users still on it to Muse Spark.
      migrate: (state: any) => (state?.llm?.model === 'beam-free' ? { ...state, llm: { ...state.llm, model: DEFAULT_LLM.model } } : state),
    },
  ),
);
