import { create } from 'zustand';
import type { UserProfile, Message, Memory, Task, Reminder, ConnectedAccount, Device } from '../types';

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
  tasks: Task[];
  setTasks: (t: Task[]) => void;
  reminders: Reminder[];
  setReminders: (r: Reminder[]) => void;
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
};

export const useAppStore = create<AppState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  onboardingDone: false,
  setOnboardingDone: (onboardingDone) => set({ onboardingDone }),
  conversationId: null,
  setConversationId: (conversationId) => set({ conversationId }),
  messages: [],
  setMessages: (messages) => set({ messages }),
  addMessage: (m) => set((s) => ({ messages: [...s.messages, m] })),
  memories: [],
  setMemories: (memories) => set({ memories }),
  tasks: [],
  setTasks: (tasks) => set({ tasks }),
  reminders: [],
  setReminders: (reminders) => set({ reminders }),
  accounts: [],
  setAccounts: (accounts) => set({ accounts }),
  device: null,
  setDevice: (device) => set({ device }),
  recording: false,
  setRecording: (recording) => set({ recording }),
  phase: 'idle',
  setPhase: (phase) => set({ phase }),
  voiceEnabled: true,
  setVoiceEnabled: (voiceEnabled) => set({ voiceEnabled }),
  reducedMotion: false,
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
}));
