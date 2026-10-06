import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

type Operation = "approve_registration" | "review_registration" | "record_subscription_payment" | "record_attendance" | "publish_player_evaluation" | "create_subscription";
type Mode = "prepare" | "execute" | "cancel" | "history" | "snapshot";

const OP_ROLES: Record<Operation, string[]> = {
  approve_registration: ["manager"],
  review_registration: ["manager"],
  record_subscription_payment: ["manager", "accountant"],
  record_attendance: ["manager", "coach"],
  publish_player_evaluation: ["manager", "coach"],
  create_subscription: ["manager", "accountant", "receptionist"],
};

const cors = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});

const reply = (origin: string | null, status: number, data: unknown) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      ...cors(origin),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });

function publicKey(): string {
  const raw = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, string>;
      const first = parsed.default || Object.values(parsed)[0];
      if (first) return String(first);
    } catch {}
  }
  const legacy = Deno.env.get("SUPABASE_ANON_KEY");
  if (!legacy) throw new Error("publishable_key_unavailable");
  return legacy;
}

function cleanText(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function addCalendarMonthsIso(dateText: string, months: number): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return null;
  const [year, month, day] = dateText.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return reply(origin, 405, { error: "method_not_allowed" });

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return reply(origin, 401, { error: "authentication_required" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return reply(origin, 500, { error: "server_configuration_error" });

  let body: {
    mode?: Mode;
    operation?: Operation;
    params?: Record<string, unknown>;
    requestId?: string;
    confirm?: boolean;
  };
  try { body = await req.json(); } catch { return reply(origin, 400, { error: "invalid_json" }); }

  const userClient = createClient(supabaseUrl, publicKey(), {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const serverClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return reply(origin, 401, { error: "invalid_session" });

  const { data: staff, error: staffError } = await userClient
    .from("staff")
    .select("id,role,status")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (staffError || !staff || staff.status !== "active") return reply(origin, 403, { error: "active_staff_required" });

  const nowIso = new Date().toISOString();
  const staleExecutionIso = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  await serverClient
    .from("ai_action_requests")
    .update({ status: "expired" })
    .eq("user_id", userData.user.id)
    .eq("status", "pending")
    .lt("expires_at", nowIso);

  await serverClient
    .from("ai_action_requests")
    .update({ status: "failed", error_code: "execution_timeout", execution_started_at: null })
    .eq("user_id", userData.user.id)
    .eq("status", "executing")
    .lt("execution_started_at", staleExecutionIso);

  const mode: Mode = body.mode === "execute" ? "execute" : body.mode === "cancel" ? "cancel" : body.mode === "history" ? "history" : body.mode === "snapshot" ? "snapshot" : "prepare";

  if (mode === "snapshot") {
    const canPayments = ["manager", "accountant"].includes(staff.role);
    const canEvaluations = ["manager", "coach"].includes(staff.role);
    const canRegistrations = staff.role === "manager";
    const hiddenCount = () => Promise.resolve({ count: null as number | null, error: null });

    const [unpaidRes, playersRes, draftEvalRes, registrationsRes] = await Promise.all([
      canPayments
        ? userClient.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "unpaid")
        : hiddenCount(),
      userClient.from("players").select("id", { count: "exact", head: true }).eq("status", "active"),
      canEvaluations
        ? userClient.from("player_evaluations").select("id", { count: "exact", head: true }).eq("status", "draft")
        : hiddenCount(),
      canRegistrations
        ? userClient.from("registration_applications").select("id", { count: "exact", head: true }).in("status", ["pending", "under_review", "needs_info"])
        : hiddenCount(),
    ]);

    const sourceError = [unpaidRes.error, playersRes.error, draftEvalRes.error, registrationsRes.error].find(Boolean);
    if (sourceError) {
      console.error("AI operations snapshot failed", sourceError.code);
      return reply(origin, 500, { error: "snapshot_failed" });
    }

    return reply(origin, 200, {
      generatedAt: nowIso,
      role: staff.role,
      snapshot: {
        unpaidSubscriptions: unpaidRes.count,
        activePlayers: playersRes.count || 0,
        draftEvaluations: draftEvalRes.count,
        applicationsNeedingAction: registrationsRes.count,
      },
    });
  }

  if (mode === "history") {
    const { data: actions, error: historyError } = await serverClient
      .from("ai_action_requests")
      .select("id,operation,status,created_at,executed_at,error_code")
      .eq("user_id", userData.user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (historyError) {
      console.error("AI action history failed", historyError.code);
      return reply(origin, 500, { error: "history_failed" });
    }

    return reply(origin, 200, {
      actions: (actions || []).map((action) => ({
        requestId: action.id,
        operation: action.operation,
        status: action.status,
        createdAt: action.created_at,
        executedAt: action.executed_at || null,
        errorCode: action.error_code || null,
      })),
    });
  }

  if (mode === "prepare") {
    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
    const { count: recentCount, error: rateError } = await serverClient
      .from("ai_action_requests")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userData.user.id)
      .gte("created_at", oneMinuteAgo);
    if (rateError) {
      console.error("AI action rate check failed", rateError.code);
      return reply(origin, 500, { error: "rate_check_failed" });
    }
    if ((recentCount || 0) >= 10) {
      return reply(origin, 429, { error: "too_many_requests" });
    }

    const operation = body.operation;
    if (!operation || !OP_ROLES[operation]) return reply(origin, 400, { error: "unsupported_operation" });
    if (!OP_ROLES[operation].includes(staff.role)) return reply(origin, 403, { error: "insufficient_role" });

    const params = body.params || {};
    let normalized: Record<string, unknown> = {};
    let preview: Record<string, unknown> = {};

    if (operation === "approve_registration" || operation === "review_registration") {
      const applicationId = cleanText(params.applicationId, 64);
      if (!applicationId) return reply(origin, 400, { error: "application_id_required" });

      const { data: application, error } = await userClient
        .from("registration_applications")
        .select("id,status,registration_type,submitted_at")
        .eq("id", applicationId)
        .maybeSingle();
      if (error || !application) return reply(origin, 404, { error: "registration_not_found" });

      normalized = { applicationId };
      preview = {
        applicationId,
        currentStatus: application.status,
        registrationType: application.registration_type,
        submittedAt: application.submitted_at,
      };

      if (operation === "review_registration") {
        const status = cleanText(params.status, 30);
        const notes = cleanText(params.notes, 1000);
        if (!["under_review", "needs_info", "rejected"].includes(status)) {
          return reply(origin, 400, { error: "invalid_review_status" });
        }
        normalized.status = status;
        normalized.notes = notes;
        preview.newStatus = status;
        preview.hasReviewNotes = Boolean(notes);
      }
    } else if (operation === "record_subscription_payment") {
      const subscriptionId = cleanText(params.subscriptionId, 100);
      const paymentMethod = cleanText(params.paymentMethod, 100);
      const description = cleanText(params.description, 500);
      const transactionDate = cleanText(params.transactionDate, 20);
      if (!subscriptionId || !paymentMethod) {
        return reply(origin, 400, { error: "subscription_and_payment_method_required" });
      }

      const { data: subscription, error } = await userClient
        .from("subscriptions")
        .select("id,status,amount,player_id,start_date,end_date")
        .eq("id", subscriptionId)
        .maybeSingle();
      if (error || !subscription) return reply(origin, 404, { error: "subscription_not_found" });
      if (subscription.status === "paid") return reply(origin, 409, { error: "subscription_already_paid" });

      normalized = {
        subscriptionId,
        paymentMethod,
        description,
        transactionDate: transactionDate || null,
        amount: Number(subscription.amount) || 0,
      };
      preview = {
        subscriptionId,
        amount: Number(subscription.amount) || 0,
        currency: "BHD",
        currentStatus: subscription.status,
        paymentMethod,
        period: { start: subscription.start_date, end: subscription.end_date },
      };
    } else if (operation === "create_subscription") {
      const playerId = cleanText(params.playerId, 100);
      const planType = cleanText(params.planType, 30);
      const startDate = cleanText(params.startDate, 20);
      if (!playerId || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
        return reply(origin, 400, { error: "player_and_valid_start_date_required" });
      }
      if (!["monthly", "quarterly", "semi_annual", "annual"].includes(planType)) {
        return reply(origin, 400, { error: "invalid_plan_type" });
      }

      const [{ data: player, error: playerError }, { data: settings, error: settingsError }] = await Promise.all([
        userClient.from("players").select("id,name,status").eq("id", playerId).maybeSingle(),
        userClient.from("academy_settings")
          .select("subscription_fee_monthly,subscription_fee_quarterly,subscription_fee_semi_annual,subscription_fee_yearly")
          .order("id")
          .limit(1)
          .maybeSingle(),
      ]);
      if (playerError || !player) return reply(origin, 404, { error: "player_not_found" });
      if (player.status !== "active") return reply(origin, 409, { error: "player_not_active" });
      if (settingsError || !settings) return reply(origin, 500, { error: "academy_settings_unavailable" });

      const amountByPlan: Record<string, number> = {
        monthly: Number(settings.subscription_fee_monthly) || 0,
        quarterly: Number(settings.subscription_fee_quarterly) || 0,
        semi_annual: Number(settings.subscription_fee_semi_annual) || 0,
        annual: Number(settings.subscription_fee_yearly) || 0,
      };
      const monthsByPlan: Record<string, number> = { monthly: 1, quarterly: 3, semi_annual: 6, annual: 12 };
      const amount = amountByPlan[planType];
      const endDate = addCalendarMonthsIso(startDate, monthsByPlan[planType]);
      if (!amount || amount <= 0 || !endDate) return reply(origin, 409, { error: "subscription_plan_not_configured" });

      normalized = { playerId, planType, startDate };
      preview = {
        playerId,
        playerName: player.name,
        planType,
        amount,
        currency: "BHD",
        startDate,
        endDate,
        newStatus: "unpaid",
      };
    } else if (operation === "publish_player_evaluation") {
      const evaluationId = cleanText(params.evaluationId, 64);
      if (!evaluationId) return reply(origin, 400, { error: "evaluation_id_required" });

      const { data: evaluation, error } = await userClient
        .from("player_evaluations")
        .select("id,player_id,team_id,evaluation_date,status,technical_score,tactical_score,physical_score,mental_score,discipline_score")
        .eq("id", evaluationId)
        .maybeSingle();
      if (error || !evaluation) return reply(origin, 404, { error: "evaluation_not_found" });
      if (evaluation.status !== "draft") return reply(origin, 409, { error: "evaluation_not_draft" });

      const scoresComplete = [
        evaluation.technical_score,
        evaluation.tactical_score,
        evaluation.physical_score,
        evaluation.mental_score,
        evaluation.discipline_score,
      ].every((score) => score != null);

      if (!scoresComplete) return reply(origin, 409, { error: "evaluation_scores_incomplete" });

      normalized = { evaluationId };
      preview = {
        evaluationId,
        playerId: evaluation.player_id,
        teamId: evaluation.team_id,
        evaluationDate: evaluation.evaluation_date,
        currentStatus: evaluation.status,
        newStatus: "published",
      };
    } else if (operation === "record_attendance") {
      const playerId = cleanText(params.playerId, 100);
      const sessionDate = cleanText(params.sessionDate, 20);
      const sessionType = cleanText(params.sessionType, 20) || "training";
      const status = cleanText(params.status, 20) || "present";
      const notes = cleanText(params.notes, 500);
      const trainingId = cleanText(params.trainingId, 100);
      if (!playerId || !/^\d{4}-\d{2}-\d{2}$/.test(sessionDate)) {
        return reply(origin, 400, { error: "player_and_valid_session_date_required" });
      }
      if (!["training", "match"].includes(sessionType)) {
        return reply(origin, 400, { error: "invalid_session_type" });
      }
      if (!["present", "absent", "excused"].includes(status)) {
        return reply(origin, 400, { error: "invalid_attendance_status" });
      }

      const { data: player, error } = await userClient
        .from("players")
        .select("id,name,team_id,status")
        .eq("id", playerId)
        .maybeSingle();
      if (error || !player) return reply(origin, 404, { error: "player_not_found" });

      normalized = {
        playerId,
        sessionDate,
        sessionType,
        status,
        notes,
        trainingId: trainingId || null,
      };
      preview = {
        playerId,
        playerName: player.name,
        teamId: player.team_id,
        sessionDate,
        sessionType,
        attendanceStatus: status,
        hasNotes: Boolean(notes),
        trainingId: trainingId || null,
      };
    }

    const { data: action, error: insertError } = await serverClient
      .from("ai_action_requests")
      .insert({
        user_id: userData.user.id,
        operation,
        payload: normalized,
        preview,
      })
      .select("id,operation,preview,status,created_at,expires_at")
      .single();

    if (insertError || !action) {
      console.error("AI action prepare insert failed", insertError?.code);
      return reply(origin, 500, { error: "prepare_failed" });
    }

    return reply(origin, 200, {
      requestId: action.id,
      operation: action.operation,
      preview: action.preview,
      status: action.status,
      requiresConfirmation: true,
      expiresAt: action.expires_at,
    });
  }

  const requestId = cleanText(body.requestId, 64);
  if (!requestId) return reply(origin, 400, { error: "request_id_required" });

  const { data: action, error: actionError } = await serverClient
    .from("ai_action_requests")
    .select("id,user_id,operation,payload,preview,status,expires_at")
    .eq("id", requestId)
    .maybeSingle();

  if (actionError || !action) return reply(origin, 404, { error: "action_request_not_found" });
  if (action.user_id !== userData.user.id) return reply(origin, 403, { error: "action_owner_mismatch" });
  if (!OP_ROLES[action.operation as Operation]?.includes(staff.role)) return reply(origin, 403, { error: "insufficient_role" });

  if (mode === "cancel") {
    if (action.status !== "pending") return reply(origin, 409, { error: "action_not_pending" });
    const { data: cancelled, error: cancelError } = await serverClient
      .from("ai_action_requests")
      .update({ status: "cancelled" })
      .eq("id", action.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (cancelError) return reply(origin, 500, { error: "cancel_failed" });
    if (!cancelled) return reply(origin, 409, { error: "action_not_pending" });
    return reply(origin, 200, { requestId: action.id, status: "cancelled" });
  }

  if (body.confirm !== true) return reply(origin, 400, { error: "explicit_confirmation_required" });
  if (action.status !== "pending") return reply(origin, 409, { error: "action_not_pending", status: action.status });
  if (new Date(action.expires_at).getTime() <= Date.now()) {
    await serverClient.from("ai_action_requests").update({ status: "expired" }).eq("id", action.id);
    return reply(origin, 410, { error: "action_expired" });
  }

  const { data: claimed, error: claimError } = await serverClient
    .from("ai_action_requests")
    .update({ status: "executing", execution_started_at: new Date().toISOString(), error_code: null })
    .eq("id", action.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (claimError) {
    console.error("AI action claim failed", claimError.code);
    return reply(origin, 500, { error: "claim_failed" });
  }
  if (!claimed) return reply(origin, 409, { error: "action_not_pending" });

  const op = action.operation as Operation;
  const p = action.payload as Record<string, unknown>;

  try {
    let sanitizedResult: Record<string, unknown>;

    if (op === "approve_registration") {
      const { error } = await userClient.rpc("approve_registration_application", {
        p_application_id: String(p.applicationId),
      });
      if (error) throw error;
      sanitizedResult = { applicationId: p.applicationId, approved: true };
    } else if (op === "review_registration") {
      const { error } = await userClient.rpc("review_registration_application", {
        p_application_id: String(p.applicationId),
        p_status: String(p.status),
        p_notes: p.notes ? String(p.notes) : null,
      });
      if (error) throw error;
      sanitizedResult = { applicationId: p.applicationId, status: p.status };
    } else if (op === "record_subscription_payment") {
      const { data, error } = await userClient.rpc("record_subscription_payment", {
        p_subscription_id: String(p.subscriptionId),
        p_amount: Number(p.amount),
        p_payment_method: String(p.paymentMethod),
        p_transaction_date: p.transactionDate ? String(p.transactionDate) : null,
        p_description: p.description ? String(p.description) : null,
      });
      if (error) throw error;
      sanitizedResult = {
        subscriptionId: p.subscriptionId,
        amount: p.amount,
        paymentMethod: p.paymentMethod,
        transactionId: data?.id ?? null,
      };
    } else if (op === "record_attendance") {
      const { data, error } = await userClient.rpc("record_attendance_entry", {
        p_player_id: String(p.playerId),
        p_session_date: String(p.sessionDate),
        p_session_type: String(p.sessionType),
        p_status: String(p.status),
        p_notes: p.notes ? String(p.notes) : null,
        p_training_id: p.trainingId ? String(p.trainingId) : null,
      });
      if (error) throw error;
      sanitizedResult = {
        attendanceId: data?.id ?? null,
        playerId: p.playerId,
        sessionDate: p.sessionDate,
        sessionType: p.sessionType,
        status: p.status,
      };
    } else if (op === "publish_player_evaluation") {
      const { data, error } = await userClient.rpc("publish_player_evaluation", {
        p_evaluation_id: String(p.evaluationId),
      });
      if (error) throw error;
      sanitizedResult = {
        evaluationId: p.evaluationId,
        playerId: data?.player_id ?? null,
        status: data?.status ?? "published",
        publishedAt: data?.published_at ?? null,
      };
    } else {
      const { data, error } = await userClient.rpc("create_subscription_entry", {
        p_player_id: String(p.playerId),
        p_plan_type: String(p.planType),
        p_start_date: String(p.startDate),
      });
      if (error) throw error;
      sanitizedResult = {
        subscriptionId: data?.id ?? null,
        playerId: data?.player_id ?? p.playerId,
        planType: data?.plan_type ?? p.planType,
        amount: Number(data?.amount ?? 0),
        startDate: data?.start_date ?? p.startDate,
        endDate: data?.end_date ?? null,
        status: data?.status ?? "unpaid",
      };
    }

    const { data: finalized, error: finalizeError } = await serverClient
      .from("ai_action_requests")
      .update({ status: "executed", result: sanitizedResult, executed_at: new Date().toISOString(), execution_started_at: null })
      .eq("id", action.id)
      .eq("status", "executing")
      .select("id")
      .maybeSingle();
    if (finalizeError) {
      console.error("AI action finalization failed", op, finalizeError.code);
      throw Object.assign(new Error("action_finalize_failed"), { code: "action_finalize_failed" });
    }
    if (!finalized) {
      console.error("AI action finalization lost execution claim", op);
      throw Object.assign(new Error("action_finalize_conflict"), { code: "action_finalize_conflict" });
    }

    // Business workflows are responsible for their own server-side audit records.
    // Do not write client-controlled generic audit entries from the gateway.

    return reply(origin, 200, {
      requestId: action.id,
      operation: op,
      status: "executed",
      result: sanitizedResult,
    });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code || "operation_failed") : "operation_failed";
    console.error("AI action execution failed", op, code);

    // A finalization failure happens after the business RPC has already succeeded.
    // Preserve the executing state so the timeout/recovery path can reconcile it;
    // marking it failed here would incorrectly invite a duplicate business retry.
    if (code === "action_finalize_failed" || code === "action_finalize_conflict") {
      return reply(origin, 503, { error: "action_finalization_uncertain", code, requestId: action.id });
    }

    await serverClient
      .from("ai_action_requests")
      .update({ status: "failed", error_code: code, execution_started_at: null })
      .eq("id", action.id)
      .eq("status", "executing");
    return reply(origin, 409, { error: "operation_failed", code });
  }
});
