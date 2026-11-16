import { LANGS, Lang, setLang, t as tr, useLang } from '../lib/i18n';
import { sfx } from '../lib/sound';

/** Small language dropdown for the main screen. English is the default; the choice is remembered on this device.
 *  Closed it shows a globe and a short code (EN / ES / HI); the real <select> sits invisibly on top, so the list that opens shows the full names. */
export function LangPicker() {
  const lang = useLang();
  return (
    <label className="lang-pick" title={tr("Language")}>
      <span className="lang-globe" aria-hidden="true">🌐</span>
      <span className="lang-code" aria-hidden="true">{lang.toUpperCase()}</span>
      <span className="lang-caret" aria-hidden="true" />
      <select value={lang} aria-label={tr("Language")} onChange={(e) => { sfx.click(); void setLang(e.target.value as Lang); }}>
        {LANGS.map((l) => <option key={l.id} value={l.id} lang={l.id}>{l.name}</option>)}
      </select>
    </label>
  );
}
