# Phase 1: stand up the stock Vexa stack and prove the minutes loop with a test mailbox

- Change ID: phase1-stock-loop
- Work type: feature
- Status: in-progress
- Created: 2026-09-20T05:46:19+00:00
- Initial Git revision: dba990b413bd0f888b02d46a24f802db492addbb (upstream vexa-ai/vexa main)
- Initial working tree: clean

## Outcome and scope

**Requested outcome (user, 2026-09-20):** "fork the repo into this folder and start phase one".
Phase one, as agreed in the exploration that preceded it: prove the stock Vexa loop end to end
with a test mailbox before any white-label code is written.

**Product context:** white-label Vexa into a product where a bot auto-joins every calendar
meeting, summarises it, and emails minutes to every attendee. UI concept:
https://claude.ai/artifact/3sS8PRi9HHhZw8g79Yzx3y

**In scope**
- Local clone of vexa-ai/vexa in this folder; GitHub fork under the user's account as `origin`,
  upstream as `upstream`.
- The compose stack from published images (`make all` equivalent), on this Windows 11 machine
  with Docker Desktop.
- A Mailpit test mailbox on the compose network, wired as the flows SMTP transport.
- Prove the `post_meeting` flow produces minutes mail for the organizer and the attendees
  without a live meeting, by admitting a `meeting.completed` fact by hand (manual replay).

**Out of scope (later phases)**
- Any branding change, the attendee fallback fix, the admin Branding UI, the approval gate.
- A live bot join (needs a transcription service and a human in a real meeting).
- Committing or pushing to the fork (the user has not asked for a commit).

**Assumptions**
- A-1: The Claude subscription credential already on this machine
  (`~/.claude/.credentials.json`) may be bind-mounted read-only into agent workers for this
  personal evaluation, as Vexa's README documents. Swappable for an API key in `.env`.
- A-2: Transcription is left unconfigured for phase one; the replay carries its own transcript.

**Observed current behaviour (from the exploration)**
- `post_meeting` v4 = process_meeting → email_minutes → email_attendees → drop_to_attendees.
- For calendar-driven meetings the completion event carries no `participants`, so
  `email_attendees` mails nobody. The manual replay passes `participants` explicitly, so this
  gap does not block phase one; it is phase two's first task.
- flows treats the agent domain as absent unless `VEXA_FLOWS_AGENT_API_URL` is set; the compose
  file defaults it to empty.

## Acceptance criteria

| ID | Observable criterion | Verification method | Status |
| --- | --- | --- | --- |
| R-001 | Repo is cloned into the working folder; `origin` = ehtan-smaltai/vexa, `upstream` = vexa-ai/vexa | `git remote -v` | pass |
| R-002 | Docker engine ≥ v26 is running | `docker version --format '{{.Server.Version}}'` | pending |
| R-003 | Compose stack is up from published images: gateway `/health` 200, terminal answers on :13000, admin-api mints an API key | curl + provision-token | pending |
| R-004 | Mailpit runs on the compose network and flows can send through it: a test message appears in Mailpit's API | `docker exec flows-api python -c "emailx.send(...)"` then `GET /api/v1/messages` | pending |
| R-005 | Agent domain is reachable by flows and has a model credential: runtime `/health` reports `model_inference` configured; `flows-api` sees `VEXA_FLOWS_AGENT_API_URL` | curl runtime health; `docker exec flows-api env` | pending |
| R-006 | Manual replay of `meeting.completed` with a transcript and two attendees at the allowed domain produces one organizer mail and two attendee mails in Mailpit, each carrying the report grounded in the transcript | `GET /api/v1/messages` shows 3 messages; body contains a six-word run from the transcript | pending |
| R-007 | The Terminal UI loads in a browser and shows the signed-in self-host account | browser screenshot | pending |

## Tasks

