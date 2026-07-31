/*
  ============================================================================
  طبقة البيانات (Data Layer) لموقع الجولة
  ============================================================================
  حاليًا: كل دوال fetchNews / fetchMatches / fetchTeam تقرأ من ملفات JSON
  ثابتة داخل مجلد /data. هذه الملفات تمثل مؤقتًا وظيفة الـ CMS.

  عند ربط الموقع بمصدر أخبار حقيقي عبر API لاحقًا:
  - غيّر فقط رابط fetch() داخل كل دالة (مثال أدناه) بدون أي تعديل على بقية
    الكود أو صفحات HTML، طالما بقيت بنية البيانات المُعادة (الحقول نفسها)
    كما هي.

    مثال:
      async function fetchNews(){
        const res = await fetch('https://api.algwola.com/v1/news');
        return res.json();
      }

  - إن اختلفت بنية استجابة الـ API الحقيقي، عدّل فقط دالة normalizeNews()
    لتحويلها إلى نفس الشكل المستخدم في هذا الملف، وسيستمر باقي الموقع
    بالعمل دون تغيير.
  ============================================================================
*/

const DATA_BASE = 'data'; // غيّرها لاحقًا إلى رابط الـ API الأساسي

async function fetchJSON(path){
  const res = await fetch(path);
  if(!res.ok) throw new Error('تعذر تحميل البيانات: ' + path);
  return res.json();
}

async function fetchNews(){
  return fetchJSON(`${DATA_BASE}/news.json`);
}

async function fetchMatches(){
  return fetchJSON(`${DATA_BASE}/matches.json`);
}

async function fetchTeam(){
  return fetchJSON(`${DATA_BASE}/team.json`);
}

/* ---------------------------------------------------------------------- */
/* أدوات مشتركة */
/* ---------------------------------------------------------------------- */

