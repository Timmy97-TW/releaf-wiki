> **Update:** the one dead link below (the 2023 wiki, in education/website) was fixed in commit fa6744a. Everything else is as found.

# ReLeaf wiki: external link check

Run 2026-09-23. Scope: every `<a href="http(s)://...">` in the wiki HTML except the nine `md-simulations/*.html` report files (md-simulations/index.html *is* included); `education/website/**` is reported separately at the end. `build/hardware/scratchpad/shading-test.html` and `software/ui/0906UI.html` were scanned and have no external links. Links built at runtime by JS were checked by grepping every non-vendor .js: none point outside the site except a code comment.

Method: HEAD then GET (stream, <=64 KB), 20 s timeout, redirects followed, desktop Chrome UA, 4 workers, <=1 req/s per host. Every 403/429/non-standard status was re-opened in Playwright driving system Chrome (`channel="chrome"`). Every doi.org link was also requested without following redirects (all returned 302) and its Crossref title compared with the reference text. YouTube links were confirmed through the oEmbed endpoint (a removed or private video returns 401/404 there). No CAPTCHA or WAF challenge was bypassed.

## Summary

| | Main wiki | education/website |
|---|---|---|
| `<a>` instances | 145 | 103 |
| Unique URLs | 58 | 36 |
| OK 2xx, no caveat | 50 | 33 |
| OK after re-check (bot-blocked / cookie gate / legacy URL) | 5 | 1 |
| Redirect to a different page | 0 | 1 (Google Form /edit -> /viewform, harmless) |
| Blocked in a real browser too (cannot verify; not shown to be dead) | 3 | 0 |
| 404/410 dead | 0 | 1 |
| Timeout / DNS / TLS failure | 0 | 0 |

DOIs: 22 unique doi.org links, all resolve (doi.org 302), and every Crossref title matches the reference it sits in. 10.48364/ISIMIP.682003.1 is a DataCite DOI (not in Crossref) and resolves to the ISIMIP repository record.

**Bottom line:** the main wiki has **no dead external links**. Three reference links on `plant/` cannot be verified by any automated means (ScienceDirect CAPTCHA, two Bio-protocol WAF pages); open them by hand once. The only dead link is in the ported education site (2023 GEMS Taiwan wiki slug, 2 places).

## Main wiki: every non-OK or caveated link

| File:line | Link text | URL | Status | In `.refs`? | Notes |
|---|---|---|---|---|---|
| `plant/index.html:1004` | iScience (2024) | https://www.sciencedirect.com/science/article/pii/S2589004224003729 | BLOCKED (unverified in browser) (raw: 403) | yes | 403 to script; real Chrome gets an 'Are you a robot?' CAPTCHA (not bypassed). The PII does exist: Crossref maps it to doi:10.1016/j.isci.2024.109151 'Heat stress promotes Arabidopsis AGO1 phase separation...'. Suggest linking https://doi.org/10.1016/j.isci.2024.109151 instead. |
| `plant/index.html:1006` | Bio-protocol | https://bio-protocol.org/exchange/minidetail?id=5725672&type=30 | BLOCKED (unverified) (raw: 468) | yes | HTTP 468 SafeLine WAF to script and real Chrome; not bypassed. 'Bio-protocol Exchange' mini-protocol pages have no DOI; cannot confirm. Link text is just "Bio-protocol". |
| `plant/index.html:1007` | Bio-protocol 1216 | https://bio-protocol.org/en/bpdetail?id=1216&type=0 | BLOCKED (unverified) (raw: 468) | yes | HTTP 468 from SafeLine WAF to script and to real Chrome ('Confirm You Are Human'; not bypassed). Cannot confirm the page exists. If the intended item is Bio-protocol e1216 ('Salinity Assay in Arabidopsis', 2014; Crossref-confirmed), https://doi.org/10.21769/BioProtoc.1216 would be a robust link, but check that it is the protocol you mean (the wiki cites it for root-length quantification). |
| `attributions/index.html:62` | What iGEM asks for → | https://competition.igem.org/judging/medals | OK, but legacy URL (raw: 200) | no | 200, but the page title is 'Medals (legacy)' and its in-page anchors point to the current URL https://competition.igem.org/judging/awards/medals (200). Consider updating. |
| `contribution/index.html:47` | What iGEM asks for → | https://competition.igem.org/judging/medals | OK, but legacy URL (raw: 200) | no | same URL |
| `geospatial-analysis/index.html:628` | doi:10.1073/pnas.0403720101 | https://doi.org/10.1073/pnas.0403720101 | OK (bot-blocked) (raw: 403) | yes | doi.org 302 -> pnas.org; 403 Cloudflare to script; 200 in real Chrome, title matches (Peng et al. 2004). |
| `laws-and-regulations/index.html:481` | PubMed 33464897 | https://pubmed.ncbi.nlm.nih.gov/33464897/ | OK (cookie gate) (raw: 203) | yes | 203 'Cookies must be enabled' to script and headless Chrome; PMID confirmed via NCBI E-utilities: 'ACC deaminase gene in Pseudomonas azotoformans ... salinity stress in tomato', matches the reference. |
| `laws-and-regulations/index.html:482` | doi:10.3390/horticulturae10121340 | https://doi.org/10.3390/horticulturae10121340 | OK (bot-blocked) (raw: 403) | yes | doi.org 302 -> mdpi.com; 403 Akamai to script; 200 in real Chrome, title matches (Kelpak / spinach). |
| `plant/index.html:1002` | Link | https://academic.oup.com/plcell/article-abstract/13/7/1499/6009554 | OK (bot-blocked) (raw: 403) | yes | 403 Cloudflare to script; 200 in real Chrome, page is Boyes et al. 2001 'Growth Stage-Based Phenotypic Analysis of Arabidopsis'. Link text is just "Link" (non-descriptive). |

