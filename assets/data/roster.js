/* =============================================================================
   ReLeaf , Team page data
   -----------------------------------------------------------------------------
   This is the roster. Edit this file. Each person is one object:

     name     shown on the card
     role     badge above the name ("Student Advisor", "Wet Lab Instructor").
              Students carry no role badge: the roster is a team, not a ladder
     photo    official portrait on the card; "" falls back to an initials tile
     workPhoto   profile view, left: the person at work
     goofyPhoto  profile view, right: the goofy one. Either one left "" shows
                 as an empty frame. Put the files in assets/img/members/work/
                 and assets/img/members/goofy/, named like the portrait
     solo     true: the profile shows one photo alone, full width: workPhoto,
              or goofyPhoto when there is no work photo
     grade / school         the small meta line under the name
     track    subteam only ("Wet Lab", "Dry Lab", "Human Practices")
     bio      shown under the photo; clicking the card opens the full view.
              A blank line ("\n\n") starts a new paragraph in the profile
     bioAI    true when the bio was not written by the person. Kept as the
              record of what still needs a student; since 2 October the page
              does not colour it, see assets/js/team.js
     tasks    the tasks this person is on -> one pill each, everybody a member

   A section's `note` renders under its title; `noteAI: true` marks a note
   the students did not write. Like bioAI it is a record only: every word on
   this page is shown in black.

   Adding a new task: add one line to LABELS. It appears in the legend's task
   row, which is also the filter, and on every card automatically.

   What the page builds from this file without being told:
     · the number on each task in the legend, and beside each section title
     · each person's frame, from the colours of their own tasks
     · an address per person (team/#member-abby-kao) and per task
       (team/#task-cloning), so any page of the wiki can link straight to one
   ========================================================================== */

/* ---------- Label system (adopted from Unicamp-Brazil) ------------------- */
const LABELS = {
  "Art":                  "#c8506b",
  "Bioreactor":           "#0e6b78",
  "Cloning":              "#7b1e3a",
  "Data Physicalization": "#2f8fb3",
  "Education":            "#d9a32e",
  "Entrepreneurship":     "#a85a8a",
  "GIS":                  "#6f66b3",
  "Hardware":             "#a5673c",
  "Lab":                  "#3b2f8f",
  "Lab Notebook":         "#8a7f6b",
  "Model":                "#4a6fa5",
  "Outreach":             "#e0703f",
  "Peptide Design":       "#3f9d86",
  "Photography":          "#6e5b73",
  "Plant":                "#4a7c3f",
  "Protectant":           "#8c9440",
  "Regulations":          "#46536b",
  "Video":                "#8b5bb0",
  "Wiki":                 "#78909c"
};

/* Lab, Cloning and Bioreactor are the three most demanding jobs on the board,
   so their pills carry a two-tone fill instead of a flat colour where a page
   draws them filled, as the legend does. */
const LABEL_GRADIENTS = {
  "Lab":         "linear-gradient(135deg,#5346c0 0%,#2a2168 100%)",
  "Cloning":     "linear-gradient(135deg,#9d2b4d 0%,#5f1230 100%)",
  "Bioreactor":  "linear-gradient(135deg,#159aab 0%,#07444e 100%)"
};

