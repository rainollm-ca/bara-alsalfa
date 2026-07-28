import type { LocalizedText } from "../types";

export type ActionPrompt = {
  readonly id: string;
  readonly text: Readonly<LocalizedText>;
  readonly categoryId?: string;
};

export type ForbiddenWordPrompt = ActionPrompt & {
  readonly forbidden: readonly Readonly<LocalizedText>[];
};

type Seed = readonly [ar: string, en: string, categoryAr: string, categoryEn: string];

const SEEDS: readonly Seed[] = [
  ["أسد", "Lion", "حيوان", "animal"], ["طائرة", "Airplane", "سفر", "travel"],
  ["طبيب", "Doctor", "مهنة", "job"], ["بيتزا", "Pizza", "طعام", "food"],
  ["هاتف", "Phone", "تقنية", "technology"], ["مطر", "Rain", "طقس", "weather"],
  ["كرة القدم", "Soccer", "رياضة", "sport"], ["قمر", "Moon", "فضاء", "space"],
  ["عازف غيتار", "Guitarist", "موسيقى", "music"], ["روبوت", "Robot", "آلة", "machine"],
  ["قرد", "Monkey", "حيوان", "animal"], ["قطار", "Train", "سفر", "travel"],
  ["معلم", "Teacher", "مهنة", "job"], ["آيس كريم", "Ice cream", "طعام", "food"],
  ["حاسوب", "Computer", "تقنية", "technology"], ["ثلج", "Snow", "طقس", "weather"],
  ["كرة السلة", "Basketball", "رياضة", "sport"], ["رائد فضاء", "Astronaut", "فضاء", "space"],
  ["طبال", "Drummer", "موسيقى", "music"], ["كاميرا", "Camera", "جهاز", "device"],
  ["بطريق", "Penguin", "حيوان", "animal"], ["سفينة", "Ship", "سفر", "travel"],
  ["طباخ", "Chef", "مهنة", "job"], ["فشار", "Popcorn", "طعام", "food"],
  ["لعبة فيديو", "Video game", "تقنية", "technology"], ["رياح", "Wind", "طقس", "weather"],
  ["سباحة", "Swimming", "رياضة", "sport"], ["كوكب", "Planet", "فضاء", "space"],
  ["مغنٍ", "Singer", "موسيقى", "music"], ["مصباح", "Lamp", "غرض", "object"],
  ["زرافة", "Giraffe", "حيوان", "animal"], ["سيارة أجرة", "Taxi", "سفر", "travel"],
  ["شرطي", "Police officer", "مهنة", "job"], ["كعكة", "Cake", "طعام", "food"],
  ["لوحة مفاتيح", "Keyboard", "تقنية", "technology"], ["عاصفة", "Storm", "طقس", "weather"],
  ["تنس", "Tennis", "رياضة", "sport"], ["نجم", "Star", "فضاء", "space"],
  ["راقص", "Dancer", "فن", "art"], ["مظلة", "Umbrella", "غرض", "object"],
  ["فيل", "Elephant", "حيوان", "animal"], ["دراجة", "Bicycle", "سفر", "travel"],
  ["رجل إطفاء", "Firefighter", "مهنة", "job"], ["ساندويتش", "Sandwich", "طعام", "food"],
  ["سماعات", "Headphones", "تقنية", "technology"], ["شمس", "Sun", "طقس", "weather"],
  ["ملاكمة", "Boxing", "رياضة", "sport"], ["صاروخ", "Rocket", "فضاء", "space"],
  ["رسام", "Painter", "فن", "art"], ["ساعة منبهة", "Alarm clock", "غرض", "object"],
  ["تمساح", "Crocodile", "حيوان", "animal"], ["حافلة", "Bus", "سفر", "travel"],
  ["مصور", "Photographer", "مهنة", "job"], ["بطيخ", "Watermelon", "طعام", "food"],
  ["جهاز تحكم", "Remote control", "تقنية", "technology"], ["قوس قزح", "Rainbow", "طقس", "weather"],
  ["تزلج", "Skiing", "رياضة", "sport"], ["مذنب", "Comet", "فضاء", "space"],
  ["ساحر", "Magician", "عرض", "performance"], ["مكنسة كهربائية", "Vacuum cleaner", "غرض", "object"],
];