## Main wiki: all unique URLs checked

| URL | Uses | Final status | Final URL (if different) |
|---|---|---|---|
| https://competition.igem.org/judging/medals | 2 | OK, but legacy URL |  |
| https://creativecommons.org/licenses/by/4.0/ | 38 | OK 200 |  |
| https://gitlab.igem.org/2026/gems-taiwan | 37 | OK 200 |  |
| https://doi.org/10.1016/j.memsci.2007.02.045 | 1 | OK 200 | https://linkinghub.elsevier.com/retrieve/pii/S0376738807001159 |
| https://doi.org/10.1016/0376-7388(94)00265-Z | 1 | OK 200 | https://linkinghub.elsevier.com/retrieve/pii/037673889400265Z |
| https://doi.org/10.1038/s41467-019-10906-6 | 2 | OK 200 | https://www.nature.com/articles/s41467-019-10906-6 |
| https://doi.org/10.1016/j.cell.2023.03.009 | 2 | OK 200 | https://linkinghub.elsevier.com/retrieve/pii/S0092867423002623 |
| https://datadryad.org/dataset/doi:10.5061/dryad.jwstqjqf7 | 1 | OK 200 |  |
| https://competition.igem.org/judging/awards/special | 8 | OK 200 |  |
| https://doi.org/10.1007/978-1-0716-4047-0_1 | 1 | OK 200 | https://link.springer.com/protocol/10.1007/978-1-0716-4047-0_1 |
| https://doi.org/10.1371/journal.pone.0016765 | 1 | OK 200 | https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0016765 |
| https://doi.org/10.1016/j.tibtech.2025.02.004 | 1 | OK 200 | https://linkinghub.elsevier.com/retrieve/pii/S0167779925000411 |
| https://www.promega.com/-/media/files/resources/protocols/technical-manuals/0/pgem-t-and-pgem-t-easy-vector-systems-protocol.pdf | 1 | OK 200 |  |
| https://doi.org/10.1016/j.jenvman.2023.117722 | 1 | OK 200 | https://linkinghub.elsevier.com/retrieve/pii/S0301479723005108 |
| https://doi.org/10.1016/j.jafr.2024.101097 | 1 | OK 200 | https://linkinghub.elsevier.com/retrieve/pii/S2666154324001340 |
| https://doi.org/10.1016/j.rsci.2021.01.002 | 1 | OK 200 | https://linkinghub.elsevier.com/retrieve/pii/S1672630821000032 |
| https://doi.org/10.3389/fpls.2025.1638213 | 1 | OK 200 | https://www.frontiersin.org/journals/plant-science/articles/10.3389/fpls.2025.1638213/full |
| https://doi.org/10.1016/j.virusres.2020.198059 | 1 | OK 200 | https://linkinghub.elsevier.com/retrieve/pii/S0168170220300320 |
| https://ourworldindata.org/farm-size | 1 | OK 200 |  |
| https://www.datainsightsreports.com/reports/global-crop-protectants-market-22233 | 1 | OK 200 |  |
| https://www.afa.gov.tw/eng/index.php?code=list&flag=detail&ids=475&article_id=31599 | 1 | OK 200 |  |
| https://doi.org/10.1073/pnas.0403720101 | 1 | OK (bot-blocked) | https://pnas.org/doi/full/10.1073/pnas.0403720101 |
| https://www.cwa.gov.tw/V8/E/C/Statistics/monthlymean.html | 1 | OK 200 |  |
| https://doi.org/10.48364/ISIMIP.682003.1 | 1 | OK 200 | https://data.isimip.org/10.48364/ISIMIP.682003.1 |
| https://data.gov.tw/dataset/80661 | 1 | OK 200 |  |
| https://threejs.org/ | 5 | OK 200 |  |
| https://2019.igem.org/Team:Calgary/Human_Practices | 1 | OK 200 |  |
| https://2021.igem.org/Team:Lambert_GA/Human_Practices | 1 | OK 200 |  |
| https://www.cwa.gov.tw/ | 1 | OK 200 |  |
| https://www.aphia.gov.tw/ | 1 | OK 200 |  |
| https://2025.igem.wiki/greatbay-scie/human-practices | 1 | OK 200 |  |
| https://single-market-economy.ec.europa.eu/sectors/chemicals/fertilising-products_en | 1 | OK 200 |  |
| https://eur-lex.europa.eu/legal-content/EN/ALL/?uri=CELEX%3A32019R1009 | 1 | OK 200 |  |
| https://eur-lex.europa.eu/eli/dir/2014/68/eng | 1 | OK 200 |  |
| https://www.epa.gov/pesticides/draft-guidance-plant-regulators-and-claims-including-plant-biostimulants | 1 | OK 200 |  |
| https://www.epa.gov/pesticide-labels/pesticide-labeling-questions-answers | 1 | OK 200 |  |
| https://www.epa.gov/pesticides/biopesticides | 1 | OK 200 |  |
| https://law.moa.gov.tw/LawContent.aspx?id=FL014413 | 1 | OK 200 |  |
| https://law.moa.gov.tw/LawContent.aspx?id=FL014452 | 1 | OK 200 |  |
| https://law.moa.gov.tw/LawContent.aspx?id=FL014387 | 1 | OK 200 |  |
| https://law.moa.gov.tw/LawContent.aspx?id=GL000940 | 1 | OK 200 |  |
| https://doi.org/10.1016/j.bbrc.2014.10.136 | 1 | OK 200 | https://linkinghub.elsevier.com/retrieve/pii/S0006291X14019561 |
| https://pubmed.ncbi.nlm.nih.gov/33464897/ | 1 | OK (cookie gate) |  |
| https://doi.org/10.3390/horticulturae10121340 | 1 | OK (bot-blocked) | https://www.mdpi.com/2311-7524/10/12/1340 |
| https://www.bonvinlab.org/software/bpg/peptides/ | 1 | OK 200 |  |
| https://academic.oup.com/plcell/article-abstract/13/7/1499/6009554 | 1 | OK (bot-blocked) |  |
| https://pmc.ncbi.nlm.nih.gov/articles/PMC4212613/ | 1 | OK 200 |  |
| https://www.sciencedirect.com/science/article/pii/S2589004224003729 | 1 | BLOCKED (unverified in browser) |  |
| https://pmc.ncbi.nlm.nih.gov/articles/PMC10308788/ | 1 | OK 200 |  |
| https://bio-protocol.org/exchange/minidetail?id=5725672&type=30 | 1 | BLOCKED (unverified) |  |
| https://bio-protocol.org/en/bpdetail?id=1216&type=0 | 1 | BLOCKED (unverified) |  |
| https://doi.org/10.1007/10_2020_138 | 1 | OK 200 | https://link.springer.com/chapter/10.1007/10_2020_138 |
| https://doi.org/10.1016/j.ifacol.2018.08.474 | 1 | OK 200 | https://linkinghub.elsevier.com/retrieve/pii/S2405896318316021 |
| https://doi.org/10.1007/10_2020_142 | 1 | OK 200 | https://link.springer.com/chapter/10.1007/10_2020_142 |
| https://doi.org/10.1016/j.jfoodeng.2025.112467 | 1 | OK 200 | https://linkinghub.elsevier.com/retrieve/pii/S0260877425000020 |
| https://doi.org/10.1007/s00449-026-03369-9 | 1 | OK 200 | https://link.springer.com/article/10.1007/s00449-026-03369-9 |
| https://doi.org/10.1016/S0140-6736(86)90837-8 | 1 | OK 200 | https://linkinghub.elsevier.com/retrieve/pii/S0140673686908378 |
| https://sdgs.un.org/goals | 1 | OK 200 |  |

