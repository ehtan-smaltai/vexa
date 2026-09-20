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

**Symptom (T-1):** the first `gh repo fork ... --clone=false --remote=false` printed usage and
created nothing; the VM clone of the fork then failed with "could not read Username". Re-ran
`gh repo fork vexa-ai/vexa --clone=false` from a non-repo directory: fork created, public.

**Second blocker found meanwhile:** C: has 2.5 GB free. The published images total roughly 10 GB
(bot image alone 3.6 GB). Existing Docker data disk is 13.4 GB; large user folders: Downloads
56.5 GB, `~/.cache` 25.1 GB, Temp 6.8 GB. Freeing space is the user's call.

| R-006 (prep) | `./bin/phase1-replay --seed-only` on the VM | same + `bin/phase1-replay` | pass (seed half) | meeting id 2, 9 speaker-attributed segments; `GET /transcripts/by-id/2` with the user key returns 9 segments. Replay half not run: no model credential (D-7) |

## Handoff

- Current task: T-9 (full replay) is blocked on a model credential the user must add (D-7).
  T-10 partially done (sign-in page renders; user signs in).
- Completed work: T-1 through T-8; stack healthy on the VM; SMTP lane proven; seed proven.
- Unverified areas: R-006 (minutes produced and mailed to three recipients), R-007 sign-in,
  and the bot image pull finishing (`~/pull.log` on the VM should end with `PULL_DONE`).
- Blockers: model credential. Options for the user: Terminal → Settings → Models (no restart),
  or `ANTHROPIC_API_KEY=` in `~/vexa/deploy/compose/.env` on the VM followed by
  `$(cat ~/compose-cmd.txt) up -d`. Then run `cd ~/vexa/deploy/compose && ./bin/phase1-replay`.
- Local uncommitted additions (fork checkout on the laptop): `deploy/compose/docker-compose.mailpit.yml`,
  `deploy/compose/docker-compose.minio-quay.yml`, `deploy/compose/bin/phase1-replay`, this record.
  Same three files exist on the VM checkout. Nothing committed or pushed yet (user has not asked).
- Access: `ssh -i ~/.ssh/aws-eb -N -L 13000:127.0.0.1:13000 -L 18056:127.0.0.1:18056 -L 18025:127.0.0.1:18025 ubuntu@54.179.146.36`
  then http://localhost:13000 (terminal), :18025 (Mailpit).
- Cost: t3.large ≈ US$0.11/h while running; `aws ec2 stop-instances --instance-ids i-00fa311d4579c0678` when idle.
- Laptop leftovers: `%LOCALAPPDATA%\Docker\run.stale-*` and `docker-secrets-engine.stale-*` can be
  deleted; Docker Desktop itself still crash-loops there (unresolved, out of scope now).
- Release status: nothing committed, nothing pushed.
