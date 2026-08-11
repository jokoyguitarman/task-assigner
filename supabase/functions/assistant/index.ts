import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// The owner's assistant.
//
// Exists at all because the OpenAI key cannot go anywhere the browser can reach it.
// Everything else about the design follows from two decisions.
//
// First, it acts as the caller, never as the service role. The client is built from
// the owner's own Authorization header, so every read is filtered by the same
// row-level security the app runs under. The assistant therefore cannot see or touch
// anything its owner could not, and a bug here cannot become a tenant leak.
//
// Second, it does not write. It reads context, calls the model, and stores what the
// model proposed. Turning a proposal into tasks is confirm_chat_proposal, a database
// function the owner invokes by tapping the card — which is also the only thing that
// can write the audit row. Nothing gets created because a language model said so.
//
// The reliability trick worth knowing: area, shift and branch ids are given to the
// model as JSON Schema `enum`s in strict mode, so it is structurally incapable of
// naming one that does not exist. The usual failure of a small model on this kind of
// job is a hallucinated identifier, and this removes that failure entirely rather
// than validating after the fact.

const OPENAI_URL = "https://api.openai.com/v1/responses";
const MODEL = Deno.env.get("OPENAI_MODEL") ?? "gpt-5.4-mini";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

interface Named { id: string; name: string }

// A task exactly as the model is allowed to describe it. Kept in one place because
// the JSON Schema below and confirm_chat_proposal in the database have to agree on
// it, and they are written in different languages.
interface ProposedTask {
  title: string;
  description: string | null;
  areaId: string;
  shiftId: string;
  dueTime: string | null;
  recurrence: "once" | "daily" | "weekly" | "monthly";
  weekday: number | null;
  dayOfMonth: number | null;
  onDate: string | null;
  outletIds: string[];
  estimatedMinutes: number;
  isHighPriority: boolean;
  requiresPhoto: boolean;
  answerType: "none" | "condition" | "text" | "number";
  answerPrompt: string | null;
}

const taskSchema = (areas: Named[], shifts: Named[], outlets: Named[]) => ({
  type: "object",
  additionalProperties: false,
  required: [
    "title", "description", "areaId", "shiftId", "dueTime", "recurrence",
    "weekday", "dayOfMonth", "onDate", "outletIds", "estimatedMinutes",
    "isHighPriority", "requiresPhoto", "answerType", "answerPrompt",
  ],
  properties: {
    title: { type: "string", description: "Short imperative name, as a person would say it." },
    description: { type: ["string", "null"], description: "Only when it adds something the title does not." },
    areaId: { type: "string", enum: areas.map((a) => a.id) },
    shiftId: { type: "string", enum: shifts.map((s) => s.id) },
    dueTime: {
      type: ["string", "null"],
      description: "HH:MM, only to override the shift's own end time. Null means the shift decides.",
    },
    recurrence: { type: "string", enum: ["once", "daily", "weekly", "monthly"] },
    weekday: { type: ["integer", "null"], description: "Required for weekly. 0 is Sunday, 6 is Saturday." },
    dayOfMonth: { type: ["integer", "null"], description: "Required for monthly, 1 to 31." },
    onDate: { type: ["string", "null"], description: "YYYY-MM-DD, only for one-off work. Null means today." },
    outletIds: {
      type: "array",
      description: "Leave empty for every branch that runs the shift and has the area.",
      items: { type: "string", enum: outlets.map((o) => o.id) },
    },
    estimatedMinutes: { type: "integer" },
    isHighPriority: { type: "boolean" },
    requiresPhoto: { type: "boolean" },
    answerType: { type: "string", enum: ["none", "condition", "text", "number"] },
    answerPrompt: { type: ["string", "null"], description: "The question to ask, when answerType is not none." },
  },
});

