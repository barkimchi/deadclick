# DeadClick on your iPhone — ~10-minute morning checklist

The desktop extension is built and tested. The **same codebase** is already Safari/iOS-compatible (`.output/safari-mv3`). Apple just requires a manual Xcode + Apple-ID signing step that can't be safely automated unattended — that's this checklist.

> You're free for all of this. The Apple Developer Program ($99/yr) is only for App Store distribution, **not** for running it on your own phone.

## 0. One-time: finish Xcode

Xcode was downloading. Once it's installed:

```bash
sudo xcodebuild -license accept          # accept the license
xcode-select -p                          # should print /Applications/Xcode.app/Contents/Developer
# if it still points at CommandLineTools, run:
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
xcrun --find safari-web-extension-converter   # should now resolve
```

## 1. Build the Safari package (if not fresh)

```bash
cd "~/BarKimchiMain/02 Projects/DeadClick/deadclick"
npm run build:safari       # → .output/safari-mv3
```

## 2. Wrap it into an Xcode project

```bash
xcrun safari-web-extension-converter .output/safari-mv3 \
  --project-location ./safari-xcode \
  --bundle-identifier dev.barkimchi.deadclick \
  --no-open --force
```

This generates `safari-xcode/DeadClick/DeadClick.xcodeproj` (a tiny container app + the Safari extension).

## 3. Run it on your iPhone

1. `open safari-xcode/DeadClick/DeadClick.xcodeproj`
2. Plug in your iPhone; trust the Mac if prompted.
3. In Xcode's top bar, pick the **DeadClick (iOS)** scheme and select your iPhone as the destination.
4. **Signing**: select the project → *Signing & Capabilities* → check *Automatically manage signing* → Team = your personal Apple ID (add it under Xcode ▸ Settings ▸ Accounts if needed). A free Apple ID works; the build is valid for 7 days, then just re-run from Xcode to refresh.
5. Hit **▶ Run**. The container app installs on your phone.
6. On the iPhone: **Settings ▸ Apps ▸ Safari ▸ Extensions ▸ DeadClick** → turn it **On**, then **Edit websites / Allow** → set to **Allow** (All Websites). (On older iOS: Settings ▸ Safari ▸ Extensions.)
7. First launch you may need to tap the **ᴀA** menu in Safari ▸ Manage Extensions ▸ enable DeadClick.

## 4. Test it

Open Safari, hit a streaming site you know spawns tabs, and click around. No new tabs = it's working. Tap the **ᴀA ▸ DeadClick** menu (or the toolbar) for the popdown with the blocked count + Trust-this-site toggle.

---

### Notes
- **7-day signing:** with a free Apple ID the app expires after 7 days. Re-open the Xcode project and hit Run to refresh. (A paid account removes this; not needed unless you want App Store distribution.)
- **Updating after code changes:** `npm run build:safari`, then re-run step 2 with `--force`, then Run in Xcode again.
- If the converter ever isn't found, Xcode's command-line tools aren't selected — re-run the `xcode-select -s` line in step 0.
