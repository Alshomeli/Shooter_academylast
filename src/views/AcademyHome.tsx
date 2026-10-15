import { prefs } from '@/lib/preferences';
import { AcademyGallery } from '@/components/AcademyGallery';
import { ArrowUpLeft, ArrowDown, Instagram, Facebook, MapPin, Phone, Mail, Play, Target, Users, Trophy, Menu, X, Sun, Moon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { academyContact as defaultLinks, programImages, publicCoaches as defaultCoaches, publicNews as defaultNews, publicVideos as defaultVideos, publicGallery as defaultGallery } from '@/data/public-academy';
import '../academy-home.css';
import { readPublicContent, type ContentItem } from '@/lib/site-content';
import { galleryAlbum, galleryNewsId } from '@/lib/home-gallery';
import { featuredImageStyle } from '@/lib/featured-player';

const platform = '/?view=login';
const navigation = [['about', 'الأكاديمية'], ['programs', 'البرامج'], ['coaches', 'التدريب'], ['media', 'الصور والفيديو'], ['news', 'الأخبار'], ['faq', 'الأسئلة الشائعة']];
type SocialPlatform = 'instagram' | 'whatsapp' | 'facebook' | 'tiktok';
function SocialIcon({ kind }: { kind: SocialPlatform }) {
  if (kind === 'instagram') return <Instagram size={19} aria-hidden="true"/>;
  if (kind === 'facebook') return <Facebook size={19} aria-hidden="true"/>;
  if (kind === 'whatsapp') return <svg viewBox="0 0 24 24" width="19" height="19" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.5 15.3L2 22l4.9-1.3A10 10 0 1 0 12 2Zm0 18a8 8 0 0 1-4-1.1l-.3-.2-2.9.8.8-2.8-.2-.3A8 8 0 1 1 12 20Zm4.1-6.2c-.2-.1-1.3-.7-1.5-.8-.2-.1-.3-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6.4 6.4 0 0 1-2.8-2.5c-.1-.2 0-.3.1-.5l.5-.6c.1-.1.2-.3.1-.5L10 8.1c-.1-.3-.3-.3-.5-.3H9c-.2 0-.5.1-.7.3-.2.3-.8.9-.8 2.1s.8 2.3 1 2.5a9 9 0 0 0 3.7 3.3c.5.2 1 .4 1.4.5.5.1 1 .1 1.4.1.4-.1 1.3-.5 1.5-1.1.2-.5.2-1 .1-1.1-.1-.2-.2-.2-.5-.4Z"/></svg>;
  return <svg viewBox="0 0 24 24" width="19" height="19" fill="currentColor" aria-hidden="true"><path d="M16.7 2c.2 2.5 1.7 4 4.3 4.2v3.9a8.9 8.9 0 0 1-4.3-1.1v6c0 4.3-3.3 7-7.2 7a7 7 0 1 1 1.5-13.8v4a3 3 0 0 0-1.5-.2 3.1 3.1 0 1 0 3.2 3.1V2h4Z"/></svg>;
}
function SocialLinks({ links, header = false }: { links: typeof defaultLinks; header?: boolean }) {
  const platforms: { kind: SocialPlatform; label: string }[] = [
    { kind: 'instagram', label: 'Instagram' }, { kind: 'whatsapp', label: 'WhatsApp' },
    { kind: 'facebook', label: 'Facebook' }, { kind: 'tiktok', label: 'TikTok' },
  ];
  return <div className={`ah-social ${header ? 'ah-social-top' : ''}`} aria-label="حسابات أكاديمية شوتر">
    {platforms.map(({ kind, label }) => <a key={kind} className={kind} href={links[kind]} target="_blank" rel="noopener noreferrer" title={label} aria-label={label}>
      <SocialIcon kind={kind}/><span className={header ? 'ah-social-label-hidden' : ''}>{label}</span>
    </a>)}
  </div>;
}
export default function AcademyHome() {
  const [content, setContent] = useState<ContentItem[]>([]);
  const [legacy, setLegacy] = useState(false);
  const [contentError, setContentError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    readPublicContent().then(items => { if (!cancelled) setContent(items); }).catch(error => {
      if (!cancelled) {
        if (error.code === '42P01' || error.code === 'PGRST205') setLegacy(true);
        else setContentError(true);
      }
    });
    return () => { cancelled = true; };
  }, []);
  const publicCoaches = legacy ? defaultCoaches : content.filter(i => i.kind === 'coach').map(i => ({name:i.payload.title,role:i.payload.role,photo:i.payload.image}));
  const publicNews = (legacy ? defaultNews.map(n => ({...n, id: n.title, date:''})) : content.filter(i => i.kind === 'news').map(i => ({id:i.id,title:i.payload.title,summary:i.payload.body,image:i.payload.image,imageAlt:i.payload.alt||i.payload.title,url:'#media',date:i.payload.date}))).filter(n => !/junior premier league|شوتر تنضم إلى/i.test(n.title));
  const publicVideos = (legacy ? defaultVideos : content.filter(i => i.kind === 'video').map(i => ({title:i.payload.title,caption:i.payload.body,src:i.payload.video,poster:i.payload.poster,newsId:i.payload.news_id}))).filter(v => Boolean(v.src?.trim()));
  const publicGallery = legacy ? defaultGallery : content.filter(i => i.kind === 'gallery').map(i => ({src:i.payload.image,title:i.payload.title,caption:i.payload.body,alt:i.payload.alt||i.payload.title,album:galleryAlbum(i.payload.image,i.payload.album),newsId:galleryNewsId(i.payload.image,i.payload.news_id,publicNews)}));
  const contact = content.find(i => i.kind === 'contact')?.payload;
  const featuredPlayer = contact?.featured_name?.trim() && contact?.featured_image
    ? { name: contact.featured_name.trim(), image: contact.featured_image,
        heading: contact.featured_heading?.trim() || 'لاعب الشهر',
        body: contact.featured_body?.trim() || '' }
    : null;
  const links = {...defaultLinks};
  for (const key of Object.keys(links) as (keyof typeof links)[]) {
    const value = contact?.[key];
    if (value) { try { if (new URL(value).protocol === 'https:') links[key] = value; } catch { /* Ignore invalid stored links. */ } }
  }
  const newsDialog = useRef<HTMLDialogElement>(null);
  const [newsIndex, setNewsIndex] = useState<number | null>(null);
  const activeNews = newsIndex === null ? null : publicNews[newsIndex];
  const newsPhotos = activeNews ? publicGallery.filter(p => 'newsId' in p && p.newsId === activeNews.id) : [];
  const newsVideos = activeNews ? publicVideos.filter(v => 'newsId' in v && v.newsId === activeNews.id) : [];
  const [menu, setMenu] = useState(false);
  const [darkMode, setDarkMode] = useState(prefs.getDarkMode);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    document.documentElement.style.colorScheme = darkMode ? 'dark' : 'light';
    prefs.saveDarkMode(darkMode);
  }, [darkMode]);
  return <div className={`academy-home ${darkMode ? 'ah-dark' : 'ah-light'}`} dir="rtl" id="top">
    <a className="ah-skip" href="#about">تخطي إلى المحتوى</a>
    <header className="ah-header">
      <a href="#top" className="ah-brand"><img src="/1790474303638.jpg" width="54" height="60" alt="شعار أكاديمية شوتر"/><span>أكاديمية شوتر<small>SHOOTER ACADEMY</small></span></a>
      <nav className={`ah-nav ${menu ? 'is-open' : ''}`} id="ah-navigation" aria-label="التنقل الرئيسي">{navigation.map(([id,label]) => <a href={`#${id}`} key={id} onClick={() => setMenu(false)}>{label}</a>)}</nav>
      <SocialLinks links={links} header/>
      <button type="button" className="ah-theme-toggle" onClick={() => setDarkMode(v => !v)} aria-label={darkMode ? 'تفعيل الوضع النهاري' : 'تفعيل الوضع الليلي'} aria-pressed={darkMode} title={darkMode ? 'تفعيل الوضع النهاري' : 'تفعيل الوضع الليلي'}>{darkMode ? <Sun size={18}/> : <Moon size={18}/>}<span>{darkMode ? 'نهاري' : 'ليلي'}</span></button>
      <a className="ah-button ah-login" href={platform}>دخول منصة الأكاديمية <ArrowUpLeft size={17}/></a>
      <button className="ah-menu" onClick={() => setMenu(v => !v)} aria-expanded={menu} aria-controls="ah-navigation" aria-label={menu ? 'إغلاق القائمة' : 'فتح القائمة'}>{menu ? <X/> : <Menu/>}</button>
    </header>
    <main>
      {contentError && <p role="status" className="ah-muted">تعذّر تحميل آخر المحتوى. يرجى تحديث الصفحة.</p>}
      <section className={featuredPlayer ? 'ah-hero ah-hero-featured' : 'ah-hero'} aria-labelledby="ah-title">
        <img className="ah-hero-image" src="/parent-hero.png" alt="تصميم رياضي يعكس شغف كرة القدم"/>
        {featuredPlayer && <img className="ah-featured-cutout" style={featuredImageStyle(contact ?? {})} src={featuredPlayer.image} alt={`لاعب الشهر: ${featuredPlayer.name}`}/>}
        <div className="ah-hero-shade"/>
        <div className="ah-hero-content"><p className="ah-eyebrow">شغف اليوم. أبطال الغد.</p><h1 id="ah-title">هنا تبدأ<br/>رحلتك <em>الكروية.</em></h1><p className="ah-lead">مهارة تتطور. ثقة تكبر. وفريق يجمعنا.<br/>في أكاديمية شوتر، نمنح شغف كرة القدم مساحة للنمو.</p><div className="ah-actions"><a className="ah-button" href={platform}>دخول منصة الأكاديمية <ArrowUpLeft size={20}/></a><a className="ah-text-link" href="#programs">اكتشف برامجنا <ArrowDown size={17}/></a></div>
          {featuredPlayer && <aside className="ah-featured-honor" aria-label="بطاقة تكريم لاعب الشهر"><span>{featuredPlayer.heading}</span><strong>{featuredPlayer.name}</strong>{featuredPlayer.body && <p>{featuredPlayer.body}</p>}</aside>}
        </div>
        <span className="ah-hero-caption">FOOTBALL · PASSION · DEVELOPMENT</span>
      </section>
      <div className="ah-values"><span><Target/> تطوير المهارات</span><span><Users/> روح الفريق</span><span><Trophy/> شغف المنافسة</span><span>SHOOTER ACADEMY — BAHRAIN</span></div>
      <section className="ah-section ah-about" id="about"><div><p className="ah-eyebrow">01 / عن الأكاديمية</p><h2>كرة القدم أكثر<br/>من مجرد <em>لعبة.</em></h2></div><div><p className="ah-copy">من المحرق في مملكة البحرين، تهدف أكاديمية شوتر إلى تطوير المواهب الناشئة في بيئة تجمع بين التدريب، والانضباط، وحب كرة القدم.</p><p className="ah-muted">نركز على المهارات الفنية واللياقة البدنية وإنهاء الهجمات، ونؤمن بأن الاحترام والعمل الجماعي أساس تطور كل لاعب داخل الملعب وخارجه.</p><a href="#contact" className="ah-text-link">تعرّف علينا أكثر <ArrowUpLeft size={18}/></a></div></section>
      <section className="ah-section ah-programs" id="programs"><div className="ah-section-head"><div><p className="ah-eyebrow">02 / برامجنا التدريبية</p><h2>خطوة أقرب <em>للتطور.</em></h2></div><p className="ah-muted">تدريب متكامل، من الأساسيات إلى المنافسة.</p></div><div className="ah-program-grid">{[
        ['01','تطوير المهارات','التحكم بالكرة، التمرير، والمراوغة. أساس قوي يمنح اللاعب ثقة أكبر في كل لمسة.'],
        ['02','اللياقة البدنية','تنمية القوة والتحمل والمرونة، لبناء جاهزية بدنية تدعم أداء اللاعب في الملعب.'],
        ['03','إنهاء الهجمات','تطوير دقة التسديد والتحرك أمام المرمى، وتعزيز الثقة عند اتخاذ القرار.'],
      ].map(([number,title,body],i) => <article className="ah-program" key={number}><img src={programImages[i]} loading="lazy" alt={`صورة توضيحية لبرنامج ${title}`}/><div><span className="ah-number">{number}</span><h3>{title}</h3><p>{body}</p></div></article>)}</div><p className="ah-photo-note">صور البرامج توضيحية من الموقع التعريفي للأكاديمية.</p></section>
      <section className="ah-section ah-coaches" id="coaches"><div><p className="ah-eyebrow">03 / التدريب والتوجيه</p><h2>نتعلّم معًا.<br/><em>ونتطور معًا.</em></h2><p className="ah-muted">التوجيه، الممارسة، والمتابعة. نهج يدعم اللاعب ويعزز روح الفريق.</p></div><div>{publicCoaches.length ? <div className="ah-coach-grid">{publicCoaches.map(c => <article key={c.name}><img src={c.photo} alt={c.name} loading="lazy"/><h3>{c.name}</h3><p>{c.role}</p></article>)}</div> : <div className="ah-principles">{[['01','المهارة','التركيز على الأساسيات وتطوير الأداء.'],['02','الانضباط','الالتزام والاحترام داخل الملعب وخارجه.'],['03','روح الفريق','التعاون والتعلم من كل تجربة.']].map(([n,t,b]) => <div key={n}><span>{n}</span><div><h3>{t}</h3><p>{b}</p></div></div>)}</div>}</div></section>
      <section className="ah-section ah-media" id="media"><div className="ah-section-head"><div><p className="ah-eyebrow">04 / من قلب الملعب</p><h2>لحظات تستحق <em>المشاهدة.</em></h2></div><a className="ah-text-link" href={links.instagram} target="_blank" rel="noopener noreferrer">ألبوم الأكاديمية <Instagram size={18}/></a></div>
        <AcademyGallery photos={publicGallery}/>
        {publicVideos.length ? <div className="ah-video-grid">{publicVideos.map(v => <figure key={v.src}><video controls playsInline preload="none" poster={v.poster} aria-label={v.title}><source src={v.src}/>متصفحك لا يدعم الفيديو. <a href={v.src}>افتح الفيديو</a></video><figcaption><h3>{v.title}</h3><p>{v.caption}</p></figcaption></figure>)}</div> : <div className="ah-media-feature"><div><span className="ah-play"><Play size={26}/></span><h3>صور التدريبات ومقاطع الأكاديمية</h3><p>تابع لحظات الملعب والمحتوى المنشور على حساباتنا الرسمية.</p></div><div className="ah-actions"><a className="ah-button" href={links.tiktok} target="_blank" rel="noopener noreferrer">شاهد على TikTok <ArrowUpLeft size={18}/></a><a className="ah-outline" href={links.instagram} target="_blank" rel="noopener noreferrer">الصور على Instagram</a></div></div>}
      </section>
      <section className="ah-section" id="news"><div className="ah-section-head"><div><p className="ah-eyebrow">05 / أخبار شوتر</p><h2>ابقَ قريبًا من <em>الفريق.</em></h2></div></div>{publicNews.length ? <div className="ah-news-grid">{publicNews.map((n, index) => <article className="ah-news" key={n.id}>{n.image && <img src={n.image} alt={n.imageAlt} loading="lazy"/>}<h3>{n.title}</h3>{n.date && <time dateTime={n.date}>{n.date}</time>}<p>{n.summary}</p><button type="button" className="ah-news-open" onClick={() => {setNewsIndex(index);newsDialog.current?.showModal();}}>تفاصيل الخبر والصور والفيديو <ArrowUpLeft size={16}/></button></article>)}</div> : <div className="ah-news-strip"><p>آخر أخبار الأكاديمية والتدريبات والمنافسات، عبر حساباتنا الرسمية.</p><a className="ah-text-link" href={links.facebook} target="_blank" rel="noopener noreferrer">أخبارنا على Facebook <ArrowUpLeft size={18}/></a></div>}</section>
      <dialog className="ah-news-dialog" ref={newsDialog} aria-label="تفاصيل خبر أكاديمية شوتر" onClick={e => {if(e.target === e.currentTarget) newsDialog.current?.close();}}>
        <button type="button" className="ah-photo-close" onClick={() => newsDialog.current?.close()} aria-label="إغلاق تفاصيل الخبر"><X/></button>
        {activeNews && <article>
          <h2>{activeNews.title}</h2>{activeNews.date && <time dateTime={activeNews.date}>{activeNews.date}</time>}
          {activeNews.image && <img className="ah-news-cover" src={activeNews.image} alt={activeNews.imageAlt}/>}
          <p>{activeNews.summary}</p>
          {newsPhotos.length > 0 && <div className="ah-news-attachments" aria-label="صور الخبر">{newsPhotos.map(p=><img key={p.src} src={p.src} alt={p.alt} loading="lazy"/>)}</div>}
          {newsVideos.length > 0 && <div className="ah-news-attachments" aria-label="فيديوهات الخبر">{newsVideos.map(v=><video key={v.src} controls playsInline preload="none" poster={v.poster} aria-label={v.title}><source src={v.src}/></video>)}</div>}
        </article>}
      </dialog>
      <section className="ah-map-section" aria-label="موقع الأكاديمية على الخريطة">
        <div className="ah-map-intro"><div><p className="ah-eyebrow">موقع الأكاديمية</p><h2>زورونا في البحرين</h2><p>شارع 28، حالة النعيم، البحرين</p></div><a className="ah-button" href={links.maps} target="_blank" rel="noopener noreferrer"><MapPin size={19}/> الاتجاهات إلى الأكاديمية</a></div>
        <iframe title="خريطة موقع أكاديمية شوتر في حالة النعيم، البحرين" loading="lazy" referrerPolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q=Shooter%20Academy%2C%20Halat%20Naim%2C%20Bahrain&output=embed"/>
        <p className="ah-map-note">للوصول إلى الموقع المحدد للأكاديمية، استخدم زر الاتجاهات المرتبط بالخريطة المعتمدة.</p>
      </section>
      <section className="ah-section ah-contact" id="contact"><div><p className="ah-eyebrow">06 / تواصل معنا</p><h2>نلتقي في <em>الملعب.</em></h2><p className="ah-muted">شارع 28، حالة النعيم 997، البحرين</p><a className="ah-text-link" href={links.maps} target="_blank" rel="noopener noreferrer"><MapPin size={18}/> الاتجاهات على خرائط Google</a></div><div className="ah-contact-links"><a href="tel:+97332287776"><Phone size={20}/><bdi>+973 3228 7776</bdi></a><a href="mailto:football.shooter.academy@gmail.com"><Mail size={20}/><span>football.shooter.academy@gmail.com</span></a><SocialLinks links={links}/></div></section>
    </main>
    <section className="ah-section ah-faq" id="faq" aria-labelledby="ah-faq-title"><p className="ah-eyebrow">مساعدة أولياء الأمور</p><h2 id="ah-faq-title">الأسئلة الشائعة</h2>
      <details><summary>كيف أسجل لاعبًا في الأكاديمية؟</summary><p>ادخل إلى منصة الأكاديمية ثم اختر تسجيل ولي الأمر. بعد تقديم البيانات، تراجع الإدارة طلب التسجيل.</p></details>
      <details><summary>كيف أتابع معلومات اللاعب والتدريبات؟</summary><p>يمكن لولي الأمر متابعة بيانات اللاعبين المرتبطين بحسابه من بوابة أولياء الأمور بعد تسجيل الدخول.</p></details>
      <details><summary>كيف أتواصل مع إدارة الأكاديمية؟</summary><p>يمكنك استخدام رقم الاتصال أو واتساب أو حسابات الأكاديمية الرسمية في قسم التواصل.</p></details>
    </section>
    <footer className="ah-footer">
      <div className="ah-footer-grid">
        <div><strong>أكاديمية شوتر</strong><p>تطوير المهارة والانضباط وروح الفريق في مملكة البحرين.</p><a href="#about">عن الأكاديمية</a><SocialLinks links={links}/></div>
        <nav aria-label="السياسات"><strong>السياسات</strong><a href="/privacy">سياسة الخصوصية</a><a href="/terms">الشروط والأحكام</a><a href="/terms#payments">الدفع والاشتراكات</a><a href="/terms#refunds">الإلغاء والاسترداد</a></nav>
        <nav aria-label="المساعدة"><strong>المساعدة</strong><a href="#faq">الأسئلة الشائعة</a><a href="#contact">الاستفسارات والتواصل</a><a href={links.maps} target="_blank" rel="noopener noreferrer">موقع الأكاديمية</a></nav>
      </div>
      <div className="ah-footer-bottom"><span>© {new Date().getFullYear()} أكاديمية شوتر لكرة القدم. جميع الحقوق محفوظة.</span><a href="#top">العودة للأعلى ↑</a></div>
    </footer>
  </div>;
}