const cloneText = (ar: string, en: string): Readonly<LocalizedText> => ({ ar, en });

export const CONTENT_CATEGORY_LABELS = {
  "arab-islamic-civilization": { ar: "العرب والحضارة الإسلامية", en: "Arab & Islamic civilization" },
  "world-figures": { ar: "شخصيات عالمية", en: "World figures" },
  "fictional-family": { ar: "عائلية وخيالية", en: "Family & fictional" },
  "sports-entertainment": { ar: "رياضة وترفيه", en: "Sports & entertainment" },
  "stories-heroes": { ar: "قصص وأبطال", en: "Stories & heroes" },
  "islamic-knowledge": { ar: "معرفة إسلامية", en: "Islamic knowledge" },
  "prophets-messengers": { ar: "الأنبياء والرسل", en: "Prophets & messengers" },
  "seerah-companions": { ar: "السيرة والصحابة", en: "Seerah & companions" },
  "quran-themes-stories": { ar: "موضوعات وقصص القرآن", en: "Quran themes & stories" },
  "everyday-family": { ar: "الحياة اليومية والعائلة", en: "Everyday life & family" },
  "food-places": { ar: "طعام وأماكن", en: "Food & places" },
  "nature-science": { ar: "طبيعة وعلوم", en: "Nature & science" },
  "sports": { ar: "رياضة", en: "Sports" },
  "professions": { ar: "مهن", en: "Professions" },
  "science-technology": { ar: "علوم وتقنية", en: "Science & technology" },
  "performance": { ar: "خيال وتمثيل", en: "Imagination & performance" },
  "word-play": { ar: "لغة وكلمات", en: "Words & language" },
} as const;

