# Installing the Estante reader on a reMarkable

This takes a reMarkable 2 from out of the box to the Estante reader paired
with your account and showing your books. It is the design's seven steps
(`docs/remarkable-reader.md` §2.1), each with what to do, what you see when it
worked, and what to do when it did not.

The reader reads only: it shows your books, songs and setlists, in any key, and
syncs them in the background. Editing stays on the phone, tablet or computer
app.

Steps 2 to 4 happen on a computer, in a terminal. Step 3 installs community
tools that hook into the tablet's own software; they are not Estante's, and
their own pages are the authority on them.

## Written against

These community tools change between releases. This guide was written on
**2026-11-02** against:

| Tool | Version | Its instructions |
|---|---|---|
| reMarkable OS | 3.20 or later | — |
| Vellum (vellum-cli) | v0.3.2 | <https://github.com/vellum-dev/vellum> |
| xovi | v0.3.3 | <https://github.com/asivery/xovi> |
| AppLoad | v0.6.0 | <https://github.com/asivery/rm-appload> |
| qt-resource-rebuilder (rm-xovi-extensions) | v19-23052026 | <https://github.com/asivery/rm-xovi-extensions> |
| xovi-tripletap | v1.1.1 | <https://github.com/rmitchellscott/xovi-tripletap> |
| remarkable-xovi-installer | v3.1.1 | <https://github.com/wowitsjack/remarkable-xovi-installer> |

When a tool's own page says something different from this guide, follow its
page for that tool.

## 1. What is needed

**What to do.** Gather:

- A reMarkable 2 on reMarkable OS **3.20 or later**. On the tablet:
  *Settings → General → About* shows the version. xovi needs 3.20.
- A computer with `ssh` and `scp`. macOS and Linux have them; Windows 10 and
  later has OpenSSH. The install script (step 4) also needs `sh`, `curl` and
  `tar`: on Windows, run it under WSL or Git Bash, or install by hand.
- Either the USB cable, or the tablet and the computer on the same Wi-Fi.
- An Estante account, signed in on a phone or a computer, for pairing.

**When it worked.** In a terminal, `ssh -V` prints a version (for example
`OpenSSH_9.6p1`), and *About* shows 3.20 or a later version.

**When it did not.**

- *About shows a version older than 3.20*: update the tablet first
  (*Settings → General → Software*). xovi does not run on older versions.
- *`ssh` is not found*: on Windows, add *OpenSSH Client* under *Settings →
  Apps → Optional features*; on Linux, install your distribution's
  `openssh-client`.

## 2. Reaching the tablet as root

**What to do.**

1. On the tablet: *Settings → General → Help → About → Copyrights and
   licenses*. At the bottom are the **root password** and the tablet's
   **IP addresses**. A reMarkable 2 needs no developer mode.
2. By USB: plug it in; the tablet is at `10.11.99.1`. Then, with the password
   from step 1:

   ```sh
   ssh root@10.11.99.1
   ```

3. By Wi-Fi: use the Wi-Fi address from the same page (Wi-Fi SSH is on by
   default on a reMarkable 2):

   ```sh
   ssh root@<address>
   ```

4. Optional, so the password is asked once and never again:

   ```sh
   ssh-copy-id root@<address>
   ```

The rest of this guide writes `<address>` for whichever address you used:
`10.11.99.1` by USB, or the Wi-Fi address.

**When it worked.** The first time, ssh asks whether to trust the tablet's
key; answer `yes`. After the password, you get the tablet's prompt, ending in
`#` (for example `reMarkable: ~#`). `exit` returns to your computer.

**When it did not.**

- *`Connection timed out` or `No route to host`*: by USB, check the cable and
  that the tablet is awake (`10.11.99.1` only answers while it is plugged in);
  by Wi-Fi, check both are on the same network, and use the address the page
  shows now — it can change.
- *`Permission denied`*: the password was mistyped; copy it again from the
  page. It changes if the tablet is reset.
- *`REMOTE HOST IDENTIFICATION HAS CHANGED`*: the tablet was reset or
  updated. Remove the old key with `ssh-keygen -R <address>` and connect
  again.

## 3. Installing xovi and AppLoad

