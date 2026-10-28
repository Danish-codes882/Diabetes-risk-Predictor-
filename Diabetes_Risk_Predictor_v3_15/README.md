# DiaCare AI – Diabetes Risk Predictor

Flask web app with a neural network trained on 100,000 patient records. Built with **Python, HTML, CSS and JavaScript** only.

## What changed (v3.16)
- **PyTorch removed** – a Windows "Application Control policy" was blocking `c10.dll`. The model's forward pass now runs in pure Python.
- Trained weights live in `artifacts/model_weights.json` (converted from the original `.pt`, including the encoder categories).
- Only **Flask** needs to be installed – no numpy / pandas / scikit-learn / torch.
- New UI: glass-morphism cards, animated background, sliders, animated gauge, dark/light theme. No CDN, works offline.
- All output text is now in English.

## How to run
```
pip install -r requirements.txt
python app.py
```
Then open http://127.0.0.1:5000 in your browser (or double-click `run.bat`).