/* ---------- Sections, in display order ---------------------------------- */
const SECTIONS = [
  {
    id: "project-leads",
    title: "Project Leads",
    openSlots: 4,
    note: "Project leads are the pillars of the project, they carried the project on their shoulders with excellence, accountability, and agency. ReLeaf is relieved to have them.",
    groups: [
    { title: "", members: [] },
    ]
  },
  {
    id: "student-members",
    title: "Student Members",
    note: "",
    groups: [
    { title: "", members: [
      {
        name: "Abby Kao",
        photo: "assets/img/members/abby-kao.webp", workPhoto: "assets/img/members/work/abby-kao.webp", goofyPhoto: "assets/img/members/goofy/abby-kao.webp",
        grade: "Freshman", school: "KCIS", track: "Wet Lab",
        bio: "Hii, I'm Abby Kao! My main interests are ballet and public speaking, yet it was my interest in biology that led me to join iGEM. Through the hundreds of hours I have spent with these (initial) strangers in the lab, I realized that through one year of locked in dedication, we could really achieve something big.\n\nOverall, I played a role in conducting the cross-team aspect of our team, and, looking at the map of our project, I understand everything that plays a role leading to our success. Whether it is video editing, testing our protectant of arabidopsis, educating elementary school students and the general public, interviewing farmers, doing golden gate assembly, or designing merch, nothing goes unnoticed, and honestly? It's the best feeling ever knowing almost 100 people are working towards the same goal.\n\nEven though it looks like summer 2026 wasted, it was a summer full of the best experiences, spending it with the best people as well as learning from and laughing at our mistakes. While our arabidopsis grew, we grew with hope and anticipation, not for what contamination would appear next, but for next time we could test another protectant on our plants and the next time we get to share our project with the outside world.",
        tasks: ["Video", "Lab", "Plant", "Education", "Art", "Entrepreneurship"]
      },
      {
        name: "Abby Tsai",
        photo: "assets/img/members/abby-tsai.webp", workPhoto: "assets/img/members/work/abby-tsai.webp", goofyPhoto: "assets/img/members/goofy/abby-tsai.webp",
        grade: "Freshman", school: "KCIS", track: "Wet Lab",
        bio: "Hey I’m Abby Tsai! At first, I joined iGEM because I was intrigued by synthetic biology, wondering how far ONE year would actually bring us to. Now, looking back, it has been a wild journey. I stepped into the room full of strangers, not knowing in the year ahead, with this team, we’ll create so much memories while grinding and pouring our heart out into this project. In this team, I play roles in wetlab and plant modeling.\n\nThroughout the project I spent more than 300 hours in lab, and it has always been fascinating to operate on such tiny amount of reagents but able to produce for example, our optogenetic circuit. The results did not come from one day but months of failing and rebuilding. I'm proud to say I know how to do so many molecular cloning techniques now, where golden gate assembly or colony PCR being my favorite experiments. And why I say this whole year is a wild journey, I also grew teeny tiny arabidopsis, and treat them almost as if they’re my babies. This is also when I learned the art of patience as a farmers’ perspective: a little tilt, a little touch, a little movement all impacts their growth (or the mold just grows naughtily all over the agar plate). But that's fine, we became more careful and professional.\n\nSince each iGEM team is a heart merged by wetlab, drylab, and hp, I have been given the opportunity to pitch and present ideas to professors, to farmers, and even an iGEM co-founder; doing cross team bonding and side quests like designing clickers; but most importantly, to work with people with dynamic perspectives and backgrounds. The laughters shared will always be the highlight of my iGEM journey!",
        tasks: ["Lab", "Plant", "Art", "Video", "Education"]
      },
      {
        name: "Abigail Lin",
        photo: "assets/img/members/abigail-lin.webp", workPhoto: "assets/img/members/work/abigail-lin.webp", goofyPhoto: "assets/img/members/goofy/abigail-lin.webp",
        grade: "Freshman", school: "KCIS", track: "Wet Lab",
        bio: "Hiii I'm Abigail! I love solving mystery novels, and to me, the plant world is the ultimate unsolved case. Outside of biology, I enjoy painting, diving, and scouting.\n\nAt the beginning of the year, I came with basic biology knowledge, a very ambitious heart, and a wild project idea. Now, after months of plant experiments, failed protocols, contamination, and countless trips to the lab straight after school, I can navigate the bench much more confidently. During the summer alone, I spent over 100 hours each month in lab, often sacrificing \"fun\" time but allowing me to perform cloning without constantly staring at my notebook for every step, troubleshooting experiments, and even planning test trials independently.\n\nI originally came up with our project sitting in front of a cold computer, researching the struggles of farmers facing an increasingly unpredictable climate. Field visits, small scale farmers' interviews, and public forums made those struggles real to me. I saw not only the interactions between technology and humans, but nature's and human's cooperation; to see the struggles, adaptations, and losses happening in front of my eyes made me strengthen my determination to develop our project.\n\nAttending the International Symposium of Living Systems was especially memorable to me because presenting our work alongside passionate scientists made me feel that I had stepped into the larger scientific community, sharing the love for science together. Throughout this journey, I designed our topic, logo, and visuals, but I think we finally discovered what our project represents; “releaf\": not only relieving the stress of plants, but also the stress carried by the people who grow our food.",
        tasks: ["Lab", "Cloning", "Plant", "Art", "Education", "Video"]
      },
      {
        name: "Alex Li",
        photo: "assets/img/members/alex-li.webp", workPhoto: "assets/img/members/work/alex-li.webp", goofyPhoto: "assets/img/members/goofy/alex-li.webp",
        grade: "Sophomore", school: "KCIS", track: "Wet Lab",
        bio: "Hi, I'm Alex. I initially joined iGEM due to my interest and curiosity in synthetic biology. However, I found out that iGEM is way more than that. It involves collaboration, discussion, research, and many other things. Initially, my work mainly focused on the design of gene circuits, but I felt a little lost, and didn't really know what to do when I got to the lab. Later on, one of the instructors asked me to take care of plants for a while, and unexpectedly, I found my passion and love in taking care of plants. I started to participate much in plants, and without realizing, I transferred to the plant group. To be honest, I never thought of planting plants in my entire life. After lots of research on plants and some on protectants, as well as participating in interviews and meetings with experts, I became more familiar with plants. In the plant group, I learned to discuss and manage experiments, manage my time, and learned to solve problems when they occur. Through this project, I learned that iGEM was not only about synthetic biology, but also a process that explores new interests, working with others, overcome challenges. I am thankful for this year's experience.",
        tasks: ["Lab", "Plant"]
      },
      {
        name: "Anna Chuang",
        photo: "assets/img/members/anna-chuang.webp", workPhoto: "assets/img/members/work/anna-chuang.webp", goofyPhoto: "assets/img/members/goofy/anna-chuang.webp",
        grade: "Junior", school: "KCIS", track: "Dry Lab",
        bio: "Hello! I'm Anna! When I first joined iGEM, all I knew was that I wanted to do something big, something that mattered. I didn't know how yet, but looking around a room full of strangers, I knew that together, we could. I still remember the first time I successfully produced a graph in RStudio for our math model. It felt foreign, but it showed me I could do more than I thought.\n\nFrom there, working through large geospatial datasets and leading conversations with farmers, I slowly came to understand the people we were working for: who they are, where they live, what they need, or simply what they had for lunch. I also began to see a clearer and clearer definition for what \"something that mattered\" means.\n\nI cherish the big wins: the opportunities to speak at a public forum, the thumbs-ups from strangers, the farmers smiling in my selfies. But I cherish the small moments just as much. There were the sighs my partners and I shared as our computers lagged under all that data, the laughter at lunch, and everything in between. ReLeaf ReLeaf ReLeaf: that's something to remember by!!",
        tasks: ["GIS", "Model", "Outreach", "Education"]
      },
      {
        name: "Anton Lin",
        photo: "assets/img/members/anton-lin.webp", workPhoto: "assets/img/members/work/anton-lin.webp", goofyPhoto: "assets/img/members/goofy/anton-lin.webp",
        grade: "Freshman", school: "TAS", track: "Dry Lab",
        bio: "Hi, I'm Anton. My background is in engineering and robotics, and I joined iGEM to see how those skills could carry over to synthetic biology and the problems it's trying to solve. This year, I designed and built an in-line photometer that tracked the optical density of our live B. subtilis cultures, along with an LED light plate for optogenetics assays. Through it all, I learned biology I had never studied before and spoke with professors and farmers about where our work could fit beyond the lab. I came in as an engineer and left with a much broader view of what it takes to build something meaningful. More than anything, I hope what we created doesn't stop here and finds its way to people who can put it to use. Outside of iGEM, I enjoy golf, traveling, and music.",
        tasks: ["Bioreactor", "Hardware", "Outreach", "Wiki", "Lab Notebook", "Education"]
      },
      {
        name: "Audrey Chu",
        photo: "assets/img/members/audrey-chu.webp", workPhoto: "assets/img/members/work/audrey-chu.webp", goofyPhoto: "assets/img/members/goofy/audrey-chu.webp",
        grade: "Sophomore", school: "IBSH", track: "Dry Lab",
        bio: "Hey, I'm Audrey Chu! My fascination with biology was the main reason I initially joined iGEM. Over this past year, however, I've read papers on protein mutations, designed hydroponic systems, managed and coded the wiki, and learned so much more. Moreover, reaching out to agricultural professionals and Taiwanese farmers shifted the way I looked at ReLeaf, from a simple plant project to a solution that could truly impact real people. Looking back now, my interest in biology is still strong as ever, but I also developed a passion for working with a team to make a vision come to life, to see so many different components come together into one big project. I'm looking forward to sharing what we did this year at the Jamboree in Paris, and no matter the outcome, I'm super grateful to have had this experience.",
        tasks: ["Plant", "Wiki"]
      },
      {
        name: "Audrey Hsieh",
        photo: "assets/img/members/audrey-hsieh.webp", workPhoto: "assets/img/members/work/audrey-hsieh.webp", goofyPhoto: "assets/img/members/goofy/audrey-hsieh.webp",
        grade: "Freshman", school: "KCIS", track: "Wet Lab",
        bio: "Hi, I’m Audrey Hsieh. I joined the iGEM competition to explore my passion for synthetic biology and challenge myself through hands-on research. When I first joined iGEM, I thought I would mainly be learning about synthetic biology and contributing to a research project. Instead, the experience took me far beyond the lab. I found myself approaching problems from different perspectives, and working with people who challenged me to grow. Speaking with farmers and studying their experiences helped me understand that solving a scientific problem also requires understanding the people affected by it.",
        tasks: ["Lab", "Plant", "Education", "Entrepreneurship", "Art", "Video"]
      },
      {
        name: "Chloe Wu",
        photo: "assets/img/members/chloe-wu.webp", workPhoto: "assets/img/members/work/chloe-wu.webp", goofyPhoto: "assets/img/members/goofy/chloe-wu.webp",
        grade: "Sophomore", school: "TAS", track: "Wet Lab",
        bio: "Hey, I'm Chloe! When people describe me in one word, they usually default to lazy. This is true, I am incredibly lazy. Being a part of this amazing team, building friendships and working on a project that I'm passionate about has taught me countless things. Turns out, I'm not incapable of hard work: I just needed to be truly driven by something I was dedicated to. At the beginning of my iGEM journey, I never expected to voluntarily trade my free time for endless cycles of colony PCR and golden gate assembly, but I now consider the lab my second home. Through failed transformations, unexpected contamination and troubleshooting protocols, I built a level of dedication I didn't know I had until I screamed out of excitement when we received our first successful sequencing results. Over the course of the summer and more than 300 hours spent in the lab, I went from having to double check every aspect of every procedure to being able to do miniprep from memory and claim the protocol on my labcoat. However, it was really the small acts of stepping out of the lab to interview small scale farmers alongside educating lower schoolers about the importance of rising climate change and how they affect agricultural resilience that really changed things for me, providing me a completely new level of motivation for our project. Our project ReLeaf isn't just relieving stress in plants, but rather, bringing relief to the farmers that rely on them, ensuring that every farmer can have their own bioreactor to combat plant stress step by step.",
        tasks: ["Lab", "Cloning", "Outreach", "Education", "Entrepreneurship", "Video"]
      },
      {
        name: "Ethan Chang",
        photo: "assets/img/members/ethan-chang.webp", workPhoto: "assets/img/members/work/ethan-chang.webp", goofyPhoto: "assets/img/members/goofy/ethan-chang.webp",
        grade: "Freshman", school: "AAIA", track: "Wet Lab",
        bio: "Greetings, I'm Ethan, and I initially joined iGEM because I wanted to see how to use synthetic biology to make a global impact. Throughout my journey, I have been met with many obstacles, including balancing the work-heavy duties I need to fulfil along with my academics. In the end, I learned to balance everything with a to-do list to keep track of my objectives and deadlines to ensure qualitative output in a timely manner. Now, I can do miniprep, colony PCR, gel electrophoresis, gel extraction, and many more experiments than when I began. iGEM is really special because it offers the chance for students to connect with professors in the field and for students to pitch their ideas to someone who knows the field well to hear thoughts from someone who can envision the future of the project. Presenting our project to the professors can be really nerve-wracking, but it felt good to experience it now than later, because I get to practice without any stakes. The professors were all really helpful and patient towards the team and each professor visit felt like someone else supported the team to keep going forward. Some professors offered seeds, while others offered products to test on. I think that to be able to experience this warmth in a year-long STEM project is very rare and priceless to me. One research question was \"which protectant to use?\" At first, I thought it was a really straightforward answer, but I later found that there were many factors to decide what was 'the best' for the team's objective in this project. I grabbed onto whatever was around me, trying to grab a sense of contribution to the team by doing broad research for candidates and submitting them for the instructors to review. I was so intrigued by the possibilities of candidates. I wanted to explore the boundaries of candidates we could use: maybe some novel ones, or maybe something between novel and well-established. After months of research, we ended up with a few prominent candidates that the instructors were pleased with (like ACCD and AtLEA14).",
        tasks: ["Regulations", "Lab", "Protectant", "Entrepreneurship"]
      },
      {
        name: "Ethan Liu",
        photo: "assets/img/members/ethan-liu.webp", workPhoto: "assets/img/members/work/ethan-liu.webp", goofyPhoto: "assets/img/members/goofy/ethan-liu.webp",
        grade: "Junior", school: "KCIS", track: "Dry Lab",
        bio: "Hi, I'm Ethan Liu! I was already THE PLANT GUY long before iGEM, so landing on a plant stress project felt extremely exciting. My math teachers always said math is the universal language. This is the first year I've watched it translate into millilitres in a farmer's bottle.\n\nThroughout the project, I've applied math to many fields, from creating a weather-stress model that directly predicts the yield of rice in the future to calculating how our protectant is uptaken by the leaves.\n\nOutside iGEM I grow, draw, and eat plants, which became suspiciously relevant once the whole model came down to it.",
        tasks: ["Model", "Education"]
      },
      {
        name: "Eva Zhong",
        photo: "assets/img/members/eva-zhong.webp", workPhoto: "assets/img/members/work/eva-zhong.webp", goofyPhoto: "",
        grade: "Sophomore", school: "TAS", track: "Dry Lab",
        bio: "Hi! I’m Eva, a student interested in biology, medicine, and the ways science can be used to solve real-world problems. I joined iGEM to learn more about synthetic biology while working with my team to develop a creative solution to our project’s problem: plant stress.",
        tasks: ["GIS", "Entrepreneurship"]
      },
      {
        name: "Felix Yu",
        photo: "assets/img/members/felix-yu.webp", workPhoto: "assets/img/members/work/felix-yu.webp", goofyPhoto: "assets/img/members/goofy/felix-yu.webp",
        grade: "Sophomore", school: "IBSH", track: "Dry Lab",
        bio: "Hey, I'm Felix. I'm interested in biochemistry and engineering, but overall, I just like the satisfaction of seeing systems work. In the team, I specialize in protein design and software, while occasionally helping out with the hardware. A challenge in this pipeline is understanding the methodology of complex systems. As you try different docking tools and modeling approaches, you may realize after hours of work, on paper, it was all for nothing, and the process needed to be scrapped and re-done. However, each failure taught me to question my past assumptions, helping me approach the problem from a new perspective. Looking back, the team is also a system where things may break down in seemingly insignificant, unexpected places. With one part of the project greatly impacting another, over time, I’ve experienced the hardships of connecting pipelines, data, and people together. But I know we can work together and finish the job. I also have a fat dog and cat.",
        tasks: ["Protectant", "Peptide Design", "Model", "Lab Notebook", "Data Physicalization"]
      },
      {
        name: "Jacquelyn Inocencio",
        photo: "assets/img/members/jacquelyn-inocencio.webp", workPhoto: "assets/img/members/work/jacquelyn-inocencio.webp", goofyPhoto: "assets/img/members/goofy/jacquelyn-inocencio.webp",
        grade: "Junior", school: "TAS", track: "Dry Lab",
        bio: "Hi, I'm Jacquelyn! I joined iGEM expecting a lot of lab work, PCR, cloning: the kind of science I was already used to. Instead, this project took me far outside the lab. I found myself kneeling in a farmer's field, talking with researchers at factories, speaking with professors, and hearing perspectives I never would have encountered if I had stayed inside the lab. I'm so grateful to have worked with so many people, especially my teammates, to build ReLeaf together.",
        tasks: ["Outreach", "Wiki", "Education", "Video"]
      },
      {
        name: "Joshua Hong",
        photo: "assets/img/members/joshua-hong.webp", workPhoto: "assets/img/members/work/joshua-hong.webp", goofyPhoto: "assets/img/members/goofy/joshua-hong.webp",
        grade: "Freshman", school: "WEGO", track: "Wet Lab",
        bio: "Hi, I'm Joshua. I love biology, firmware, and outdoor activities. When I first joined iGEM, I was excited about the possibility of doing experiments to create something impactful. However, I forgot that behind the achievements is sacrifice. These include repeating the same experiment countless times until cloning succeeds, or countless hours in labs or on computers. Throughout the year, I learned that patience and commitment are the cornerstones of research, and that really caring about and owning your tasks is what makes things work. Though I’m a wet lab member, most of my contribution lies in hardware. Prior to this experience, I never thought tech and bio could go hand in hand. It opened my eyes to new possibilities, since I now know I can combine my two interests. I really cherish this year and all the opportunities it provided. I learned a lot and found out more about myself. It is truly a surreal experience.",
        tasks: ["Bioreactor", "Lab", "Hardware"]
      },
      {
        name: "Mia Guo",
        photo: "assets/img/members/mia-guo.webp", workPhoto: "assets/img/members/work/mia-guo.webp", goofyPhoto: "assets/img/members/goofy/mia-guo.webp",
        grade: "Sophomore", school: "IBSH", track: "Human Practices",
        bio: "Hello, I'm Mia Guo! I first joined iGEM because I always had an interest in biology. Over this past year, I have made lesson plans for our education outreach, conducted research on professors, and hosted our public events in September. Moreover, through these preparations I have learned how to cooperate with large groups of people, public speaking, and also learning how to plan events and managing my time wisely. Looking back, this year has been fulfilling with many minor achievement scattered. I enjoyed achieving every milestone with the team and overall realized how much a group of high school students can achieve in just a few months. I am excited to present our project and go to Grand Jamboree!",
        tasks: ["Data Physicalization", "Outreach", "Education", "Entrepreneurship"]
      },
      {
        name: "Naomi Lin",
        photo: "assets/img/members/naomi-lin.webp", workPhoto: "assets/img/members/work/naomi-lin.webp", goofyPhoto: "assets/img/members/goofy/naomi-lin.webp",
        grade: "Freshman", school: "FHJH", track: "Wet Lab",
        bio: "Hi, I’m Naomi! I joined iGEM because I was fascinated by synthetic biology and wanted to experience real research. I expected to spend most of my time doing labs and reading papers, but iGEM became much more than that. Throughout the year, I learned to turn biology concepts into experiments, balance iGEM with schoolwork, and work with teammates from different schools. When I made mistakes, I learned to face them honestly, learn from them, and step up again.\n\nI also learned to look beyond my own role and see how different parts of a project connect, and this is why I enjoy cross-team work. I even brought ReLeaf to my school by coordinating with my teachers and teammates to organize an educational event, allowing my peers a chance to learn about synthetic biology and its role in addressing agricultural challenges. Through ReLeaf, I came to see research as a way to share knowledge and address problems beyond the lab.",
        tasks: ["Lab Notebook", "Education", "Lab", "Art", "Video", "Wiki"]
      },
      {
        name: "Noah Tau",
        photo: "assets/img/members/noah-tau.webp", workPhoto: "assets/img/members/work/noah-tau.webp", goofyPhoto: "assets/img/members/goofy/noah-tau.webp",
        grade: "Sophomore", school: "TAS", track: "Dry Lab",
        bio: "Hi, I'm Noah Tau, and I joined iGEM to explore my growing passion for engineering. At first, that passion was limited to engineering and robotics. Through iGEM however, I was able to bring the skills I built in FRC into a new field and take on a real role in a project that offers tangible help for a real-world problem. At a symposium in Tainan, I presented our project, ReLeaf, to professors from Japan. Their questions pushed me to explain our work more clearly and to think harder about the science and logic behind it. That experience made the project feel like my own, and it taught me lessons about communication as well as scientific thinking that I could never have learned from a textbook at school. I came to iGEM as a robotics student curious about biology and am leaving as an engineer who knows skills beyond the field he started in. I'm excited to keep on progressing in the place where these two worlds meet.",
        tasks: ["Bioreactor", "Hardware", "Wiki"]
      },
      {
        name: "Olivia Du",
        photo: "assets/img/members/olivia-du.webp", workPhoto: "assets/img/members/work/olivia-du.webp", goofyPhoto: "assets/img/members/goofy/olivia-du.webp",
        grade: "Sophomore", school: "IBSH", track: "Human Practices",
        bio: "Hi, I'm Olivia! I joined iGEM because I wanted to explore my interest in biology and see how it connects to the real world. Being pretty shy and introverted, I was really unsure about stepping into Human Practices, where the whole job meant reaching out to people both on the team and far outside of it. Early on, managing outreach alongside school was a big adjustment. Over the months, I learned how to connect with external experts, help build a real business plan, and even spend a little time at the bench learning basic lab techniques. Presenting our project to professors and field experts showed me I could explain our work clearly and hold my own. Looking back, this year helped me step out of my comfort zone and showed me I can handle a lot more than I thought.",
        tasks: ["Education", "Outreach", "Entrepreneurship", "Data Physicalization"]
      },
      {
        name: "Olivia Lin",
        photo: "assets/img/members/olivia-lin.webp", workPhoto: "assets/img/members/work/olivia-lin.webp", goofyPhoto: "assets/img/members/goofy/olivia-lin.webp",
        grade: "Junior", school: "KCISLK", track: "Wet Lab",
        bio: "Hi, I'm Olivia! Given the chances I would get to work in both dry-lab and wet-lab settings, I joined iGEM. I'm so grateful to have met and worked with everyone here. I expected we'd make countless memories together, but nothing prepared me for the late-night writing, endless hours in the lab, and midnight meetings. I love that I had a chance to touch on the geospatial analysis, protein modeling/mutations, and wet lab sectors of this team project. I developed a well-rounded understanding of farmers' real challenges through geographical analysis, photos, interviews, and presentations rather than simply reading papers. Though our project's immediate impact on the world may not be huge, this year of endurance and grinding had a real impact on the farmers we touched and the team we formed. No matter the outcome, I am so happy to have joined iGEM and met all these hardworking people.",
        tasks: ["GIS", "Protectant", "Entrepreneurship"]
      },
      {
        name: "Phoebe Chen",
        photo: "assets/img/members/phoebe-chen.webp", workPhoto: "assets/img/members/work/phoebe-chen.webp", goofyPhoto: "assets/img/members/goofy/phoebe-chen.webp",
        grade: "Sophomore", school: "WEGO", track: "Wet Lab",
        bio: "Hi, I'm Phoebe. Initially, I joined iGEM due to my passion for all things biology. Throughout the process, however, I realized that this competition was much more than conducting research and experiments. I learned to handle tools I've never heard of both digital and physical. I experimented with and solidified my understanding in the inner workings of a bioreactor and used online resources and codes to create math models and forecasting tools. These were all skills and knowledge I've never thought I'd acquire when I first joined this team. No matter the outcome when we eventually head to Paris, I'm thankful for this year-long journey and experience.",
        tasks: ["Model", "Lab", "Education"]
      },
      {
        name: "Renee Kuo",
        photo: "assets/img/members/renee-kuo.webp", workPhoto: "assets/img/members/work/renee-kuo.webp", goofyPhoto: "assets/img/members/goofy/renee-kuo.webp",
        grade: "Freshman", school: "TAS", track: "Human Practices",
        bio: "Hi, I'm Renee and I initially joined iGEM because I want to learn more about biology and learn more about my own interest in it. Through the year-long journey I went through with the team, I initially struggled with maintaining a work-life balance and really getting into the mindset of putting my all into iGEM, but months later not only have I somehow maybe managed to find that balance, I've also learned to do things like GIS, hound people for work, and managing a business plan.",
        tasks: ["Entrepreneurship", "GIS", "Education"]
      },
      {
        name: "Ryan Wei",
        photo: "assets/img/members/ryan-wei.webp", workPhoto: "assets/img/members/work/ryan-wei.webp", goofyPhoto: "assets/img/members/goofy/ryan-wei.webp",
        grade: "Junior", school: "FHJH", track: "Wet Lab",
        bio: "Hi, I'm Ryan Wei! I joined iGEM simply to pursue my interest in synthetic biology. The competition, however, struck me as much more than what I expected: beyond the incredible experience of working in a lab independently as a high school student, the connections and communication between members, instructors, and advisors, the collaborative work between different groups, the public engagement initiatives, and even guidance from professors we didn't know at the start of the competition really strike me as something very realistic and reminiscent of what an actual, authentic research project looks like. I am very grateful for the opportunity I have been given to explore and learn more about synthetic biology in the future.",
        tasks: ["Lab", "Protectant", "Education"]
      },
      {
        name: "Ryan Yuan",
        photo: "assets/img/members/ryan-yuan.webp", workPhoto: "assets/img/members/work/ryan-yuan.webp", goofyPhoto: "assets/img/members/goofy/ryan-yuan.webp",
        grade: "Sophomore", school: "KCIS", track: "Wet Lab",
        bio: "Hi, I'm Ryan Yuan. I joined iGEM out of curiosity, influenced by a friend, and soon fell in love with synthetic biology. When I first joined the team, I was primarily interested in wet lab experiments and believed that wet lab work was the core of an iGEM project. However, as time passed, I came to realize that dry lab, human practices, and even video editing can carry the same weight for a successful iGEM team. iGEM taught me to step up for my team, take responsibility for my actions, and embrace uncertainty with an open mind. One example was video editing, something completely unfamiliar to me. Before iGEM, I had never even opened video editing software. When the team needed someone to take on the task, I stepped up and took responsibility. I spent hours figuring out how to edit, going through hundreds of sound effects and transitions, and talking to people I normally would not interact with to gather key information and structure the video properly. I also developed a greater sense of attentiveness by constantly trying to make the video as smooth and polished as possible. It had little to do with wet lab experiments, yet I felt more accomplished than I ever had before. That experience showed me that contributing to iGEM is not limited to the field I initially expected to pursue. It is about being willing to step outside your comfort zone, learn something completely new, and contribute wherever the team needs you.",
        tasks: ["Lab", "Protectant", "Video", "Entrepreneurship"]
      },
      {
        name: "Sara Chen",
        photo: "assets/img/members/sara-chen.webp", workPhoto: "assets/img/members/work/sara-chen.webp", goofyPhoto: "assets/img/members/goofy/sara-chen.webp",
        grade: "Sophomore", school: "WEGO", track: "Dry Lab",
        bio: "Hi everyone, I am Sara. I initially joined iGEM to look for my passion in synthetic Biology. The experience of transferring from wet lab to dry lab changes me a lot. Although transferring between groups is not common, I manage to find the similarities between these two labs. Even though I have a pretty rough time to catch up in dry lab, I think making decisions from two different perspectives of conducting experiment and prediction helps a lot. For example, I was in charge in plants when I was in wet lab. The experience of taking care of plants allows me to look for research for modules that correlated more to the conditions in lab. Overall, I realized the importance of communication and collaboration between labs to win or achieve our goals together.",
        tasks: ["Lab", "Plant"]
      },
      {
        name: "Sarah Chou",
        photo: "assets/img/members/sarah-chou.webp", workPhoto: "assets/img/members/work/sarah-chou.webp", goofyPhoto: "assets/img/members/goofy/sarah-chou.webp",
        grade: "Junior", school: "FHJH", track: "Wet Lab",
        bio: "Hi, I'm Sarah~ I am very interested in experiments and biology. The hardest part of iGEM for me was seeing no band where I expected one on my PCR gel. I had followed the procedure, so at first I did not know what had gone wrong. Instead of repeating the experiment without a plan, I went back to the plasmid map, calculated the expected fragment size, checked the primer positions, and compared the result with the DNA ladder. I discussed possible causes with my teammates before deciding what to try next. In January, I needed help understanding what a gel result meant. Now I can use a plasmid map to predict a band size and think through possible reasons when an experiment fails. I have also learned to keep clearer lab notes so the team can use each result, even an unsuccessful one. The missing band was frustrating, but it taught me that research involves asking better questions after an experiment does not go as expected.",
        tasks: ["Lab", "Plant", "Lab Notebook", "Education"]
      },
      {
        name: "Sophia Lin",
        photo: "assets/img/members/sophia-lin.webp", workPhoto: "assets/img/members/work/sophia-lin.webp", goofyPhoto: "assets/img/members/goofy/sophia-lin.webp",
        grade: "Sophomore", school: "KCISLK", track: "Human Practices",
        bio: "Hi, I’m Sophia! I’ve always been interested in biology, which is one of the reasons I decided to join iGEM. Throughout the year, I’ve learned and experienced many new things, including designing an educational lesson, helping build a business plan, contacting experts, organizing outreach events, learning lab techniques, and much more than I ever imagined I would learn if I hadn’t joined iGEM. I’m looking forward to present our results and share the insights we’ve gained throughout this journey. I hope to carry the knowledge and experiences I’ve gained from iGEM into my future studies and continue exploring biology and science.",
        tasks: ["Outreach", "Education"]
      },
      {
        name: "Sophia Yeh",
        photo: "assets/img/members/sophia-yeh.webp", workPhoto: "assets/img/members/work/sophia-yeh.webp", goofyPhoto: "assets/img/members/goofy/sophia-yeh.webp",
        grade: "Sophomore", school: "TAS", track: "Wet Lab",
        bio: "Hello! I am Sophia and I joined iGEM to explore the field of synthetic biology and to acquire useful skills for my future science-related work. Coming into this project, I thought that I would only practice lab skills, but I have learned so much more regarding research, molecular dynamics, video making, and others! Through this experience, I also learned interpersonal skills such as leadership, team-building, time management, and communication. One of my favorite events was the Farmer's Expo where we were able to understand farmers' perspective on our project, allowing us to adapt to their needs. Because I struggled at the start to connect the dots between different aspects of our project, I shifted my focus to cross-team work, which is how I began to understand the importance of connecting the team together. The most rewarding part about iGEM was the inspiration and advice I gained from experts, farmers, instructors, and the team itself.\n\nOutside of iGEM, I like to spend my time staring down math problems, teaching children about science, discovering new cat cafes, taking photos, making a new playlist for every genre in every language, and singing my heart out in karaoke! I am so glad that iGEM provided me with the opportunity to explore some of these areas as well. Overall, iGEM showed me that working together as a team is what makes ideas become reality. I hope that our project's contribution to agriculture can empower farmers, allowing them to have the resources they need to protect their plants!",
        tasks: ["Protectant", "Lab", "Peptide Design", "Education", "Entrepreneurship", "Video"]
      },
      {
        name: "Sophie Chen",
        photo: "assets/img/members/sophie-chen.webp", workPhoto: "assets/img/members/work/sophie-chen.webp", goofyPhoto: "assets/img/members/goofy/sophie-chen.webp",
        grade: "Sophomore", school: "TES", track: "Wet Lab",
        bio: "Hey, I'm Sophie Chen! I’ve always loved chemistry, art, and math, so I didn’t expect to get this invested in synthetic biology, spending hundreds of hours in the lab. I joined iGEM wanting to create a worldwide impact, and somehow ended up looking forward to colony PCRs and liquid cultures.\n\niGEM has really pushed my determination to chase results, not just for my own accomplishments, but for the team and everything we’ve worked on together. I mostly work in wetlab, but I’ve also enjoyed collaborating with drylab to understand the bigger picture and meeting with professors to hear different perspectives on our work. My favorite moments, though, are the messy ones: troubleshooting failed experiments, complaining about protocols, and interacting with teammates from completely different backgrounds. Somewhere along the way, iGEM made me realize that I don’t just like doing science: I really love being part of the process of figuring things out.",
        tasks: ["Lab", "Cloning"]
      },
      {
        name: "Sophie Huang",
        photo: "assets/img/members/sophie-huang.webp", workPhoto: "assets/img/members/work/sophie-huang.webp", goofyPhoto: "assets/img/members/goofy/sophie-huang.webp",
        grade: "Freshman", school: "WEGO", track: "Wet Lab",
        bio: "Hi, I'm Sophie Huang. Initially, I joined the iGEM competition for a chance to get closer to Biology, one of my favorite subjects. At first, I envisioned synthetic biology as a pristine world of precise equations and predictable organisms. But stepping into our Biomanufacturing project with GEMS-Taiwan quickly showed me that living systems are far more dynamic, and delightfully chaotic, than anything in a textbook.\n\nThroughout this journey, I’ve navigated the intricate bridge between concept and application, learning that real scientific impact requires both rigorous technical execution and a clear vision for how biomanufactured solutions touch the real world. Beyond the lab bench and project timelines, the steep learning curve tested my adaptability and resilience. I learned how to embrace unexpected design pivots, align diverse ideas across a multi-faceted team, and turn abstract biological challenges into functional, scalable outcomes. Looking back, this experience transformed my curiosity into confidence, proving that high school researchers can actively contribute to the future of biotechnology. I’m incredibly proud of what our team has built, and I can't wait to share our work at the Grand Jamboree!",
        tasks: ["Lab Notebook", "Lab", "Plant", "Education"]
      },
      {
        name: "Sophie Liu",
        photo: "assets/img/members/sophie-liu.webp", workPhoto: "assets/img/members/work/sophie-liu.webp", goofyPhoto: "assets/img/members/goofy/sophie-liu.webp",
        grade: "Sophomore", school: "TAS", track: "Wet Lab",
        bio: "Hi, I’m Sophie! I joined iGEM to explore synthetic biology and build practical scientific skills. Over the past year, I learned to troubleshoot and adapt when experiments and processes didn’t go as planned, or when our initial assumptions about market promotion were wrong I worked across wet lab, drylab hardware/math modeling, and business strategy, constantly shifting between different types of problems. Through focusing on cross-team work and understanding how each workflow fed into others, I really got to understand how much of the project’s success depended on people communicating with each other and building on what different subteams had learned. The most valuable part of this experience was learning from professors, farmers we interviewed, as well as collaborating with the instructors and my teammates, and each person in this journey has taught me something different about what it takes to build a project that will actually be successful in the real world, which I’m extremely grateful to be able to experience.",
        tasks: ["Video", "Lab", "Plant", "Model", "Education", "Entrepreneurship"]
      }
    ]},
    ]
  },
  {
    id: "advisors",
    title: "Student Advisors",
    noteAI: true,
    note: "Each student advisor turned a year of experience into something the team did not have: an education site that strings our teaching work together across the years, the logistics and software behind advanced peptide design, a firmer structure for our videos, a photography initiative that puts plant stress in front of a global audience, and lab technique passed down bench to bench.",
    groups: [
    { title: "", members: [
      {
        name: "Caden Wu", role: "Student Advisor", hidden: true,
        photo: "assets/img/members/caden-wu.webp", workPhoto: "", goofyPhoto: "assets/img/members/goofy/caden-wu.webp", solo: true,
        grade: "Junior", school: "TAS", track: "",
        bio: "Hi, I'm Caden, and I'm an advisor for GEMS Taiwan. Following a great year as a drylab member from the 2025 team, I decided to return as an advisor to support the team any way possible by sharing my knowledge and experience.",
        tasks: ["Education"]
      },
      {
        name: "Dylan Huang", role: "Student Advisor",
        photo: "assets/img/members/dylan-huang.webp", workPhoto: "assets/img/members/work/dylan-huang.webp", goofyPhoto: "assets/img/members/goofy/dylan-huang.webp",
        grade: "Sophomore", school: "TAS", track: "",
        bio: "Hi, I’m Dylan! I joined iGEM as an advisor because I’m interested in synthetic biology and enjoy projects that connect engineering and biology. This year, I’ve been involved in extensive Human Practices outreach, building connections with experts and professionals, while sharing both drylab and wet lab advice and provide assistance based on my experience from last year. I helped to document the team's progress by capturing small details of our work through photography. I hope to support the team in bringing its ideas to life and making this year’s iGEM journey a meaningful one!",
        tasks: ["Wiki", "Data Physicalization"]
      },
      {
        name: "Hachi Wu", role: "Student Advisor",
        photo: "assets/img/members/hachi-wu.webp", workPhoto: "assets/img/members/work/hachi-wu.webp", goofyPhoto: "assets/img/members/goofy/hachi-wu.webp",
        grade: "Sophomore", school: "KCIS", track: "",
        bio: "Hi, I'm Hachi, I was the project lead and wet-lab lead for Gems Taiwan 2025. My passion for synthetic biology has driven me to pursue iGEM for another round, but as an advisor to share experiences with new iGEMers. This year, instead of spending hours in the lab, I focused more on documenting the team's journey with my camera, from the small details in the lab to all the unseen efforts, I try to capture everything through my lens. I look forward to supporting and working with the team, and build a meaningful project.",
        tasks: ["Video", "Photography"]
      },
      {
        name: "Ian Cheng", role: "Student Advisor", hidden: true,
        photo: "assets/img/members/ian-cheng.webp", workPhoto: "assets/img/members/work/ian-cheng.webp", goofyPhoto: "assets/img/members/goofy/ian-cheng.webp",
        grade: "Sophomore", school: "TAS", track: "Wet Lab",
        bio: "Hi! I'm Ian, and I'm an advisor this year. I'm passionate about ecology and zoology, and I bring that same passion to synthetic biology as well. I hope to support the team through my wet lab knowledge, as well as my artistic ability.",
        tasks: []
      },
      {
        name: "Katherine Chen", role: "Student Advisor", hidden: true,
        photo: "assets/img/members/katherine-chen.webp", workPhoto: "", goofyPhoto: "assets/img/members/goofy/katherine-chen.webp", solo: true,
        grade: "", school: "", track: "",
        bio: "",
        tasks: ["Photography", "Data Physicalization"]
      },
      {
        name: "Neo Su", role: "Student Advisor",
        photo: "assets/img/members/neo-su.webp", workPhoto: "assets/img/members/work/neo-su.webp", goofyPhoto: "assets/img/members/goofy/neo-su.webp",
        grade: "Sophomore", school: "TAS", track: "Wet Lab",
        bio: "",
        tasks: ["Hardware", "Bioreactor", "Wiki"]
      },
      {
        name: "Oscar Huang", role: "Student Advisor", hidden: true,
        photo: "assets/img/members/oscar-huang.webp", workPhoto: "", goofyPhoto: "assets/img/members/goofy/oscar-huang.webp", solo: true,
        grade: "Sophomore", school: "TAS", track: "",
        bio: "Hi I am Oscar a Sophomore at TAS and a current advisor for GEMS Taiwan. I was a former drylab member for the 2025 team, and I hope to bring meaningful impact to the team from what I have learned last year. I also hope to continue looking forward to the learning opportunities that iGEM has to offer, whether that's teamwork or technical skills.",
        tasks: ["Wiki"]
      },
      {
        name: "Venus Tay", role: "Student Advisor",
        photo: "assets/img/members/venus-tay.webp", workPhoto: "assets/img/members/work/venus-tay.webp", goofyPhoto: "assets/img/members/goofy/venus-tay.webp",
        grade: "Sophomore", school: "TAS", track: "",
        bio: "Hi! I’m Venus, a former project lead and wet-lab lead of the 2025 Gems Taiwan iGEM team. After an amazing experience last year, I chose to return as an advisor to support the 2026 team, share my wet-lab experience, and continue exploring the impact of synthetic biology together.",
        tasks: ["Lab"]
      },
      {
        name: "Bruce Tsai", role: "Student Advisor", hidden: true,
        photo: "", workPhoto: "assets/img/members/work/bruce-tsai.webp", goofyPhoto: "",
        grade: "", school: "", track: "",
        bio: "",
        tasks: ["Protectant", "Peptide Design"]
      }
    ]},
    ],
    afterword: { text: "We appreciate the contributions of the following members from the 2025 team.", names: "Caden Wu, Ian Cheng, Katherine Chen, Oscar Huang, Bruce Tsai" }
  },
  {
    id: "support-team",
    title: "Support Team",
    noteAI: true,
    note: "Not everyone can give the project the same hours. This section is for members whose contribution has been lighter, and it is empty today.",
    groups: [
    { title: "", members: [] },
    ]
  },
  {
    id: "instructors",
    title: "Instructors",
    note: "",
    groups: [
    { title: "", members: [
      {
        name: "Timmy", role: "Dry Lab Instructor",
        photo: "assets/img/members/timmy.webp", workPhoto: "assets/img/members/work/timmy.webp", goofyPhoto: "assets/img/members/goofy/timmy.webp",
        grade: "", school: "", track: "",
        bio: "This year we put plants under stress and watch who breaks first, sometimes it’s the system, sometimes it’s us. That’s fine. Not everything survives hardships. But often times that’s how you find the gems.",
        tasks: []
      },
      {
        name: "Chars Hsieh", role: "Wet Lab Instructor",
        photo: "assets/img/members/chars-hsieh.webp",
        workPhoto: "assets/img/members/work/chars-hsieh.webp",
        goofyPhoto: "assets/img/members/goofy/chars-hsieh.webp",
        grade: "", school: "", track: "",
        bio: "Chars Hsieh, an experienced researcher with over ten years of expertise in molecular and cell biology. I train and empower students at GEMS Academy, journeying with them to explore the frontiers of synthetic biology.",
        tasks: []
      },
      {
        name: "Gabriel Ng", role: "Wet Lab Instructor",
        photo: "assets/img/members/gabriel-ng.webp",
        workPhoto: "assets/img/members/work/gabriel-ng.webp",
        goofyPhoto: "assets/img/members/goofy/gabriel-ng.webp",
        grade: "", school: "", track: "",
        bio: "Hey everyone, I’m Gabriel, wet lab instructor. I’ll be guiding the biology experiments this year. Looking forward to learning a lot together over the coming months!",
        tasks: []
      },
      {
        name: "Jessie Lau", role: "Human Practices Instructor",
        photo: "assets/img/members/jessie-lau.webp",
        workPhoto: "assets/img/members/work/jessie-lau.webp",
        goofyPhoto: "assets/img/members/goofy/jessie-lau.webp",
        grade: "", school: "", track: "",
        bio: "Hello! I am Jessie, HP instructor. I've spent years teaching Chemistry and guiding various science projects. I enjoyed so much seeing students apply what they've learned to the real world, can't wait to see the impact this year's iGEM team will have on society!",
        tasks: []
      },
      {
        name: "Gina Yu", role: "Wet Lab Instructor",
        photo: "assets/img/members/gina-yu.webp",
        workPhoto: "assets/img/members/work/gina-yu.webp",
        goofyPhoto: "assets/img/members/goofy/gina-yu.webp",
        grade: "", school: "", track: "",
        bio: "Hi, this is Gina, one of wetlab instructors. I passionate about science and have extensive hands-on experience working in lab. Also I enjoy guiding students in hands-on experiments.",
        tasks: []
      },
      {
        name: "Dr. Pak", role: "Project Advisor",
        photo: "assets/img/members/dr-pak.webp", workPhoto: "assets/img/members/work/dr-pak.webp", goofyPhoto: "", solo: true,
        grade: "", school: "", track: "",
        bio: "Howdy! Pak here (yes, I lived in Houston for a few years). This is my first year with iGEM, and what an eye-opener! Between the high level of science, the dedication of both instructors and students, and an amazing sense of curiosity, it’s been an incredible ride. As a newcomer to synbio, I’ve learned right alongside the team. Having worked in both academia and industrial R&D, watching these budding scientists tackle such challenging issues is truly rewarding and inspiring.",
        tasks: []
      }
    ]},
    ]
  }
];
