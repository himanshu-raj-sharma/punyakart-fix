/** English + all 22 Eighth Schedule languages of India. */
export const SITE_LANGUAGES = [
  { id: 'en', short: 'EN', label: 'English', native: 'English' },
  { id: 'hi', short: 'हिं', label: 'Hindi', native: 'हिन्दी' },
  { id: 'as', short: 'অস', label: 'Assamese', native: 'অসমীয়া' },
  { id: 'bn', short: 'বাং', label: 'Bengali', native: 'বাংলা' },
  { id: 'brx', short: 'बड़', label: 'Bodo', native: 'बड़ो' },
  { id: 'doi', short: 'डोग', label: 'Dogri', native: 'डोगरी' },
  { id: 'gu', short: 'ગુ', label: 'Gujarati', native: 'ગુજરાતી' },
  { id: 'kn', short: 'ಕನ್ನ', label: 'Kannada', native: 'ಕನ್ನಡ' },
  { id: 'ks', short: 'کٲش', label: 'Kashmiri', native: 'كٲشُر' },
  { id: 'kok', short: 'कों', label: 'Konkani', native: 'कोंकणी' },
  { id: 'mai', short: 'मैथ', label: 'Maithili', native: 'मैथिली' },
  { id: 'ml', short: 'മല', label: 'Malayalam', native: 'മലയാളം' },
  { id: 'mni', short: 'মৈত', label: 'Manipuri', native: 'মৈতৈলোন্' },
  { id: 'mr', short: 'मर', label: 'Marathi', native: 'मराठी' },
  { id: 'ne', short: 'नेप', label: 'Nepali', native: 'नेपाली' },
  { id: 'or', short: 'ଓଡ଼', label: 'Odia', native: 'ଓଡ଼ିଆ' },
  { id: 'pa', short: 'ਪੰ', label: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  { id: 'sa', short: 'सं', label: 'Sanskrit', native: 'संस्कृतम्' },
  { id: 'sat', short: 'ᱥᱟᱱ', label: 'Santali', native: 'ᱥᱟᱱᱛᱟᱲᱤ' },
  { id: 'sd', short: 'سنڌ', label: 'Sindhi', native: 'سنڌي' },
  { id: 'ta', short: 'த', label: 'Tamil', native: 'தமிழ்' },
  { id: 'te', short: 'తె', label: 'Telugu', native: 'తెలుగు' },
  { id: 'ur', short: 'اردو', label: 'Urdu', native: 'اردو' },
] as const;

export type Language = (typeof SITE_LANGUAGES)[number]['id'];

/** All site languages ship with UI packs under src/data/packs/. */
export type TranslatedLanguage = Language;

export function isLanguage(value: string): value is Language {
  return SITE_LANGUAGES.some((l) => l.id === value);
}

export function getLanguageMeta(id: Language) {
  return SITE_LANGUAGES.find((l) => l.id === id) ?? SITE_LANGUAGES[0];
}
