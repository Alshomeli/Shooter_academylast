# Public academy homepage

The root URL now opens a public Arabic homepage. The platform entry is `/?view=login`. Existing `/parent`, `/coach`, legal pages, OAuth routes and authentication callbacks continue to the application. No player registration CTA is added to the public page.

Content is adapted from shooter.academy (redirecting to shooteracademy.gamer.gd), reviewed on 2026-10-14. Omit template testimonials and unsupported statistics. Program images on that site are illustrative stock photography and are labeled accordingly. The hero reuses the existing repository asset.

Edit `src/data/public-academy.ts` to add verified coaches, news and direct video URLs. The gallery, JPL news and Farid Albalushi video use public material supplied by the academy. Coach profiles remain empty until verified names and photos are supplied. Editorial captions do not assert scores or event dates. Program images are optimized local copies of the source’s Pexels photos (34970425, 26546638 and 10031866), avoiding dependence on the WordPress image host.

The parent and staff headers include an ordinary link to `/` for returning to the public site while keeping the authentication session. No database, authentication, domain or production deployment changes are included.

