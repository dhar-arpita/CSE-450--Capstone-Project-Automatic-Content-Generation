# Azure VM Setup — Step 1.9 (DEPLOYMENT_PLAN.md)

Owner: Member A (deviation from the plan's original "B or C" assignment — see
`docs/PHASE5_HANDOFF.md` §... — nobody had done it by the time Phase 5 was
about to start, so A did it directly rather than block further).

## VM

| Property | Value |
|---|---|
| Name | `seed-vm` |
| Resource group | `seed-rg` |
| Subscription | Azure for Students |
| Region | East Asia |
| Size | Standard D2s v3 (2 vCPUs, 8 GiB RAM) — matches the plan's recommendation |
| OS | Ubuntu Server 20.04 LTS (Canonical, `0001-com-ubuntu-server-focal`) |
| Admin user | `seed` |
| SSH auth | Key-based only (no password auth — see "Security decisions" below) |

## Networking

| Property | Value |
|---|---|
| Public IP | `20.24.218.75` — **Static** allocation (confirmed stable across VM stop/start before locking in) |
| DNS name label | `seed-vm-capstone.eastasia.cloudapp.azure.com` — confirmed resolving via `nslookup` |
| VNet / Subnet | `seed-vmVNET` / `seed-vmSubnet` |
| NSG | `seed-vmNSG` |

### NSG inbound rules

| Priority | Name | Port | Source | Action | Why |
|---|---|---|---|---|---|
| 300 | Allow-HTTP-80 | 80 | Any | Allow | Public site access + Let's Encrypt HTTP-01 challenge |
| 310 | Allow-HTTPS-443 | 443 | Any | Allow | Public site access over TLS |
| 1000 | default-allow-ssh | 22 | Any | Allow | See "Security decisions" — deliberately NOT restricted to team IPs |
| 65000 | AllowVnetInBound | Any | VirtualNetwork | Allow | Azure default |
| 65001 | AllowAzureLoadBalancerInBound | Any | AzureLoadBalancer | Allow | Azure default |
| 65500 | DenyAllInBound | Any | Any | Deny | Azure default — catches everything not explicitly allowed above |

**6379 (Redis) and 8000 (backend) are never opened** — no rule permits them, so they fall through to `DenyAllInBound`. Confirmed by the absence of any rule for them, matching the plan's requirement exactly.

## Security decisions (deliberate deviations from the plan, recorded so they're not mistaken for oversights)

**Port 22 is open to `Any`, not restricted to team IPs as the plan specifies.** This was a conscious call for this academic capstone project, made after weighing the actual risk:
- Automated SSH brute-force scanning of any public IP's port 22 is guaranteed to happen (confirmed via research), typically within minutes to hours of the IP going live.
- However, the real danger is password-guessing succeeding — which requires password authentication to be enabled. This VM uses **key-based auth only**; brute-forcing a private key is computationally infeasible, so the constant scan traffic is functionally harmless here.
- Restricting to team IPs would also be a maintenance burden for a student team connecting from campus wifi, phone hotspots, and home ISPs with non-static addresses.
- **Verified with the authoritative check** (not just grepping the raw file, which is ambiguous when the line is commented out): `sudo sshd -T | grep -i passwordauthentication` → `passwordauthentication no`. Confirmed genuinely disabled — leaving port 22 open to `Any` is a safe tradeoff on this VM.

**SSH access is currently via a single shared private key** (`~/.ssh/id_rsa`, same file used by both A and C), rather than one key pair per person. Acceptable shortcut for a 2-3 person team on a short-lived project; the tradeoff is no per-person audit trail on who connected. **To do properly later** (deferred until after the current deployment push): each team member generates their own key pair and adds only their *public* key to `~/.ssh/authorized_keys` under `seed`.

## Docker

| Property | Value |
|---|---|
| Docker Engine | 26.1.3 — **pre-installed on this VM image**, not via Docker's official apt repo (confirmed: `apt update` shows no `download.docker.com` source) |
| Docker Compose | v5.5.1 — installed manually as a per-user CLI plugin, **not** via apt (`docker-compose-plugin` isn't installable here since Docker's own apt repo was never added) |
| Compose install location | `~/.docker/cli-plugins/docker-compose` (per-user, `seed` account only) |
| Compose install method | Binary download from `https://github.com/docker/compose/releases/download/v5.5.1/docker-compose-linux-x86_64`, `chmod +x` |
| `docker` group | `seed` user added via `usermod -aG docker seed`, so `docker`/`docker compose` run without `sudo` |

**Note for future reinstall/another user:** since this is a manual binary install rather than an apt package, it does not auto-update, and it is only present for the `seed` user's home directory. If a teammate ever gets their own separate Linux account on this VM (rather than sharing `seed`), the Compose binary needs to be re-installed for that account too — or reinstalled at the system-wide location (`/usr/local/lib/docker/cli-plugins/`) instead, which was considered but not done since the team is currently sharing one account.

## Verified working (plan's "done when" criteria)

- `ssh seed@20.24.218.75` (or via the DNS label) connects successfully.
- `sudo docker run hello-world` succeeded.
- `docker compose version` succeeded (no `sudo` needed, after the `docker` group change + new session).
- `nslookup seed-vm-capstone.eastasia.cloudapp.azure.com` resolves to `20.24.218.75`.

## Deferred to Step 5.1 (not part of 1.9)

- Copying real production secrets into a `.env` on the VM (root-owned, `chmod 600`), per the plan's requirement — left until the actual deployment step, since there's nothing to run against yet.
