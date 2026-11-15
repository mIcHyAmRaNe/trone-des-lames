import { defineMiddleware } from 'astro:middleware';
import { DEFAULT_LANG, LANG_COOKIE, isLang } from './i18n';

/** Langue du visiteur : `?lang=` (lien partageable) puis cookie, sinon français. */
export const onRequest = defineMiddleware((context, next) => {
  const asked = context.url.searchParams.get('lang');
  const saved = context.cookies.get(LANG_COOKIE)?.value;
  const lang = isLang(asked) ? asked : isLang(saved) ? saved : DEFAULT_LANG;

  if (isLang(asked) && asked !== saved) {
    context.cookies.set(LANG_COOKIE, asked, {
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
      secure: context.url.protocol === 'https:',
    });
  }
  context.locals.lang = lang;
  return next();
});