const IDENTITY_SEEDS: readonly (readonly [string, string])[] = [
  ["ابن سينا", "Ibn Sina"], ["الخوارزمي", "Al-Khwarizmi"],
  ["ابن الهيثم", "Ibn al-Haytham"], ["ابن بطوطة", "Ibn Battuta"],
  ["صلاح الدين الأيوبي", "Salah al-Din"], ["نجيب محفوظ", "Naguib Mahfouz"],
  ["أحمد زويل", "Ahmed Zewail"], ["سميرة موسى", "Sameera Moussa"],
  ["غسان كنفاني", "Ghassan Kanafani"], ["محمود درويش", "Mahmoud Darwish"],
  ["محمد صلاح", "Mohamed Salah"], ["هيفاء المنصور", "Haifaa al-Mansour"],
  ["زها حديد", "Zaha Hadid"], ["عمر الشريف", "Omar Sharif"],
  ["سميحة أيوب", "Samiha Ayoub"], ["دريد لحام", "Duraid Lahham"],
  ["ألبرت أينشتاين", "Albert Einstein"], ["كليوباترا", "Cleopatra"],
  ["ويليام شكسبير", "William Shakespeare"], ["ليونيل ميسي", "Lionel Messi"],
  ["ماري كوري", "Marie Curie"], ["شارلوك هولمز", "Sherlock Holmes"],
  ["سندريلا", "Cinderella"], ["سوبرمان", "Superman"],
  ["باتمان", "Batman"], ["هاري بوتر", "Harry Potter"],
  ["مستر بين", "Mr. Bean"], ["مايكل جاكسون", "Michael Jackson"],
  ["أديل", "Adele"], ["أم كلثوم", "Umm Kulthum"],
  ["فيروز", "Fairuz"], ["محمد علي", "Muhammad Ali"],
  ["سيرينا ويليامز", "Serena Williams"], ["كريستيانو رونالدو", "Cristiano Ronaldo"],
  ["نيل أرمسترونغ", "Neil Armstrong"], ["إسحاق نيوتن", "Isaac Newton"],
  ["بابلو بيكاسو", "Pablo Picasso"], ["فنسنت فان غوخ", "Vincent van Gogh"],
  ["ستيف جوبز", "Steve Jobs"], ["والت ديزني", "Walt Disney"],
  ["جاكي شان", "Jackie Chan"], ["توم وجيري", "Tom and Jerry"],
  ["ميكي ماوس", "Mickey Mouse"], ["سبونج بوب", "SpongeBob"],
  ["شريك", "Shrek"], ["إلسا", "Elsa"],
  ["علاء الدين", "Aladdin"], ["بيتر بان", "Peter Pan"],
  ["روبن هود", "Robin Hood"], ["طرزان", "Tarzan"],
  ["دراكولا", "Dracula"], ["هرقل", "Hercules"],
  ["يوليوس قيصر", "Julius Caesar"], ["نابليون", "Napoleon"],
  ["غاندي", "Gandhi"], ["نيلسون مانديلا", "Nelson Mandela"],
  ["مارتن لوثر كينغ", "Martin Luther King Jr."], ["إلفيس بريسلي", "Elvis Presley"],
  ["تايلور سويفت", "Taylor Swift"], ["بيونسيه", "Beyoncé"],
  ["ليوناردو دي كابريو", "Leonardo DiCaprio"], ["تشارلي تشابلن", "Charlie Chaplin"],
  ["مستر إنكريدبل", "Mr. Incredible"], ["وودي", "Woody"],
  ["باز يطير", "Buzz Lightyear"], ["سيمبا", "Simba"],
  ["نيمو", "Nemo"], ["بيكاتشو", "Pikachu"],
  ["سونيك", "Sonic"], ["ماريو", "Mario"],
  ["وندر وومان", "Wonder Woman"], ["سبايدرمان", "Spider-Man"],
  ["الرجل الحديدي", "Iron Man"], ["كابتن أمريكا", "Captain America"],
  ["الأميرة ياسمين", "Princess Jasmine"], ["ذات الرداء الأحمر", "Little Red Riding Hood"],
  ["آدم عليه السلام", "Prophet Adam"], ["نوح عليه السلام", "Prophet Noah"],
  ["إبراهيم عليه السلام", "Prophet Abraham"], ["موسى عليه السلام", "Prophet Moses"],
  ["عيسى عليه السلام", "Prophet Jesus"],
  ["أبو بكر الصديق رضي الله عنه", "Abu Bakr al-Siddiq"],
  ["عمر بن الخطاب رضي الله عنه", "Umar ibn al-Khattab"],
  ["عثمان بن عفان رضي الله عنه", "Uthman ibn Affan"],
  ["علي بن أبي طالب رضي الله عنه", "Ali ibn Abi Talib"],
  ["خديجة بنت خويلد رضي الله عنها", "Khadijah bint Khuwaylid"],
  ["أصحاب الكهف", "The People of the Cave"],
  ["أصحاب الفيل", "The People of the Elephant"],
  ["ذو القرنين", "Dhul-Qarnayn"],
  ["قارون", "Qarun"], ["لقمان الحكيم", "Luqman the Wise"],
];