The reader is an AppLoad app; AppLoad is an extension of xovi, which hooks
into the tablet's own interface. Installing them is done with their own tools,
following their own pages (linked in *Written against*). This guide does not
repeat their install scripts.

**What to do.**

1. With **Vellum**, the package manager for current reMarkable OS: install
   Vellum as [its instructions](https://github.com/vellum-dev/vellum) say,
   then, on the tablet:

   ```sh
   vellum add xovi appload
   ```

   `appload` brings in `qt-resource-rebuilder`, the xovi extension AppLoad
   draws itself with, and with it the script step 3 runs. `xovi` alone does
   not: without `appload` there is no `/home/root/xovi/rebuild_hashtable`.
   Vellum's AppLoad package installs only on the OS versions it lists
   (3.28 and 3.29 when this was written); on another, it says so.
2. Or with a community installer for the reMarkable 2, for example
   [remarkable-xovi-installer](https://github.com/wowitsjack/remarkable-xovi-installer),
   as its instructions say. It installs the same pieces, the script included.
3. Rebuild xovi's hashtable for this OS version. qt-resource-rebuilder needs
   it to find its way around this version's interface; it is needed again
   after every OS update. Over ssh:

   ```sh
   /home/root/xovi/rebuild_hashtable
   ```

   It stops the tablet's interface and asks for **Enter**. It then starts the
   interface by itself to build the table — if the tablet has a passcode,
   enter it on the tablet when asked — and stops it again once it prints
   `[qmldiff]: Hashtab saved to /home/root/xovi/exthome/qt-resource-rebuilder/hashtab`.
   It ends with *Hashtable rebuilt*; the tablet's screen stays without its
   interface until step 5.
4. Install [**xovi-tripletap**](https://github.com/rmitchellscott/xovi-tripletap)
   (with Vellum, `vellum add tripletap`):
   xovi does not start on its own after a reboot, and tripletap starts it with
   **three presses of the power button**. A plain reboot always returns to the
   tablet's own interface, which is what keeps a broken extension from locking
   the tablet out.
5. Start xovi: press the power button three times.

**When it worked.** The tablet's interface restarts, and AppLoad's icon
appears in it. Over ssh, `ls /home/root/xovi/extensions.d/` lists
`appload.so`. The folder AppLoad lists its apps from,
`/home/root/xovi/exthome/appload/`, may not exist yet — a Vellum install does
not make it — and step 4 makes it.

**When it did not.**

- *`rebuild_hashtable: No such file or directory`*, or *Please install
  qt-resource-rebuilder*: AppLoad is not installed yet — `vellum add appload`
  (3.1), then run it again.
- *No AppLoad icon after the three presses*: the hashtable is missing or for
  another OS version — rebuild it (3.3), then press three times again.
- *The tablet's interface does not come back*: restart the tablet (hold the
  power button). It returns to its own interface without xovi; then check the
  installer's page for this OS version.
- *Vellum or the installer reports an error*: it is theirs — see the tool's
  own page and issues; the versions this guide was written against are listed
  above.

## 4. Installing the reader

**What to do.** Either way below, xovi and AppLoad must already be on the
tablet (step 3).

*By the script, from a computer* (macOS, Linux; on Windows, WSL or Git Bash).
Download [`scripts/install.sh`](scripts/install.sh) and run it with the
tablet's address:

```sh
RM_IP=<address> sh install.sh
```

`RM_IP` is required — over USB it is `RM_IP=10.11.99.1`. `RM_USER` changes the
login (default `root`); `ESTANTE_RELEASES` changes where it downloads the
reader from (default the latest release on GitHub,
`https://github.com/ruoso/estante-de-cifras/releases/latest/download`). The
reader is published only there, as a release of the repository: the
backend, the screens and the music code, built together by the repository's
release workflow. The site only pairs it and syncs your books.

To run a reader built on your own computer instead of the release's — to try a
change before it is deployed, or to trust only what you built — run the script
from a clone of the repository with `ESTANTE_FROM_SOURCE=1`:

```sh
git clone https://github.com/ruoso/estante-de-cifras
cd estante-de-cifras
ESTANTE_FROM_SOURCE=1 RM_IP=<address> sh remarkable/scripts/install.sh
```

It builds all three parts from that clone: the backend (needs
[Go](https://go.dev/dl/), which fetches the version the reader needs by
itself), the screens (Qt's `rcc`, from a Python venv the script makes the
first time, about 100 MB — needs `python3`, or `ESTANTE_RCC` naming an `rcc`)
and the music code (needs `npm`, from [Node](https://nodejs.org/)).
With all three built there, nothing is downloaded.
`ESTANTE_SOURCE_QML=0` or `ESTANTE_SOURCE_BUNDLE=0` keeps the release's screens
or music code instead. The backend is built with its self-update off, so no
release replaces what was installed until the script runs again; it says
*Built backend version …, its self-update off*, and the reader's settings show
that version.

The script, over one SSH connection (so the password, if any, is asked once):

1. asks the tablet its architecture with `uname -m` — `armv7l` for the
   reMarkable 2, `aarch64` for the Paper Pro — and stops on anything else;
2. downloads that app folder from the latest release
   (`estante-armv7.tar.gz` or `estante-arm64.tar.gz`) with the release's
   `manifest.json`, and checks the folder against the manifest's SHA-256;
3. unpacks it on the computer, and copies it to the tablet;
4. keeps any installed reader as the previous one, in
   `/home/root/xovi/exthome/estante.previous/` (outside AppLoad's directory,
   so AppLoad does not list *Estante* twice), puts the new one at
   `/home/root/xovi/exthome/appload/estante/`, and stops the previous one's
   backend if it is still running, so the next opening starts the new one.

It never touches `/home/root/.local/share/estante/`, where the reader keeps
its pairing and synced books: installing or updating keeps both.

*Or by hand*, for the reMarkable 2 (armv7):

```sh
curl -fLO https://github.com/ruoso/estante-de-cifras/releases/latest/download/estante-armv7.tar.gz
tar xzf estante-armv7.tar.gz
scp -r estante root@<address>:/home/root/xovi/exthome/appload/
```

Copying by hand over an installed reader merges into it rather than replacing
it, and does not stop its backend: to update by hand, first move the old one
aside with `ssh root@<address> mv /home/root/xovi/exthome/appload/estante
/home/root/xovi/exthome/estante.previous` (after removing an older
`estante.previous`), and restart the tablet afterwards.

*The Paper Pro* (and the Move) is `aarch64`: the script picks
`estante-arm64.tar.gz` by itself; by hand, use that archive instead. Unlike
the reMarkable 2, it needs developer mode for root SSH — see reMarkable's own
support pages — and xovi and AppLoad for it, as their pages say. The reader
is built and tested for the reMarkable 2; nothing in it is specific to it
beyond the architecture.

Then, on the tablet, open AppLoad and press **Reload**.

**When it worked.** The script ends with what it installed and the next step:

```text
Installed the armv7 reader, version 3f9c2a7d10be, at /home/root/xovi/exthome/appload/estante.
The previous install is kept at /home/root/xovi/exthome/estante.previous.
Next: on the tablet, open AppLoad and press Reload; Estante is listed.
```

(or *There was no previous install.* the first time). After **Reload**,
*Estante* is listed in AppLoad.

**When it did not.**

- *`set RM_IP to the tablet's address`*: run it as `RM_IP=10.11.99.1 sh
  install.sh` (USB) or with the Wi-Fi address (step 2).
- *`could not reach the tablet`*: the same as step 2's failures — try
  `ssh root@<address>` first.
- *`… is not installed on this computer`*: install the tool it names, or
  install by hand.
- *`the tablet is a … machine`*: the reader runs on `armv7l` and `aarch64`
  only; check `RM_IP` points at the tablet.
- *`the download does not match the release's manifest`*: see step 7.
- *`AppLoad is not installed on the tablet yet`*: the reader was installed,
  but step 3 is not done (or not on this tablet); AppLoad lists *Estante* once
  it is installed and xovi started.
- *`could not copy the reader to the tablet`*: check the connection and run
  it again; nothing in AppLoad's directory was changed.

## 5. Opening and pairing

**What to do.**

1. Open *Estante* from AppLoad. It says *Pair with your account*.
2. Press it: it shows a code and an address — *go to www.estantedecifras.app/pair
   and enter KQ7-4TM* (your code differs).
3. On a phone or a computer signed in to Estante, open that address, enter the
   code and confirm *Pair your reMarkable*.

**When it worked.** The tablet shows the shelf and syncs the books. From then
on the reader opens on the shelf, and keeps syncing in the background while it
runs.

**When it did not.**

- *The code was not accepted*: a code lasts ten minutes. Press *Pair with your
  account* again for a new one.
- *The tablet keeps showing the code after you confirmed*: the tablet must be
  on Wi-Fi to hear that the pairing was approved; check *Settings → Wi-Fi*.
- *The address asks you to sign in*: sign in with the Estante account whose
  books the tablet should read, then enter the code.

## 6. Updating it, and the tablet's own updates

**What to do.**

- **The reader updates itself**, whole: when a newer release is published, it
  downloads it at its next sync (from GitHub only, checked against the
  release's SHA-256), and its settings say *A new version is ready: it starts
  the next time Estante opens*. Once Estante is closed, it puts the new
  version in place — the one it replaces kept as the previous install — and
  the next opening runs it. Nothing to do.
- **reMarkable OS updates** can stop xovi until its hashtable is rebuilt for the
  new version (step 3.3), and tripletap may need its own step again (its page
  says). The reader itself is untouched in `/home/root`. Turning automatic OS
  updates off (*Settings → General → Software*) and updating by hand avoids
  being caught out before a gig.
- **Going back to the previous install**, if a new one misbehaves:

  ```sh
  ssh root@<address> 'rm -r /home/root/xovi/exthome/appload/estante && mv /home/root/xovi/exthome/estante.previous /home/root/xovi/exthome/appload/estante'
  ```

  then restart the tablet (three presses for xovi) and open *Estante*.
- **Removing it**: *Sign out* in the reader's settings, then

  ```sh
  ssh root@<address> rm -r /home/root/xovi/exthome/appload/estante /home/root/xovi/exthome/estante.previous
  ```

  and **Reload** in AppLoad. Its synced books and state are in
  `/home/root/.local/share/estante/`, removed by *Sign out* or by hand.

**When it worked.** After an update, the reader's settings show the new
version and no longer say *A new version is ready*. After
removing it, *Estante* is no longer listed in AppLoad.

**When it did not.**

- *After an OS update, no AppLoad icon*: rebuild the hashtable (step 3.3),
  then three presses.
- *`rm: can't remove … estante.previous`* while removing: there was no
  previous install; the rest was removed.
- *The old version still shows in the settings*: see step 7.

## 7. When something goes wrong

- *No AppLoad icon*: xovi is not running — press the power button three
  times. After an OS update, rebuild the hashtable first (step 3.3).
- *Estante not in AppLoad's list*: the folder is not at
  `/home/root/xovi/exthome/appload/estante/` with its `manifest.json` at the
  top. Check with `ssh root@<address> ls /home/root/xovi/exthome/appload/estante`
  — it lists `backend`, `icon.png`, `manifest.json` and `resources.rcc`; a
  folder nested one level deeper (`estante/estante`) is from copying by hand
  over an existing one. Then **Reload**.
- *It opens but says nothing*: the backend did not start — the folder for the
  wrong architecture (`ssh root@<address> uname -m`: `armv7l` takes
  `estante-armv7.tar.gz`, `aarch64` takes `estante-arm64.tar.gz`), or
  `backend/entry` not executable:
  `ssh root@<address> chmod +x /home/root/xovi/exthome/appload/estante/backend/entry`.
- *The script says the download does not match*: run it again in a few
  minutes. If it persists, a release is being published (a new manifest
  beside an old archive); nothing was changed on the tablet, so waiting costs
  nothing.
- *The old version still shows in the settings* after an update: close and
  reopen *Estante*. If it persists, restart the tablet and press the power
  button three times.
- *Pairing fails*: the code lasts ten minutes; get a new one. The tablet must
  be on Wi-Fi.
- *Not connected*: the reader shows what it last synced and says when; it
  syncs again when Wi-Fi is back.
- *`scp` fails with `Connection closed` or `subsystem request failed`*
  copying by hand: a recent `scp` speaks SFTP, which the tablet may not
  offer; add `-O` (`scp -O -r estante root@<address>:…`). The script falls
  back to it by itself.

The reader keeps its pairing and synced books in
`/home/root/.local/share/estante/`. Reinstalling (step 4) never touches it;
*Sign out* (step 6) removes it.
