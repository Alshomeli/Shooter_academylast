# Public academy homepage

The root URL now opens a public Arabic homepage. The platform entry is `/?view=login`. Existing `/parent`, `/coach`, legal pages, OAuth routes and authentication callbacks continue to the application. No player registration CTA is added to the public page.

Content is adapted from shooter.academy (redirecting to shooteracademy.gamer.gd), reviewed on 2026-10-14. Omit template testimonials and unsupported statistics. Program images on that site are illustrative stock photography and are labeled accordingly. The hero reuses the existing repository asset.

Edit `src/data/public-academy.ts` to add verified coaches, news and direct video URLs. Until supplied, those sections show training principles and official social links, without fabricated coaches or stories. Remote program images depend on the existing WordPress host.

No database changes, authentication changes, domain changes or production deployment are included.