const CHARADES_SEEDS: readonly (readonly [string, string])[] = [
  ["فتح هدية مفاجئة", "Opening a surprise gift"], ["المشي على حبل مشدود", "Walking a tightrope"],
  ["إطفاء شموع عيد الميلاد", "Blowing out birthday candles"], ["صيد سمكة كبيرة", "Catching a huge fish"],
  ["ركوب أفعوانية", "Riding a roller coaster"], ["البحث عن كنز", "Searching for treasure"],
  ["الهروب من نحلة", "Escaping from a bee"], ["بناء قلعة رملية", "Building a sandcastle"],
  ["غسل سيارة", "Washing a car"], ["تسلق شجرة", "Climbing a tree"],
  ["لف هدية", "Wrapping a present"], ["خبز فطيرة", "Baking a pie"],
  ["التقاط صورة جماعية", "Taking a group photo"], ["إضاعة الطريق", "Getting lost"],
  ["نفخ بالون", "Inflating a balloon"], ["حل مكعب روبيك", "Solving a Rubik's cube"],
  ["تعلم التزلج", "Learning to skateboard"], ["تجربة طعام حار", "Tasting spicy food"],
  ["حمل حقيبة ثقيلة", "Carrying a heavy suitcase"], ["الاستيقاظ متأخراً", "Waking up late"],
  ["إصلاح صنبور يتسرب", "Fixing a leaky faucet"], ["قراءة خريطة", "Reading a map"],
  ["العزف على كمان", "Playing a violin"], ["قص الشعر", "Getting a haircut"],
  ["زراعة زهرة", "Planting a flower"], ["تمشية كلب", "Walking a dog"],
  ["التقاط كرة", "Catching a ball"], ["كي قميص", "Ironing a shirt"],
  ["التحدث في الهاتف", "Talking on the phone"], ["ركوب حصان", "Riding a horse"],
  ["فتح مظلة في الريح", "Opening an umbrella in the wind"], ["تزيين شجرة", "Decorating a tree"],
  ["الاستماع عند الباب", "Listening at a door"], ["حزم حقيبة سفر", "Packing for a trip"],
  ["طلاء جدار", "Painting a wall"], ["ربط ربطة عنق", "Tying a necktie"],
  ["حلب بقرة", "Milking a cow"], ["قيادة قارب", "Steering a boat"],
  ["تقديم عرض سحري", "Performing a magic show"], ["إطعام طفل", "Feeding a baby"],
  ["الوقوف على الجليد", "Balancing on ice"], ["الركض تحت المطر", "Running through rain"],
  ["نفخ فقاعات الصابون", "Blowing soap bubbles"], ["العثور على عملة", "Finding a coin"],
  ["محاولة فتح مرطبان", "Trying to open a jar"], ["تركيب خيمة", "Pitching a tent"],
  ["تذوق ليمونة", "Tasting a lemon"], ["مراقبة الطيور", "Birdwatching"],
  ["الكتابة على آلة كاتبة", "Typing on a typewriter"], ["تنظيف نافذة", "Cleaning a window"],
  ["ركوب مصعد مزدحم", "Riding a crowded elevator"], ["ملاحقة قبعة طائرة", "Chasing a flying hat"],
  ["نحت تمثال", "Sculpting a statue"], ["إجراء مقابلة عمل", "Attending a job interview"],
  ["حفر حفرة", "Digging a hole"], ["إمساك عطسة", "Holding back a sneeze"],
  ["قيادة سيارة سباق", "Driving a race car"], ["قراءة قصة مخيفة", "Reading a scary story"],
  ["اكتشاف فأر", "Spotting a mouse"], ["عبور نهر", "Crossing a river"],
];

const FICTIONAL_IDENTITIES = new Set([
  "Sherlock Holmes", "Cinderella", "Superman", "Batman", "Harry Potter", "Tom and Jerry",
  "Mickey Mouse", "SpongeBob", "Shrek", "Elsa", "Aladdin", "Peter Pan", "Pikachu",
  "Sonic", "Mario", "Wonder Woman", "Spider-Man", "Iron Man", "Captain America",
  "Princess Jasmine", "Little Red Riding Hood", "Mr. Incredible", "Woody", "Buzz Lightyear",
  "Simba", "Nemo",
]);
const STORY_IDENTITIES = new Set(["Robin Hood", "Tarzan", "Dracula", "Hercules"]);
const PROPHET_IDENTITIES = new Set([
  "Prophet Adam", "Prophet Noah", "Prophet Abraham", "Prophet Moses", "Prophet Jesus",
]);
const SEERAH_COMPANION_IDENTITIES = new Set([
  "Abu Bakr al-Siddiq", "Umar ibn al-Khattab", "Uthman ibn Affan", "Ali ibn Abi Talib",
  "Khadijah bint Khuwaylid",
]);
const QURAN_STORY_IDENTITIES = new Set([
  "The People of the Cave", "The People of the Elephant", "Dhul-Qarnayn", "Qarun",
  "Luqman the Wise",
]);
const SPORTS_ENTERTAINMENT_IDENTITIES = new Set([
  "Lionel Messi", "Mohamed Salah", "Muhammad Ali", "Serena Williams", "Cristiano Ronaldo",
  "Umm Kulthum", "Fairuz", "Michael Jackson", "Adele", "Elvis Presley", "Taylor Swift",
  "Beyoncé", "Leonardo DiCaprio", "Charlie Chaplin", "Jackie Chan", "Mr. Bean",
  "Omar Sharif", "Samiha Ayoub", "Duraid Lahham",
]);

