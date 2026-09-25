# Orphaned mentions of the deleted Bioreactor Calculations page (25 September 2026, overnight)

The owner deleted the Bioreactor Calculations page on 25 September. 35 prose mentions of it survived on eight pages (INCONSISTENCIES.md section 35). The page's last version was recovered from commit `f99ab00` to see what each sentence relied on. Each mention was classed:

- **A, pure pointer.** The sentence only said where detail lives. Repointed with a real link where another page holds the material (Hardware, Bioreactor for the reactor, membrane, pore and containment; Measurement, Pressure and flow meter for hydraulics; Math Model, Fit to the salt ladder and Units per hectare, for the Human Practices items), otherwise the pointer clause was deleted and the grammar repaired.
- **B, attribution.** The sentence says the deleted page computed or stated something. The number and the rest of the sentence are unchanged; only the attribution now reads "the team's reactor calculations (not currently published on the wiki)" or a short back-reference to it. None of these conflicts was resolved.

HTML comments were left alone (one in engineering/index.html). Three lower-case mentions in drylab-notebook/index.html are dated log entries and were not in scope. Each section's review note has an appended "(Overnight: ...)" sentence saying what changed and what the team still has to do.

## 1. What I changed

| Commit | Page |
|---|---|
| `4ba1821` | Description: sentences no longer send readers to the deleted Bioreactor Calculations page |
| `d3d8982` | Engineering: sentences no longer send readers to the deleted Bioreactor Calculations page |
| `119ed8e` | Experiments: sentences no longer send readers to the deleted Bioreactor Calculations page |
| `1999791` | Human Practices: sentences no longer send readers to the deleted Bioreactor Calculations page |
| `d30ebf1` | Measurement: sentences no longer send readers to the deleted Bioreactor Calculations page |
| `a8921a9` | Math Model: sentences no longer send readers to the deleted Bioreactor Calculations page |
| `d71640a` | Results: sentences no longer send readers to the deleted Bioreactor Calculations page |
| `b2e90ec` | Software: sentences no longer send readers to the deleted Bioreactor Calculations page |

Plus this file and the section 35 status marks in INCONSISTENCIES.md.

Checks: `build/audit.py` output identical before and after (missing 0, anchor 0, dupid 0, alt 0, external 0). All eight pages rendered in headless Chrome (dump-dom, 25 s) with the edited text and every review note present. A grep of all published HTML outside review notes and comments finds no "Bioreactor Calculations" except the three notebook log entries.

## 2. Every sentence, before and after


### Description (`description/index.html`)

1. **Abstract · How to read this page** (class A-fixed)
   - Before: “build and test cycles, Plants the stress assays, Bioreactor Calculations the transport arithmetic, and Peptide Design the modelling”
   - After: “build and test cycles, Plants the stress assays, and Peptide Design the modelling”
2. **Our solution · Figure 4 caption** (class A-fixed)
   - Before: “The membrane sizing, the flux arithmetic and the pump floor are on the Bioreactor Calculations page.”
   - After: “The membrane sizing is on Hardware → Bioreactor.”

### Engineering (`engineering/index.html`)

3. **Sheet 05 · cycle 5, ACCD in the reactor** (class A-fixed)
   - Before: “Hardware and Bioreactor Calculations.”
   - After: “Hardware.”
4. **Sheet 08 · What is next** (class A-fixed)
   - Before: “photometer are on Hardware and Bioreactor Calculations; the BoPep4 design”
   - After: “photometer are on Hardware; the BoPep4 design”

### Experiments (`experiments/index.html`)

5. **Protocols held elsewhere · Bioreactor operation** (class A-fixed)
   - Before: “Hardware → Bioreactor, with the derived parameters on Bioreactor Calculations.”
   - After: “Hardware → Bioreactor.”

### Human Practices (`human-practices/index.html`)

6. **3.1 Expert selection · Modelling and AIoT row** (class A-fixed)
   - Before: “the model now takes wet-lab data back in. Bioreactor calculations”
   - After: “the model now takes wet-lab data back in. Math Model”
7. **3.2 Return visits · Prof. Chen tab** (class A-fixed)
   - Before: “set up to be proven wrong by it: see Bioreactor calculations.”
   - After: “set up to be proven wrong by it: see Math Model.”
8. **Conclusion · open items** (class A-fixed)
   - Before: “how many reactors a farm needs (Bioreactor calculations).”
   - After: “how many reactors a farm needs (Math Model).”

### Measurement (`measurement/index.html`)

9. **Measurement map** (class A-fixed)
   - Before: “the cloning and blot record on Engineering, the photometer build on Hardware, and the reactor physics on Bioreactor Calculations.”
   - After: “the cloning and blot record on Engineering, and the photometer build on Hardware.”
