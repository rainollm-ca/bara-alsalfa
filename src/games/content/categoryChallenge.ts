import type { LocalizedText } from "../types";

export type CategoryChallengeQuestion = {
  readonly id: string;
  readonly question: Readonly<LocalizedText>;
  readonly answer: Readonly<LocalizedText>;
};

export type CategoryChallengeCategory = {
  readonly id: string;
  readonly title: Readonly<LocalizedText>;
  readonly questions: readonly CategoryChallengeQuestion[];
};

type QuestionSeed = [questionAr: string, questionEn: string, answerAr: string, answerEn: string];

const makeQuestions = (
  categoryId: string,
  seeds: QuestionSeed[],
): readonly CategoryChallengeQuestion[] =>
  seeds.map(([questionAr, questionEn, answerAr, answerEn], index) => ({
    id: `${categoryId}-${String(index + 1).padStart(2, "0")}`,
    question: { ar: questionAr, en: questionEn },
    answer: { ar: answerAr, en: answerEn },
  }));

const category = (
  id: string,
  titleAr: string,
  titleEn: string,
  seeds: QuestionSeed[],
): CategoryChallengeCategory => ({
  id,
  title: { ar: titleAr, en: titleEn },
  questions: makeQuestions(id, seeds),
});

export const CATEGORY_CHALLENGE_CATEGORIES: readonly CategoryChallengeCategory[] = [
  category("world-geography", "جغرافيا العالم", "World Geography", [
    ["ما عاصمة اليابان؟", "What is the capital of Japan?", "طوكيو", "Tokyo"],
    ["ما أطول نهر في أمريكا الجنوبية؟", "What is the longest river in South America?", "نهر الأمازون", "The Amazon River"],
    ["في أي قارة تقع كينيا؟", "On which continent is Kenya?", "أفريقيا", "Africa"],
    ["ما أكبر محيط في العالم؟", "What is the world's largest ocean?", "المحيط الهادئ", "The Pacific Ocean"],
    ["ما الدولة التي تشبه الحذاء على الخريطة؟", "Which country resembles a boot on the map?", "إيطاليا", "Italy"],
    ["ما عاصمة كندا؟", "What is the capital of Canada?", "أوتاوا", "Ottawa"],
    ["أي صحراء تغطي معظم شمال أفريقيا؟", "Which desert covers much of North Africa?", "الصحراء الكبرى", "The Sahara"],
    ["ما أصغر قارة؟", "What is the smallest continent?", "أستراليا", "Australia"],
    ["في أي دولة تقع ماتشو بيتشو؟", "In which country is Machu Picchu?", "بيرو", "Peru"],
    ["ما البحر الذي يفصل أوروبا عن أفريقيا؟", "Which sea separates Europe and Africa?", "البحر المتوسط", "The Mediterranean Sea"],
  ]),
  category("science", "علوم", "Science", [
    ["ما الكوكب الأحمر؟", "Which planet is known as the Red Planet?", "المريخ", "Mars"],
    ["ما الرمز الكيميائي للذهب؟", "What is the chemical symbol for gold?", "Au", "Au"],
    ["كم عدد عظام جسم الإنسان البالغ؟", "How many bones are in an adult human body?", "206", "206"],
    ["ما الغاز الذي تمتصه النباتات؟", "Which gas do plants absorb?", "ثاني أكسيد الكربون", "Carbon dioxide"],
    ["ما أقسى مادة طبيعية؟", "What is the hardest natural substance?", "الألماس", "Diamond"],
    ["ما وحدة قياس القوة؟", "What is the unit of force?", "النيوتن", "Newton"],
    ["أي عضو يضخ الدم؟", "Which organ pumps blood?", "القلب", "The heart"],
    ["ما أقرب نجم إلى الأرض؟", "What is the closest star to Earth?", "الشمس", "The Sun"],
    ["كم عدد كواكب النظام الشمسي؟", "How many planets are in the Solar System?", "ثمانية", "Eight"],
    ["عند كم درجة مئوية يتجمد الماء؟", "At what Celsius temperature does water freeze?", "صفر", "Zero degrees"],
  ]),
  category("history", "تاريخ", "History", [
    ["من بنى الأهرامات في الجيزة؟", "Which civilization built the pyramids at Giza?", "المصريون القدماء", "The ancient Egyptians"],
    ["في أي عام انتهت الحرب العالمية الثانية؟", "In what year did World War II end?", "1945", "1945"],
    ["من كان أول إنسان يمشي على القمر؟", "Who was the first person to walk on the Moon?", "نيل أرمسترونغ", "Neil Armstrong"],
    ["أين نشأت الألعاب الأولمبية القديمة؟", "Where did the ancient Olympic Games begin?", "اليونان", "Greece"],
    ["من اخترع الطباعة بالحروف المتحركة في أوروبا؟", "Who introduced movable-type printing to Europe?", "يوهان غوتنبرغ", "Johannes Gutenberg"],
    ["ما المدينة التي دمرها بركان فيزوف عام 79؟", "Which city was buried by Vesuvius in 79 CE?", "بومبي", "Pompeii"],
    ["من قاد الهند نحو الاستقلال بالمقاومة السلمية؟", "Who led India's nonviolent independence movement?", "المهاتما غاندي", "Mahatma Gandhi"],
    ["أي إمبراطورية بنت الكولوسيوم؟", "Which empire built the Colosseum?", "الإمبراطورية الرومانية", "The Roman Empire"],
    ["ما اسم السفينة التي غرقت عام 1912؟", "Which famous ship sank in 1912?", "تايتانيك", "Titanic"],
    ["من كتب إعلان الاستقلال الأمريكي؟", "Who drafted the US Declaration of Independence?", "توماس جيفرسون", "Thomas Jefferson"],
  ]),
  category("sports", "رياضة", "Sports", [
    ["كم لاعباً في فريق كرة القدم داخل الملعب؟", "How many players does a soccer team field?", "أحد عشر", "Eleven"],
    ["في أي رياضة تستخدم الريشة؟", "Which sport uses a shuttlecock?", "الريشة الطائرة", "Badminton"],
    ["كم حلقة في الشعار الأولمبي؟", "How many rings are in the Olympic symbol?", "خمس", "Five"],
    ["كم لاعباً من كل فريق في ملعب كرة السلة؟", "How many players from each team are on a basketball court?", "خمسة", "Five"],
    ["أي بلد استضاف كأس العالم 2022؟", "Which country hosted the 2022 World Cup?", "قطر", "Qatar"],
    ["كم نقطة تساوي الركلة الحرة في كرة السلة؟", "How many points is a basketball free throw worth?", "نقطة واحدة", "One point"],
    ["ما سطح بطولة ويمبلدون؟", "What surface is Wimbledon played on?", "العشب", "Grass"],
    ["في أي رياضة يوجد الهوم رن؟", "Which sport features a home run?", "البيسبول", "Baseball"],
    ["كم حفرة في جولة الغولف القياسية؟", "How many holes are in a standard golf round?", "ثماني عشرة", "Eighteen"],
    ["ما لون بطاقة الطرد في كرة القدم؟", "What color card sends off a soccer player?", "الأحمر", "Red"],
  ]),
  category("movies", "أفلام", "Movies", [
    ["من أخرج فيلم تايتانيك؟", "Who directed Titanic?", "جيمس كاميرون", "James Cameron"],
    ["ما اسم لعبة رعاة البقر في توي ستوري؟", "What is the cowboy toy's name in Toy Story?", "وودي", "Woody"],
    ["في أي سلسلة تظهر شخصية هاري بوتر؟", "Which film series features Harry Potter?", "هاري بوتر", "Harry Potter"],
    ["ما لون الحبة التي يختارها نيو في ماتريكس؟", "Which pill does Neo choose in The Matrix?", "الحمراء", "The red pill"],
    ["من يؤدي دور جاك سبارو؟", "Who plays Jack Sparrow?", "جوني ديب", "Johnny Depp"],
    ["ما اسم مملكة فروزن؟", "What is the kingdom in Frozen called?", "أريندل", "Arendelle"],
    ["أي فيلم يتضمن الأسد سيمبا؟", "Which film features the lion Simba?", "الأسد الملك", "The Lion King"],
    ["ما مهنة إنديانا جونز؟", "What is Indiana Jones's profession?", "عالم آثار", "Archaeologist"],
    ["من هو الشرير الرئيسي في حرب النجوم الأصلية؟", "Who is the iconic villain in the original Star Wars trilogy?", "دارث فيدر", "Darth Vader"],
    ["أي فيلم رسوم متحركة تدور أحداثه في عقل رايلي؟", "Which animated film takes place inside Riley's mind?", "قلباً وقالباً", "Inside Out"],
  ]),
  category("food", "طعام ومطبخ", "Food & Cooking", [
    ["ما المكوّن الأساسي للحمص؟", "What is the main ingredient in hummus?", "الحمص", "Chickpeas"],
    ["من أي بلد جاءت البيتزا؟", "Which country originated pizza?", "إيطاليا", "Italy"],
    ["ما التابل الأصفر في الكاري؟", "Which spice gives curry a yellow color?", "الكركم", "Turmeric"],
    ["مم يصنع الجواكامولي؟", "What is guacamole made from?", "الأفوكادو", "Avocado"],
    ["ما الحبوب المستخدمة لصنع الفشار؟", "Which grain is used to make popcorn?", "الذرة", "Corn"],
    ["ما اسم المعكرونة على شكل فراشة؟", "What is bow-tie pasta called?", "فارفالي", "Farfalle"],
    ["أي فاكهة تُجفف لتصبح زبيباً؟", "Which fruit is dried to make raisins?", "العنب", "Grapes"],
    ["ما الجبن المستخدم تقليدياً على المارغريتا؟", "Which cheese traditionally tops a Margherita pizza?", "موزاريلا", "Mozzarella"],
    ["ما الطبق الياباني المصنوع من أرز متبّل؟", "Which Japanese dish is based on seasoned rice?", "السوشي", "Sushi"],
    ["ما المادة التي تجعل الخبز يرتفع؟", "What ingredient makes bread rise?", "الخميرة", "Yeast"],
  ]),
  category("nature", "طبيعة وحيوانات", "Nature & Animals", [
    ["ما أسرع حيوان بري؟", "What is the fastest land animal?", "الفهد", "Cheetah"],
    ["ما أكبر حيوان على الأرض؟", "What is the largest animal on Earth?", "الحوت الأزرق", "Blue whale"],
    ["كم قلباً للأخطبوط؟", "How many hearts does an octopus have?", "ثلاثة", "Three"],
    ["ما الحيوان الملقب بسفينة الصحراء؟", "Which animal is called the ship of the desert?", "الجمل", "Camel"],
    ["ما الثديي الوحيد القادر على الطيران الحقيقي؟", "What is the only mammal capable of true flight?", "الخفاش", "Bat"],
    ["ماذا تسمى مجموعة الأسود؟", "What is a group of lions called?", "زمرة", "A pride"],
    ["أي طائر لا يطير ويعيش في القارة القطبية؟", "Which flightless bird lives in Antarctica?", "البطريق", "Penguin"],
    ["ما الحيوان الذي يغيّر لونه للتمويه؟", "Which animal changes color for camouflage?", "الحرباء", "Chameleon"],
    ["كم ساقاً للعنكبوت؟", "How many legs does a spider have?", "ثمانٍ", "Eight"],
    ["ما أطول حيوان بري؟", "What is the tallest land animal?", "الزرافة", "Giraffe"],
  ]),
  category("technology", "تقنية", "Technology", [
    ["ماذا تعني CPU؟", "What does CPU stand for?", "وحدة المعالجة المركزية", "Central Processing Unit"],
    ["من أسس شركة مايكروسوفت مع بول ألن؟", "Who co-founded Microsoft with Paul Allen?", "بيل غيتس", "Bill Gates"],
    ["ماذا تعني WWW؟", "What does WWW stand for?", "الشبكة العالمية", "World Wide Web"],
    ["أي شركة صنعت أول آيفون؟", "Which company made the first iPhone?", "آبل", "Apple"],
    ["ما النظام الثنائي المستخدم في الحوسبة؟", "Which number system underpins computing?", "الثنائي", "Binary"],
    ["ماذا تعني GPS؟", "What does GPS stand for?", "نظام تحديد المواقع العالمي", "Global Positioning System"],
    ["ما لغة تنسيق صفحات الويب؟", "Which language styles web pages?", "CSS", "CSS"],
    ["ما اسم الروبوت المتجول الذي هبط على المريخ عام 2021؟", "Which rover landed on Mars in 2021?", "بيرسيفيرانس", "Perseverance"],
    ["أي اختصار يعني الذكاء الاصطناعي؟", "Which abbreviation means artificial intelligence?", "AI", "AI"],
    ["ما الجهاز الذي يوجّه البيانات بين الشبكات؟", "Which device routes data between networks?", "الموجّه", "Router"],
  ]),
];
