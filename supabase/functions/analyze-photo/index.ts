import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "application/json",
};

const GEMINI_MODELS = ["gemini-3.5-flash-lite", "gemini-3.8-flash"];
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);
class GeminiRequestError extends Error {}

async function generateWithGemini(apiKey: string, body: unknown) {
  const failures: string[] = [];

  for (const model of GEMINI_MODELS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        },
      );
      const result = await response.json();

      if (response.ok) return result;

      const message = result.error?.message || `Gemini returned status ${response.status}.`;
      console.error(`Gemini ${model} error:`, response.status, message);
      failures.push(`${model}: ${response.status} ${message}`);

      if (!RETRYABLE_STATUS.has(response.status)) {
        throw new GeminiRequestError(message);
      }
    } catch (error) {
      if (error instanceof GeminiRequestError) throw error;
      if (error instanceof Error && !failures.some((failure) => failure.includes(error.message))) {
        const reason = controller.signal.aborted
          ? "request timed out after 25 seconds"
          : error.message;
        failures.push(`${model}: ${reason}`);
        console.error(`Gemini ${model} request failed:`, reason);
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(`Gemini models are temporarily unavailable. ${failures.join(" | ")}`);
}

serve(async (req) => {
  // Handle browser CORS preflight requests.
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  // Only allow POST requests for analysis.
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        error: "Method not allowed",
        workers: [],
      }),
      {
        status: 405,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }

  try {
    const { image, imageMimeType, notes } = await req.json();

    if (typeof image !== "string" || !image.trim()) {
      return new Response(
        JSON.stringify({
          error: "An image is required.",
          workers: [],
        }),
        {
          status: 400,
          headers: corsHeaders,
        },
      );
    }

    const mimeType = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ].includes(imageMimeType)
      ? imageMimeType
      : "image/jpeg";

    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

    if (!geminiApiKey) {
      throw new Error(
        "GEMINI_API_KEY is not configured in Supabase function secrets.",
      );
    }

    const result = await generateWithGemini(geminiApiKey, {
      systemInstruction: {
        parts: [
          {
            text:
              "You are a worker PPE visual inspection assistant. " +
              "Inspect the visible person in this worker photo ONLY for " +
              "these five items: safety helmet, safety vest, gloves, " +
              "safety boots, and safety goggles. Do not report unrelated " +
              "site hazards or tools. Return exactly a JSON object shaped " +
              "as {workers:[{worker_id:1,ppe:{helmet:{status,evidence}," +
              "safety_vest:{status,evidence},gloves:{status,evidence}," +
              "safety_boots:{status,evidence},safety_goggles:{status,evidence}}}]} . " +
              "Each status must be present, missing, or uncertain. Mark " +
              "present only when the item is visibly worn. Mark missing " +
              "only when the relevant body area is clearly visible and the " +
              "item is absent. If the area is cropped, occluded, too small, " +
              "or unclear, mark uncertain. Give a short visual evidence " +
              "string for every item. If no person is visible, return " +
              "{workers:[]}. Never infer PPE from job role or background.",
          },
        ],
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              text:
                `Assess the worker's PPE only. Additional context: ${notes || "None provided"}.`,
            },
            {
              inline_data: {
                mime_type: mimeType,
                data: image,
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const aiResponse = result.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text || "")
      .join("")
      .trim();

    if (!aiResponse) {
      throw new Error(
        "Gemini returned an empty analysis. Please try another image.",
      );
    }

    const parsed = JSON.parse(aiResponse);

    const ppeKeys = ["helmet", "safety_vest", "gloves", "safety_boots", "safety_goggles"] as const;
    const validStatuses = new Set(["present", "missing", "uncertain"]);
    const workers = Array.isArray(parsed.workers)
      ? parsed.workers
          .filter((worker: unknown) => typeof worker === "object" && worker !== null)
          .slice(0, 1)
          .map((worker: { ppe?: Record<string, { status?: unknown; evidence?: unknown }> }) => {
            const ppe = Object.fromEntries(ppeKeys.map((key) => {
              const item = worker.ppe?.[key];
              const status = typeof item?.status === "string" && validStatuses.has(item.status)
                ? item.status
                : "uncertain";
              return [key, {
                status,
                evidence: typeof item?.evidence === "string" ? item.evidence : "Not clear in the image; manual check recommended.",
              }];
            }));
            return { worker_id: 1, ppe };
          })
      : [];

    return new Response(
      JSON.stringify({
        workers,
      }),
      {
        status: 200,
        headers: corsHeaders,
      },
    );
  } catch (error) {
    console.error("Error in analyze-photo function:", error);

    const errorMessage =
      error instanceof Error
        ? error.message
        : "Unknown error";

    return new Response(
      JSON.stringify({
        error: errorMessage,
        workers: [],
      }),
      {
        status: 500,
        headers: corsHeaders,
      },
    );
  }
});