function el(tag, attrs = {}, children = []){
  const node = document.createElement(tag);
  for(const [k,v] of Object.entries(attrs)){
    if(k === 'html'){ node.innerHTML = v; }
    else if(k === 'text'){ node.textContent = v; }
    else node.setAttribute(k, v);
  }
  (Array.isArray(children) ? children : [children]).forEach(c => {
    if(c) node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return node;
}

function setActiveNav(){
  const path = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('nav.main-nav a[data-page]').forEach(a=>{
    a.classList.toggle('active', a.dataset.page === path);
  });
}

function initMobileNav(){
  const burger = document.querySelector('.burger');
  const nav = document.querySelector('.main-nav');
  if(!burger || !nav) return;
  function toggleNav(){
    if(nav.style.display === 'flex'){ nav.style.display = 'none'; }
    else {
      nav.style.display = 'flex';
      Object.assign(nav.style, {
        position:'absolute', top:'64px', right:'0', left:'0',
        background:'#fff', flexDirection:'column', padding:'10px 20px',
        borderBottom:'1px solid var(--line)'
      });
    }
  }
  burger.addEventListener('click', toggleNav);
  burger.addEventListener('keypress', e => { if(e.key === 'Enter') toggleNav(); });
}

function showError(container, message){
  container.innerHTML = `<div style="padding:24px; text-align:center; color:var(--ink-soft);">${message}</div>`;
}

// يحوّل تاريخ ISO (من الأخبار الحقيقية) إلى نص نسبي مثل "منذ 3 ساعات"
function relativeTime(isoString, fallback){
  if(!isoString) return fallback || '';
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diffMs / 60000);
  if(mins < 1) return 'الآن';
  if(mins < 60) return `منذ ${mins} دقيقة`;
  const hours = Math.floor(mins / 60);
  if(hours < 24) return `منذ ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  if(days === 1) return 'أمس';
  return `منذ ${days} أيام`;
}

function timeLabel(item){
  return item.publishedAt ? relativeTime(item.publishedAt) : (item.time || '');
}

/* ---------------------------------------------------------------------- */
/* رسم الصفحة الرئيسية */
/* ---------------------------------------------------------------------- */

async function renderHome(){
  const ticker = document.getElementById('tickerTrack');
  const heroMain = document.getElementById('heroMain');
  const heroSide = document.getElementById('heroSide');
  const newsGrid = document.getElementById('newsGrid');
  const videoGrid = document.getElementById('videoGrid');
  const scoreboard = document.getElementById('scoreboard');

  try{
    const news = await fetchNews();

    if(ticker){
      ticker.innerHTML = '';
      news.ticker.forEach(t => ticker.appendChild(el('span', {text:t})));
    }

    if(heroMain){
      const f = news.featured;
      heroMain.innerHTML = '';
      heroMain.appendChild(el('div', {class:'content'}, [
        el('span', {class:'eyebrow', style:'color:#ffb3af;', text:f.eyebrow}),
        el('h1', {text:f.title}),
        el('p', {text:f.excerpt}),
        el('div', {class:'meta-row'}, [
          el('span', {text:f.author}), el('span', {text:timeLabel(f)}), el('span', {text:f.readTime})
        ])
      ]));
      heroMain.style.cursor = 'pointer';
      heroMain.addEventListener('click', ()=> location.href = `article.html?id=${f.id}`);
    }

    if(heroSide){
      heroSide.innerHTML = '';
      news.sideHighlights.forEach(h=>{
        const card = el('a', {class:'side-card', href:`article.html?id=${h.id}`}, [
          el('span', {class:'cat', text:h.category}),
          el('h3', {text:h.title}),
          el('span', {class:'time', text:timeLabel(h)})
        ]);
        heroSide.appendChild(card);
      });
    }

    if(newsGrid){
      newsGrid.innerHTML = '';
      news.articles.forEach(a=>{
        const card = el('article', {class:'card'}, [
          el('a', {href:`article.html?id=${a.id}`}, [
            el('div', {class:'thumb'}, [
              el('span', {class:'tag-pill', text:a.tag}),
              el('span', {class:'icon', text:a.icon})
            ]),
            el('div', {class:'body'}, [
              el('h3', {text:a.title}),
              el('p', {text:a.excerpt}),
              el('div', {class:'foot'}, [
                el('span', {text:a.author}), el('span', {text:timeLabel(a)})
              ])
            ])
          ])
        ]);
        newsGrid.appendChild(card);
      });
    }

    if(videoGrid){
      videoGrid.innerHTML = '';
      news.videos.forEach(v=>{
        const card = el('article', {class:'card'}, [
          el('div', {class:'thumb'}, [el('span', {class:'icon', text:'▶'})]),
          el('div', {class:'body'}, [
            el('h3', {text:v.title}),
            el('div', {class:'foot'}, [el('span', {text:'فيديو'}), el('span', {text:v.duration})])
          ])
        ]);
        videoGrid.appendChild(card);
      });
    }
  }catch(err){
    if(newsGrid) showError(newsGrid, 'تعذّر تحميل الأخبار حاليًا. حاول لاحقًا.');
    console.error(err);
  }

  if(scoreboard){
    try{
      const data = await fetchMatches();
      scoreboard.innerHTML = '';
      data.matches.forEach(m=>{
        const card = el('div', {class:'match-card'}, [
          el('div', {class:'match-league'}, [el('span', {text:m.league}), el('span', {text:m.round})]),
          el('div', {class:'match-teams'}, [
            el('div', {class:'team'}, [el('span', {class:'crest', text:m.home.short}), el('span', {text:m.home.name})]),
            el('div', {class:'score', text:m.score}),
            el('div', {class:'team'}, [el('span', {class:'crest', text:m.away.short}), el('span', {text:m.away.name})])
          ]),
          el('div', {class:'match-status', text:m.status})
        ]);
        scoreboard.appendChild(card);
      });
    }catch(err){
      showError(scoreboard, 'تعذّر تحميل النتائج حاليًا.');
      console.error(err);
    }
  }
}

/* ---------------------------------------------------------------------- */
/* رسم صفحة الخبر المفرد */
/* ---------------------------------------------------------------------- */

async function renderArticle(){
  const container = document.getElementById('articleContent');
  const relatedGrid = document.getElementById('relatedGrid');
  if(!container) return;

  const params = new URLSearchParams(location.search);
  const id = params.get('id');

  try{
    const news = await fetchNews();
    const all = [news.featured, ...news.articles];
    const article = all.find(a => a.id === id) || news.featured;

    document.title = `${article.title} | الجولة`;

    container.innerHTML = '';
    container.appendChild(el('span', {class:'eyebrow', text:article.category || article.tag || 'خبر'}));
    container.appendChild(el('h1', {text:article.title}));
    container.appendChild(el('div', {class:'meta-row', style:'margin:14px 0 26px;'}, [
      el('span', {text:article.author}),
      el('span', {text:timeLabel(article)}),
      el('span', {text:article.readTime || ''})
    ]));
    (article.body && article.body.length ? article.body : [article.excerpt]).forEach(p=>{
      if(p) container.appendChild(el('p', {class:'article-p', text:p}));
    });
    if(article.sourceUrl){
      container.appendChild(el('a', {
        href: article.sourceUrl, target:'_blank', rel:'noopener noreferrer',
        class:'source-link',
        text: `اقرأ القصة كاملة على ${article.sourceName || 'المصدر الأصلي'} ↗`
      }));
    }

    if(relatedGrid){
      relatedGrid.innerHTML = '';
      news.articles.filter(a => a.id !== id).slice(0,3).forEach(a=>{
        const card = el('article', {class:'card'}, [
          el('a', {href:`article.html?id=${a.id}`}, [
            el('div', {class:'thumb'}, [
              el('span', {class:'tag-pill', text:a.tag}),
              el('span', {class:'icon', text:a.icon})
            ]),
            el('div', {class:'body'}, [
              el('h3', {text:a.title}),
              el('div', {class:'foot'}, [el('span', {text:a.author}), el('span', {text:timeLabel(a)})])
            ])
          ])
        ]);
        relatedGrid.appendChild(card);
      });
    }
  }catch(err){
    showError(container, 'تعذّر تحميل الخبر حاليًا.');
    console.error(err);
  }
}

/* ---------------------------------------------------------------------- */
/* رسم صفحة الفريق */
/* ---------------------------------------------------------------------- */

async function renderTeam(){
  const container = document.getElementById('teamGroups');
  if(!container) return;
  try{
    const data = await fetchTeam();
    container.innerHTML = '';
    data.groups.forEach(group=>{
      container.appendChild(el('h2', {class:'section-title', style:'margin:34px 0 18px;', text:group.name}));
      const grid = el('div', {class:'team-grid'});
      group.members.forEach(m=>{
        grid.appendChild(el('div', {class:'team-card'}, [
          el('div', {class:'team-avatar', text:m.name.trim().charAt(0)}),
          el('h3', {text:m.name}),
          el('span', {class:'team-role', text:m.role}),
          el('p', {text:m.bio})
        ]));
      });
      container.appendChild(grid);
    });
  }catch(err){
    showError(container, 'تعذّر تحميل بيانات الفريق حاليًا.');
    console.error(err);
  }
}

document.addEventListener('DOMContentLoaded', ()=>{
  setActiveNav();
  initMobileNav();
  renderHome();
  renderArticle();
  renderTeam();
});
