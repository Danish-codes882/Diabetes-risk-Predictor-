document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);

  /* ---------- Theme ---------- */
  const root = document.documentElement;
  try { const t = localStorage.getItem("diacare-theme"); if (t) root.dataset.theme = t; } catch (e) {}
  $("themeToggle").addEventListener("click", () => {
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try { localStorage.setItem("diacare-theme", next); } catch (e) {}
  });

  /* ---------- Count-up helper ---------- */
  function countUp(el, to, dur = 1400, decimals = 0, suffix = "") {
    const t0 = performance.now();
    (function tick(now) {
      const p = Math.min((now - t0) / dur, 1), e = 1 - Math.pow(1 - p, 3);
      el.textContent = (to * e).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  }
  document.querySelectorAll("[data-count]").forEach((el) => countUp(el, +el.dataset.count, 1600));

  /* ---------- Slider <-> number sync ---------- */
  document.querySelectorAll(".slider-field").forEach((f) => {
    const range = f.querySelector(".range"), num = f.querySelector("input[type=number]");
    f.style.setProperty("--accent", f.dataset.accent);
    const paint = () => {
      const min = +range.min, max = +range.max;
      const v = Math.min(Math.max(+range.value, min), max);
      range.style.setProperty("--p", ((v - min) / (max - min)) * 100 + "%");
    };
    range.addEventListener("input", () => { num.value = range.value; paint(); });
    num.addEventListener("input", () => { if (num.value !== "") { range.value = num.value; paint(); } });
    paint();
  });

  /* ---------- Segmented / chips -> hidden selects (keeps original ids) ---------- */
  const bindRadios = (name, selectId) => {
    const sel = $(selectId);
    document.querySelectorAll(`input[name="${name}"]`).forEach((r) =>
      r.addEventListener("change", () => { sel.value = r.value; }));
  };
  bindRadios("gender", "gender");
  bindRadios("smoking", "smoking_history");

  /* ---------- Prediction ---------- */
  const form = $("diabetesForm"), btn = $("btnAnalyze"), label = btn.querySelector(".btn-label");
  const IDLE = label.textContent;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    btn.disabled = true; label.textContent = "Processing Neural Weights…";

    const payload = {
      age: parseFloat($("age").value),
      gender: $("gender").value,
      bmi: parseFloat($("bmi").value),
      smoking_history: $("smoking_history").value,
      HbA1c_level: parseFloat($("HbA1c_level").value),
      blood_glucose_level: parseFloat($("blood_glucose_level").value),
      hypertension: $("hypertension").checked ? 1 : 0,
      heart_disease: $("heart_disease").checked ? 1 : 0,
    };

    try {
      const res = await fetch("/predict", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const r = await res.json();
      if (!r.success) throw new Error(r.error || "Unknown error");
      showResult(r);
    } catch (err) {
      console.error(err);
      alert("Prediction Error: " + err.message);
    } finally {
      btn.disabled = false; label.textContent = IDLE;
    }
  });

  const tierClass = (txt) => (/^(Normal)/.test(txt) ? "ok" : /Pre|Over|Under/.test(txt) ? "warn" : "bad");

  function showResult(r) {
    const color = r.probability < 0.25 ? "var(--low)" : r.probability < 0.6 ? "var(--mod)" : "var(--high)";
    $("resultArea").style.setProperty("--rc", color);

    $("riskBadge").className = "risk-badge " + r.badge_class;
    $("riskBadge").textContent = r.risk_category;
    $("medicalAdvice").textContent = r.advice;

    [["bmiStatus", r.metrics.bmi_status], ["hba1cStatus", r.metrics.hba1c_status], ["glucoseStatus", r.metrics.glucose_status]]
      .forEach(([id, txt]) => { const el = $(id); el.textContent = txt; el.className = "m-val " + tierClass(txt); });

    $("placeholderState").classList.add("hidden");
    const rc = $("resultsContent");
    rc.classList.remove("hidden");
    rc.style.animation = "none"; void rc.offsetWidth; rc.style.animation = "";

    // animate gauge from 0
    const fill = $("gFill"), needle = $("needle");
    fill.style.transition = "none"; needle.style.transition = "none";
    fill.style.strokeDashoffset = 100; needle.style.transform = "rotate(-90deg)";
    void fill.getBoundingClientRect();
    fill.style.transition = ""; needle.style.transition = "";
    requestAnimationFrame(() => {
      fill.style.strokeDashoffset = 100 - r.percentage;
      needle.style.transform = `rotate(${-90 + 1.8 * r.percentage}deg)`;
    });
    countUp($("probPercentage"), r.percentage, 1500, 1, "%");

    if (window.innerWidth <= 940) $("resultArea").scrollIntoView({ behavior: "smooth", block: "start" });
  }
});
