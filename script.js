const imageInput = document.getElementById("imageInput");

async function analyseImage() {
    const result = document.getElementById("analysisResult");
    const file = imageInput.files[0];

    if (!file) {
        result.innerText = "Please upload a screenshot first.";
        return;
    }

    result.innerText = "🔥 SIR TRADES AI is analysing...";

    const formData = new FormData();
    formData.append("image", file);

    try {
        const response = await fetch(
            "https://sir-trades-ag.rolix717.workers.dev",
            {
                method: "POST",
                body: formData
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Analysis failed.");
        }

        result.innerText = data.analysis;

    } catch (error) {
        result.innerText = "Error: " + error.message;
    }
}

function calculateOdds() {
    const numbers = document.getElementById("odds").value
        .split(/[,\s]+/)
        .filter(Boolean)
        .map(Number);

    const stake = Number(document.getElementById("stake").value);

    if (!numbers.length || numbers.some(n => !Number.isFinite(n) || n <= 1) || stake <= 0) {
        alert("Enter valid odds and stake.");
        return;
    }

    const combined = numbers.reduce((a, b) => a * b, 1);
    const returns = combined * stake;

    document.getElementById("combined").innerText = combined.toFixed(2);
    document.getElementById("returns").innerText = Math.round(returns).toLocaleString() + " UGX";
    document.getElementById("profit").innerText = Math.round(returns - stake).toLocaleString() + " UGX";
    document.getElementById("probability").innerText = (100 / combined).toFixed(2) + "%";
}
