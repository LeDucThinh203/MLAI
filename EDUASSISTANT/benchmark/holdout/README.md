# Frozen Holdout Evaluation

`track_a_holdout_v1.json` is a static, synthetic final evaluation set for the
Track A escalation-routing policy. It contains 36 scenarios whose expected
decisions and escalation reasons are written directly in the dataset. The
scenarios cover valid internal workflow processing, formatting, missing facts,
conflicts, academic authority, out-of-scope requests, ownership, provenance,
and the 0.75 confidence boundary.

This dataset is separate from the 18-case development benchmark. Only the
explicit manual holdout command reads it; normal requests, routine CI, training,
and tests do not. The dataset is frozen in
`manifest.json`; the runner checks the SHA-256 of the exact file bytes before
it calls the Rule Engine.

The dataset was authored for this repository from the documented workflow
policy. It is **not claimed to be externally authored or independently
authored**. This holdout check reports implementation behavior on a frozen set;
it is not production user validation or a legal-eligibility evaluation.

Run it manually after implementation work is complete:

```powershell
cd EDUASSISTANT
benchmark\run_holdout_eval.bat
```

The command uses only the deterministic Rule Engine and explicit synthetic test
context. It makes no AI or network calls, writes no database data, and does not
mutate the adaptive threshold. Results are written to `results/latest.json` and
`results/latest.csv`.

Do not edit v1 after viewing its result. If a dataset correction is required,
create a new version and manifest and explain the change. Do not tune the Rule
Engine or rewrite expected labels to make v1 pass.
