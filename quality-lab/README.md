# AI Answer Quality Lab

Check whether changes to ML Incident Copilot break expected answers. Start with five questions, write down the expected routing and evidence, then check the chatbot response automatically.

From the repository root, run:

```sh
node quality-lab/run.mjs
node quality-lab/run.mjs --simulate-regression
```

The first command checks the real evidence engine. The second removes a required drift citation from one response after it is generated. It should report one failure and exit with status 1. This shows how a missing citation can fail a check even when every citation that remains is valid.

The pipeline example asks “Show pipeline logs” and then “What should I check next?” The second answer should cite `runbook/pipeline`. GitHub Actions runs these cases on pushes and pull requests.

**Your turn.** In `cases.json`, copy the pipeline case and change the second question to “Should I retrain the model?” Predict the expected intent and citation, run the lab, then update the expectations based on what a useful answer should contain. Inspect the source text to check whether it actually supports the answer.

The cases use synthetic incidents and evaluate the rule-based response path. The lab checks routing, expected hypotheses, and citation IDs. It does not measure LLM quality or verify that a cited passage supports every claim.

The [Promptfoo RAG example](https://github.com/promptfoo/promptfoo/tree/main/examples/eval-rag) is a reference for adapting this exercise to model-generated answers later.