function identityCategory(en: string, index: number) {
  if (PROPHET_IDENTITIES.has(en)) return "prophets-messengers";
  if (SEERAH_COMPANION_IDENTITIES.has(en)) return "seerah-companions";
  if (QURAN_STORY_IDENTITIES.has(en)) return "quran-themes-stories";
  if (index < 16) return "arab-islamic-civilization";
  if (STORY_IDENTITIES.has(en)) return "stories-heroes";
  if (FICTIONAL_IDENTITIES.has(en)) return "fictional-family";
  if (SPORTS_ENTERTAINMENT_IDENTITIES.has(en)) return "sports-entertainment";
  return "world-figures";
}

function charadesCategory(en: string) {
  if (/violin|photo|magic|story|sculpt|typewriter/i.test(en)) return "performance";
  if (/car|map|trip|horse|boat|river|elevator|race/i.test(en)) return "everyday-family";
  if (/ball|skate|tightrope|ice/i.test(en)) return "sports";
  if (/interview|faucet|haircut|paint|window/i.test(en)) return "professions";
  return "everyday-family";
}

function rapidCategory(en: string, index: number) {
  if ([0, 3, 5, 6, 7].includes(index)) return "quran-themes-stories";
  if ([1, 8, 9, 10].includes(index)) return "prophets-messengers";
  if ([2, 11, 12, 13, 14].includes(index)) return "seerah-companions";
  if (index === 4) return "arab-islamic-civilization";
  if (/letter|words|days|numbers/i.test(en)) return "word-play";
  if (/planet|animal|bird|sky|green|wood|plant|body/i.test(en)) return "nature-science";
  if (/sport|ball|boxing|swimming/i.test(en)) return "sports";
  if (/Arab|capital|cities|countries/i.test(en)) return "food-places";
  return "everyday-family";
}

const FORBIDDEN_CATEGORY_MAP: Record<string, string> = {
  animal: "nature-science", travel: "everyday-family", job: "professions",
  food: "food-places", technology: "science-technology", weather: "nature-science",
  sport: "sports", space: "nature-science", music: "performance", machine: "science-technology",
  device: "science-technology", art: "performance", object: "everyday-family", performance: "performance",
};

