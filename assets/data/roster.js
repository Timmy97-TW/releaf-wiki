/* =============================================================================
   ReLeaf , Team page data
   -----------------------------------------------------------------------------
   This is the roster. Edit this file. Each person is one object:

     name     shown on the card
     role     badge above the name ("Wet Lab Lead", "Advisor", ...). "" = none
     photo    portrait; "" falls back to a generated initials tile
     funPhoto optional 2nd photo revealed on hover (Marburg-style)
     grade / school         the small meta line under the name
     track / level          subteam and whether they are a major or a minor
     bio      shown under the photo; clicking the card opens the full view
     own      tasks this person OWNS   -> solid pill
     mem      tasks this person is ON  -> outlined pill

   Adding a new task: add one line to LABELS. It appears in the filter bar and
   on every card automatically.
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
   so their owner pills carry a two-tone fill instead of a flat colour. */
const LABEL_GRADIENTS = {
  "Lab":         "linear-gradient(135deg,#5346c0 0%,#2a2168 100%)",
  "Cloning":     "linear-gradient(135deg,#9d2b4d 0%,#5f1230 100%)",
  "Bioreactor":  "linear-gradient(135deg,#159aab 0%,#07444e 100%)"
};

/* ---------- Sections, in display order ---------------------------------- */
const SECTIONS = [
    {
    id: "student-leaders",
    title: "Student Leaders",
    note: "",
    groups: [
    { title: "", members: [
      {
        name: "Abigail Lin", role: "Wet Lab Lead",
        photo: "assets/img/members/abigail-lin.jpg", funPhoto: "",
        grade: "Freshman", school: "KCIS", track: "Wet Lab", level: "Major",
        bio: "Hi I'm Abigail! I love solving mystery novels, and to me, the plant world is the ultimate unsolved case. Outside of biology, I enjoy painting, diving, and scouting. I joined iGEM to explore the \"art\" of biological systems. Just like playing the cello, iGEM requires lots of harmony and creativity!",
        own: ["Lab", "Cloning", "Plant", "Art"], mem: ["Education", "Video"]
      },
      {
        name: "Abby Tsai", role: "Wet Lab Lead",
        photo: "assets/img/members/abby-tsai.jpg", funPhoto: "",
        grade: "Freshman", school: "KCIS", track: "Wet Lab", level: "Major",
        bio: "Hey! I'm Abby Tsai, I love r&b musics, movies, and traveling. I also play oboe in the orchestra. I joined iGEM because of my deep fascination with synthetic biology, and I'm super excited to work with this team and achieve greatness this year!",
        own: ["Lab", "Plant", "Art", "Video"], mem: ["Education"]
      },
      {
        name: "Abby Kao", role: "Cross-Team Lead",
        photo: "assets/img/members/abby-kao.jpg", funPhoto: "",
        grade: "Freshman", school: "KCIS", track: "Wet Lab", level: "Major",
        bio: "Hey, I'm Abby! My favourite hobbies are dancing and experiencing different cultures around the world. Honestly, I am still surprised at how I found myself in this iGEM team, but through our hard work, I am very excited for what the future holds for us.",
        own: ["Video"], mem: ["Lab", "Plant", "Education", "Art"]
      },
      {
        name: "Anton Lin", role: "Cross-Team Lead",
        photo: "assets/img/members/anton-lin.jpg", funPhoto: "",
        grade: "Freshman", school: "TAS", track: "Dry Lab", level: "Major",
        bio: "Hi, I’m Anton. I’m interested in engineering and robotics, and I joined iGEM to learn more about synthetic biology and how to solve real-world problems. Outside of that, I also enjoy golf, traveling, and music.",
        own: ["Bioreactor", "Hardware", "Outreach", "Wiki"], mem: ["Lab Notebook", "Education"]
      },
      {
        name: "Chloe Wu", role: "Wet Lab Lead",
        photo: "assets/img/members/chloe-wu.jpg", funPhoto: "",
        grade: "Sophomore", school: "TAS", track: "Wet Lab", level: "Major",
        bio: "hey everyone, I'm Chloe!! In my free time, I love shopping, trying out new restaurants, and hanging out with my friends. I initially joined iGEM to learn more about synbio and explore my scientific passions, but I've come to learn that it's so much more than that - it is truly building a foundation for how I think, collaborate with others, and contribute towards creating a measurable difference in our lives.",
        own: ["Lab", "Cloning"], mem: ["Outreach", "Education", "Entrepreneurship", "Video"]
      },
      {
        name: "Jacquelyn Inocencio", role: "Cross-Team Lead",
        photo: "assets/img/members/jacquelyn-inocencio.jpg", funPhoto: "",
        grade: "Junior", school: "TAS", track: "Dry Lab", level: "Major",
        bio: "Hi! I’m Jacquelyn, and I joined iGEM because I’m really interested in using synthetic biology to create practical, real-world solutions. I love hands-on science and figuring out how ideas can actually work outside the lab. Outside the lab, I enjoy trying new food spots, hanging out with my friends, and shopping!",
        own: ["Outreach", "Wiki"], mem: ["Education", "Video"]
      },
      {
        name: "Alex Li", role: "Wet Lab Vice Lead",
        photo: "assets/img/members/alex-li.jpg", funPhoto: "",
        grade: "Sophomore", school: "KCIS", track: "Wet Lab", level: "Major",
        bio: "Hi! I'm Alex. I love to play board games and listen to music. I joined iGEM because I enjoy learning biology and I am looking foward to create a significant project that will really impact the world.",
        own: ["Lab", "Plant"], mem: []
      },
      {
        name: "Anna Chuang", role: "Cross-Team Vice Lead",
        photo: "assets/img/members/anna-chuang.jpg", funPhoto: "",
        grade: "Junior", school: "KCIS", track: "Dry Lab", level: "Major",
        bio: "Hey, I'm Anna Chuang! Outside of my passion for biochemistry, I am also a dedicated swimmer who loves to use training as yet another reason to get sweets! I joined iGEM in hope of contributing alongside more like-minded people who view science not as a subject, but the most natural way to interact with the world!",
        own: ["GIS"], mem: ["Model", "Outreach", "Education"]
      },
      {
        name: "Felix Yu", role: "Dry Lab Vice Lead",
        photo: "assets/img/members/felix-yu.jpg", funPhoto: "",
        grade: "Sophomore", school: "IBSH", track: "Dry Lab", level: "Major",
        bio: "Hey, I'm Felix. I'm interested in biochemistry and engineering, but overall, I just like the satisfaction of seeing systems work. I joined iGEM to help solve real world problems and turn impactful ideas into practical solutions. I also have a fat dog and cat.",
        own: ["Protectant", "Peptide Design", "Model"], mem: ["Lab Notebook", "Data Physicalization"]
      },
      {
        name: "Naomi Lin", role: "Cross-Team Vice Lead",
        photo: "assets/img/members/naomi-lin.jpg", funPhoto: "",
        grade: "Freshman", school: "FPS", track: "Wet Lab", level: "Major",
        bio: "Hi, I'm Naomi. I enjoy art, travel, and music, and I have a strong interest in biology research. Joining iGEM allows me to expand my knowledge, collaborate with people who also loved biology, and work together to create meaningful impacts on real-world problems.",
        own: ["Lab Notebook", "Education"], mem: ["Lab", "Art", "Video", "Wiki"]
      },
      {
        name: "Noah Tau", role: "Dry Lab Vice Lead",
        photo: "assets/img/members/noah-tau.jpg", funPhoto: "",
        grade: "Sophomore", school: "TAS", track: "Dry Lab", level: "Major",
        bio: "Hi, my name is Noah and my passion lies in robotics, specfically FRC at the moment. I joined iGEM because of my deep passion towards countless facets of engineering and I'd love to explore different types to broaden my horizons and learn more about the world we live in. I look forward to working alongside other passionate hardworkers to understand difficult topics and learn how to better work as a group.",
        own: ["Bioreactor", "Hardware", "Wiki"], mem: []
      },
      {
        name: "Olivia Du", role: "Human Practices Vice Lead",
        photo: "assets/img/members/olivia-du.jpg", funPhoto: "",
        grade: "Sophomore", school: "IBSH", track: "Human Practices", level: "Major",
        bio: "Hi, I'm Olivia! Outside of school and iGEM I enjoy dancing, scrolling on my phone, and doing nothing. By joining iGEM I hope to further explore my interest in biology and learn more about everything!",
        own: ["Education"], mem: ["Outreach", "Entrepreneurship", "Data Physicalization"]
      },
      {
        name: "Sophia Yeh", role: "Cross-Team Vice Lead",
        photo: "assets/img/members/sophia-yeh.jpg", funPhoto: "",
        grade: "Sophomore", school: "TAS", track: "Wet Lab", level: "Major",
        bio: "Hi! I'm Sophia and I enjoy listening to music while studying subjects such as chemistry! I joined iGEM to learn more about synthetic biology and to collaborate with others to create a meaningful project that contributes to both scientific advancements and real-world problems.",
        own: ["Protectant"], mem: ["Lab", "Peptide Design", "Education", "Entrepreneurship", "Video"]
      },
      {
        name: "Sophie Chen", role: "Wet Lab Vice Lead",
        photo: "assets/img/members/sophie-chen.jpg", funPhoto: "",
        grade: "Sophomore", school: "TES", track: "Wet Lab", level: "Major",
        bio: "Hi, I’m Sophie. I'm interested in math and chemistry and joined iGEM to work on a meaningful project that could make a difference. Outside of that, I like sports, art, and music.",
        own: ["Lab", "Cloning"], mem: []
      },
      {
        name: "Sophie Liu", role: "Cross-Team Vice Lead",
        photo: "assets/img/members/sophie-liu.jpg", funPhoto: "",
        grade: "Sophomore", school: "TAS", track: "Wet Lab", level: "Major",
        bio: "Hi, I'm Sophie! I love listening to music, studying at cafes, and going out with my friends. I joined igem to collaborate with like-minded peers to work on a meaningful real-world project.",
        own: ["Video"], mem: ["Lab", "Plant", "Model", "Education", "Entrepreneurship"]
      }
    ]},
    ]
  },
  {
    id: "student-members",
    title: "Student Members",
    note: "",
    groups: [
    { title: "", members: [
      {
        name: "Audrey Chu",
        photo: "assets/img/members/audrey-chu.jpg", funPhoto: "",
        grade: "Sophomore", school: "IBSH", track: "Dry Lab", level: "Major",
        bio: "Hey, I'm Audrey Chu! I love traveling, dancing, and listening to music. I have a keen interest in biology and joined iGEM to explore my passion more deeply and work with others just as enthusiastic as I am. I can't wait to share our journey this year at the Grand Jamboree in Paris!",
        own: [], mem: ["Plant", "Wiki"]
      },
      {
        name: "Audrey Hsieh",
        photo: "assets/img/members/audrey-hsieh.jpg", funPhoto: "",
        grade: "Freshman", school: "KCIS", track: "Wet Lab", level: "Major",
        bio: "Hi! I'm Audrey and I enjoy listening to music and traveling. I joined iGEM to learn more about synthetic biology and to make more friends from different schools with the same passion!",
        own: [], mem: ["Lab", "Plant", "Education", "Entrepreneurship", "Art", "Video"]
      },
      {
        name: "Ethan Chang",
        photo: "assets/img/members/ethan-chang.jpg", funPhoto: "",
        grade: "Freshman", school: "AAIA", track: "Wet Lab", level: "Minor",
        bio: "Greetings! I am Ethan. I enjoy playing volleyball, fencing, and binging Netflix series as hobbies. Initially, I joined iGEM to create global impact around the world through a different lens that's not offered in the traditional education curricula. Still, I really look forward to winning the iGEM competition with my team!",
        own: ["Regulations"], mem: ["Lab", "Protectant", "Entrepreneurship"]
      },
      {
        name: "Ethan Liu",
        photo: "assets/img/members/ethan-liu.jpg", funPhoto: "",
        grade: "Junior", school: "KCIS", track: "Dry Lab", level: "Minor",
        bio: "Wassup, this is Ethan! I’m dedicated to biotech and currently seeking solutions to end world hunger through innovative agricultural systems. I joined iGEM as a first step toward creating meaningful impact alongside like-minded people. Excited to turn ideas into real solutions",
        own: ["Model"], mem: ["Education"]
      },
      {
        name: "Eva Zhong",
        photo: "assets/img/members/eva-zhong.jpg", funPhoto: "",
        grade: "Sophomore", school: "TAS", track: "Dry Lab", level: "Minor",
        bio: "Hi, I'm Eva!! I love reading, cooking, and playing games! I joined iGEM because I want to explore more in a specific topic, and iGEM allows me to do so.",
        own: [], mem: ["GIS", "Entrepreneurship"]
      },
      {
        name: "Joshua Hong",
        photo: "assets/img/members/joshua-hong.jpg", funPhoto: "",
        grade: "Freshman", school: "WEGO", track: "Wet Lab", level: "Major",
        bio: "Sup, I'm Joshua. I love outdoor activities, computer stuff, and biology. Joining iGEM allows me to learn more about a field of biology I hadn't delved in before, so I really cherish this experience.",
        own: ["Bioreactor"], mem: ["Lab", "Hardware"]
      },
      {
        name: "Mia Guo",
        photo: "assets/img/members/mia-guo.jpg", funPhoto: "",
        grade: "Sophomore", school: "IBSH", track: "Human Practices", level: "Major",
        bio: "Hi, I'm Mia! Outside of iGEM I enjoy watching romance movies, fencing, listening to music, and watching F1. I joined iGEM because of my love for biology and I can't wait to attend the Grand Jamboree in Paris!",
        own: ["Data Physicalization"], mem: ["Outreach", "Education", "Entrepreneurship"]
      },
      {
        name: "Olivia Lin",
        photo: "assets/img/members/olivia-lin.jpg", funPhoto: "",
        grade: "Junior", school: "KCISLK", track: "Wet Lab", level: "Major",
        bio: "Hi, I'm Olivia Lin! I love listening to music, gyming or running, and shopping in my freetime! I joined iGem because of my ongoing passion for biology (especially human biology and oncology) in general alongside the research and wetlab based experiences that I will derive from joining. Besides having fun in Paris, I hope to grind some late night research with new friends on integrated biology,making a difference to society!",
        own: ["GIS"], mem: ["Protectant", "Entrepreneurship"]
      },
      {
        name: "Phoebe Chen",
        photo: "assets/img/members/phoebe-chen.jpg", funPhoto: "",
        grade: "Sophomore", school: "WEGO", track: "Wet Lab", level: "Major",
        bio: "Hi, I'm Phoebe! One thing about me is that I love animals and listening to music, but I'm obsessed with reading novels. I joined iGEM due to my interest in biology and partly in hopes of meeting people with the same passion as I have. Looking forward to having a great time at Paris in October!",
        own: ["Model"], mem: ["Lab", "Education"]
      },
      {
        name: "Renee Kuo",
        photo: "assets/img/members/renee-kuo.jpg", funPhoto: "",
        grade: "Freshman", school: "FPS", track: "Human Practices", level: "Major",
        bio: "Hi, I'm Renee!!! ^^ I love all types of music, books, and games. I joined iGEM because I wanted to work on something that would allow me to expand my knowledge on biology, one of my favorite subjects.",
        own: ["Entrepreneurship"], mem: ["GIS", "Education"]
      },
      {
        name: "Ryan Wei",
        photo: "assets/img/members/ryan-wei.jpg", funPhoto: "",
        grade: "Junior", school: "FHJH", track: "Wet Lab", level: "Minor",
        bio: "Hi, I'm Ryan Wei! I love music and anime. I'm passionate of math and biology and I am looking forward to solve problems in the world using synthetic biology.",
        own: [], mem: ["Lab", "Protectant", "Education"]
      },
      {
        name: "Ryan Yuan",
        photo: "assets/img/members/ryan-yuan.jpg", funPhoto: "",
        grade: "Sophomore", school: "KCIS", track: "Wet Lab", level: "Major",
        bio: "Hi, I'm Ryan Yuan! I enjoyed listening to R&B music and diving all around the volleyball court. I'm extremely passioante in both biology and chemistry and I hope the love can be fully shown into the effort of our iGEM team. It's been a pleasure to stay on the team as it teaches not only synthetic biology, but also on how to stand out as an individual and make a true difference.",
        own: ["Lab", "Protectant", "Video"], mem: ["Entrepreneurship"]
      },
      {
        name: "Sara Chen",
        photo: "assets/img/members/sara-chen.jpg", funPhoto: "",
        grade: "Sophomore", school: "WEGO", track: "Wet Lab", level: "Minor",
        bio: "Hi! I am Sara Chen. I love to listen to jazz, sing different types of songs and explore questions about Biology. I joined IGEM aiming to gain expereicne of molecular cloning technique and expand my vision of Biology. I am also really looking forward to create something on my own and share those results with people who are fascinated with Biology.",
        own: [], mem: ["Lab", "Plant"]
      },
      {
        name: "Sarah Chou",
        photo: "assets/img/members/sarah-chou.jpg", funPhoto: "",
        grade: "Junior", school: "FHJH", track: "Wet Lab", level: "Minor",
        bio: "Hi! I'm Sarah. I joined iGEM because I love biology and enjoy spending time in the lab. In my spare time, I like to watch YouTube and watch some interesting short videos.",
        own: [], mem: ["Lab", "Plant", "Lab Notebook", "Education"]
      },
      {
        name: "Sophia Lin",
        photo: "assets/img/members/sophia-lin.jpg", funPhoto: "",
        grade: "Sophomore", school: "KCISLK", track: "Human Practices", level: "Major",
        bio: "Hi, I’m Sophia! I love traveling and listening to music! I have always been passionate about biology, and I’m looking forward to learning and exploring more about this subject through iGEM!",
        own: [], mem: ["Outreach", "Education"]
      },
      {
        name: "Sophie Huang",
        photo: "assets/img/members/sophie-huang.jpg", funPhoto: "",
        grade: "Freshman", school: "WEGO", track: "Wet Lab", level: "Major",
        bio: "Hi :), I'm Sophie Huang. I enjoy exploring the exciting, mysterious world of both biology and chemistry, and I hope to make more friends who are also interested in these and be more skilled at molecular cloning techniques. That's exactly why I chose to join iGEM. Outside of that, I also enjoy reading all kinds of books, watching movies, and collecting plushies.",
        own: ["Lab Notebook"], mem: ["Lab", "Plant", "Education"]
      }
    ]},
    ]
  },
  {
    id: "advisors",
    title: "Student Advisors",
    afterword: {
      text: "We also appreciate the contributions of the advisors who helped mostly online:",
      names: "Caden Wu, Elizabeth Wong, Ian Cheng and Oscar Huang."
    },
    note: "Student advisors are not just here to help out. Each of them turned a year of experience into something the team did not have: an education site that finally strings our teaching work together across the years, the logistics and software behind advanced peptide design, a firmer structure for our videos, a photography initiative putting plant stress in front of a global audience through one distinct lens, and lab technique passed down bench to bench.",
    groups: [
    { title: "", members: [
      {
        name: "Bruce Tsai", role: "Student Advisor",
        photo: "", funPhoto: "",
        grade: "", school: "", track: "", level: "",
        bio: "",
        own: [], mem: ["Protectant", "Peptide Design"]
      },
      {
        name: "Caden Wu", role: "Student Advisor", hidden: true,
        photo: "assets/img/members/caden-wu.jpg", funPhoto: "",
        grade: "Junior", school: "TAS", track: "", level: "",
        bio: "",
        own: [], mem: ["Education"]
      },
      {
        name: "Dylan Huang", role: "Student Advisor",
        photo: "assets/img/members/dylan-huang.jpg", funPhoto: "",
        grade: "Sophomore", school: "TAS", track: "", level: "",
        bio: "",
        own: [], mem: ["Wiki", "Data Physicalization"]
      },
      {
        name: "Elizabeth Wong", role: "Student Advisor", hidden: true,
        photo: "assets/img/members/elizabeth-wong.jpg", funPhoto: "",
        grade: "Sophomore", school: "TAS", track: "", level: "",
        bio: "",
        own: [], mem: ["Art"]
      },
      {
        name: "Hachi Wu", role: "Student Advisor", frame: "lead",
        photo: "assets/img/members/hachi-wu.jpg", funPhoto: "",
        grade: "Sophomore", school: "KCIS", track: "", level: "",
        bio: "",
        own: ["Video"], mem: ["Photography"]
      },
      {
        name: "Ian Cheng", role: "Student Advisor", hidden: true,
        photo: "assets/img/members/ian-cheng.jpg", funPhoto: "",
        grade: "Sophomore", school: "TAS", track: "", level: "",
        bio: "",
        own: [], mem: []
      },
      {
        name: "Katherine Chen", role: "Student Advisor",
        photo: "assets/img/members/katherine-chen.jpg", funPhoto: "",
        grade: "", school: "", track: "", level: "",
        bio: "",
        own: [], mem: ["Photography", "Data Physicalization"]
      },
      {
        name: "Neo Su", role: "Student Advisor", frame: "lead",
        photo: "assets/img/members/neo-su.jpg", funPhoto: "",
        grade: "", school: "", track: "", level: "",
        bio: "",
        own: ["Hardware"], mem: ["Bioreactor", "Wiki"]
      },
      {
        name: "Oscar Huang", role: "Student Advisor", hidden: true,
        photo: "assets/img/members/oscar-huang.jpg", funPhoto: "",
        grade: "Sophomore", school: "TAS", track: "", level: "",
        bio: "",
        own: [], mem: ["Wiki"]
      },
      {
        name: "Venus Tay", role: "Student Advisor",
        photo: "assets/img/members/venus-tay.jpg", funPhoto: "",
        grade: "Sophomore", school: "TAS", track: "", level: "",
        bio: "",
        own: [], mem: ["Lab"]
      }
    ]},
    ]
  },
  {
    id: "support-team",
    title: "Support Team",
    note: "Every team finds its own rhythm, and not everyone can give it the same hours. This section is kept for members whose contribution to the project has been lighter. It is empty today, and we would be glad for it to stay that way.",
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
        photo: "assets/img/members/timmy.jpg", funPhoto: "",
        grade: "", school: "", track: "", level: "",
        bio: "Timmy the drylab instructor here. This year we put plants under stress and watch who breaks first, sometimes it’s the system, sometimes it’s us. That’s fine. Not everything survives hardships. But often times that’s how you find the gems.",
        own: [], mem: []
      },
      {
        name: "Chars Hsieh", role: "Wet Lab Instructor",
        photo: "assets/img/members/chars-hsieh.jpg", funPhoto: "",
        grade: "", school: "", track: "", level: "",
        bio: "Chars Hsieh, an experienced researcher with over ten years of expertise in molecular and cell biology. I train and empower students at GEMS Academy, journeying with them to explore the frontiers of synthetic biology.",
        own: [], mem: []
      },
      {
        name: "Gabriel Ng", role: "Wet Lab Instructor",
        photo: "assets/img/members/gabriel-ng.jpg", funPhoto: "",
        grade: "", school: "", track: "", level: "",
        bio: "Hey everyone, I’m Gabriel, wet lab instructor. I’ll be guiding the biology experiments this year. Looking forward to learning a lot together over the coming months!",
        own: [], mem: []
      },
      {
        name: "Jessie Lau", role: "Human Practices Instructor",
        photo: "assets/img/members/jessie-lau.jpg", funPhoto: "",
        grade: "", school: "", track: "", level: "",
        bio: "Hello! I am Jessie, HP instructor. I've spent years teaching Chemistry and guiding various science projects. I enjoyed so much seeing students apply what they've learned to the real world, can't wait to see the impact this year's iGEM team will have on society!",
        own: [], mem: []
      },
      {
        name: "Gina Yu", role: "Wet Lab Instructor",
        photo: "assets/img/members/gina-yu.jpg", funPhoto: "",
        grade: "", school: "", track: "", level: "",
        bio: "Hi, this is Gina, one of wetlab instructors. I passionate about science and have extensive hands-on experience working in lab. Also I enjoy guiding students in hand-on experiments.",
        own: [], mem: []
      },
      {
        name: "Dr. Pak", role: "Project Advisor",
        photo: "", funPhoto: "",
        grade: "", school: "", track: "", level: "",
        bio: "",
        own: [], mem: []
      }
    ]},
    ]
  }
];