## education/website/** (ported sub-site)

103 link instances, 36 unique URLs. All YouTube videos are live (oEmbed 200), all Google Drive/Docs/Slides items are publicly viewable (no sign-in redirect), all static.igem.wiki PDFs return 200.

| File:line | Link text | URL | Status | In `.refs`? | Notes |
|---|---|---|---|---|---|
| `education/website/index.html:293` | Click Here to explore: https://2023.igem.wiki/gemstaiwan/hom | https://2023.igem.wiki/gemstaiwan/home | 404 DEAD (raw: 404) | no | GitLab-pages 404. The 2023 GEMS Taiwan wiki is at https://2023.igem.wiki/gems-taiwan/ (200, 'Homepage \| GEMS-Taiwan - iGEM 2023'). |
| `education/website/zh/index.html:277` | Click Here to explore: https://2023.igem.wiki/gemstaiwan/hom | https://2023.igem.wiki/gemstaiwan/home | 404 DEAD (raw: 404) | no | same URL |
| `education/website/resources.html:1357` | Download ↓ | https://www.canva.com/design/DAHHlxSUsXY/a6eo5KZFuYGzaMemCxc4BA/edit | OK (bot-blocked) (raw: 403) | no | 403 to script; 200 in real Chrome ('High School lesson slide'). It is an /edit link that opens the Canva editor; a /view share link is safer for a public 'Download' button. |
| `education/website/zh/resources.html:1347` | 檔案下載 ↓ | https://www.canva.com/design/DAHHlxSUsXY/a6eo5KZFuYGzaMemCxc4BA/edit | OK (bot-blocked) (raw: 403) | no | same URL |
| `education/website/involved.html:119` | https://docs.google.com/forms/d/1GA3MGRhnRAbWJxb010RgmITatjY | https://docs.google.com/forms/d/1GA3MGRhnRAbWJxb010RgmITatjY5hBockVmNfAcopHI/edit | REDIRECT (fine) (raw: 200) | no | /edit redirects to /viewform?edit_requested=true, form loads ('Education Program Application Form'). Linking /viewform directly avoids the redirect; the link text shows the /edit URL. |
| `education/website/zh/involved.html:124` | https://docs.google.com/forms/d/1GA3MGRhnRAbWJxb010RgmITatjY | https://docs.google.com/forms/d/1GA3MGRhnRAbWJxb010RgmITatjY5hBockVmNfAcopHI/edit | REDIRECT (fine) (raw: 200) | no | same URL |

