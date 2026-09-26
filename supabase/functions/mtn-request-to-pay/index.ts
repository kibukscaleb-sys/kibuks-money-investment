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

function getEnvKey(name: string): string | null {
  const direct = Deno.env.get(name);
  if (direct) return direct;
  return null;
}

function getMapKey(envName: string, keyName = "default"): string | null {
  try {
    const raw = Deno.env.get(envName);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.[keyName] ?? null;
  } catch {
    return null;
  }
}

function normalizeUgandaMsisdn(value: string): string {
  const digits = value.replace(/[^0-9]/g, "");
  if (digits.startsWith("256")) return digits;
  if (digits.startsWith("0")) return "256" + digits.slice(1);
  return digits;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Authentication required." }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const publishableKey =
      getMapKey("SUPABASE_PUBLISHABLE_KEYS") ??
      getEnvKey("SUPABASE_ANON_KEY");
    const secretKey =
      getMapKey("SUPABASE_SECRET_KEYS") ??
      getEnvKey("SUPABASE_SERVICE_ROLE_KEY");

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
    const amount = Number(body.amount);
    const provider = String(body.provider ?? "");
    const phone = normalizeUgandaMsisdn(String(body.phone ?? ""));

    if (provider !== "MTN Mobile Money") {
      return json({ error: "Only MTN Mobile Money is connected right now." }, 400);
    }
    if (!Number.isFinite(amount) || amount < 1000 || amount > 50000000) {
      return json({ error: "Deposit amount must be between UGX 1,000 and UGX 50,000,000." }, 400);
    }
    if (!/^2567\d{8}$/.test(phone)) {
      return json({ error: "Enter a valid Uganda mobile number, for example 2567XXXXXXXX." }, 400);
    }

    const { data: requestRow, error: insertError } = await adminClient
      .from("payment_requests")
      .insert({
        user_id: userData.user.id,
        type: "deposit",
        amount,
        phone,
        provider,
        status: "initiating",
      })
      .select("id")
      .single();

    if (insertError || !requestRow) {
      return json({ error: insertError?.message ?? "Could not create deposit request." }, 500);
    }

    const baseUrl = Deno.env.get("MTN_BASE_URL") ?? "https://sandbox.momodeveloper.mtn.com";
    const targetEnvironment = Deno.env.get("MTN_TARGET_ENVIRONMENT") ?? "sandbox";
    const currency = Deno.env.get("MTN_CURRENCY") ?? "EUR";
    const subscriptionKey = Deno.env.get("MTN_COLLECTION_SUBSCRIPTION_KEY");
    const apiUser = Deno.env.get("MTN_API_USER_ID");
    const apiKey = Deno.env.get("MTN_API_KEY");

    if (!subscriptionKey || !apiUser || !apiKey) {
      await adminClient.from("payment_requests")
        .update({ status: "failed" })
        .eq("id", requestRow.id);
      return json({
        error: "MTN credentials are not configured yet.",
        payment_request_id: requestRow.id,
      }, 500);
    }

    const tokenResponse = await fetch(baseUrl + "/collection/token/", {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(apiUser + ":" + apiKey),
        "Ocp-Apim-Subscription-Key": subscriptionKey,
        "X-Target-Environment": targetEnvironment,
      },
    });

    if (!tokenResponse.ok) {
      const details = await tokenResponse.text();
      await adminClient.from("payment_requests")
        .update({ status: "failed" })
        .eq("id", requestRow.id);
      return json({
        error: "MTN access-token request failed.",
        details: details.slice(0, 500),
        payment_request_id: requestRow.id,
      }, 502);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    if (!accessToken) throw new Error("MTN did not return an access token.");

    const providerReference = crypto.randomUUID();
    const externalId = "HUT10-" + requestRow.id;

    const payResponse = await fetch(baseUrl + "/collection/v1_0/requesttopay", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + accessToken,
        "X-Reference-Id": providerReference,
        "X-Target-Environment": targetEnvironment,
        "Ocp-Apim-Subscription-Key": subscriptionKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: String(amount),
        currency,
        externalId,
        payer: {
          partyIdType: "MSISDN",
          partyId: phone,
        },
        payerMessage: "HUT 10 PRO deposit",
        payeeNote: externalId,
      }),
    });

    if (payResponse.status !== 202) {
      const details = await payResponse.text();
      await adminClient.from("payment_requests")
        .update({ status: "failed" })
        .eq("id", requestRow.id);
      return json({
        error: "MTN did not accept the payment request.",
        status: payResponse.status,
        details: details.slice(0, 500),
        payment_request_id: requestRow.id,
      }, 502);
    }

    const { error: updateError } = await adminClient
      .from("payment_requests")
      .update({
        status: "pending",
        provider_reference: providerReference,
      })
      .eq("id", requestRow.id);

    if (updateError) throw updateError;

    return json({
      ok: true,
      payment_request_id: requestRow.id,
      provider_reference: providerReference,
      status: "pending",
      message: "Payment request sent. Approve it on the MTN Mobile Money phone.",
    }, 202);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unexpected payment error." }, 500);
  }
});
