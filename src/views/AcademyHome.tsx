import { AcademyGallery } from '@/components/AcademyGallery';
import { ArrowUpLeft, ArrowDown, Instagram, MapPin, Phone, Mail, Play, Target, Users, Trophy, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { academyContact as links, programImages, publicCoaches, publicNews, publicVideos } from '@/data/public-academy';
import '../academy-home.css';

const platform = '/?view=login';
const navigation = [['about', 'الأكاديمية'], ['programs', 'البرامج'], ['coaches', 'التدريب'], ['media', 'الصور والفيديو'], ['news', 'الأخبار']];
export default function AcademyHome() {
  const [menu, setMenu] = useState(false);
  return <div className="academy-home" dir="rtl" id="top">
    <a className="ah-skip" href="#about">تخطي إلى المحتوى</a>
    <div className="ah-topline"><span>المحرق، مملكة البحرين</span><a href={links.maps} target="_blank" rel="noopener noreferrer">موقع الأكاديمية <MapPin size={13}/></a></div>
    <header className="ah-header">
      <a href="#top" className="ah-brand"><img src="/1790474303638.jpg" width="54" height="60" alt="شعار أكاديمية شوتر"/><span>أكاديمية شوتر<small>SHOOTER ACADEMY</small></span></a>
      <nav className={`ah-nav ${menu ? 'is-open' : ''}`} id="ah-navigation" aria-label="التنقل الرئيسي">{navigation.map(([id,label]) => <a href={`#${id}`} key={id} onClick={() => setMenu(false)}>{label}</a>)}</nav>
      <a className="ah-button ah-login" href={platform}>دخول منصة الأكاديمية <ArrowUpLeft size={17}/></a>
      <button className="ah-menu" onClick={() => setMenu(v => !v)} aria-expanded={menu} aria-controls="ah-navigation" aria-label={menu ? 'إغلاق القائمة' : 'فتح القائمة'}>{menu ? <X/> : <Menu/>}</button>
    </header>
    <main>
      <section className="ah-hero" aria-labelledby="ah-title">
        <img className="ah-hero-image" src="/parent-hero.png" alt="تصميم رياضي يعكس شغف كرة القدم"/>
        <div className="ah-hero-shade"/>
        <div className="ah-hero-content"><p className="ah-eyebrow">شغف اليوم. أبطال الغد.</p><h1 id="ah-title">هنا تبدأ<br/>رحلتك <em>الكروية.</em></h1><p className="ah-lead">مهارة تتطور. ثقة تكبر. وفريق يجمعنا.<br/>في أكاديمية شوتر، نمنح شغف كرة القدم مساحة للنمو.</p><div className="ah-actions"><a className="ah-button" href={platform}>دخول منصة الأكاديمية <ArrowUpLeft size={20}/></a><a className="ah-text-link" href="#programs">اكتشف برامجنا <ArrowDown size={17}/></a></div></div>
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
        <AcademyGallery/>
        {publicVideos.length ? <div className="ah-video-grid">{publicVideos.map(v => <figure key={v.src}><video controls playsInline preload="none" poster={v.poster} aria-label={v.title}><source src={v.src}/>متصفحك لا يدعم الفيديو. <a href={v.src}>افتح الفيديو</a></video><figcaption><h3>{v.title}</h3><p>{v.caption}</p></figcaption></figure>)}</div> : <div className="ah-media-feature"><div><span className="ah-play"><Play size={26}/></span><h3>صور التدريبات ومقاطع الأكاديمية</h3><p>تابع لحظات الملعب والمحتوى المنشور على حساباتنا الرسمية.</p></div><div className="ah-actions"><a className="ah-button" href={links.tiktok} target="_blank" rel="noopener noreferrer">شاهد على TikTok <ArrowUpLeft size={18}/></a><a className="ah-outline" href={links.instagram} target="_blank" rel="noopener noreferrer">الصور على Instagram</a></div></div>}
      </section>
      <section className="ah-section" id="news"><div className="ah-section-head"><div><p className="ah-eyebrow">05 / أخبار شوتر</p><h2>ابقَ قريبًا من <em>الفريق.</em></h2></div></div>{publicNews.length ? <div className="ah-news-grid">{publicNews.map(n => <article className="ah-news" key={n.title}><img src={n.image} alt={n.imageAlt} loading="lazy"/><h3>{n.title}</h3><p>{n.summary}</p><a href={n.url}>شاهد الصور والفيديو <ArrowUpLeft size={16}/></a></article>)}</div> : <div className="ah-news-strip"><p>آخر أخبار الأكاديمية والتدريبات والمنافسات، عبر حساباتنا الرسمية.</p><a className="ah-text-link" href={links.facebook} target="_blank" rel="noopener noreferrer">أخبارنا على Facebook <ArrowUpLeft size={18}/></a></div>}</section>
      <section className="ah-portal-band"><div><p className="ah-eyebrow">الأكاديمية، أقرب إليك.</p><h2>كل المتابعة.<br/>في مكان واحد.</h2><p>بوابة أولياء الأمور وفريق الأكاديمية لمتابعة الأنشطة وبيانات الحساب.</p></div><a className="ah-button" href={platform}>دخول منصة الأكاديمية <ArrowUpLeft size={20}/></a></section>
      <section className="ah-section ah-contact" id="contact"><div><p className="ah-eyebrow">06 / تواصل معنا</p><h2>نلتقي في <em>الملعب.</em></h2><p className="ah-muted">شارع 28، حالة النعيم 997، البحرين</p><a className="ah-text-link" href={links.maps} target="_blank" rel="noopener noreferrer"><MapPin size={18}/> الاتجاهات على خرائط Google</a></div><div className="ah-contact-links"><a href="tel:+97332287776"><Phone size={20}/><bdi>+973 3228 7776</bdi></a><a href="mailto:football.shooter.academy@gmail.com"><Mail size={20}/><span>football.shooter.academy@gmail.com</span></a><div className="ah-social"><a className="instagram" href={links.instagram} target="_blank" rel="noopener noreferrer">Instagram</a><a className="whatsapp" href={links.whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp</a><a className="facebook" href={links.facebook} target="_blank" rel="noopener noreferrer">Facebook</a><a className="tiktok" href={links.tiktok} target="_blank" rel="noopener noreferrer">TikTok</a></div></div></section>
    </main>
    <footer className="ah-footer"><span>© {new Date().getFullYear()} أكاديمية شوتر لكرة القدم</span><nav aria-label="روابط قانونية"><a href="/privacy">الخصوصية</a><a href="/terms">الشروط والأحكام</a><a href="#top">إلى الأعلى ↑</a></nav></footer>
  </div>;
}