const RAPID_SEEDS: readonly (readonly [string, string])[] = [
  ["اذكر ثلاثة من أسماء سور القرآن", "Name three surahs of the Quran"],
  ["اذكر ثلاثة أنبياء وردت أسماؤهم في القرآن", "Name three prophets mentioned in the Quran"],
  ["سمّ مدينتين ارتبطتا بالسيرة النبوية", "Name two cities connected to the Seerah"],
  ["اذكر ثلاث قيم يحث عليها الإسلام", "Name three values encouraged in Islam"],
  ["سمّ ثلاثة علماء من الحضارة الإسلامية", "Name three scholars from Islamic civilization"],
  ["اذكر ثلاث قصص لأنبياء وردت في القرآن", "Name three prophetic stories found in the Quran"],
  ["سمّ ثلاثة حيوانات ورد ذكرها في القرآن", "Name three animals mentioned in the Quran"],
  ["اذكر ثلاثة موضوعات متكررة في القرآن", "Name three recurring themes in the Quran"],
  ["سمّ ثلاثة رسل من أولي العزم", "Name three of the resolute messengers"],
  ["اذكر ثلاثة أنبياء عاشوا قبل عيسى عليه السلام", "Name three prophets who lived before Jesus"],
  ["سمّ نبيين ارتبطت قصتهما بمصر", "Name two prophets whose stories are connected to Egypt"],
  ["اذكر ثلاثة من كبار الصحابة", "Name three well-known companions"],
  ["سمّ حدثين من أحداث السيرة قبل الهجرة", "Name two Seerah events before the Hijrah"],
  ["اذكر ثلاثة أماكن ارتبطت بالسيرة النبوية", "Name three places connected to the Seerah"],
  ["سمّ اثنين من كتّاب الوحي", "Name two scribes of revelation"],
  ["اذكر ثلاث دول تبدأ بحرف الميم", "Identify three countries beginning with M"],
  ["عدّد أربعة أشياء في المطبخ", "Give four things found in a kitchen"],
  ["ما لونان يصنعان اللون الأخضر؟", "Which two colors make green?"],
  ["سمّ ثلاثة حيوانات تعيش في الماء", "Name three animals that live in water"],
  ["اذكر وظيفتين تعملان ليلاً", "Name two jobs performed at night"],
  ["ما ثلاثة أشياء تأخذها إلى الشاطئ؟", "What three things would you take to the beach?"],
  ["سمّ رياضتين تستخدمان كرة", "Name two sports played with a ball"],
  ["اذكر ثلاث فواكه حمراء", "List three red fruits"],
  ["ما شيئان يصدران صوتاً عالياً؟", "Name two things that make a loud noise"],
  ["سمّ ثلاثة كواكب", "Name three planets"],
  ["أكمل بسرعة: واحد، اثنان، ثلاثة، ماذا بعد؟", "Quickly continue: one, two, three, what comes next?"],
  ["اذكر ثلاث كلمات تتعلق بالشتاء", "Name three words related to winter"],
  ["ما شيئان يمكنك قراءتهما؟", "Name two things you can read"],
  ["سمّ ثلاثة أبطال خارقين", "Name three superheroes"],
  ["اذكر أربعة ألوان", "List four colors"],
  ["ما ثلاث وجبات تبدأ بحرف الباء؟", "Name three foods beginning with B"],
  ["سمّ عاصمتين عربيتين", "Name two Arab capital cities"],
  ["اذكر ثلاثة أشياء تطير", "List three things that fly"],
  ["ما شيئان تحتاجهما للتخييم؟", "Name two things needed for camping"],
  ["سمّ ثلاثة آلات موسيقية", "Name three musical instruments"],
  ["اذكر أربعة أيام من الأسبوع", "Recite four days of the week"],
  ["ما ثلاثة أشياء لها عجلات؟", "Name three things with wheels"],
  ["سمّ حيوانين مخططين", "Name two striped animals"],
  ["اذكر ثلاث حلويات", "List three desserts"],
  ["ما شيئان تجدهما في مدرسة؟", "Name two things found in a school"],
  ["سمّ ثلاثة أفلام رسوم متحركة", "Name three animated movies"],
  ["اذكر أربع مهن", "List four professions"],
  ["ما ثلاث كلمات تبدأ بحرف السين؟", "Name three words beginning with S"],
  ["سمّ بلدين فيهما صحراء", "Name two countries with deserts"],
  ["اذكر ثلاثة أشياء باردة", "List three cold things"],
  ["ما شيئان يضيئان؟", "Name two things that shine"],
  ["سمّ ثلاثة أنواع من الطيور", "Name three kinds of birds"],
  ["اذكر أربعة أرقام زوجية", "List four even numbers"],
  ["ما ثلاث أدوات يستخدمها الطبيب؟", "Name three tools a doctor uses"],
  ["سمّ رياضتين فرديتين", "Name two individual sports"],
  ["اذكر ثلاثة أشياء مستديرة", "List three round things"],
  ["ما شيئان يمكن زرعهما؟", "Name two things you can plant"],
  ["سمّ ثلاثة مشروبات ساخنة", "Name three hot drinks"],
  ["اذكر أربع مدن", "List four cities"],
  ["ما ثلاثة أشياء تستخدم الكهرباء؟", "Name three things powered by electricity"],
  ["سمّ حيوانين لهما قرون", "Name two animals with horns"],
  ["اذكر ثلاثة أشياء في حقيبة سفر", "List three things in a suitcase"],
  ["ما شيئان يمكن رسمهما؟", "Name two things you can draw"],
  ["سمّ ثلاثة أطعمة دائرية", "Name three round foods"],
  ["اذكر أربعة أعضاء في الجسم", "List four body parts"],
  ["ما ثلاثة أشياء تراها في السماء؟", "Name three things seen in the sky"],
  ["سمّ بلدين جزيرتين", "Name two island countries"],
  ["اذكر ثلاثة أصوات حيوانات", "Make or name three animal sounds"],
  ["ما شيئان يمكن فتحهما بمفتاح؟", "Name two things opened with a key"],
  ["سمّ ثلاثة أشياء مصنوعة من الخشب", "Name three things made of wood"],
  ["اذكر أربعة أسماء تبدأ بحرف الألف", "List four names beginning with A"],
  ["ما ثلاثة أشياء تفعلها قبل النوم؟", "Name three things you do before bed"],
  ["سمّ رياضتين شتويتين", "Name two winter sports"],
  ["اذكر ثلاثة توابل", "List three spices"],
  ["ما شيئان يمكن نفخهما؟", "Name two things you can inflate"],
  ["سمّ ثلاثة أشياء خضراء", "Name three green things"],
  ["اذكر أربع وسائل نقل", "List four modes of transport"],
  ["ما ثلاثة أشياء تحتاج إلى بطارية؟", "Name three things that need a battery"],
  ["سمّ حيوانين بطيئين", "Name two slow animals"],
  ["اذكر ثلاثة أسباب للاحتفال", "List three reasons to celebrate"],
];

