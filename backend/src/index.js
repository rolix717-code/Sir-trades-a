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

      if (!["image/jpeg", "image/png", "image/webp"].includes(image.type)) {
        throw new Error("Only JPG, PNG and WEBP images are supported.");
      }

      const bytes = new Uint8Array(await image.arrayBuffer());
      let binary = "";

      for (let i = 0; i < bytes.length; i += 32768) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
      }

      const base64 = btoa(binary);

      const response = await fetch(
        "https://tchavi.com/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.TCHAVI_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: `You are SIR TRADES AI.
Analyse virtual sports screenshots.

Extract:
1. Visible fixtures and teams.
2. All readable odds.
3. Betting markets.
4. Implied probabilities.
5. Combined odds where possible.
6. Unclear information.

Never invent missing information.
Never guarantee winnings.
Virtual sports outcomes are random.
Clearly explain that analysis is not a guaranteed prediction.`
              },
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "Analyse this uploaded virtual sports screenshot."
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:${image.type};base64,${base64}`
                    }
                  }
                ]
              }
            ],
            max_tokens: 1200
          })
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error?.message || JSON.stringify(result.error) ||
          "Tchavi API request failed."
        );
      }

      return Response.json(
        {
          analysis:
            result.choices?.[0]?.message?.content ||
            "No analysis returned."
        },
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
