# NovAura server: relay + TURN

One Linux machine with a public IP runs three things:

- **Mesh relay** (`novaura_relay`, TCP 43889). Every Sovereign node dials out to it, so people on hotspots, 5G home internet or any other carrier NAT can still join the mesh.
- **Marketplace archive** (inside the relay). It keeps every signed marketplace listing, so a node that was offline when something was published catches up when it connects. Nodes check each publisher's signature themselves, so the server can't fake or edit a listing, and only the original publisher can update one.
- **TURN server** (coturn, 3478 + UDP 49152-50151). It carries a call's audio and video when the two callers can't reach each other directly, which is common on mobile carriers. The media stays end-to-end encrypted (DTLS-SRTP), so the server can't see or hear it.

The relay hands each node short-lived TURN logins, signed with a secret it shares with coturn. No TURN password is ever stored in the app.

A node's ID is derived from its identity key, and logging in to the relay means signing a one-time challenge with that key, so nobody can take over another node's address. Sovereign builds before 1.0.9 log in the old way and are refused; update them.

## 1. Get a machine

Oracle Cloud Always Free works and costs nothing:

1. Create an Oracle Cloud account. It asks for a card to verify you; Always Free resources aren't charged.
2. Create a compute instance:
   - Image: **Ubuntu 24.04** (or 22.04).
   - Shape: **VM.Standard.A1.Flex** (Ampere ARM). 1–2 OCPUs and 6–12 GB is plenty. If it says "out of capacity", try another availability domain or try again later.
   - Add your SSH public key.
3. Note the instance's **public IP**.

Any other Ubuntu VPS with a public IPv4 works the same way. Skip the Oracle-specific steps.

## 2. Open the ports in Oracle's network

In the Oracle console, go to Networking → Virtual cloud networks → your VCN → Security Lists → Default Security List → **Add Ingress Rules**. Use source CIDR `0.0.0.0/0` for each:

| Protocol | Port(s) | For |
|---|---|---|
| TCP | 43889 | mesh relay |
| TCP | 3478 | TURN |
| UDP | 3478 | TURN |
| UDP | 49152-50151 | call media |

The setup script opens the same ports in the machine's own firewall. On Oracle both must be open.

## 3. Upload the relay and run the setup

From this repo on your PC:

```bash
scp -r "novaura OS soveriegn/relay" ubuntu@YOUR_IP:~/relay
ssh ubuntu@YOUR_IP
cd ~/relay
sudo bash deploy/setup-server.sh
```

The first run takes a few minutes. It installs Rust and coturn, builds the relay, creates the TURN secret and starts both services on boot. It ends with a short check and the address to use.

If the public IP can't be detected, pass it: `sudo bash deploy/setup-server.sh --public-ip YOUR_IP`.

**Update feed (in-app updates):** Sovereign checks `https://relay.novaura.life/sovereign/latest.json`. Point the DNS A record of `relay.novaura.life` at this server first, then run the script with `--update-domain relay.novaura.life`. It installs Caddy, which gets and renews the HTTPS certificate itself, and serves `/var/www/novaura/sovereign/`. On Oracle, also open TCP 80 and 443 in the security list. For each release, copy `latest.json`, the installer and its `.sig` from your PC's `release\` folder (after `scripts\publish-update.ps1`):

```bash
scp release/* ubuntu@YOUR_IP:/var/www/novaura/sovereign/
```

The installers are signed with your updater key, so the server can't slip in a changed one.

**Updating:** upload the new `relay` folder and run the script again. It keeps the existing secret.

## 4. Point Sovereign at it

In Sovereign, open the Peering window → **Relay** tab, enter `YOUR_IP:43889` and apply. The setting is saved and survives restarts. Within a few seconds the relay shows ONLINE, and the node fetches TURN logins on its own.

Everyone you want to reach must use the same relay. Share the address with your testers.

## Checking on it

```bash
systemctl status novaura-relay coturn
journalctl -u novaura-relay -f     # joins, leaves, rejected packets
journalctl -u coturn -f            # TURN sessions
```

The relay's startup lines say whether TURN logins are on (`TURN credentials: turn:...`) and how many listings the archive holds (`Listing archive: N stored in /var/lib/novaura`).

## Sizes and memory

One packet can be up to 16 MB. Files of any size (multi-GB projects) travel as a series of 4 MB pieces, so there is no limit on the total. A broadcast keeps one copy in memory however many people it goes to.

Every packet the relay is holding (being read, or waiting for a slow receiver) counts against one memory budget, 1536 MB by default. On a machine with more RAM, raise it in `/etc/novaura/relay.env`, for example `NOVAURA_RELAY_MEMORY_MB=4096`, then `sudo systemctl restart novaura-relay`. When the budget is in use, senders wait instead of losing packets.

Each connection can send 64 MB at once and then 16 MB per second; past that, the relay reads more slowly (the sender's upload waits) rather than dropping anything.

## Files on the server

| Path | What |
|---|---|
| `/etc/novaura/relay.env` | TURN secret and URLs (readable only by root and the relay). Settings added by hand are kept on re-runs. |
| `/etc/turnserver.conf` | coturn config, rewritten by the script. The original is saved as `.orig`. |
| `/etc/systemd/system/novaura-relay.service` | relay service |
| `/usr/local/bin/novaura_relay` | relay binary |
| `/var/lib/novaura/archive.jsonl` | marketplace listing archive (one signed packet per line). Back it up if you care about the history; deleting it only means nodes stop getting old listings from the relay. |
