"""
DiaCare AI - Diabetes Risk Predictor
------------------------------------
Only Flask is required. The neural network forward pass is pure Python
(no torch / numpy / pandas / scikit-learn), so Windows "Application Control"
policies cannot block any DLL.
Trained weights: artifacts/model_weights.json
"""
import json
import math
from pathlib import Path

from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

BASE_DIR = Path(__file__).resolve().parent
WEIGHTS_PATH = BASE_DIR / "artifacts" / "model_weights.json"

with open(WEIGHTS_PATH, "r", encoding="utf-8") as f:
    MODEL = json.load(f)

NUM_COLS = MODEL["num_cols"]
CATEGORIES = MODEL["categories"]  # {"gender": [...], "smoking_history": [...]}
LAYERS = MODEL["layers"]


def one_hot(value, categories):
    if value not in categories:
        raise ValueError(f"Unknown category '{value}'. Allowed: {', '.join(categories)}")
    return [1.0 if value == c else 0.0 for c in categories]


def forward(x):
    """Dense -> ReLU ... -> Dense -> Sigmoid (dropout is off at inference)."""
    for layer in LAYERS:
        out = []
        for row, b in zip(layer["weights"], layer["bias"]):
            s = b
            for w, v in zip(row, x):
                s += w * v
            out.append(s)
        if layer["activation"] == "relu":
            x = [v if v > 0 else 0.0 for v in out]
        else:  # sigmoid
            x = [1.0 / (1.0 + math.exp(-max(min(v, 60.0), -60.0))) for v in out]
    return x[0]


def predict_risk(d):
    numeric = [float(d[c]) for c in NUM_COLS]
    cats = one_hot(d["gender"], CATEGORIES["gender"]) + one_hot(
        d["smoking_history"], CATEGORIES["smoking_history"]
    )
    return forward(numeric + cats)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json(force=True)

        age = float(data.get("age", 0))
        gender = str(data.get("gender", "Female"))
        hypertension = int(data.get("hypertension", 0))
        heart_disease = int(data.get("heart_disease", 0))
        smoking_history = str(data.get("smoking_history", "never"))
        bmi = float(data.get("bmi", 0))
        hba1c = float(data.get("HbA1c_level", 0))
        glucose = float(data.get("blood_glucose_level", 0))

        probability = predict_risk({
            "age": age,
            "hypertension": hypertension,
            "heart_disease": heart_disease,
            "bmi": bmi,
            "HbA1c_level": hba1c,
            "blood_glucose_level": glucose,
            "gender": gender,
            "smoking_history": smoking_history,
        })
        percentage = round(probability * 100, 2)

        if probability < 0.25:
            risk_category = "Low Risk"
            badge_class = "risk-low"
            advice = "Your diabetes risk is very low. Keep up a balanced diet, regular exercise and a healthy lifestyle."
        elif probability < 0.60:
            risk_category = "Moderate Risk"
            badge_class = "risk-moderate"
            advice = "Your risk is moderate. Reduce sugar intake, walk at least 30 minutes daily and get your blood sugar checked periodically."
        else:
            risk_category = "High Risk"
            badge_class = "risk-high"
            advice = "Your risk is high. Please consult a certified endocrinologist or physician promptly and have your HbA1c test repeated."

        return jsonify({
            "success": True,
            "probability": probability,
            "percentage": percentage,
            "risk_category": risk_category,
            "badge_class": badge_class,
            "advice": advice,
            "metrics": {
                "bmi_status": "Normal" if 18.5 <= bmi <= 24.9 else ("Overweight" if bmi > 24.9 else "Underweight"),
                "hba1c_status": "Normal (< 5.7)" if hba1c < 5.7 else ("Prediabetes (5.7 - 6.4)" if hba1c <= 6.4 else "Diabetic (>= 6.5)"),
                "glucose_status": "Normal (< 140)" if glucose < 140 else ("Prediabetes (140 - 199)" if glucose < 200 else "High (>= 200)"),
            },
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400


if __name__ == "__main__":
    print("DiaCare AI is running at http://127.0.0.1:5000")
    app.run(host="127.0.0.1", port=5000, debug=False)
