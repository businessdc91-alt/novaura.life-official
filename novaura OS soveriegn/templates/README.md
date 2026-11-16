# NovAura templates

Prototype projects shared as signed template bundles (`.novatemplate`). People open them in the Templates app, read what works and what doesn't, accept the license, and the app unpacks the project into `Documents\NovauraSovereign\Templates\`.

| Path | What it is |
| --- | --- |
| `LICENSE-NOVAURA-TEMPLATE-1.0.md` | The template license. The builder fills in the royalty, the licensor and the contact. |
| `originals/*.json` | One config per template: source folder, what to include, the notes people read, and repairs applied to the packed copy. |
| `assets/` | Placeholder images for art a template leaves out. |

## Build a bundle

Run these in the `novaura OS soveriegn` folder, on the machine that holds the NovAura authority key:

```
node scripts/build_template.mjs templates/originals/aetherium-tcg.json --dry-run
node scripts/build_template.mjs templates/originals/aetherium-tcg.json --redact --receipts-to <your node key>
```

- `--dry-run` lists what would be packed, every key or password found (file and line only, never the value), the files skipped unopened because their names say they hold secrets, and the parts that keep their own licenses.
- `--redact` packs placeholders where keys were found. The source folder is never changed. Rotate any real key that was found, because it is still in the source.
- `--receipts-to` is the node that receives license acceptances. Use your own node key, shown in Nova Registry > Operator. Without it, acceptances stay on the installer's PC.
- Bundles are written to `template-bundles/`, which git ignores.

The builder refuses a project whose own LICENSE is copyleft (GPL and similar) until the config names that license under `rootLicense` and lists the parts it covers. Those parts carry no royalty.

## Before releasing bundles publicly

- **The license is a plain-English draft.** Have a lawyer review it, add a governing-law clause, and confirm the royalty terms. The royalty is set in each config (`royalty.percent`, `royalty.thresholdUsd`, default 10% from the first dollar).
- **Rebuild with `--receipts-to`** so acceptances reach your node.
- **Rotate the keys the scans found** in the original sources if those folders were ever shared. The templates have them removed; the Command v5 originals on J: (never published) still contain them.
