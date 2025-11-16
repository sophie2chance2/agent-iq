# SECURITY & PRIVACY GUIDELINES — Agent Navigability Simulator

**Purpose:** Minimize data collection and third‑party exposure for the Agent Navigability Simulator capstone.

## 1. Data Minimization
- Avoid personal data. Use synthetic/demo accounts where possible.
- Do not commit secrets/tokens to source control; use local env vars or a secrets manager.
- Redact/mask URLs, cookies, and auth artifacts in any logs.

## 2. Logging & Recordings
- Disable platform session recording by default. If required for debugging: enable temporarily, avoid PII, and document scope.
- **Retention:** Delete runtime logs/recordings within **30 days** (or sooner). Document deletions in `logs/DELETION_LOG.md`.
- Store prompts and agent traces only when necessary for evaluation; strip identifiers.

## 3. Credentials & Accounts
- Team‑owned accounts only (no employer accounts/tokens). Rotate tokens monthly or on exposure.
- Use separate credentials for staging vs. demos. Keep `.env` files local and out of the repo.

## 4. Third‑Party Platforms
- Platform may host the running app only; source code and datasets remain in the private Team repo.
- Review platform terms before uploads; do not upload datasets containing PII.
- If logs are unavoidable, restrict scope and shorten retention.

## 5. Risk Management
- Track incidents in `SECURITY_RISKS.md` (what happened, impact, fix, date).
- For material risks, notify the instructor within 48 hours.

## 6. Destruction / Project Close‑Out
- Revoke tokens/credentials.
- Wipe platform logs/recordings and verify deletion.
- Archive final code/deliverables to Team‑controlled storage.
