import type { Language } from './languages';
import en from './packs/en.json';
import hi from './packs/hi.json';
import ta from './packs/ta.json';
import as from './packs/as.json';
import bn from './packs/bn.json';
import brx from './packs/brx.json';
import doi from './packs/doi.json';
import gu from './packs/gu.json';
import kn from './packs/kn.json';
import ks from './packs/ks.json';
import kok from './packs/kok.json';
import mai from './packs/mai.json';
import ml from './packs/ml.json';
import mni from './packs/mni.json';
import mr from './packs/mr.json';
import ne from './packs/ne.json';
import or from './packs/or.json';
import pa from './packs/pa.json';
import sa from './packs/sa.json';
import sat from './packs/sat.json';
import sd from './packs/sd.json';
import te from './packs/te.json';
import ur from './packs/ur.json';

/** Full UI string packs for every site language (English + 22 scheduled languages). */
export const localePacks = {
  en,
  hi,
  ta,
  as,
  bn,
  brx,
  doi,
  gu,
  kn,
  ks,
  kok,
  mai,
  ml,
  mni,
  mr,
  ne,
  or,
  pa,
  sa,
  sat,
  sd,
  te,
  ur,
} as Record<Language, Record<string, string>>;
