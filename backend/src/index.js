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
            new Response(JSON.stringify(data), {
                status,
                headers
            });

        if (request.method === "OPTIONS") {
            return new Response(null, {
                status: 204,
                headers
            });
        }

        if (request.headers.get("Origin") !== origin) {
            return reply({ error: "Access denied." }, 403);
        }

        if (request.method !== "POST") {
            return reply({ error: "POST only." }, 405);
        }

        if (!env.TCHAVI_API_KEY) {
            return reply({
                error: "TCHAVI_API_KEY secret is missing."
            }, 500);
        }

        try {

            const form = await request.formData();

            const image = form.get("image");

            const history = String(
                form.get("history") || ""
            ).slice(0, 12000);

            if (!image || typeof image.arrayBuffer !== "function") {
                return reply({
                    error: "Upload a fixture screenshot."
                }, 400);
            }

            if (image.size > 8 * 1024 * 1024) {
                return reply({
                    error: "Image must be under 8 MB."
                }, 400);
            }

            if (!["image/jpeg", "image/png", "image/webp"].includes(image.type)) {
                return reply({
                    error: "Use JPG, PNG or WEBP."
                }, 400);
            }

            const bytes = new Uint8Array(
                await image.arrayBuffer()
            );

            let binary = "";

            for (let i = 0; i < bytes.length; i += 32768) {
                binary += String.fromCharCode(
                    ...bytes.subarray(i, i + 32768)
                );
            }

            const base64 = btoa(binary);

            const prompt = `
You are SIR TRADES AI for BetPawa English Virtual League.

UPLOADED HISTORY:
${history || "No historical results supplied."}

TASK:
Read upcoming fixtures and odds from the uploaded screenshot.

Compare the fixtures with the supplied historical results.

RULES:
1. Do not invent teams, fixtures or odds.
2. Use only clearly readable information.
3. Historical virtual results are descriptive and do not guarantee future outcomes.
4. Return at most TWO selections.
5. Selections must come from different matches.
6. If fewer than two qualify, return fewer.
7. If none qualify, return NO QUALIFIED PICKS.
8. Never promise guaranteed wins.

OUTPUT:

🔥 SIR TRADES AI

1. MATCH:
   PICK:
   ODDS:

2. MATCH:
   PICK:
   ODDS:

COMBINED ODDS:
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
                                content: prompt
                            },

                            {
                                role: "user",

                                content: [

                                    {
                                        type: "text",
                                        text: "Analyse this upcoming fixtures screenshot."
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

                        max_tokens: 300,
                        temperature: 0

                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                return reply({
                    error: data.error?.message || "AI request failed."
                }, response.status);
            }

            const analysis =
                data.choices?.[0]?.message?.content;

            if (!analysis) {
                return reply({
                    error: "No analysis returned."
                }, 502);
            }

            return reply({
                analysis: analysis
            });

        } catch (error) {

            return reply({
                error: error.message || "Server error."
            }, 500);

        }
    }
};