| ID | Task | Depends on | Acceptance IDs | Check | Status |
| --- | --- | --- | --- | --- | --- |
| T-1 | Clone into working folder, rename remote to upstream, create GitHub fork, add origin | — | R-001 | `git remote -v` | done |
| T-2 | Start Docker Desktop, confirm engine version | — | R-002 | `docker version` | in-progress |
| T-3 | Write `deploy/compose/.env` with generated secrets, Mailpit SMTP, `VEXA_UI_URL`, agent door, credential mount | — | R-003, R-004, R-005 | file present, secrets non-placeholder | done |
| T-4 | Add `deploy/compose/docker-compose.mailpit.yml` | — | R-004 | compose config validates | done |
| T-5 | Pull published images (services, agent-worker, bot) | T-2 | R-003 | `docker images` | pending |
| T-6 | `docker compose up -d --no-build` with both files; wait healthy; mint API key | T-3, T-4, T-5 | R-003, R-004 | curl health; token printed | pending |
| T-7 | Verify agent door + model credential from inside the stack | T-6 | R-005 | runtime /health | pending |
| T-8 | SMTP smoke: send one mail from flows-api to Mailpit | T-6 | R-004 | Mailpit API lists it | pending |
| T-9 | Manual replay of `meeting.completed` for a seeded meeting; read Mailpit | T-7, T-8 | R-006 | 3 messages, grounded body | pending |
| T-10 | Open the Terminal in the browser, screenshot | T-6 | R-007 | screenshot | pending |
| T-11 | Update this record with evidence and handoff | all | — | record current | pending |

## Decisions

- D-1 **Local clone plus GitHub fork.** The user said "fork"; `gh` was authenticated, so a fork
  was created under their account and added as `origin`. Upstream stays reachable for rebasing.
- D-2 **Run compose steps directly rather than through `make`.** `make` was absent; a user-scope
  GNU make was installed via winget, but the Makefile recipes assume a POSIX shell. Driving
  `docker compose` and `bin/provision-token` directly from Git Bash is deterministic on Windows.
- D-3 **Mailpit as a compose override file**, not a one-off `docker run`, so the team gets the
  same test mailbox with one command and the file can ship with the fork.
- D-4 **Claude subscription credential via bind mount** (A-1) instead of copying a token into
  `.env`: no secret material passes through the environment or this record. Path is given in
  Docker Desktop's WSL2 host form (`/run/desktop/mnt/host/c/...`) because the runtime container
  asks the engine to mount it, and the engine resolves paths inside the VM.
- D-5 **Prove the minutes lane by manual replay**, not a live meeting. A live join needs STT and
  a human; the replay exercises exactly the steps phase two will change.
- D-6 **Move the phase-1 host to an AWS EC2 VM** (user decision 2026-09-20, after the Docker
  Desktop crash loop and 2.5 GB free disk on the laptop). Ubuntu 24.04 is Vexa's production
  target. Created: account 803553313526, ap-southeast-1, `i-00fa311d4579c0678`, t3.large,
  40 GB gp3, AMI ami-0ba4172b23e57d5a8, key pair `aws-eb`, security group
  `sg-003331b4987fedc4e` (22/13000/18056/18025 from 115.135.135.42 only), public IP
  54.179.146.36, tag Name=vexa-minutes-phase1. Docker CE installed by cloud-init
  (`scratchpad/vm-user-data.sh`). Compose binds every port to loopback, so the UI is reached
  through an SSH tunnel; the extra security-group ports are unused but harmless.
