/*
  ============================================================================
  fetch-news.js
  ============================================================================
  يعمل هذا السكربت داخل GitHub Actions (لا يعمل في المتصفح إطلاقًا) كل ساعة.
  يجلب أخبارًا حقيقية من GNews API (عام + رياضة) ويعيد كتابة data/news.json
  بنفس البنية التي تستخدمها الصفحات (assets/js/site.js) — بدون أي تعديل
  مطلوب على الواجهة الأمامية.

  المفتاح السري (GNEWS_API_KEY) يُقرأ من GitHub Secrets فقط، ولا يظهر أبدًا
  في كود المتصفح أو في الملفات المرفوعة إلى المستودع.

  ملاحظات مهمة:
  - الخطة المجانية من GNews: 100 طلب/يوم، بتأخير حتى 12 ساعة عن اللحظة الفعلية،
    ومحتوى النص مقتطع (description فقط، بدون النص الكامل). لهذا نعرض مقتطعًا
    قصيرًا في صفحة الخبر مع رابط "اقرأ القصة كاملة على المصدر" بدل نسخ النص
    كاملاً — هذا يحترم حقوق النشر أيضًا.
  - هذا السكربت يستهلك طلبين لكل تشغيلة (عام + رياضة). بجدولة كل ساعة =
    48 طلب/يوم، ضمن الحد المجاني بهامش أمان.
  ============================================================================
*/

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const API_KEY = process.env.GNEWS_API_KEY;
const OUTPUT_PATH = path.join(__dirname, '..', 'data', 'news.json');

const CATEGORY_MAP = {
  general: { tag: 'أخبار', icon: '📰', eyebrow: 'تغطية إخبارية' },
  sports:  { tag: 'رياضة', icon: '⚽', eyebrow: 'تغطية رياضية' }
};

async function fetchCategory(category){
  const url = `https://gnews.io/api/v4/top-headlines?category=${category}&lang=ar&max=10&apikey=${API_KEY}`;
  const res = await fetch(url);
  if(!res.ok){
    throw new Error(`فشل جلب فئة ${category}: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return (data.articles || []).map(a => ({ ...a, _category: category }));
}

function makeId(url){
  // هاش قصير من الرابط الكامل — يضمن عدم تصادم المعرفات حتى لو تشاركت
  // الروابط نفس الدومين في بدايتها (وهو سبب الخلل عند استخدام base64 مقطوع)
  return crypto.createHash('sha1').update(url).digest('hex').slice(0, 16);
}

function toInternalArticle(raw){
  const meta = CATEGORY_MAP[raw._category] || CATEGORY_MAP.general;
  return {
    id: makeId(raw.url),
    section: 'news',
    tag: meta.tag,
    icon: meta.icon,
    title: raw.title,
    excerpt: raw.description || '',
    author: raw.source?.name || 'مصدر خارجي',
    publishedAt: raw.publishedAt,
    readTime: 'قراءة 2 دقيقة',
    body: raw.description ? [raw.description] : [],
    sourceName: raw.source?.name || null,
    sourceUrl: raw.url,
    image: raw.image || null
  };
}

async function main(){
  if(!API_KEY){
    console.error('خطأ: لم يتم توفير GNEWS_API_KEY كمتغير بيئة سري.');
    process.exit(1);
  }

  const [general, sports] = await Promise.all([
    fetchCategory('general'),
    fetchCategory('sports')
  ]);

  const combinedRaw = [...general, ...sports]
    .filter(a => a.title && a.url)
    .sort((a,b) => new Date(b.publishedAt) - new Date(a.publishedAt));

  const combined = combinedRaw.map(toInternalArticle);

  if(combined.length === 0){
    console.error('لم يتم استلام أي مقالات — سيتم الاحتفاظ بالملف الحالي دون تغيير.');
    process.exit(1);
  }

  const featuredRaw = combined[0];
  const featured = {
    id: featuredRaw.id,
    eyebrow: CATEGORY_MAP[combinedRaw[0]._category]?.eyebrow || 'تغطية خاصة',
    title: featuredRaw.title,
    excerpt: featuredRaw.excerpt,
    author: featuredRaw.author,
    publishedAt: featuredRaw.publishedAt,
    readTime: featuredRaw.readTime,
    category: featuredRaw.tag,
    body: featuredRaw.body,
    sourceName: featuredRaw.sourceName,
    sourceUrl: featuredRaw.sourceUrl
  };

  const sideHighlights = combined.slice(1, 4).map(a => ({
    id: a.id, category: a.tag, title: a.title, publishedAt: a.publishedAt
  }));

  const articles = combined.slice(4, 16);

  const ticker = combined.slice(0, 6).map(a => a.title);

  // نحافظ على قسم الفيديوهات ثابتًا (GNews لا يوفر محتوى فيديو)
  let existingVideos = [];
  try{
    const prev = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
    existingVideos = prev.videos || [];
  }catch(e){ /* ملف غير موجود بعد، تجاهل */ }

  const output = {
    _meta: {
      note: 'يتم تحديث هذا الملف تلقائيًا كل ساعة عبر GitHub Actions (scripts/fetch-news.js) من GNews API. لا تُعدّل هذا الملف يدويًا — أي تعديل يدوي سيُستبدل عند أول تشغيلة قادمة.',
      updated: new Date().toISOString(),
      source: 'GNews API (v4 top-headlines, categories: general, sports, lang=ar)'
    },
    featured,
    sideHighlights,
    articles,
    videos: existingVideos,
    ticker
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf8');
  console.log(`تم تحديث ${OUTPUT_PATH} بنجاح: ${combined.length} خبرًا.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