10. **Bioreactor · Figure 6 caption** (class B-reworded)
   - Before: “The amber line is the 230 mL/min floor that Bioreactor Calculations is built on,”
   - After: “The amber line is the 230 mL/min floor that the team's reactor calculations (not currently published on the wiki) are built on,”
11. **Bioreactor · M11** (class B-reworded)
   - Before: “Bioreactor Calculations states the pump “will not run slower than 230 mL/min” and anchors its whole shear table on 230;”
   - After: “The team's reactor calculations (not currently published on the wiki) state the pump “will not run slower than 230 mL/min” and anchor their whole shear table on 230;”
12. **Bioreactor · M13** (class B-reworded)
   - Before: “Bioreactor Calculations computes 3.74 mL of lumen holdup”
   - After: “The team's reactor calculations (not currently published on the wiki) compute 3.74 mL of lumen holdup”
13. **Bioreactor · M14 (fibre count)** (class B-reworded)
   - Before: “Bioreactor Calculations specifies eight fibres of 1.0 mm bore”
   - After: “The team's reactor calculations (not currently published on the wiki) specify eight fibres of 1.0 mm bore”
14. **Bioreactor · M14 (part number)** (class B-reworded)
   - Before: “the part number now carried on Bioreactor Calculations appears in no document”
   - After: “the part number now carried in those calculations appears in no document”
15. **Bioreactor · pressure and flow meter sources** (class B-reworded)
   - Before: “the error analysis and the Darcy-Starling treatment: Bioreactor Calculations.”
   - After: “the error analysis and the Darcy-Starling treatment: the team's reactor calculations (not currently published on the wiki).”
16. **Bioreactor · membrane breach detector sources** (class A-fixed)
   - Before: “Hardware → Bioreactor and Bioreactor Calculations.”
   - After: “Hardware → Bioreactor.”
17. **Fix summary list · M11** (class B-reworded)
   - Before: “Pump floor, 230 mL/min on Bioreactor Calculations against”
   - After: “Pump floor, 230 mL/min in the team's reactor calculations (not currently published on the wiki) against”

### Math Model (`model/index.html`)

18. **The model chain** (class B-reworded)
   - Before: “The vessel physics sits on its own page. What happens between the culture and the bottle, which is to say the hollow-fibre module, the wall shear, the critical flux and the two-compartment transient, is worked out in full on Bioreactor Calculations and is not repeated here.”
   - After: “The vessel physics sits outside this page. What happens between the culture and the bottle, which is to say the hollow-fibre module, the wall shear, the critical flux and the two-compartment transient, is worked out in full in the team's reactor calculations (not currently published on the wiki) and is not repeated here.”
19. **Optogenetics kinetics · fix M5** (class B-reworded)
   - Before: “Bioreactor Calculations cites Castillo-Hair et al. 2019,”
   - After: “The team's reactor calculations (not currently published on the wiki) cite Castillo-Hair et al. 2019,”
20. **Optogenetics kinetics · equation (9) note** (class B-reworded)
   - Before: “The single-nutrient logistic form the reactor pages use is in Bioreactor Calculations, with”
   - After: “The single-nutrient logistic form the reactor pages use is in the team's reactor calculations (not currently published on the wiki), with”
21. **Optogenetics kinetics · fix M6** (class B-reworded)
   - Before: “The two pages also give two carrying capacities, 1.456 at 22 °C here and 1.54 at 37 °C on Bioreactor Calculations;”
   - After: “The two sources also give two carrying capacities, 1.456 at 22 °C here and 1.54 at 37 °C in the team's reactor calculations (not currently published on the wiki);”
22. **Optogenetics kinetics · dead-time paragraph** (class B-reworded)
   - Before: “longer than the loop's other time constants, which Bioreactor Calculations works out in full.”
   - After: “longer than the loop's other time constants, which the team's reactor calculations (not currently published on the wiki) work out in full.”
23. **GIS economic impact · fix M8** (class B-reworded)
   - Before: “Bioreactor Calculations computes the ACC concentration in the shell, 0.88 µg/mL or 23 nM, against an ACC deaminase KM of 1.5 to 17.4 mM, and states that the comparison”
   - After: “The team's reactor calculations (not currently published on the wiki) compute the ACC concentration in the shell, 0.88 µg/mL or 23 nM, against an ACC deaminase KM of 1.5 to 17.4 mM, and state that the comparison”
24. **GIS economic impact · fix M8 (last sentence)** (class B-reworded)
   - Before: “Either add it as a fourth short model, or amend the sentence on that page.”
   - After: “Either add it as a fourth short model, or amend the sentence in those calculations.”
25. **Parameters · t1/2 row** (class B-reworded)
   - Before: “[1], via Bioreactor Calculations”
   - After: “[1], via the team's reactor calculations (not currently published on the wiki)”
26. **Parameters · mu_max, X_max row** (class B-reworded)
   - Before: “1 June refit, see Bioreactor Calculations”
   - After: “1 June refit, in the team's reactor calculations (not currently published on the wiki)”
