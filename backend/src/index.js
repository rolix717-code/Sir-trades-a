export default {
  async fetch(request, env) {
    const allowedOrigin = "https://rolix717-code.github.io";

    const headers = {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    if (request.headers.get("Origin") !== allowedOrigin) {
      return new Response("Forbidden", { status: 403 });
    }

    if (request.method !== "POST") {
      return Response.json(
        { error: "POST requests only." },
        { status: 405, headers }
      );
    }

    try {
      const form = await request.formData();
      const image = form.get("image");

      if (!image || typeof image.arrayBuffer !== "function") {
        throw new Error("Please upload a screenshot.");
      }

      if (image.size > 8 * 1024 * 1024) {
        throw new Error("Image must be under 8 MB.");
      }

      const types = ["image/jpeg", "image/png", "image/webp"];

      if (!types.includes(image.type)) {
        throw new Error("Only JPG, PNG and WEBP images are supported.");
      }

      const bytes = new Uint8Array(await image.arrayBuffer());

      let binary = "";
      for (let i = 0; i < bytes.length; i += 32768) {
        binary += String.fromCharCode(
          ...bytes.subarray(i, i + 32768)
        );
      }

      const base64 = btoa(binary);

      const response = await fetch(
        "https://api.openai.com/v1/responses",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "gpt-4.1",
            input: [{
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: `You are SIR TRADES AI.

Analyse this virtual sports screenshot.

1. Extract visible fixtures and teams.
2. Read all visible odds.
3. Identify betting markets.
4. Calculate implied probabilities.
5. Highlight unclear information.
6. Present the results clearly.

Never invent missing information.
Never guarantee winnings.
Virtual sports outcomes are random.`
                },
                {
                  type: "input_image",
                  image_url: `data:${image.type};base64,${base64}`,
                  detail: "high"
                }
              ]
            }]
          })
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error?.message || "AI analysis failed."
        );
      }

      return Response.json(
        { analysis: result.output_text || "No analysis returned." },
        { headers }
      );

    } catch (error) {
      return Response.json(
        { error: error.message },
        { status: 400, headers }
      );
    }
  }
};
