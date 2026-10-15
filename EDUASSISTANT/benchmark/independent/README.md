# Independent Evaluation

**Status: PENDING.** No independent dataset is included in this repository.

`cases.json` may be supplied only after the cases and expected decisions have
been created and frozen independently from Rule Engine development. Do not copy
cases from the Verify Harness or `benchmark/fixed_synthetic_cases.json`, and do
not tune rules against this set. Record the source and provenance in the
manifest. Expected decisions must be agreed before running the evaluator.

Each case uses the same input fields understood by
`benchmark/run_benchmark.py`: `id`, `title`, `description`, `category`,
`priority`, and `expectedDecision`; optional evaluation inputs include
`student`, `institutionalFacts`, `studentClaim`, `addressAnalysis`,
`evidenceFiles`, `ocr`, `aiMetadata`, `benchmarkSISVerified`, and
`expectedEscalationReason`. Use opaque case IDs and remove direct identifiers
from the dataset and output.

Copy `cases.template.json` to `cases.json` only when a real frozen dataset is
available. The runner reads that one file, makes no AI, network, or database
calls, and does not change the adaptive threshold. It writes aggregate and
per-case decision metrics to `results/latest.json` and `results/latest.csv`
only after a valid dataset is supplied.

```powershell
cd EDUASSISTANT
python benchmark/independent/run_independent_eval.py
```

With no `cases.json`, the default command prints
`INDEPENDENT_EVALUATION_PENDING` and exits successfully so readiness checks can
report the pending state. Add `--require-data` when a release gate must fail
until an independent dataset is present.

Do not commit participant names, student records, source documents, or other
personal information in the dataset or results.
