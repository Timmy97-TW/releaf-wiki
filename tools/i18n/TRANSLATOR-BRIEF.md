# Translating one page into Chinese

You are translating one page of the ReLEAF iGEM wiki into **Traditional Chinese,
Taiwan usage (zh-Hant)**. Read `tools/i18n/GLOSSARY.md` first; it is the
terminology and it is not optional.

Work only on the page you were given. Never touch another page's file, never run
any `git` command, never pass `"force": true`.

## The loop

Everything happens in the worktree you were given. All commands run from it.

1. See what is left, in slices so the output does not get truncated:

       python3 -I tools/i18n/tr.py list <page>            # everything untranslated
       python3 -I tools/i18n/tr.py list <page> 0 80       # units 0 to 80 only

   Each line is `index` TAB `b` (block) or `a` (attribute) TAB tag-or-attribute
   TAB the English. A block line shows the markup when the unit carries any, and
   the plain text when it does not.

   If a line looks cut off, read that unit in full rather than guessing:

       python3 -I -c "import json;d=json.load(open('tools/i18n/src/<page>.json'));print(d['blocks'][123]['en'])"

2. Write a patch as JSON and apply it. Work in slices of roughly 40 to 80 units
   so a mistake is cheap to redo:

       cat > /tmp/patch-<page>-1.json <<'JSON'
       {"page": "<page>",
        "blocks": {"4": "<zh html>", "5": "..."},
        "attrs":  {"0": "<zh text>"}}
       JSON
       python3 -I tools/i18n/tr.py apply /tmp/patch-<page>-1.json

   `apply` refuses to overwrite a unit that already has a translation. If it
   refuses, your indices are stale: run `list` again and rebuild the patch.

3. When `list` shows nothing left but the things that stay in English (below),
   build the runtime file for your page only:

       python3 -I tools/i18n/build.py <page>

4. Report: the page, how many strings you translated, how many you left in
   English and why, and anything you could not resolve.

## What a translation must preserve

- **The markup, exactly.** If the English is
  `<b>99.2%</b><span>of Taiwan's farms</span>`, the Chinese is
  `<b>99.2%</b><span>的臺灣農場</span>`: same tags, same attributes, same order,
  same class names, same `href`. Never drop a tag, never add one.
- **Jinja as it stands.** `{{ url_for('pages', page='plant') }}` is copied
  character for character inside the `href`. Only the link's words change.
- **Numbers, units, formulae**: 24 h, 3.4 µg/mL, OD600, 37 °C, pH 5.7, R² 0.991,
  α-酮丁酸. A space between a number and a Latin unit; a space between Han
  characters and any Latin word or number: 「在 100 mM NaCl 下」.
- **Names in Latin script**: ReLEAF, iGEM, BoPep4, AcdS 2.1, WB800, CcaSR,
  Pveg-EEBD-RBS0-SamyQ-AcdS-2.1-B0015, *Bacillus subtilis*, Prof. Cheng,
  Dr. Sattely, CH Biotech. Keep `<i>` on a Latin binomial.
- **The strength of every claim.** A hedge is evidence language: "suggests",
  "not yet quantified", "n = 1", "preliminary", "we have not tested this",
  "partial success". Translate it as it stands. Never make a result sound firmer
  or weaker, never add a conclusion the English does not make, never drop a
  caveat because the sentence reads better without it.
- **Figure and table numbering**: `Figure 12.` → `圖 12.`, `Table 1.` → `表 1.`,
  and a reference inside prose, "(Figure 42b, f, j)" → 「（圖 42b、f、j）」.

## What stays in English — leave `zh` empty, do not translate

- **References**: every bibliography entry (author, year, title, journal, DOI).
- **LaTeX** (`\[ ... \]`, `\( ... \)`) and any cell that is only a symbol.
- **Cells that are only a number, a unit or a part name**: `200 cm²`,
  `0.60 s`, `dimensionless` is prose and IS translated（無因次）, but `Pa s` is not.
- **Organisation, product and sponsor names**, and people's names.
- **File names and download labels** that name an English PDF.
- A unit whose text has no words to translate.

## Style

Write the way a careful Taiwanese science writer would: plain, concrete, no
padding. Follow the English sentence order where it reads naturally in Chinese;
split a very long English sentence rather than forcing one Chinese sentence to
carry it. Use 「」 for quotes inside prose, and never a straight `"` inside an
HTML attribute value. Use 臺灣 (not 台灣), ；and ，as the punctuation, full-width.

A heading is a heading: short, nominal, no trailing period.
