# prompts — what an agent turn is asked to do

The kickoffs `flows_defs/production.py` hands to a dispatched agent. Resolution is the order
[`../README.md`](../README.md) states for this whole tree: a flow's own `prompts` param, then the
admin's `_global/prompts/<name>.md`, then the private tree at `$VEXA_BEHAVIOR_DIR/prompts/`, then
this published showcase. A deployment that carries none of them gets `PromptAbsent`, which the
step turns into a terminal `behavior:not_present` — nothing is broken, nothing is coming, and it
says so on the reaction.

| file | read by | when |
|---|---|---|
| `process-meeting.md` | `process_meeting` | after a meeting completes, to write its minutes |

## `process-meeting.md`

Substitutions, filled by the step's own `.format()`: `{mid}` the meeting's row id, `{native}` its
platform id, `{date}` the meeting's stamp, and `{transcript}` — the speaker-attributed transcript,
inlined.

**Why the words are IN the kickoff rather than behind a tool.** The agent cannot fetch them: the
toolbelt that would attach Vexa's MCP server to a turn (`core/agent/shared/tools.apply_tool_grant`)
has no caller in this cut, so no MCP server is ever passed to the harness. Asked to call
`mcp__vexa__meeting_transcript`, the agent reported the tool missing and wrote the minutes from the
title instead — twice — and the grounding gate correctly refused to mail an ungrounded report.
`flows_steps.meeting.transcript_dialogue` reads the transcript through the owning service at
dispatch time, caps it, and marks the cut; nothing is stored and no fact carries the words.

A template that does not use `{transcript}` still works — the extra argument is ignored — so a
deployment running its own private kickoff is unaffected by this one.

**The shape the step depends on.** The reply IS the artefact: it is mailed verbatim, so the prompt
forbids preamble and file writes, and it demands a verbatim quote with its speaker — which is also
what carries the report past the grounding gate (a six-word run shared with the transcript). Change
the headings freely; drop the quote and meetings start failing that gate.