27. **Not modelled · Membrane transport row** (class B-reworded)
   - Before: “On Bioreactor Calculations, in more detail than this page could carry,”
   - After: “In the team's reactor calculations (not currently published on the wiki), in more detail than this page could carry,”
28. **Not modelled · ACC deaminase against ACC oxidase row** (class B-reworded)
   - Before: “Promised to this page by Bioreactor Calculations and not delivered.”
   - After: “Promised to this page by the team's reactor calculations (not currently published on the wiki) and not delivered.”
29. **References · [1] note** (class B-reworded)
   - Before: “activation half-time cited on Bioreactor Calculations, and the likely source”
   - After: “activation half-time cited in the team's reactor calculations (not currently published on the wiki), and the likely source”
30. **Status box · M8** (class B-reworded)
   - Before: “M8 a handoff promised by Bioreactor Calculations is not taken here.”
   - After: “M8 a handoff promised by the team's reactor calculations (not currently published on the wiki) is not taken here.”

### Results (`results/index.html`)

31. **Whole system · reactor paragraph** (class A-fixed)
   - Before: “The engineering of it is on Hardware and the hydraulics on Bioreactor Calculations.”
   - After: “The engineering of it is on Hardware and the hydraulics on Measurement.”
32. **Whole system · fix R4** (class B-reworded)
   - Before: “and Bioreactor Calculations builds its shear, Reynolds, pressure-drop and critical-flux numbers on 230 mL/min as a floor, which its own fix B1 already flags.”
   - After: “and the team's reactor calculations (not currently published on the wiki) build their shear, Reynolds, pressure-drop and critical-flux numbers on 230 mL/min as a floor, which their own fix B1 already flags.”
33. **Whole system · blot mass** (class B-reworded)
   - Before: “and 37.6 kDa on Bioreactor Calculations.”
   - After: “and 37.6 kDa in the team's reactor calculations (not currently published on the wiki).”
34. **Containment · fix R8 (who states the claim)** (class B-reworded)
   - Before: “Hardware, Bioreactor Calculations and a poster figure each state this claim differently.”
   - After: “Hardware, the team's reactor calculations (not currently published on the wiki) and a poster figure each state this claim differently.”
35. **Containment · fix R8 (log reduction value)** (class B-reworded)
   - Before: “Bioreactor Calculations lists the log reduction value as unmeasured and says plainly that publishing a number we have not measured would undercut the rest of the page.”
   - After: “Those calculations list the log reduction value as unmeasured and say plainly that publishing a number we have not measured would undercut the rest of the calculations.”

### Software (`software/index.html`)

36. **Running the software · closing sentence** (class A-fixed)
   - Before: “The reactor is described on Hardware, and the transport and membrane calculations on Bioreactor Calculations.”
   - After: “The reactor is described on Hardware.”

Item 24 (Math Model, fix M8 last sentence) is not itself a mention; it was changed because "on that page" referred to the deleted page. Items 1 to 36 minus that one make the 35 mentions.

## 3. Writing inconsistencies

None new. The conflicts these sentences carry (pump floor 230 against 100.3, 140, 121.7 and 116.7 mL/min; lumen 3.74 against 7.0 to 7.2 and about 200 mL; eight fibres against eleven; 37.6 against 36, 41 and 42 kDa; 1.54 against 1.456 OD600) are all still open and still listed in INCONSISTENCIES.md facts 3 and 4 and section 35.

## 4. Needs a person

- **Results R8 and the log reduction value.** The only published statement that no log reduction value has been measured now sits in a fix box on Results, attributed to unpublished calculations. Put a plain sentence into the body of Results or Safety before the freeze.
- **The pump floor.** Measurement (Figure 6's amber line, M11) and Results R4 still rest on a 230 mL/min derivation that no reader can open. Either publish the derivation or present 230 as the vendor range only and redraw the amber line.
- **Model's transport and refit numbers.** 1.31 h-1, 1.54 OD600, the 0.88 ug/mL shell concentration and the loop time constants now cite an unpublished source. Decide: fourth short model on Math Model, or a section on Hardware, Bioreactor, or drop them.
- **Measurement M11** still says "a fix is already open there", meaning a fix box on the deleted page. Nobody can read it now.
- **Human Practices repoints.** I linked the "model takes wet-lab data back in" claims to Math Model, Fit to the salt ladder, and the reactors-per-farm item to Units per hectare. The deleted page never covered these topics, so these are my best reading of what the writer meant. A team member who was at the Prof. Chen meeting should confirm.
- **Description Figure 4 caption** lost "the flux arithmetic and the pump floor" because no page holds them. Restore them if they get a home.
- The header of INCONSISTENCIES.md section 35 still says 34 mentions; with the blot-mass sentence on Results it is 35. I left the original count and added the status lines.

## 5. Requests for the shared layer

None.
