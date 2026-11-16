export default {
  async fetch(request, env) {
    const origin = "https://rolix717-code.github.io";

    const headers = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json"
    };

    const reply = (data, status = 200) =>
      new Response(JSON.stringify(data), { status, headers });

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    if (request.headers.get("Origin") !== origin) {
      return reply({ error: "Access denied." }, 403);
    }

    if (request.method !== "POST") {
      return reply({ error: "POST requests only." }, 405);
    }

    if (!env.TCHAVI_API_KEY) {
      return reply({ error: "TCHAVI API key is missing." }, 500);
    }

    try {
      const form = await request.formData();
      const image = form.get("image");

      if (!image || typeof image.arrayBuffer !== "function") {
        return reply({ error: "Upload a screenshot first." }, 400);
      }

      if (image.size > 8 * 1024 * 1024) {
        return reply({ error: "Image must be below 8 MB." }, 400);
      }

      if (!["image/jpeg", "image/png", "image/webp"].includes(image.type)) {
        return reply({ error: "Unsupported image format." }, 400);
      }

      const bytes = new Uint8Array(await image.arrayBuffer());
      let binary = "";

      for (let i = 0; i < bytes.length; i += 32768) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
      }

      const base64 = btoa(binary);

      const prompt = `
You are SIR TRADES AI.

Read the virtual sports screenshot.

Extract every fixture with a complete 1X2 market.

Return ONLY valid JSON in this exact structure:

{
  "matches": [
    {
      "fixture": "Team A vs Team B",
      "home": 1.50,
      "draw": 4.00,
      "away": 6.00
    }
  ]
}

STRICT RULES:

1. Read the actual screenshot.
2. Never invent fixtures or odds.
3. Include only complete, clearly readable 1X2 markets.
4. All odds must be decimal numbers greater than 1.
5. Do not include explanations or Markdown.
6. If nothing is readable, return:
   {"matches":[]}
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
              { role: "system", content: prompt },
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "Extract the complete readable fixtures and odds."
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
            temperature: 0,
            max_tokens: 1500
          })
        }
      );

      const result = await response.json();

      if (!response.ok) {
        return reply({
          error: result.error?.message || "AI request failed."
        }, response.status);
      }

      let content = result.choices?.[0]?.message?.content;

      if (!content) {
        return reply({ error: "No data returned by AI." }, 502);
      }

      content = content
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

      const extracted = JSON.parse(content);

      if (!Array.isArray(extracted.matches)) {
        return reply({ error: "Invalid odds data returned." }, 502);
      }

      const qualified = [];

      for (const match of extracted.matches) {
        const home = Number(match.home);
        const draw = Number(match.draw);
        const away = Number(match.away);

        if (
          !match.fixture ||
          !Number.isFinite(home) ||
          !Number.isFinite(draw) ||
          !Number.isFinite(away) ||
          home <= 1 ||
          draw <= 1 ||
          away <= 1
        ) {
          continue;
        }

        // Calculate bookmaker's implied probability total.
        const overround =
          (1 / home) + (1 / draw) + (1 / away);

        // Reject incomplete or unusual markets.
        if (overround < 1.02 || overround > 1.15) {
          continue;
        }

        const outcomes = [
          { pick: "Home Win", odds: home },
          { pick: "Draw", odds: draw },
          { pick: "Away Win", odds: away }
        ];

        outcomes.sort((a, b) => a.odds - b.odds);

        const favourite = outcomes[0];

        // Strict price filter.
        if (favourite.odds < 1.20 || favourite.odds > 2.00) {
          continue;
        }

        // Remove bookmaker margin for a normalized
        // market-implied probability.
        const probability =
          (1 / favourite.odds) / overround * 100;

        qualified.push({
          fixture: match.fixture,
          pick: favourite.pick,
          odds: favourite.odds,
          probability
        });
      }

      // Sort qualifying selections by shortest odds.
      qualified.sort((a, b) => a.odds - b.odds);

      // Never select two outcomes from the same fixture.
      const selections = [];

      for (const candidate of qualified) {
        if (
          !selections.some(
            item => item.fixture === candidate.fixture
          )
        ) {
          selections.push(candidate);
        }

        if (selections.length === 2) break;
      }

      if (selections.length !== 2) {
        return reply({
          analysis:
            "🔥 SIR TRADES AI\n\nNO QUALIFIED PICKS\n\nFewer than two matches passed the selection filters. No selections recommended."
        });
      }

      const combinedOdds =
        selections[0].odds * selections[1].odds;

      const analysis = `
🔥 SIR TRADES AI — QUALIFIED PICKS

1. ${selections[0].fixture}
   PICK: ${selections[0].pick}
   ODDS: ${selections[0].odds.toFixed(2)}

2. ${selections[1].fixture}
   PICK: ${selections[1].pick}
   ODDS: ${selections[1].odds.toFixed(2)}

COMBINED ODDS: ${combinedOdds.toFixed(2)}

These selections passed the odds and data-quality filters. This is not proof of a winning advantage. Virtual sports outcomes are random.
`;

      return reply({ analysis });

    } catch (error) {
      return reply({
        error: error.message || "Unexpected server error."
      }, 500);
    }
  }
};
