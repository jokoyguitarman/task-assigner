import { supabase } from '../lib/supabase';

// The owner's assistant, from the browser's side.
//
// Three different things are talked to here and the split matters:
//
//   Reads go straight to Postgres. Conversations and messages are ordinary rows
//   behind row-level security scoped to the signed-in owner, so there is no reason
//   to pay for a function invocation to list them.
//
//   Sending goes to the `assistant` edge function, because it is the only place
//   that holds the OpenAI key.
//
//   Confirming goes to the confirm_chat_proposal database function, which re-reads
//   the stored proposal rather than accepting one from here. That is deliberate:
//   what the owner approved is what was on the card, not whatever this file sends.

export type ChatRole = 'user' | 'assistant';
export type ProposalState = 'pending' | 'confirmed' | 'discarded';

// Shaped by the edge function, which resolves the names alongside the ids so the
// card cannot describe one branch while the ids would create work at another.
export interface ProposedTask {
  title: string;
  description?: string | null;
  areaName?: string;
  shiftName?: string;
  dueTime?: string | null;
  recurrence?: 'once' | 'daily' | 'weekly' | 'monthly';
  weekday?: number | null;
  dayOfMonth?: number | null;
  onDate?: string | null;
  outletNames?: string[];
  estimatedMinutes?: number;
  isHighPriority?: boolean;
  requiresPhoto?: boolean;
  answerType?: 'none' | 'condition' | 'text' | 'number';
  answerPrompt?: string | null;
}

export interface Proposal {
  summary: string;
  tasks: ProposedTask[];
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  proposal?: Proposal | null;
  proposalState?: ProposalState | null;
}

// Sidebar rows. Messages are fetched when a conversation is opened rather than
// carried here, so the list stays cheap however long the history gets.
export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const ordinal = (n: number): string => {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
  return `${n}${suffix}`;
};

// "every Monday", "on the 15th", "once". The model returns the anchor as a number
// because that is what the database stores; nobody wants to read "weekday 1".
export const recurrenceLabel = (task: ProposedTask): string | null => {
  switch (task.recurrence) {
    case 'daily':
      return 'every day';
    case 'weekly':
      return typeof task.weekday === 'number' ? `every ${WEEKDAYS[task.weekday]}` : 'every week';
    case 'monthly':
      return typeof task.dayOfMonth === 'number'
        ? `monthly on the ${ordinal(task.dayOfMonth)}`
        : 'every month';
    default:
      return null;
  }
};

const toConversation = (row: any): Conversation => ({
  id: row.id,
  title: row.title,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toMessage = (row: any): ChatMessage => ({
  id: row.id,
  role: row.role,
  content: row.content,
  createdAt: row.created_at,
  proposal: row.proposal ?? null,
  proposalState: row.proposal_state ?? null,
});

export const assistantService = {
  async listConversations(): Promise<Conversation[]> {
    const { data, error } = await supabase
      .from('chat_conversations')
      .select('id, title, created_at, updated_at')
      .order('updated_at', { ascending: false });

    if (error) throw error;

    return (data ?? []).map(toConversation);
  },

  async loadMessages(conversationId: string): Promise<ChatMessage[]> {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('id, role, content, proposal, proposal_state, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return (data ?? []).map(toMessage);
  },

  // Both messages come back from the function rather than being echoed optimistically,
  // because the ids are what the confirm step is keyed on.
  async send(
    message: string,
    conversationId?: string
  ): Promise<{ conversationId: string; userMessage: ChatMessage; reply: ChatMessage }> {
    const { data, error } = await supabase.functions.invoke('assistant', {
      body: { message, conversationId },
    });

    // A non-2xx from the function arrives as a FunctionsHttpError whose useful part
    // is in the response body, not in error.message — which on its own only ever
    // says "non-2xx status code".
    if (error) {
      const detail = await readFunctionError(error);
      throw new Error(detail ?? 'The assistant could not be reached.');
    }

    if (data?.error) throw new Error(data.error);

    return {
      conversationId: data.conversationId,
      userMessage: toMessage(data.userMessage),
      reply: toMessage(data.reply),
    };
  },

  async confirm(messageId: string): Promise<{ taskIds: string[]; assignmentsCreated: number }> {
    const { data, error } = await supabase.rpc('confirm_chat_proposal', {
      p_message_id: messageId,
    });

    if (error) throw error;

    return {
      taskIds: data?.taskIds ?? [],
      assignmentsCreated: data?.assignmentsCreated ?? 0,
    };
  },

  // Nothing was created, so this is only a record of the owner's decision and needs
  // no audit row of its own.
  async discard(messageId: string): Promise<void> {
    const { error } = await supabase
      .from('chat_messages')
      .update({ proposal_state: 'discarded' })
      .eq('id', messageId);

    if (error) throw error;
  },

  async removeConversation(conversationId: string): Promise<void> {
    const { error } = await supabase
      .from('chat_conversations')
      .delete()
      .eq('id', conversationId);

    if (error) throw error;
  },
};

const readFunctionError = async (error: unknown): Promise<string | null> => {
  const response = (error as { context?: Response })?.context;
  if (!response || typeof response.json !== 'function') return null;

  try {
    const body = await response.json();
    if (typeof body?.error !== 'string') return null;

    // The function passes OpenAI's own words through on a 502. Showing them beats
    // a generic failure, which reads the same whether the model name is wrong or
    // the network is down.
    return typeof body?.detail === 'string' && body.detail
      ? `${body.error} ${body.detail}`
      : body.error;
  } catch {
    return null;
  }
};