const forbiddenByCategory: Readonly<
  Record<string, readonly [Readonly<LocalizedText>, Readonly<LocalizedText>, Readonly<LocalizedText>]>
> = {
  animal: [cloneText("حيوان", "animal"), cloneText("حديقة", "zoo"), cloneText("بري", "wild")],
  travel: [cloneText("سفر", "travel"), cloneText("رحلة", "trip"), cloneText("طريق", "route")],
  job: [cloneText("مهنة", "job"), cloneText("عمل", "work"), cloneText("موظف", "worker")],
  food: [cloneText("طعام", "food"), cloneText("أكل", "eat"), cloneText("مطبخ", "kitchen")],
  technology: [cloneText("تقنية", "technology"), cloneText("إلكتروني", "electronic"), cloneText("جهاز", "device")],
  weather: [cloneText("طقس", "weather"), cloneText("سماء", "sky"), cloneText("درجة الحرارة", "temperature")],
  sport: [cloneText("رياضة", "sport"), cloneText("فريق", "team"), cloneText("لاعب", "player")],
  space: [cloneText("فضاء", "space"), cloneText("سماء", "sky"), cloneText("ناسا", "NASA")],
  music: [cloneText("موسيقى", "music"), cloneText("أغنية", "song"), cloneText("لحن", "melody")],
  machine: [cloneText("آلة", "machine"), cloneText("معدن", "metal"), cloneText("محرك", "motor")],
  device: [cloneText("جهاز", "device"), cloneText("زر", "button"), cloneText("إلكتروني", "electronic")],
  art: [cloneText("فن", "art"), cloneText("إبداع", "creative"), cloneText("عرض", "show")],
  object: [cloneText("غرض", "object"), cloneText("منزل", "home"), cloneText("يستخدم", "use")],
  performance: [cloneText("عرض", "show"), cloneText("جمهور", "audience"), cloneText("مسرح", "stage")],
};

