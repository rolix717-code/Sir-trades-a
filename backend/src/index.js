export default {
  async fetch(request, env) {
    const allowedOrigin = "https://rolix717-code.github.io";

    const headers = {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json"
    };

    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), { status, headers });

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    if (request.headers.get("Origin") !== allowedOrigin) {
      return json({ error: "Access denied." }, 403);
    }

    if (request.method !== "POST") {
      return json({ error: "POST requests only." }, 405);
    }

    if (!env.TCHAVI_API_KEY) {
      return json({ error: "TCHAVI_API_KEY is missing." }, 500);
    }

    try {
      const form = await request.formData();
      const image = form.get("image");

      if (!image || typeof image.arrayBuffer !== "function") {
        return json({ error: "Please upload a screenshot." }, 400);
      }

      if (image.size > 8 * 1024 * 1024) {
        return json({ error: "Image must be under 8 MB." }, 400);
      }

      if (!["image/jpeg", "image/png", "image/webp"].includes(image.type)) {
        return json({ error: "Only JPG, PNG and WEBP are supported." }, 400);
      }

      const bytes = new Uint8Array(await image.arrayBuffer());
      let binary = "";

      for (let i = 0; i < bytes.length; i += 32768) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
      }

      const base64 = btoa(binary);

      const systemPrompt = `
You are SIR TRADES AI, a professional virtual sports odds analysis assistant.

Analyse the uploaded betting screenshot carefully.

SECTION 1: FIXTURE EXTRACTION
- List all visible fixtures and teams.
- Extract all readable odds and markets.
- Never invent missing information.

SECTION 2: ODDS ANALYSIS
For each outcome calculate:
Implied probability = (1 / decimal odds) × 100.

Calculate the 1X2 implied probability total for each fixture.
Explain the bookmaker margin where possible.

Check all calculations carefully.

SECTION 3: TOP 3 SELECTIONS
- Rank the three shortest readable odds across all fixtures.
- Show fixture, selection and odds.
- Explain why each has a shorter price.
- Give an odds-based risk description.
- Do not call any selection guaranteed or safe.

SECTION 4: COMBINED ODDS
Multiply the three selected odds.
Show the calculation and final combined odds to two decimal places.

SECTION 5: SIR TRADES AI FINAL VERDICT

Use this exact heading:

🔥 SIR TRADES AI FINAL VERDICT

Include:
1. Top three shortest-priced selections.
2. Combined odds.
3. Estimated combined implied probability (1 / combined odds × 100).
4. Overall risk assessment.
5. A short final explanation.

Do not invent information or recommend a selection when the screenshot is unclear.

IMPORTANT:
- Virtual sports outcomes are random.
- Shorter odds do not guarantee a win.
- Implied probability is not a confirmed real-world probability.
- Never promise profits or guaranteed winnings.
- Clearly distinguish odds analysis from predictions.
- Encourage responsible gambling.
`;

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
                content: systemPrompt
              },
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "Analyse this virtual sports screenshot and provide the complete SIR TRADES AI report."
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
            max_tokens: 2000,
            temperature: 0.2
          })
        }
      );

      const result = await response.json();

      if (!response.ok) {
        return json({
          error: result.error?.message || "Tchavi API request failed.",
          provider_status: response.status
        }, response.status);
      }

      const analysis = result.choices?.[0]?.message?.content;

      if (!analysis) {
        return json({ error: "No analysis was returned." }, 502);
      }

      return json({ analysis });

    } catch (error) {
      return json({
        error: error.message || "Unexpected server error."
      }, 500);
    }
  }
};
