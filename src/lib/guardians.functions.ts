import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequestHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Find an auth user by email (case-insensitive) using the admin client. */
async function findUserByEmail(email: string): Promise<{ id: string; email: string } | null> {
  const target = email.trim().toLowerCase();
  // Paginate through users (sufficient for typical project sizes).
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const users = data?.users ?? [];
    const match = users.find((u) => (u.email ?? "").toLowerCase() === target);
    if (match) return { id: match.id, email: match.email ?? target };
    if (users.length < 200) break;
  }
  return null;
}

async function sendInviteEmail(args: {
  toEmail: string;
  wearerName: string;
  acceptUrl: string;
}): Promise<boolean> {
  // Best-effort email delivery. Requires Lovable email infrastructure to be
  // configured; if it isn't, we silently skip — the invitation still shows up
  // in the guardian's "Pending Invitations" inside the app.
  try {
    const { error } = await supabaseAdmin.rpc("enqueue_email" as any, {
      queue_name: "transactional_emails",
      payload: {
        to: args.toEmail,
        subject: `${args.wearerName} invited you as their Guardian on RakshaLink`,
        html: `<p>${args.wearerName} has invited you to be their Guardian on RakshaLink.</p>
<p>As a Guardian you'll be able to monitor their safety and receive emergency alerts.</p>
<p><a href="${args.acceptUrl}">Open RakshaLink to accept the invitation</a></p>`,
      },
    } as any);
    return !error;
  } catch {
    return false;
  }
}

const InviteSchema = z.object({
  email: z.string().trim().email().max(255),
});

type InviteResult = {
  status: "invited" | "reinvited";
  wearerName: string;
  guardianEmail: string;
  guardianName: string | null;
};

export const inviteGuardian = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InviteSchema.parse(input))
  .handler(async ({ data, context }): Promise<InviteResult> => {
    const { userId } = context;

    const guardian = await findUserByEmail(data.email);
    if (!guardian) {
      throw new Error("No RakshaLink account found with that email. Ask them to sign up first.");
    }
    if (guardian.id === userId) {
      throw new Error("You can't invite yourself as a guardian.");
    }

    // Look for an existing link between this guardian and wearer.
    const { data: existing } = await supabaseAdmin
      .from("guardian_links")
      .select("id, status")
      .eq("guardian_id", guardian.id)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      if (existing.status === "active") {
        throw new Error("This guardian is already linked to your account.");
      }
      if (existing.status === "pending") {
        // Re-send the invite for an outstanding request.
      }
      if (existing.status === "revoked" || existing.status === "pending") {
        await supabaseAdmin
          .from("guardian_links")
          .update({ status: "pending" })
          .eq("id", existing.id);
      }
    } else {
      const { error: insErr } = await supabaseAdmin.from("guardian_links").insert({
        guardian_id: guardian.id,
        user_id: userId,
        status: "pending",
      });
      if (insErr) throw new Error(insErr.message);
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();
    const wearerName = profile?.full_name ?? "A RakshaLink user";

    const { data: gProfile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", guardian.id)
      .maybeSingle();

    return {
      status: existing ? "reinvited" : "invited",
      wearerName,
      guardianEmail: guardian.email,
      guardianName: gProfile?.full_name ?? null,
    };
  });

type GuardianRow = {
  id: string;
  status: string;
  guardianName: string | null;
  guardianEmail: string | null;
};

/** Wearer: list all guardians (any status) linked to me, with display info. */
export const listMyGuardians = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<GuardianRow[]> => {
    const { userId } = context;
    const { data: links, error } = await supabaseAdmin
      .from("guardian_links")
      .select("id, status, guardian_id")
      .eq("user_id", userId)
      .neq("status", "revoked")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = links ?? [];
    if (!rows.length) return [];

    const ids = rows.map((r) => r.guardian_id);
    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .in("id", ids);
    const nameById: Record<string, string | null> = {};
    (profs ?? []).forEach((p: any) => (nameById[p.id] = p.full_name));

    const emailById: Record<string, string | null> = {};
    const { data: usersPage } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    (usersPage?.users ?? []).forEach((u) => (emailById[u.id] = u.email ?? null));

    return rows.map((r) => ({
      id: r.id,
      status: r.status,
      guardianName: nameById[r.guardian_id] ?? null,
      guardianEmail: emailById[r.guardian_id] ?? null,
    }));
  });

type PendingInvite = {
  id: string;
  wearerName: string | null;
  wearerId: string;
};

/** Guardian: list invitations awaiting my response. */
export const listPendingInvites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PendingInvite[]> => {
    const { userId } = context;
    const { data: links, error } = await supabaseAdmin
      .from("guardian_links")
      .select("id, user_id")
      .eq("guardian_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = links ?? [];
    if (!rows.length) return [];

    const ids = rows.map((r) => r.user_id);
    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .in("id", ids);
    const nameById: Record<string, string | null> = {};
    (profs ?? []).forEach((p: any) => (nameById[p.id] = p.full_name));

    return rows.map((r) => ({
      id: r.id,
      wearerId: r.user_id,
      wearerName: nameById[r.user_id] ?? null,
    }));
  });

const RespondSchema = z.object({
  linkId: z.string().uuid(),
  action: z.enum(["accept", "decline"]),
});

/** Guardian: accept (status=active) or decline (delete) a pending invitation. */
export const respondToInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => RespondSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { userId } = context;
    // Verify ownership: the link must be addressed to this guardian and pending.
    const { data: link } = await supabaseAdmin
      .from("guardian_links")
      .select("id, guardian_id, status")
      .eq("id", data.linkId)
      .maybeSingle();
    if (!link || link.guardian_id !== userId || link.status !== "pending") {
      throw new Error("Invitation not found or already handled.");
    }
    if (data.action === "accept") {
      const { error } = await supabaseAdmin
        .from("guardian_links")
        .update({ status: "active" })
        .eq("id", data.linkId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("guardian_links")
        .delete()
        .eq("id", data.linkId);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

const RevokeSchema = z.object({ linkId: z.string().uuid() });

/** Wearer: revoke a guardian link (status=revoked). */
export const revokeGuardian = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => RevokeSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { userId } = context;
    const { data: link } = await supabaseAdmin
      .from("guardian_links")
      .select("id, user_id")
      .eq("id", data.linkId)
      .maybeSingle();
    if (!link || link.user_id !== userId) {
      throw new Error("Guardian link not found.");
    }
    const { error } = await supabaseAdmin
      .from("guardian_links")
      .update({ status: "revoked" })
      .eq("id", data.linkId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