const TARGET_CLUES: readonly Readonly<LocalizedText>[] = [
  cloneText("زئير", "roar"), cloneText("أجنحة", "wings"), cloneText("مستشفى", "hospital"),
  cloneText("جبن", "cheese"), cloneText("مكالمة", "call"), cloneText("مظلة", "umbrella"),
  cloneText("هدف", "goal"), cloneText("ليل", "night"), cloneText("أوتار", "strings"),
  cloneText("مبرمج", "programmed"), cloneText("موز", "banana"), cloneText("قضبان", "rails"),
  cloneText("مدرسة", "school"), cloneText("بارد", "cold"), cloneText("شاشة", "screen"),
  cloneText("أبيض", "white"), cloneText("سلة", "hoop"), cloneText("بدلة", "suit"),
  cloneText("عصي", "sticks"), cloneText("صورة", "photo"), cloneText("القطب الجنوبي", "Antarctica"),
  cloneText("محيط", "ocean"), cloneText("وصفة", "recipe"), cloneText("سينما", "cinema"),
  cloneText("وحدة تحكم", "controller"), cloneText("تهب", "blow"), cloneText("مسبح", "pool"),
  cloneText("مدار", "orbit"), cloneText("صوت", "voice"), cloneText("ضوء", "light"),
  cloneText("رقبة", "neck"), cloneText("أجرة", "fare"), cloneText("شارة", "badge"),
  cloneText("عيد ميلاد", "birthday"), cloneText("كتابة", "typing"), cloneText("رعد", "thunder"),
  cloneText("مضرب", "racket"), cloneText("يلمع", "shine"), cloneText("حركة", "movement"),
  cloneText("مبلل", "wet"), cloneText("خرطوم", "trunk"), cloneText("دواسات", "pedals"),
  cloneText("خرطوم ماء", "hose"), cloneText("خبز", "bread"), cloneText("أذنان", "ears"),
  cloneText("حار", "hot"), cloneText("قفازات", "gloves"), cloneText("إطلاق", "launch"),
  cloneText("لوحة رسم", "canvas"), cloneText("استيقاظ", "wake"), cloneText("أسنان", "teeth"),
  cloneText("محطة", "stop"), cloneText("عدسة", "lens"), cloneText("بذور", "seeds"),
  cloneText("تلفاز", "television"), cloneText("ألوان", "colors"), cloneText("جبل", "mountain"),
  cloneText("ذيل", "tail"), cloneText("خدعة", "trick"), cloneText("غبار", "dust"),
];

export const CHARADES_PROMPTS: readonly ActionPrompt[] = CHARADES_SEEDS.map(
  ([ar, en], index) => ({
    id: `charades-${String(index + 1).padStart(3, "0")}`,
    text: cloneText(ar, en),
    categoryId: charadesCategory(en),
  }),
);

export const WHO_AM_I_PROMPTS: readonly ActionPrompt[] = IDENTITY_SEEDS.map(
  ([ar, en], index) => ({
    id: `identity-${String(index + 1).padStart(3, "0")}`,
    text: cloneText(ar, en),
    categoryId: identityCategory(en, index),
  }),
);

export const RAPID_FIRE_PROMPTS: readonly ActionPrompt[] = RAPID_SEEDS.map(
  ([ar, en], index) => ({
    id: `rapid-fire-${String(index + 1).padStart(3, "0")}`,
    text: cloneText(ar, en),
    categoryId: rapidCategory(en, index),
  }),
);

export const FORBIDDEN_WORD_PROMPTS: readonly ForbiddenWordPrompt[] = SEEDS.map(
  ([ar, en, categoryAr, categoryEn], index) => ({
    id: `forbidden-${String(index + 1).padStart(3, "0")}`,
    text: cloneText(ar, en),
    categoryId: FORBIDDEN_CATEGORY_MAP[categoryEn] ?? "everyday-family",
    forbidden: (() => {
      const related =
        forbiddenByCategory[categoryEn] ??
        [cloneText(categoryAr, categoryEn), cloneText("وصف", "describe"), cloneText("كلمة", "word")];
      return [
        { ...related[0] },
        { ...related[1] },
        { ...TARGET_CLUES[index] },
      ];
    })(),
  }),
);
