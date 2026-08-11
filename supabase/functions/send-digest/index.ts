import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

// The morning summary. Runs hourly and does nothing most of the time: it only acts
// for owners whose chosen hour has arrived in their own timezone and who have not
// already had one today.
//
// Unlike the escalation alert, this is sent even when everything went well. A digest
// that only ever arrives with bad news gets muted like any other alarm, and "all
// branches closed clean" is the message that makes its silence during the day worth
// trusting.
//
// Authenticates on a shared secret because a scheduled job has no user session,
// which is why JWT verification is off; the check below runs before anything else.

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

interface Due {
  user_id: string;
  organization_id: string;
  business_day: string;
}

interface Row {
  outlet_name: string;
  total: number;
  completed: number;
  finished_late: number;
  missed: number;
  raised: number;
  raised_done: number;
}

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

  const { data: due, error } = await db.rpc("digests_due");

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let sent = 0;

  for (const item of (due ?? []) as Due[]) {
    const { data: rows } = await db.rpc("digest_for", {
      p_org: item.organization_id,
      p_day: item.business_day,
    });

    const branches = (rows ?? []) as Row[];

    // Nothing was scheduled, so there is nothing worth saying.
    if (branches.length === 0) {
      await db.from("digest_preferences")
        .update({ last_sent_on: item.business_day })
        .eq("user_id", item.user_id);
      continue;
    }

    const missed = branches.reduce((n, b) => n + b.missed, 0);
    const late = branches.reduce((n, b) => n + b.finished_late, 0);
    const raised = branches.reduce((n, b) => n + b.raised, 0);
    const clean = branches.filter((b) => b.missed === 0 && b.finished_late === 0);

    const title =
      missed === 0 && late === 0
        ? branches.length === 1 ? "Closed clean last night" : "All branches closed clean"
        : `${missed} job${missed === 1 ? "" : "s"} not done last night`;

    const worst = branches
      .filter((b) => b.missed > 0)
      .sort((a, b) => b.missed - a.missed)[0];

    // Work the branches raised themselves is mentioned but never counted as a
    // failure, and never sent as its own alert - reporting a problem is the
    // behaviour worth encouraging, so it must not become a way to set off alarms.
    const raisedNote =
      raised === 0
        ? null
        : `Your team raised ${raised} thing${raised === 1 ? "" : "s"} themselves.`;

    const body = [
      missed === 0 && late === 0
        ? `Every job finished on time at ${branches.length === 1 ? branches[0].outlet_name : `all ${branches.length} branches`}.`
        : [
            worst ? `${worst.outlet_name} missed ${worst.missed}.` : null,
            late > 0 ? `${late} finished late.` : null,
            clean.length > 0 ? `${clean.length} clean.` : null,
          ].filter(Boolean).join(" "),
      raisedNote,
    ].filter(Boolean).join(" ");

    const { data: subs } = await db
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", item.user_id);

    for (const sub of subs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title, body, url: "/dashboard" })
        );
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await db.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    }

    // Marked regardless of whether a device was reachable, so a subscription that
    // has gone stale does not cause the same digest to be retried every hour.
    await db.from("digest_preferences")
      .update({ last_sent_on: item.business_day })
      .eq("user_id", item.user_id);
  }

  return new Response(JSON.stringify({ due: (due ?? []).length, sent }), {
    headers: { "Content-Type": "application/json" },
  });
});
