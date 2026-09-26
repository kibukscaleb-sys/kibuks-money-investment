import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders });
}

function mapKey(envName: string, keyName = "default"): string | null {
  try {
    const raw = Deno.env.get(envName);
    if (!raw) return null;
    return JSON.parse(raw)?.[keyName] ?? null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Authentication required." }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const publishableKey = mapKey("SUPABASE_PUBLISHABLE_KEYS") ?? Deno.env.get("SUPABASE_ANON_KEY");
    const secretKey = mapKey("SUPABASE_SECRET_KEYS") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !publishableKey || !secretKey) {
      return json({ error: "Supabase function keys are not configured." }, 500);
    }

    const userClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, secretKey);

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: "Invalid or expired session." }, 401);

    const body = await req.json();
    const paymentRequestId = String(body.payment_request_id ?? "");
    if (!paymentRequestId) return json({ error: "payment_request_id is required." }, 400);

    const { data: request, error: requestError } = await userClient
      .from("payment_requests")
      .select("id,amount,phone,provider,status,provider_reference,created_at")
      .eq("id", paymentRequestId)
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (requestError || !request) return json({ error: "Deposit request not found." }, 404);
    if (request.provider !== "MTN Mobile Money" || !request.provider_reference) {
      return json({ error: "This is not an active MTN deposit request." }, 400);
    }

    const baseUrl = Deno.env.get("MTN_BASE_URL") ?? "https://sandbox.momodeveloper.mtn.com";
    const targetEnvironment = Deno.env.get("MTN_TARGET_ENVIRONMENT") ?? "sandbox";
    const subscriptionKey = Deno.env.get("MTN_COLLECTION_SUBSCRIPTION_KEY");
    const apiUser = Deno.env.get("MTN_API_USER_ID");
    const apiKey = Deno.env.get("MTN_API_KEY");
    if (!subscriptionKey || !apiUser || !apiKey) return json({ error: "MTN credentials are not configured." }, 500);

    const tokenResponse = await fetch(baseUrl + "/collection/token/", {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(apiUser + ":" + apiKey),
        "Ocp-Apim-Subscription-Key": subscriptionKey,
        "X-Target-Environment": targetEnvironment,
      },
    });
    if (!tokenResponse.ok) return json({ error: "MTN access-token request failed." }, 502);

    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) return json({ error: "MTN did not return an access token." }, 502);

    const statusResponse = await fetch(
      baseUrl + "/collection/v1_0/requesttopay/" + encodeURIComponent(request.provider_reference),
      {
        method: "GET",
        headers: {
          Authorization: "Bearer " + tokenData.access_token,
          "X-Target-Environment": targetEnvironment,
          "Ocp-Apim-Subscription-Key": subscriptionKey,
        },
      }
    );

    const providerData = await statusResponse.json().catch(() => ({}));
    if (!statusResponse.ok) {
      return json({
        error: "MTN status check failed.",
        status: statusResponse.status,
        details: providerData,
      }, 502);
    }

    const providerStatus = String(providerData.status ?? "PENDING").toUpperCase();

    if (providerStatus === "SUCCESSFUL") {
      const { data: finalized, error: finalizeError } = await adminClient.rpc("finalize_mtn_deposit", {
        p_payment_request_id: request.id,
        p_provider_reference: request.provider_reference,
      });
      if (finalizeError) return json({ error: finalizeError.message }, 500);
      return json({ ok: true, status: "SUCCESSFUL", provider: providerData, finalized });
    }

    if (providerStatus === "FAILED") {
      await adminClient
        .from("payment_requests")
        .update({ status: "failed" })
        .eq("id", request.id)
        .eq("user_id", userData.user.id);
      return json({ ok: true, status: "FAILED", provider: providerData });
    }

    return json({ ok: true, status: providerStatus, provider: providerData });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unexpected status error." }, 500);
  }
});
