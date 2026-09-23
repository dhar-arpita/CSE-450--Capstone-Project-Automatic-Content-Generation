/* Every user-facing string in the app lives here, keyed by language.
   Bangla is the default: the backend generates content with language="bangla",
   and the classrooms this is built for read Bangla first.

   Note for anyone adding Bangla copy: never write the possessive of ধী as
   ধীর — it is indistinguishable from ধীর ("slow"). Rephrase instead. */

   export const LANGUAGES = {
    bn: { code: "bn", label: "বাংলা", short: "বাং", htmlLang: "bn" },
    en: { code: "en", label: "English", short: "EN", htmlLang: "en" },
  };
  
  export const DEFAULT_LANGUAGE = "bn";
  
  const en = {
    brand: "Dhi",
    slogans: {
      primary: "Teach sharper. Prep faster.",
      secondary: "Your syllabus, classroom-ready in minutes.",
      punchline: "Stop drowning in prep. Let Dhi do the heavy lifting.",
    },
    a11y: {
      toLight: "Switch to light mode",
      toDark: "Switch to dark mode",
      toBangla: "বাংলায় দেখুন",
      toEnglish: "Switch language to English",
      primaryNav: "Main menu",
      footerNav: "Footer menu",
      scrollDown: "See what Dhi can do",
      practiceList: "Practice mode features",
    },
    nav: {
      craft: "Features",
      how: "How it works",
      students: "For students",
      login: "Log in",
    },
    hero: {
      kicker: "Aligned with the National Curriculum",
      titleLead: "You teach the syllabus,",
      titleAccent: "now bring it to life in their language.",
      lede:
        "Turn any chapter into custom worksheets, instant quizzes, and crisp study notes with Dhi. Tweak anything in plain words, ready before your next period rings.",
      primary: "Get started",
      secondary: "See it in action",
      scroll: "Explore",
    },
    craft: {
      eyebrow: "What Dhi makes",
      headLead: "Four things teachers never have time for,",
      headAccent: "done in under a minute.",
      items: [
        {
          title: "Worksheets your way",
          body:
            "Pick a topic, set the difficulty, hit generate. Or upload an old favorite sheet—Dhi mirrors your teaching style, not some rigid corporate template.",
        },
        {
          title: "Quizzes of any scale",
          body:
            "A 3-minute warm-up, a quick pop quiz, or a full board exam review. You pick the coverage and the question count; Dhi handles the rest.",
        },
        {
          title: "Crystal-clear study notes",
          body:
            "Distilled, exam-ready notes students can actually digest the night before—in crisp Bangla or English, just the way you want.",
        },
        {
          title: "A patient practice partner",
          body:
            "Walks students through problems one by one. When they stumble, it drops thoughtful hints rather than spoiling the answer right away.",
        },
      ],
    },
    how: {
      eyebrow: "How it works",
      headLead: "From textbook pages",
      headAccent: "straight to desk-ready prints.",
      steps: [
        {
          k: "Upload a chapter or pick from the syllabus",
          v: "Drop your own materials or choose directly from NCTB chapters. Dhi indexes the concepts and tags them to curriculum goals seamlessly.",
        },
        {
          k: "Say what you need",
          v: "Worksheet, quiz, or concise notes—tailored from that exact chapter at your chosen length and difficulty.",
        },
        {
          k: "Fine-tune in a single prompt",
          v: "“Too tough”, “Add 3 word problems”—just say it naturally. Dhi updates only what you point out without resetting the rest.",
        },
        {
          k: "Print or share instantly",
          v: "Grab a ready-to-print PDF for class or assign it directly for self-paced student practice.",
        },
      ],
    },
    students: {
      eyebrow: "For students",
      headLead: "A reliable study guide,",
      headAccent: "especially when things get tricky.",
      body:
        "Not everyone has someone at home to explain a difficult concept again at 11 PM. Practice mode takes problems one by one, catches where thinking derails, and nudges students forward step by step.",
      cta: "Join as a student",
      quotes: [
        { k: "One step at a time.", v: "Single focused questions drawn straight from the topic." },
        { k: "Smart hints, no spoilers.", v: "Bite-sized clues that encourage thinking, not copying." },
        { k: "Deep explanations on demand.", v: "Step-by-step reasoning available whenever you tap." },
        { k: "Picks up where you left off.", v: "Progress stays saved for tomorrow's revision." },
      ],
    },
    close: {
      headLead: "Tomorrow's class materials,",
      headAccent: "sorted tonight.",
      sub: "Free to start. No card, no setup headache, zero learning curve.",
      primary: "Create free account",
      secondary: "I already have an account",
    },
    auth: {
    backHome: "Back to home",
    explore: "Explore the platform",
    signupCta: "Sign up",
    haveAccount: "Already have an account?",
    noAccount: "New here?",
    loginLink: "Log in",
    signupLink: "Create one",
    switchPrompt: "Not you? Log in as",
    or: "or",
    roleLabel: "I am a",
    submitLogin: "Log in",
    submitSignup: "Create account",
    working: "One moment",
    roleName: { student: "Student", teacher: "Teacher", admin: "Admin" },
    fields: {
      name: "Full name",
      namePlaceholder: "Ayesha Rahman",
      email: "Email",
      emailPlaceholder: "you@school.edu",
      password: "Password",
      passwordPlaceholder: "At least 6 characters",
      show: "Show password",
      hide: "Hide password",
      forgot: "Forgot password?",
      className: "Your class",
      classPlaceholder: "Choose your class",
      classLoading: "Loading classes",
      classUnavailable: "Class list unavailable",
    },
    student: {
      eyebrow: "Practice mode",
      title: "Student log in",
      lede: "Pick up where you stopped. One question at a time, and a hint whenever you get stuck.",
      points: [
        "Questions straight from your own chapter",
        "Hints first, answers only when you ask",
        "Tomorrow it remembers where you left off",
      ],
    },
    teacher: {
      eyebrow: "For teachers",
      title: "Teacher log in",
      lede: "Worksheets, quizzes and study notes for tomorrow's class, all in one place.",
    },
    admin: {
      eyebrow: "Admin console",
      title: "Admin log in",
      lede: "Curriculum, chapters and ingestion jobs. Restricted to platform administrators.",
      note: "Every action here is recorded against your account.",
    },
    signup: {
      eyebrow: "Free to start",
      title: "Create your account",
      lede: "No card, no setup, nothing to install. Pick who you are and start making class material.",
    },
    errors: {
      required: "Please fill in every field.",
      shortPassword: "Password needs at least 6 characters.",
      pickClass: "Please choose your class.",
      badCredentials: "That email and password do not match.",
      signupFailed: "Could not create the account. This email may already be registered.",
      offline: "Cannot reach the server right now. Please try again in a moment.",
      wrongRole: {
        student: "This is a student account. Please use the student log in.",
        teacher: "This is a teacher account. Please use the teacher log in.",
        admin: "This is an admin account. Please use the admin log in.",
      },
    },
  },
  app: {
    nav: {
      dashboard: "Dashboard",
      worksheet: "Generate Worksheet",
      quiz: "Quiz Generation",
      notes: "Study Note Generation",
      upload: "Custom Uploads (Optional)",
      chatbot: "Practice with Progga",
      profile: "Profile",
    },
    notif: {
      title: "Notifications",
      empty: "Nothing finished yet.",
      markRead: "Mark all read",
      failedSuffix: "failed",
      kinds: {
        worksheet: "Worksheet ready",
        quiz_topic: "Quiz ready",
        quiz_chapter: "Quiz ready",
        quiz_subject: "Quiz ready",
        chat_quiz: "Quiz ready",
        study_note: "Study note ready",
        refine: "Worksheet refined",
        seed: "Cache seed built",
        ingestion: "Chapter added to the curriculum",
      },
    },
    logout: "Log out",
    footer: "Dhi — Curriculum-aligned content for Bangladeshi classrooms",
    menu: "Menu",
    closeMenu: "Close menu",
  },
  footer: { rights: "All rights reserved.", signup: "Sign up" },
  };
  
  const bn = {
    brand: "ধী",
    slogans: {
      primary: "পড়াশোনা হোক সহজ, প্রস্তুতি আরও গোছানো।",
      secondary: "ক্লাসের প্রস্তুতি এবার এক মিনিটেই।",
      punchline: "প্রশ্ন বানানোর ক্লান্তি শেষ, ধী আছে আপনার সাথে।",
    },
    a11y: {
      toLight: "লাইট মোড চালু করুন",
      toDark: "ডার্ক মোড চালু করুন",
      toBangla: "বাংলায় দেখুন",
      toEnglish: "Switch language to English",
      primaryNav: "মূল মেনু",
      footerNav: "ফুটার মেনু",
      scrollDown: "ধী কী কী করতে পারে দেখুন",
      practiceList: "প্র্যাকটিস মোডের সুবিধাসমূহ",
    },
    nav: {
      craft: "কী কী পাবেন",
      how: "কীভাবে কাজ করে",
      students: "শিক্ষার্থীদের জন্য",
      login: "লগ ইন",
    },
    hero: {
      kicker: "জাতীয় শিক্ষাক্রমের সাথে পুরোপুরি মানানসই",
      titleLead: "যা ক্লাসে পড়াচ্ছেন,",
      titleAccent: "সেটাই ওদের মনের মতো ভাষায়।",
      lede:
        "যেকোনো চ্যাপ্টার থেকে ওয়ার্কশিট, কুইজ কিংবা নোট তৈরি করুন নিমিষেই। শুধু একটি বাক্যে জানিয়ে দিন কী চাই—পরের পিরিয়ড শুরুর আগেই ক্লাসের কনটেন্ট একদম রেডি।",
      primary: "শুরু করুন",
      secondary: "কীভাবে কাজ করে দেখুন",
      scroll: "নিচে দেখুন",
    },
    craft: {
      eyebrow: "কী কী তৈরি করা যায়",
      headLead: "যে কাজগুলো করার মতো সময় শিক্ষকের কখনোই থাকে না,",
      headAccent: "সেগুলোই হবে মিনিটখানেকের মধ্যে।",
      items: [
        {
          title: "ওয়ার্কশিট, আপনার নিজের ধাঁচে",
          body:
            "টপিক বেছে নিন, লেভেল নির্ধারণ করুন, বাকি কাজ ধী নিজে থেকেই করে দেবে। চাইলে আপনার পুরোনো কোনো শিট আপলোড করতে পারেন—বাঁধাধরা ছকে না ফেলে, এটি আপনার নিজস্ব ধারাতেই তৈরি হবে।",
        },
        {
          title: "প্রয়োজনমতো যেকোনো কুইজ",
          body:
            "ক্লাসের শুরুতে ৩ মিনিটের ওয়ার্ম-আপ কুইজ হোক কিংবা পরীক্ষার আগের পূর্ণাঙ্গ রিভিশন। কয়টি প্রশ্ন থাকবে এবং পরিধি কতটুকু হবে—সবই আপনার নিয়ন্ত্রণে।",
        },
        {
          title: "সহজ ও গোছানো স্টাডি নোট",
          body:
            "পরীক্ষার আগের রাতে রিভিশন দেওয়ার মতো করে সাজানো কনসেপ্ট নোট—সহজ বাংলা কিংবা প্রয়োজনমতো ইংরেজিতে।",
        },
        {
          title: "একটি সহায়ক প্র্যাকটিস পার্টনার",
          body:
            "শিক্ষার্থীরা একটি একটি করে সমস্যার সমাধান করে। কোথাও আটকে গেলে সরাসরি উত্তর না দিয়ে ছোট ছোট হিন্ট দিয়ে ওদের ভাবিয়ে তোলে।",
        },
      ],
    },
    how: {
      eyebrow: "কাজের ধাপগুলো",
      headLead: "বইয়ের পাতার চ্যাপ্টার থেকে",
      headAccent: "সরাসরি ক্লাসরুমের টেবিলে।",
      steps: [
        {
          k: "চ্যাপ্টার আপলোড করুন বা তালিকা থেকে বেছে নিন",
          v: "এনসিটিবি (NCTB) কারিকুলাম থেকে চ্যাপ্টার বেছে নিন কিংবা নিজের ফাইল আপলোড করুন। ধী নিজ থেকেই মূল বিষয়গুলো গুছিয়ে নেয়।",
        },
        {
          k: "বলে দিন কী প্রয়োজন",
          v: "ওয়ার্কশিট, কুইজ নাকি নোট—নির্দিষ্ট চ্যাপ্টারের ওপর আপনার চাহিদা অনুযায়ী আকার ও কাঠিন্য ঠিক করে নিন।",
        },
        {
          k: "এক লাইনেই পরিবর্তন করুন",
          v: "“প্রশ্নগুলো বেশি কঠিন লাগছে”, “আরও দুটি সমাধান দিন”—সহজ ভাষায় বলে দিন, শুধু ওই অংশটুকুই বদলে যাবে।",
        },
        {
          k: "প্রিন্ট নিন বা সরাসরি শেয়ার করুন",
          v: "কালকের ক্লাসের জন্য ঝটপট পিডিএফ নামিয়ে প্রিন্ট করে নিন, অথবা শিক্ষার্থীদের সরাসরি প্র্যাকটিস করার সুযোগ দিন।",
        },
      ],
    },
    students: {
      eyebrow: "শিক্ষার্থীদের জন্য",
      headLead: "পড়ার মাঝে আটকে গেলে,",
      headAccent: "পাশে থাকার এক নির্ভরযোগ্য সাথী।",
      body:
        "বাসায় ফিরে পড়া বুঝিয়ে দেওয়ার মতো মানুষ সবার থাকে না। ধী-এর প্র্যাকটিস মোডে প্রশ্ন আসে একটি একটি করে। ভুল হলে পুরো সমাধান না দিয়ে ছোট হিন্ট দিয়ে এগিয়ে দেয়—তা-ও নিজের ভাষায়, যেকোনো সময়।",
      cta: "শিক্ষার্থী হিসেবে যুক্ত হোন",
      quotes: [
        { k: "ধাপে ধাপে প্রশ্ন।", v: "টপিকের ওপর ভিত্তি করে একটি করে প্রশ্ন আসে।" },
        { k: "সরাসরি উত্তর নয়, হিন্ট।", v: "নিজ থেকে সমাধান করার জন্য ছোট ছোট ক্লু দেওয়া হয়।" },
        { k: "প্রয়োজনে বিস্তারিত ব্যাখ্যা।", v: "এক ক্লিকেই দেখে নেওয়া যায় পূর্ণাঙ্গ সমাধান।" },
        { k: "অসমাপ্ত সেশন মনে রাখে।", v: "পরের দিন আবার যেখান থেকে শেষ করেছিলেন সেখান থেকেই শুরু করুন।" },
      ],
    },
    close: {
      headLead: "আগামীকালের ক্লাসের প্রস্তুতি,",
      headAccent: "সেরে ফেলুন আজ রাতেই।",
      sub: "শুরু করা একদম ফ্রি। কোনো কার্ড লাগবে না, নেই কোনো সেটআপের ঝামেলা।",
      primary: "ফ্রি অ্যাকাউন্ট তৈরি করুন",
      secondary: "আগে থেকেই অ্যাকাউন্ট আছে",
    },
    auth: {
    backHome: "হোমে ফিরে যান",
    explore: "ঘুরে দেখুন",
    signupCta: "সাইন আপ",
    haveAccount: "আগে থেকেই অ্যাকাউন্ট আছে?",
    noAccount: "নতুন এসেছেন?",
    loginLink: "লগ ইন করুন",
    signupLink: "অ্যাকাউন্ট খুলুন",
    switchPrompt: "আপনি নন? লগ ইন করুন",
    or: "কিংবা",
    roleLabel: "আপনি কে",
    submitLogin: "লগ ইন",
    submitSignup: "অ্যাকাউন্ট তৈরি করুন",
    working: "এক সেকেন্ড",
    roleName: { student: "স্টুডেন্ট", teacher: "টিচার", admin: "অ্যাডমিন" },
    fields: {
      name: "পুরো নাম",
      namePlaceholder: "আয়েশা রহমান",
      email: "ইমেইল",
      emailPlaceholder: "you@school.edu",
      password: "পাসওয়ার্ড",
      passwordPlaceholder: "অন্তত ৬ অক্ষর",
      show: "পাসওয়ার্ড দেখুন",
      hide: "পাসওয়ার্ড লুকান",
      forgot: "পাসওয়ার্ড ভুলে গেছেন?",
      className: "আপনার ক্লাস",
      classPlaceholder: "কোন ক্লাসে পড়েন বেছে নিন",
      classLoading: "ক্লাসের লিস্ট আসছে",
      classUnavailable: "ক্লাসের লিস্ট আসছে না",
    },
    student: {
      eyebrow: "প্র্যাকটিস মোড",
      title: "স্টুডেন্ট লগ ইন",
      lede: "যেখানে থেমেছিলেন, সেখান থেকেই শুরু করুন। একটা একটা করে প্রশ্ন, আটকে গেলে হিন্ট।",
      points: [
        "প্রশ্ন আসে আপনার নিজের চ্যাপ্টার থেকেই",
        "আগে হিন্ট, উত্তর চাইলে তবেই উত্তর",
        "কাল আবার ঠিক ওখান থেকেই শুরু",
      ],
    },
    teacher: {
      eyebrow: "টিচারদের জন্য",
      title: "টিচার লগ ইন",
      lede: "কালকের ক্লাসের ওয়ার্কশিট, কুইজ আর নোট—সব এক জায়গাতেই।",
    },
    admin: {
      eyebrow: "অ্যাডমিন কনসোল",
      title: "অ্যাডমিন লগ ইন",
      lede: "কারিকুলাম, চ্যাপ্টার আর ইনজেশনের কাজ এখান থেকে দেখা যায়। শুধু অ্যাডমিনদের জন্য।",
      note: "এখানকার প্রতিটা কাজ আপনার অ্যাকাউন্টের নামে জমা থাকে।",
    },
    signup: {
      eyebrow: "শুরুটা ফ্রি",
      title: "অ্যাকাউন্ট খুলুন",
      lede: "কার্ড লাগবে না, সেটআপের ঝামেলা নেই। আপনি কে সেটা বেছে নিয়ে ক্লাসের কনটেন্ট বানানো শুরু করুন।",
    },
    errors: {
      required: "সব ঘর পূরণ করুন।",
      shortPassword: "পাসওয়ার্ড অন্তত ৬ অক্ষরের হতে হবে।",
      pickClass: "আপনি কোন ক্লাসে পড়েন সেটা বেছে নিন।",
      badCredentials: "ইমেইল আর পাসওয়ার্ড মিলছে না।",
      signupFailed: "অ্যাকাউন্ট তৈরি হলো না। এই ইমেইল দিয়ে হয়তো আগেই অ্যাকাউন্ট খোলা আছে।",
      offline: "সার্ভারে পৌঁছানো যাচ্ছে না। একটু পরে আবার চেষ্টা করুন।",
      wrongRole: {
        student: "এটা স্টুডেন্ট অ্যাকাউন্ট। স্টুডেন্ট লগ ইন দিয়ে ঢুকুন।",
        teacher: "এটা টিচার অ্যাকাউন্ট। টিচার লগ ইন দিয়ে ঢুকুন।",
        admin: "এটা অ্যাডমিন অ্যাকাউন্ট। অ্যাডমিন লগ ইন দিয়ে ঢুকুন।",
      },
    },
  },
  app: {
    nav: {
      dashboard: "ড্যাশবোর্ড",
      worksheet: "ওয়ার্কশিট তৈরি করুন",
      quiz: "কুইজ প্রস্তুত করুন",
      notes: "স্টাডি নোট তৈরি",
      upload: "নিজের মেটেরিয়াল আপলোড (ঐচ্ছিক)",
      chatbot: "প্রজ্ঞার সাথে প্র্যাকটিস",
      profile: "প্রোফাইল",
    },
    notif: {
      title: "নোটিফিকেশন",
      empty: "এখনো কিছু শেষ হয়নি।",
      markRead: "সব পড়া হয়েছে",
      failedSuffix: "ব্যর্থ",
      kinds: {
        worksheet: "ওয়ার্কশিট তৈরি হয়েছে",
        quiz_topic: "কুইজ তৈরি হয়েছে",
        quiz_chapter: "কুইজ তৈরি হয়েছে",
        quiz_subject: "কুইজ তৈরি হয়েছে",
        chat_quiz: "কুইজ তৈরি হয়েছে",
        study_note: "স্টাডি নোট তৈরি হয়েছে",
        refine: "ওয়ার্কশিট রিফাইন হয়েছে",
        seed: "ক্যাশ সিড তৈরি হয়েছে",
        ingestion: "চ্যাপ্টার কারিকুলামে যুক্ত হয়েছে",
      },
    },
    logout: "লগ আউট",
    footer: "ধী — জাতীয় শিক্ষাক্রমের আলোকে তৈরি ক্লাসরুম সহায়ক প্ল্যাটফর্ম",
    menu: "মেনু",
    closeMenu: "মেনু বন্ধ করুন",
  },
  footer: { rights: "সর্বস্বত্ব সংরক্ষিত।", signup: "সাইন আপ" },
  };
  
  export const STRINGS = { bn, en };