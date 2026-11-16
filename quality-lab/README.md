# AI Answer Quality Lab

Check whether changes to ML Incident Copilot break expected answers. Start with four questions, write down the expected routing and evidence, then check the chatbot response automatically.

From the repository root, run:

```sh
node quality-lab/run.mjs
node quality-lab/run.mjs --simulate-regression
```

The first command checks the real evidence engine. The second removes a required drift citation from one response after it is generated. It should report one failure and exit with status 1. This shows how a missing citation can fail a check even when every citation that remains is valid.

**Your first exercise.** Add a case for “What should I check next?” in the pipeline incident. Predict which source the response should cite, then run the lab and inspect the output. Compare the answer manually with the source text to see what checking a citation ID alone can establish.

The cases use synthetic incidents and evaluate the rule-based response path. The lab checks routing, expected hypotheses, and citation IDs. It does not measure LLM quality or verify that a cited passage supports every claim.

The [Promptfoo RAG example](https://github.com/promptfoo/promptfoo/tree/main/examples/eval-rag) is a reference for adapting this exercise to model-generated answers later.