Four Google Docs/Slides 'Download' buttons also point at `/edit` URLs (resources.html:1216, 1242, 1268, 1331 and zh/resources.html:1207, 1233, 1259, 1321). They open fine for anonymous viewers, but `/view`, `/preview` or `/export?format=pdf` would match the 'Download' label better.

### All unique URLs (education/website)

| URL | Uses | Final status |
|---|---|---|
| https://creativecommons.org/licenses/by/4.0/ | 19 | OK 200 |
| https://gitlab.igem.org/2026/gems-taiwan | 19 | OK 200 |
| https://youtu.be/ZmpN68o5IhI?si=4jc1AymzU0_fWcgE | 2 | OK 200 |
| https://youtu.be/ujDHpd0K97c?si=D35WjTgyTf4uvDXX | 2 | OK 200 |
| https://youtu.be/BYrJAX-8N7k?si=rUSjfAIVqJFFIfRZ | 2 | OK 200 |
| https://2022.igem.wiki/gems-taiwan/index | 2 | OK 200 |
| https://2023.igem.wiki/gemstaiwan/home | 2 | 404 DEAD |
| https://2024.igem.wiki/gems-taiwan/ | 2 | OK 200 |
| https://2025.igem.wiki/gems-taiwan/ | 2 | OK 200 |
| https://docs.google.com/forms/d/1GA3MGRhnRAbWJxb010RgmITatjY5hBockVmNfAcopHI/edit | 2 | REDIRECT (fine) |
| https://caden-wu-gems-tw.itch.io/textile-fighter | 2 | OK 200 |
| https://drive.google.com/file/d/1gtxFswhx2TWneFXNUMF-0BGkLVmPOCDb/view | 2 | OK 200 |
| https://drive.google.com/file/d/1csxFVfVAAsKAMNpaE2zdcOkpyqmUDhC_/view | 2 | OK 200 |
| https://static.igem.wiki/teams/5066/human-practice/elementary-lesson-plan.pdf | 2 | OK 200 |
| https://static.igem.wiki/teams/5066/human-practice/high-school-lesson-plan-8-5.pdf | 2 | OK 200 |
| https://static.igem.wiki/teams/5066/human-practice/snap-gene-compressed.pdf | 2 | OK 200 |
| https://static.igem.wiki/teams/5066/human-practice/aminopoly-compressed.pdf | 2 | OK 200 |
| https://static.igem.wiki/teams/5066/pdfs/bill-listen-my-children-these-evil-humans-are-trying-to-get-us-extinct-chloe-how-horrid-evil-humans-should-be-stopped-bill-i-heard-they-invented-this-new-ovitrap-they-lure-you-in-to-la.pdf | 2 | OK 200 |
| https://drive.google.com/file/d/1jVw_EMEmFZ8m7EhtLp1qaRLyegQkGVaa/view | 2 | OK 200 |
| https://drive.google.com/file/d/19My-3_0ALirUWyVlGdwBdTT8rXksZqu1/view | 2 | OK 200 |
| https://drive.google.com/file/d/1wsPwD66nnrNsC8-GTbe3jH-fdLA9hHut/view | 2 | OK 200 |
| https://static.igem.wiki/teams/5729/educationwiki/gems-elementary-slides.pdf | 4 | OK 200 |
| https://static.igem.wiki/teams/5729/educationwiki/gems-taiwan-junior-high-school-educationnewest.pdf | 2 | OK 200 |
| https://static.igem.wiki/teams/5729/educationwiki/card-game-rulebook.pdf | 2 | OK 200 |
| https://www.youtube.com/watch?v=ZmpN68o5IhI&list=PLyaRayqkCwh7PEaCNOLhKb8uFSsVVvQPM&index=3 | 2 | OK 200 |
| https://www.youtube.com/watch?v=wDwpsd4awfM&list=PLyaRayqkCwh4QlQZU0eNYbZkm2F3JitTa | 2 | OK 200 |
| https://docs.google.com/document/d/1_Zz0lcXX8pJWoUvxaR_V16XEpOn_77D-/edit | 1 | OK 200 |
| https://docs.google.com/document/d/1IeCZfAKOXkoFAf32Rsn57-YSFWzL7IgK/edit#heading=h.h5xegitf0dna | 2 | OK 200 |
| https://docs.google.com/document/d/1uGPNanzQcx_cx7l0gSlMYOTUdcg-tyXp92xl_qKgFsY/edit?tab=t.0#heading=h.h5xegitf0dna | 2 | OK 200 |
| https://drive.google.com/file/d/1EHIhA_hbRsbHOsfM7IwcGNF1tc3YJnLk/view?usp=sharing | 2 | OK 200 |
| https://docs.google.com/presentation/d/1q4i3k1JyIGkHxeRoxyKOdYg-cB85jMFkPhW0xPFYmh8/edit?slide=id.g4dfce81f19_0_45#slide=id.g4dfce81f19_0_45 | 2 | OK 200 |
| https://www.canva.com/design/DAHHlxSUsXY/a6eo5KZFuYGzaMemCxc4BA/edit | 2 | OK (bot-blocked) |
| https://www.youtube.com/watch?v=QPHPzOrEDR4 | 1 | OK 200 |
| https://www.youtube.com/watch?v=8fSGeybwtq8 | 1 | OK 200 |
| https://www.youtube.com/watch?v=weZNzesFk5Y | 1 | OK 200 |
| https://docs.google.com/document/d/180TQqncR-N0-Z3eT3k83kYjxaigYA1UM/edit#heading=h.r4z7qkuvmqt4 | 1 | OK 200 |
