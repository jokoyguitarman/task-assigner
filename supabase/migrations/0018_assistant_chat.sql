-- 0018_assistant_chat
--
-- Where the owner's conversations with the assistant live.
--
-- These were in browser localStorage while the chat was a shell, which was fine for
-- a shell and is not fine now: history that only exists on one device is lost when
-- the owner opens the app on their phone, and a proposal the assistant made cannot
-- reference a task id that only that browser knows about.
--
-- Scoped to the account rather than to the organization, which is stricter than most
-- of this schema. Every other owner-facing table is org-scoped because two owners of
-- the same restaurant group are looking at the same business. A conversation is not
-- the business, it is one person thinking out loud, and it will contain half-formed
-- instructions they decided against. There is no reason for a second admin to read it.
--
-- A branch never touches these tables at all. The assistant is owner-only, so both
-- policies require app_is_admin() rather than relying on the chat screen being the
-- only way in.

BEGIN;

CREATE TABLE IF NOT EXISTS public.chat_conversations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title           TEXT NOT NULL DEFAULT 'New chat',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The sidebar reads exactly this: one owner's conversations, most recent first.
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_time
    ON public.chat_conversations(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.chat_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content         TEXT NOT NULL,
    -- What the assistant intends to create, as shown on the confirmation card. Kept
    -- as the model produced it so the card can be re-rendered exactly as the owner
    -- saw it, including for a proposal they already decided on.
    proposal        JSONB,
    proposal_state  TEXT CHECK (proposal_state IN ('pending', 'confirmed', 'discarded')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- A proposal without a state would render a card with no buttons and no verdict;
    -- a state without a proposal is a verdict on nothing. `IS NULL` always yields a
    -- boolean, so unlike a BETWEEN this cannot pass by evaluating to NULL.
    CONSTRAINT chat_messages_proposal_paired
        CHECK ((proposal IS NULL) = (proposal_state IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation
    ON public.chat_messages(conversation_id, created_at);

CREATE TRIGGER chat_conversations_touch
    BEFORE UPDATE ON public.chat_conversations
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_conversations_own ON public.chat_conversations;
CREATE POLICY chat_conversations_own ON public.chat_conversations
    FOR ALL TO authenticated
    USING (user_id = auth.uid() AND public.app_is_admin())
    WITH CHECK (
        user_id = auth.uid()
        AND public.app_is_admin()
        AND organization_id = public.app_org_id()
    );

-- Reached through the conversation rather than carrying its own user_id, so a message
-- cannot outlive or escape the ownership of the thread it belongs to.
DROP POLICY IF EXISTS chat_messages_own ON public.chat_messages;
CREATE POLICY chat_messages_own ON public.chat_messages
    FOR ALL TO authenticated
    USING (
        public.app_is_admin()
        AND EXISTS (
            SELECT 1 FROM public.chat_conversations c
             WHERE c.id = conversation_id AND c.user_id = auth.uid()
        )
    )
    WITH CHECK (
        public.app_is_admin()
        AND organization_id = public.app_org_id()
        AND EXISTS (
            SELECT 1 FROM public.chat_conversations c
             WHERE c.id = conversation_id AND c.user_id = auth.uid()
        )
    );

REVOKE ALL ON TABLE public.chat_conversations FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.chat_messages      FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.chat_conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.chat_messages      TO authenticated;

COMMIT;
