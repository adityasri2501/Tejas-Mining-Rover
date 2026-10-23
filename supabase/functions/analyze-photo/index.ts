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
        hazards: [],
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
          hazards: [],
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

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": geminiApiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text:
                  "You are a mining safety inspection assistant. " +
                  "Inspect the image for visible hazards such as missing " +
                  "personal protective equipment (PPE), structural issues, " +
                  "equipment problems, spills, and unsafe conditions. " +
                  "Be specific and cautious. Do not claim that an image " +
                  "proves a site is safe. Return a JSON object with a " +
                  "hazards array. Each hazard must contain tag (string), " +
                  "confidence (number from 0 to 1), and notes (string). " +
                  "If no hazards are visible, return an empty hazards array. " +
                  "Visual inspection is not a substitute for an on-site " +
                  "safety inspection.",
              },
            ],
          },
          contents: [
            {
              role: "user",
              parts: [
                {
                  text:
                    `Analyze this mining site photo for visible safety ` +
                    `hazards. Additional context: ${notes || "None provided"}.`,
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
        }),
      },
    );

    const result = await response.json();

    if (!response.ok) {
      const message =
        result.error?.message ||
        `Gemini API returned status ${response.status}.`;

      console.error(
        "Gemini API error:",
        response.status,
        message,
      );

      throw new Error(message);
    }

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

    const hazards = Array.isArray(parsed.hazards)
      ? parsed.hazards
          .filter(
            (hazard: unknown) =>
              typeof hazard === "object" && hazard !== null,
          )
          .map(
            (
              hazard: {
                tag?: unknown;
                confidence?: unknown;
                notes?: unknown;
              },
            ) => ({
              tag:
                typeof hazard.tag === "string"
                  ? hazard.tag
                  : "Safety concern",
              confidence:
                typeof hazard.confidence === "number" &&
                Number.isFinite(hazard.confidence)
                  ? Math.max(0, Math.min(1, hazard.confidence))
                  : 0.5,
              notes:
                typeof hazard.notes === "string"
                  ? hazard.notes
                  : "Manual review recommended.",
            }),
          )
      : [];

    return new Response(
      JSON.stringify({
        hazards,
        annotatedImage: `data:${mimeType};base64,${image}`,
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
        hazards: [],
      }),
      {
        status: 500,
        headers: corsHeaders,
      },
    );
  }
});
