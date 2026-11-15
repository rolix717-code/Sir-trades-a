const imageInput = document.getElementById("imageInput");

imageInput.addEventListener("change", function () {
    const file = this.files[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
        alert("Please select an image.");
        return;
    }

    const preview = document.getElementById("preview");

    preview.src = URL.createObjectURL(file);
    preview.style.display = "block";

    document.getElementById("analysisResult").innerText =
        "Screenshot uploaded successfully.";
});

function analyseImage() {
    const file = imageInput.files[0];

    if (!file) {
        alert("Upload a screenshot first.");
        return;
    }

    document.getElementById("analysisResult").innerText =
        "Screenshot ready. Connect the secure AI backend to analyse fixtures and odds.";
}

function calculateOdds() {
    const input = document.getElementById("odds").value;

    const numbers = input
        .split(/[,\s]+/)
        .filter(Boolean)
        .map(Number);

    const stake = Number(document.getElementById("stake").value);

    if (
        numbers.length === 0 ||
        numbers.some(n => !Number.isFinite(n) || n <= 1) ||
        !Number.isFinite(stake) ||
        stake <= 0
    ) {
        alert("Enter valid odds greater than 1 and a stake greater than 0.");
        return;
    }

    const combined = numbers.reduce((a, b) => a * b, 1);

    const returns = combined * stake;
    const profit = returns - stake;
    const probability = (100 / combined);

    document.getElementById("combined").innerText =
        combined.toFixed(2);

    document.getElementById("returns").innerText =
        Math.round(returns).toLocaleString() + " UGX";

    document.getElementById("profit").innerText =
        Math.round(profit).toLocaleString() + " UGX";

    document.getElementById("probability").innerText =
        probability.toFixed(2) + "%";
}
