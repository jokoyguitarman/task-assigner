import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

// What reaches the owner's phone, and nothing else does.
//
// Two kinds of message. Work that has blown its deadline, and work the owner asked
// to be kept posted on that has just been finished. Called by a scheduled database
// job rather than a client, so it authenticates on a shared secret instead of a user
// session - which is also why JWT verification is off: the check below is the door,
// and it runs before anything else happens.
//
// The rules that matter more than the plumbing: nothing is escalated until it is past
// its deadline by the organization's grace window, and nothing is escalated twice. An
// alert that repeats every fifteen minutes until someone acts is an alert people mute,
// and a muted alert is worse than none because it feels like coverage.

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

interface Escalation {
  id: string;
  organization_id: string;
  outlet_name: string;
  task_title: string;
  minutes_late: number;
}

interface Completion {
  id: string;
  organization_id: string;
  outlet_name: string;
  task_title: string;
  finished_by: string | null;
  was_late: boolean;
}

const groupBy = <T,>(rows: T[], key: (row: T) => string): Map<string, T[]> => {
  const out = new Map<string, T[]>();
  rows.forEach((row) => out.set(key(row), [...(out.get(key(row)) ?? []), row]));
  return out;
};

Deno.serve(async (req: Request) => {
  const provided = req.headers.get("x-job-secret");
  const { data: secretRow } = await db.from("app_keys").select("value").eq("name", "job_secret").maybeSingle();

  if (!secretRow || !provided || provided !== secretRow.value) {
    return new Response(JSON.stringify({ error: "not authorised" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data: keys } = await db.from("app_keys").select("name, value");
  const keyOf = (name: string) => keys?.find((k: { name: string; value: string }) => k.name === name)?.value ?? "";
  webpush.setVapidDetails(keyOf("vapid_subject"), keyOf("vapid_public"), keyOf("vapid_private"));

  const subscriptionsFor = async (organizationId: string) => {
    const { data } = await db
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("organization_id", organizationId);
    return data ?? [];
  };

  let sent = 0;
  let pruned = 0;

  const push = async (
    subs: { id: string; endpoint: string; p256dh: string; auth: string }[],
    payload: string
  ) => {
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        sent++;
        await db.from("push_subscriptions").update({ last_used_at: new Date().toISOString() }).eq("id", sub.id);
      } catch (err) {
        // 404 and 410 mean the browser threw the subscription away. Keeping it would
        // mean retrying a dead endpoint forever.
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await db.from("push_subscriptions").delete().eq("id", sub.id);
          pruned++;
        }
      }
    }
  };

  // ---- work that has blown its deadline -----------------------------------

  const { data: overdue, error: overdueError } = await db.rpc("escalations_awaiting_owner");

  if (overdueError) {
    return new Response(JSON.stringify({ error: overdueError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  for (const [organizationId, items] of groupBy((overdue ?? []) as Escalation[], (e) => e.organization_id)) {
    const subs = await subscriptionsFor(organizationId);

    // Nothing to send to. Left unmarked on purpose, so the alert is not burned on a
    // moment when nobody could have received it.
    if (subs.length === 0) continue;

    const worst = items.reduce((a, b) => (b.minutes_late > a.minutes_late ? b : a));
    const hours = Math.floor(worst.minutes_late / 60);
    const lateness = hours > 0 ? `${hours}h ${worst.minutes_late % 60}m` : `${worst.minutes_late}m`;

    await push(subs, JSON.stringify({
      title: `${worst.outlet_name} needs attention`,
      body:
        items.length === 1
          ? `${worst.task_title} is ${lateness} past its deadline.`
          : `${worst.task_title} is ${lateness} late, and ${items.length - 1} other job${items.length > 2 ? "s" : ""} are overdue.`,
      url: "/dashboard",
    }));

    await db.from("task_assignments")
      .update({ owner_alerted_at: new Date().toISOString() })
      .in("id", items.map((i) => i.id));
  }

  // ---- watched work that just got done ------------------------------------

  const { data: finished } = await db.rpc("completions_awaiting_owner");

  for (const [organizationId, items] of groupBy((finished ?? []) as Completion[], (c) => c.organization_id)) {
    const subs = await subscriptionsFor(organizationId);
    if (subs.length === 0) continue;

    const first = items[0];
    const who = first.finished_by ? ` by ${first.finished_by}` : "";

    await push(subs, JSON.stringify({
      title: items.length === 1 ? "Done" : `${items.length} of the jobs you were watching are done`,
      body:
        items.length === 1
          ? `${first.task_title} at ${first.outlet_name} was finished${who}${first.was_late ? ", late" : ""}.`
          : `Including ${first.task_title} at ${first.outlet_name}.`,
      url: "/dashboard",
    }));

    await db.from("task_assignments")
      .update({ owner_completion_alerted_at: new Date().toISOString() })
      .in("id", items.map((i) => i.id));
  }

  return new Response(JSON.stringify({
    overdue: (overdue ?? []).length,
    completed: (finished ?? []).length,
    sent,
    pruned,
  }), { headers: { "Content-Type": "application/json" } });
});