- D-8 **Fully self-hosted model tier as the unattended path** (user away 2 h, asked for "everything
  prepared" and had asked about 100 % self-hosting). The OSS cut ships ONE harness runner,
  `claude-code` (the `.env.example` mention of `openai-agent` is stale; `llm/registry.py` lists
  only `claude-code`). The harness accepts an Anthropic-compatible gateway via
  `ANTHROPIC_BASE_URL`/`ANTHROPIC_AUTH_TOKEN`, and Ollama ≥ 0.14 serves `/v1/messages`, so
  `deploy/compose/docker-compose.localai.yml` adds `ollama` and `whisper`
  (faster-whisper-server, CPU) on the stack network. Wiring test model: `qwen3:1.7b` on 2 vCPU —
  expected slow and low quality; a real deployment needs a GPU host (g6.xlarge class) and a
  20B–32B model. `.env` before this change is saved at `~/.env.before-localai` on the VM.
- D-9 **Company layer and kickoff prompt supplied by us.** Two more things the OSS cut leaves to the
  private tree: (a) the instance gate (`global_setup` platform setting) is meant to be flipped by an
  agent-api verifier route that is not in this cut, so it was set through admin-api's internal
  settings door after creating a `_global` git repo (README "# Smalt AI", STRUCTURE.md) in the
  agent-workspaces volume and pointing `VEXA_GLOBAL_SYSTEM_WORKSPACE_PATH` at it; (b) the
  showcase `behavior/` has no `prompts/process-meeting.md`, so the first replay ended
  `behavior:not_present`. Wrote `behavior/prompts/process-meeting.md` (transcript-first, fixed
  headings, verbatim quotes for the grounding gate) and `docker-compose.behavior.yml` to bind
  the checkout's `behavior/` at `VEXA_BEHAVIOR_DIR=/behavior-local`. Company name "Smalt AI" is a
  placeholder for the user to confirm.
- D-7 **No model credential on the VM yet.** The laptop's Claude subscription file is not copied
  to a cloud host, and API keys are the user's to enter. R-005/R-006 wait on the user adding a
  credential to `deploy/compose/.env` on the VM (or Settings → Models in the UI).

## Verification evidence

| Criterion/task | Command or procedure | Revision and relevant diff | Result | Evidence |
| --- | --- | --- | --- | --- |
| R-001 | `git remote -v`; `gh repo view ehtan-smaltai/vexa` | dba990b4, clean tree | pass | origin = https://github.com/ehtan-smaltai/vexa.git (public fork, created 2026-09-20), upstream = https://github.com/vexa-ai/vexa.git |
| R-002 | `docker version` on the VM | VM i-00fa311d4579c0678 | pass | engine 29.8.1, compose v5.5.1 (≥ v26 required) |
| R-003 | `docker compose ... up -d --no-build`; `ps`; `curl :18056/health`; `bin/provision-token` | dba990b4 + `.env` + mailpit/minio-quay overrides | pass | 13 services healthy (flows-worker has no healthcheck, running); gateway `{"status":"ok"}`; key `vxa_bot_…` (40 chars) minted for ethan@smaltai.com, stored at `~/api-key.txt` on the VM (mode 600) |
| R-004 | `emailx.send(...)` inside flows-api → `GET mailpit/api/v1/messages` | same | pass | 1 message: `Vexa <minutes@local.test>` → organizer@local.test, subject "phase-1 SMTP smoke". Sender display name is the hard-coded brand (phase-2 item) |
| R-005 | `env` in flows-api; runtime `/health` | same | partial | `VEXA_FLOWS_AGENT_API_URL=http://agent-api:8100` present; runtime `model_inference: not_configured` (D-7, waits on user credential) |
| R-007 | Built-in browser via SSH tunnel → http://localhost:13000 | same | partial | "Vexa Terminal — Sign in to continue" renders (dev email login). Sign-in deliberately left to the user: the first sign-in becomes the instance admin |

## Documentation

- `deploy/compose/docker-compose.mailpit.yml` carries its own usage header.
- No upstream docs changed in this phase.

## Repair history

**Symptom (T-2):** Docker Desktop 4.57.0 on Windows 11 26200 starts, then the backend crashes
within ~30 s and quits. `docker version` never reaches the engine.

| # | Hypothesis | Experiment | Result |
| --- | --- | --- | --- |
| 1 | Stale AF_UNIX socket file `%LOCALAPPDATA%\Docker\run\dockerInference` blocks "Inference manager" init (log: `remove ...: The file cannot be accessed by the system`) | `Remove-Item`, `del /f`, `fsutil reparsepoint delete` on the file | all fail with the same error; renamed the `run` folder instead |
| 2 | Same class of file elsewhere | restart; log now names `%LOCALAPPDATA%\docker-secrets-engine\engine.sock` | renamed that folder too |
| 3 | Root cause is one-off stale files | restart again | **new** `dockerInference` socket created by the previous attempt is again undeletable. Every start leaves a socket the next start cannot remove: the fault is in socket removal itself, not in leftovers |
| 4 | AF_UNIX driver stopped, or Defender Controlled Folder Access | `sc query afunix` = RUNNING; `EnableControlledFolderAccess` = 0 | not the cause |

Three unsuccessful patches for the same failure → stop patching (repair rule), reassess the plan.
Same crash signature already appears in the log at 00:17 today, before this session.
Resolution: user chose an AWS VM (D-6).

**Symptom (T-5, on the VM):** `docker compose pull` aborts: `pull access denied for minio/minio,
repository does not exist`. Docker Hub no longer serves `minio/minio:latest` or `minio/mc:latest`
(manifest inspect fails for both). Upstream `make all` is therefore broken for every new
install today. Fix: `deploy/compose/docker-compose.minio-quay.yml` overrides both images to
`quay.io/minio/...`, which pull fine. Candidate upstream issue/PR.

**T-9 repair trail (the minutes lane on the OSS cut), each found by running the replay and reading
the reaction's `reason`:**

| # | Symptom | Cause | Fix |
| --- | --- | --- | --- |
| 1 | reaction admitted but PARKED, `gate: missing` | instance gate reads admin-api `global_setup`; the verifier route that sets it is not in this cut | created `_global` repo in the workspaces volume; `PUT /internal/settings/global_setup` state=completed, company="Smalt AI" |
| 2 | `process_meeting` done with `behavior:not_present` | showcase `behavior/` has no `prompts/process-meeting.md` | wrote `behavior/prompts/process-meeting.md`; `docker-compose.behavior.yml` binds it at `VEXA_BEHAVIOR_DIR=/behavior-local` |
| 3 | agent-api 422 `extra_forbidden room_meeting_id` | this cut's chat route has no meeting-room fields; flows always sends them when the row resolves | `flows_steps/agent.py`: on 422 naming `room_`, retry the dispatch without the room (logged via `swallowed`) |
| 4 | agent-api 500 ← runtime 502 `cannot access .../agent-workspaces/_data/1` | organizer's workspace never seeded (no sign-in yet); worker mount subpath `1` absent | `POST /api/workspace/init` as user 1; removed the dead `Created` worker container |
| 5 | `GET /api/workspace/file?slug=_global` → 403 for user 1 | per-user reads are scoped to own mounts; `_global` not among them | `mailtext.company_name` falls back to admin-api `/admin/instance` `company` |
| 6 | patched flows code must run without an image rebuild | image bakes `/app/src` | `docker-compose.flows-src.yml` binds `core/flows/src` over `/app/src` (same pattern as `docker-compose.hot.yml`) |

**Second repair pass (with a workspace-scoped Anthropic key, 2026-09-20 afternoon):**

| # | Symptom | Cause | Fix |
| --- | --- | --- | --- |
| 7 | API 400 "not scoped to a workspace" | the first key was organization-level | runtime forwards `ANTHROPIC_CUSTOM_HEADERS`; user issued a workspace-scoped key instead |
| 8 | report not grounded, twice → reaction failed | `mcp__vexa__meeting_transcript` does not exist: `shared/tools.apply_tool_grant` has no caller, so no MCP server is attached to a turn | transcript goes into the kickoff (`mt.transcript_dialogue`); regrounding retry points at it |
| 9 | `KeyError('transcript')` | bind-mounted source changed but the container kept the old module in memory | `restart`, not `up -d`, after a source-overlay edit |
| 10 | `no scaffold could be minted … HTTP 404` | `POST /internal/scaffolds` absent from this agent-api | `mint_scaffold` returns `""` on 404; `email_minutes` builds its closing after the mint |
| 11 | `every desk drop failed … HTTP 405` | `PUT /api/workspace/file` absent | new `agent.DoorAbsent`; `drop_to_attendees` returns `NotPresent` |

Model tier for the earlier unattended run: Ollama `qwen3:1.7b`, 20k context, CPU — observed ~2.3 tokens/s
generation. **Outcome:** the chain gate → prompt → dispatch → worker spawn → harness → Ollama
`POST /v1/messages` is proven live (worker `vexa-worker-1-chat-meet-5` reached Ollama), but each
harness request took ~5 min of prompt processing and timed out (Ollama logged 500 after 4m59s,
one 200 after 5m48s); no reply reached flows inside its 15-min ceiling. Reaction cancelled by
operator. Verdict: a CPU-only t3.large cannot run the claude-code harness against a local model;
the same wiring on a GPU host (or a much larger CPU box) is the self-hosted path. R-006 therefore
still waits on either the user's Anthropic key (`bin/model-switch anthropic`) or a GPU host.

**Symptom (T-1):** the first `gh repo fork ... --clone=false --remote=false` printed usage and
created nothing; the VM clone of the fork then failed with "could not read Username". Re-ran
`gh repo fork vexa-ai/vexa --clone=false` from a non-repo directory: fork created, public.

**Second blocker found meanwhile:** C: has 2.5 GB free. The published images total roughly 10 GB
(bot image alone 3.6 GB). Existing Docker data disk is 13.4 GB; large user folders: Downloads
56.5 GB, `~/.cache` 25.1 GB, Temp 6.8 GB. Freeing space is the user's call.

| R-006 (prep) | `./bin/phase1-replay --seed-only` on the VM | same + `bin/phase1-replay` | pass (seed half) | meeting id 2, 9 speaker-attributed segments; `GET /transcripts/by-id/2` with the user key returns 9 segments |
| **R-006** | `./bin/phase1-replay` on the VM | 847b0f9f | **pass** | Reaction `done` ~35 s after admission. Mailpit holds 3 messages: `Minutes: …` to ethan@smaltai.com, `… — what it means for you` to priya@ and marco@. Body carries Summary / Decisions / Action items with owners+dates / Open questions / two verbatim quotes with speakers. Grounding gate passed. `drop_to_attendees` answers `agent:not_present` (no PUT workspace route in this cut) without failing the meeting |

## Handoff

- Status: **phase 1 complete.** R-001 to R-006 pass; R-007 partial (sign-in page renders, the
  user signs in themselves — the first sign-in claims the admin role).
- Completed work: T-1 to T-9 and T-11. The replayed meeting produces minutes and mails them to
  the organizer and both attendees, grounded in the transcript, in about 35 seconds.
- Unverified areas: a LIVE meeting (bot joins a real call, Whisper transcribes real speech) —
  the bot image is pulled and transcription is wired to the local Whisper, but no call has been
  held; the branding is still Vexa's (phase 2); prompt quality on long/multilingual meetings.
- Current VM model tier: workspace-scoped Anthropic API key (`ANTHROPIC_API_KEY`), no base-url
  override. `bin/model-switch local <model>` switches to the local Ollama for a self-hosted test;
  that needs a GPU host to be usable (CPU measured at ~2.3 tokens/s, harness times out).
- Next phase (2, white-labeling): the attendee fallback for calendar meetings
  (`_attendees` in production.py has no `participants` for a calendar-driven completion), the
  `branding` settings key + admin UI, the Minutes/Recipients surfaces, the approval gate.
- Committed on branch `phase-1` of the fork (commit 0630fea1, pushed 2026-09-20 at the user's
  request): `deploy/compose/docker-compose.mailpit.yml`, `deploy/compose/docker-compose.minio-quay.yml`,
  `deploy/compose/bin/phase1-replay`, this record. The VM checkout tracks the same branch.
- Access: `ssh -i ~/.ssh/aws-eb -N -L 13000:127.0.0.1:13000 -L 18056:127.0.0.1:18056 -L 18025:127.0.0.1:18025 ubuntu@54.179.146.36`
  then http://localhost:13000 (terminal), :18025 (Mailpit).
- Cost: t3.large ≈ US$0.11/h while running; `aws ec2 stop-instances --instance-ids i-00fa311d4579c0678` when idle.
- Laptop leftovers: `%LOCALAPPDATA%\Docker\run.stale-*` and `docker-secrets-engine.stale-*` can be
  deleted; Docker Desktop itself still crash-loops there (unresolved, out of scope now).
- Release status: pushed to `origin/phase-1` on the fork; no PR, no merge, no deploy.