const replySchema = (areas: Named[], shifts: Named[], outlets: Named[]) => ({
  type: "object",
  additionalProperties: false,
  required: ["reply", "proposal"],
  properties: {
    reply: { type: "string", description: "What to say to the owner. Plain, brief, no markdown." },
    proposal: {
      type: ["object", "null"],
      additionalProperties: false,
      required: ["summary", "tasks"],
      properties: {
        summary: { type: "string", description: "One line describing what will be created." },
        tasks: { type: "array", items: taskSchema(areas, shifts, outlets) },
      },
    },
  },
});

const list = (items: Named[]) => items.map((i) => `${i.name} (${i.id})`).join("\n  ");

const systemPrompt = (
  org: string,
  today: string,
  timezone: string,
  areas: Named[],
  shifts: Named[],
  outlets: Named[],
  staff: string[],
  state: string
) => `You are the assistant inside Task Assigner, an accountability tool used by the owner of ${org}, a small restaurant group. The owner tells you what needs to happen and you turn it into scheduled work.

Today is ${today} in ${timezone}.

You may only use these identifiers. They are the whole vocabulary of this business.

AREAS — the part of the building work happens in:
  ${list(areas)}

SHIFTS — when work happens. A task's deadline is its shift's end time at each branch unless you override it:
  ${list(shifts)}

BRANCHES:
  ${list(outlets)}

PEOPLE ON THE ROSTER: ${staff.length ? staff.join(", ") : "nobody enrolled yet"}

WHERE THINGS STAND RIGHT NOW:
${state}

How this business works, which you must respect:

- Every task belongs to exactly one shift and one area. There is no such thing as a task without both.
- Tasks are created unclaimed. Whoever is working the shift takes them on the branch phone. You never assign work to a named person, because staff do not log in and the roster changes daily.
- Leave outletIds empty unless the owner named specific branches. Empty means every branch that runs the shift and has the area, which is almost always what they mean.
- Weekly work must say which weekday. Monthly work must say which day of the month. If the owner says "every week" without saying when, ask which day rather than picking one.
- Use answerType when the job produces a reading worth tracking over time: "condition" for a fine / needs attention / bad judgement, "number" for a measurement, "text" for a note. Otherwise "none".
- Use requiresPhoto when the proof matters more than the word of whoever ticked it off.

Your two jobs:

1. When the owner describes work that should exist, put it in "proposal" and use "reply" to say briefly what you have set up and to flag anything you had to assume. Nothing is saved until they tap to confirm, so say what you assumed rather than staying quiet about it.

2. When the owner asks a question, answer it from what is above and leave "proposal" null. If the answer needs detail you have not been given, say so plainly and point them at Reports rather than guessing at numbers.

If a request is genuinely ambiguous in a way that changes what gets created — which branch, which shift, how often — ask one short question and leave "proposal" null. Do not ask about things you can reasonably infer.

Never invent an area, shift or branch that is not listed above.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const apiKey = Deno.env.get("OPENAI_API_KEY");

  // Reachable with nothing but the publishable key, and says only whether a key is
  // configured — never any part of it. Exists so a missing secret is diagnosed in
  // one request instead of looking like the model being broken.
  if (req.method === "GET") {
    return json({ ok: true, model: MODEL, keyPresent: Boolean(apiKey) });
  }

  if (!apiKey) {
    return json({ error: "The assistant has no OPENAI_API_KEY configured." }, 503);
  }

  const authorization = req.headers.get("Authorization") ?? "";

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authorization } } }
  );

  const { data: auth } = await db.auth.getUser();
  const user = auth?.user;
  if (!user) return json({ error: "Not signed in." }, 401);

  const { data: me } = await db
    .from("users")
    .select("role, organization_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!me || me.role !== "admin") {
    return json({ error: "The assistant is for the owner." }, 403);
  }

  let body: { conversationId?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Expected a JSON body." }, 400);
  }

  const text = (body.message ?? "").trim();
  if (!text) return json({ error: "Nothing to send." }, 400);

  // ---- context ------------------------------------------------------------
  //
  // All of it read as the owner, so RLS scopes it, and all of it small enough to
  // sit in the prompt. That is what keeps this a single call instead of an agent
  // loop: there are no lookups left for the model to make.

  const [areasRes, shiftsRes, outletsRes, staffRes, orgRes] = await Promise.all([
    db.from("areas").select("id, name").order("sort_order"),
    db.from("shift_definitions").select("id, name").order("sort_order"),
    db.from("outlets").select("id, name").eq("is_active", true).order("name"),
    db.from("staff_profiles").select("name").eq("is_active", true).order("name"),
    db.from("organizations").select("name, timezone").eq("id", me.organization_id).single(),
  ]);

  const areas = (areasRes.data ?? []) as Named[];
  const shifts = (shiftsRes.data ?? []) as Named[];
  const outlets = (outletsRes.data ?? []) as Named[];

  // An empty enum is not valid JSON Schema, and a business with no areas or shifts
  // cannot have a task described for it anyway.
  if (areas.length === 0 || shifts.length === 0 || outlets.length === 0) {
    return json({
      error:
        "Set up your shifts, areas and at least one branch before using the assistant — " +
        "a task cannot exist without them.",
    }, 409);
  }

  const timezone = orgRes.data?.timezone ?? "UTC";
  const today = new Date().toLocaleDateString("en-CA", { timeZone: timezone });
  const weekday = new Date().toLocaleDateString("en-US", { timeZone: timezone, weekday: "long" });

  const { data: openWork } = await db
    .from("task_assignments")
    .select("outlet_id, status")
    .in("status", ["pending", "overdue"]);

  const state = outlets
    .map((o) => {
      const mine = (openWork ?? []).filter((a: { outlet_id: string }) => a.outlet_id === o.id);
      const late = mine.filter((a: { status: string }) => a.status === "overdue").length;
      return `  ${o.name}: ${mine.length} open${late > 0 ? `, ${late} of them overdue` : ""}`;
    })
    .join("\n");

  // ---- conversation -------------------------------------------------------

  // Nothing is written before the model has answered. Creating the conversation up
  // front meant every failed call — a rate limit, a dropped connection — left a
  // titled stub in the sidebar holding a question with no answer. Only an existing
  // conversation has history to read, so the ordering costs nothing.
  const conversationId = body.conversationId;

  const { data: history } = conversationId
    ? await db
        .from("chat_messages")
        .select("role, content")
        .eq("conversation_id", conversationId)
        .order("created_at")
        .limit(40)
    : { data: [] as { role: string; content: string }[] };

  // ---- the model ----------------------------------------------------------

  const input = [
    ...(history ?? []).map((m: { role: string; content: string }) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    })),
    { role: "user", content: text },
  ];

  let parsed: { reply: string; proposal: { summary: string; tasks: ProposedTask[] } | null };

  try {
    const response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        instructions: systemPrompt(
          orgRes.data?.name ?? "the business",
          `${weekday}, ${today}`,
          timezone,
          areas,
          shifts,
          outlets,
          (staffRes.data ?? []).map((s: { name: string }) => s.name),
          state || "  no branches configured"
        ),
        input,
        text: {
          format: {
            type: "json_schema",
            name: "assistant_reply",
            strict: true,
            schema: replySchema(areas, shifts, outlets),
          },
        },
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("OpenAI rejected the request:", response.status, detail);

      // The detail is passed through rather than swallowed. This is an owner-only
      // tool on a single tenant, the body carries no credential, and the
      // alternative — "could not be reached" for a wrong model name as much as for
      // a dead network — costs an afternoon to tell apart.
      return json({
        error:
          response.status === 401
            ? "OpenAI rejected the API key."
            : response.status === 429
            ? "OpenAI is rate limiting, or the account is out of quota."
            : `OpenAI returned ${response.status}.`,
        detail: detail.slice(0, 600),
      }, 502);
    }

    const payload = await response.json();

    // `output_text` is a convenience the OpenAI SDKs compute; it does not exist in
    // the raw REST response, which is what this calls. The answer has to be dug out
    // of the output items — and it cannot be assumed to be the first one, because a
    // reasoning model puts a reasoning item ahead of its message.
    const parts = (Array.isArray(payload.output) ? payload.output : []).flatMap(
      (item: { content?: unknown }) => (Array.isArray(item.content) ? item.content : [])
    ) as { type: string; text?: string; refusal?: string }[];

    const refusal = parts.find((c) => c.type === "refusal");
    const answer = parts.find((c) => c.type === "output_text");

    if (refusal) {
      parsed = { reply: refusal.refusal ?? "I can't help with that one.", proposal: null };
    } else if (!answer?.text) {
      console.error("No answer in the OpenAI response:", JSON.stringify(payload));
      return json({
        error: "The assistant replied with nothing usable.",
        detail: JSON.stringify(payload).slice(0, 600),
      }, 502);
    } else {
      parsed = JSON.parse(answer.text);
    }
  } catch (error) {
    console.error("Assistant call failed:", error);
    return json({ error: "The assistant could not be reached." }, 502);
  }

  // ---- check what came back -----------------------------------------------
  //
  // Strict mode guarantees the shape and the enums, not the sense. A weekly task
  // with no weekday would be accepted here and then rejected by the database at
  // confirmation time, which is a worse place to find out.

  let proposal = parsed.proposal;
  let note = "";

  if (proposal) {
    const broken = proposal.tasks.filter(
      (t) =>
        (t.recurrence === "weekly" && (t.weekday === null || t.weekday < 0 || t.weekday > 6)) ||
        (t.recurrence === "monthly" &&
          (t.dayOfMonth === null || t.dayOfMonth < 1 || t.dayOfMonth > 31))
    );

    if (broken.length > 0 || proposal.tasks.length === 0) {
      note =
        "\n\n(I could not pin down when that should repeat, so I have not set anything up. " +
        "Tell me which day and I will.)";
      proposal = null;
    }
  }

  const nameOf = (items: Named[], id: string) => items.find((i) => i.id === id)?.name;

  // Names are resolved here rather than asked of the model, so the card cannot
  // describe one thing while the ids create another.
  const stored = proposal
    ? {
        summary: proposal.summary,
        tasks: proposal.tasks.map((t) => ({
          ...t,
          areaName: nameOf(areas, t.areaId),
          shiftName: nameOf(shifts, t.shiftId),
          outletNames: t.outletIds.map((id) => nameOf(outlets, id)).filter(Boolean),
        })),
      }
    : null;

  // Now there is an exchange worth keeping, so the thread comes into existence.
  let threadId = conversationId;

  if (!threadId) {
    const { data: created, error } = await db
      .from("chat_conversations")
      .insert({
        organization_id: me.organization_id,
        user_id: user.id,
        title: text.length <= 42 ? text : `${text.slice(0, 42).trimEnd()}…`,
      })
      .select("id")
      .single();

    if (error) return json({ error: error.message }, 500);
    threadId = created.id;
  }

  const { data: savedUserMessage, error: userInsertError } = await db
    .from("chat_messages")
    .insert({
      conversation_id: threadId,
      organization_id: me.organization_id,
      role: "user",
      content: text,
    })
    .select("id, role, content, created_at")
    .single();

  if (userInsertError) return json({ error: userInsertError.message }, 500);

  const { data: savedReply, error: replyError } = await db
    .from("chat_messages")
    .insert({
      conversation_id: threadId,
      organization_id: me.organization_id,
      role: "assistant",
      content: parsed.reply + note,
      proposal: stored,
      proposal_state: stored ? "pending" : null,
    })
    .select("id, role, content, proposal, proposal_state, created_at")
    .single();

  if (replyError) return json({ error: replyError.message }, 500);

  await db
    .from("chat_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", threadId);

  return json({ conversationId: threadId, userMessage: savedUserMessage, reply: savedReply });
});
