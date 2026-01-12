# Masterplan: @angular-schule/angular-cli-cloudflare-pages

## Executive Summary

Ein neues npm-Paket `@angular-schule/angular-cli-cloudflare-pages` das intern `angular-cli-ghpages` nutzt, aber mit Cloudflare-optimierten Defaults und eigenständigem Branding.

---

## Das Problem

### GitHub Pages 404-Problem (unlösbar)

GitHub Pages erlaubt nur `404.html` für SPA-Routing. Das funktioniert, aber:
- HTTP-Status ist **404** statt 200
- Schlecht für SEO
- Schlecht für Monitoring-Tools
- Kein Fix möglich ohne GitHub-Änderung

### Cloudflare Pages löst das nativ

> "If your project does not include a top-level 404.html file, Pages assumes that you are deploying a single-page application."
> — [Cloudflare Docs](https://developers.cloudflare.com/pages/configuration/serving-pages/)

**Ohne 404.html → Cloudflare liefert 200 OK für alle Routen!**

### Das Marketing-Problem

Der Name `angular-cli-ghpages` schreit "GitHub Pages":
- Niemand sucht nach "ghpages" wenn er Cloudflare will
- Die Cloudflare-Funktionalität ist in der README versteckt
- User müssen `--no-notfound` kennen

---

## Die Lösung

### Neues Paket mit eigenem Branding

```
@angular-schule/angular-cli-cloudflare-pages
```

- Eigenständiger npm-Eintrag
- Eigenständige README
- Gefunden bei Suche nach "cloudflare pages angular deploy"
- `@angular-schule/` Namespace prominent sichtbar

### Technisch: Shared Core via Git Subrepo

```
angular-cli-cloudflare-pages/     ← Neues Repo
├── src/
│   └── core/                     ← git subrepo von angular-cli-ghpages
├── README.md                     ← Cloudflare-fokussiert
├── package.json                  ← @angular-schule/...
└── ...
```

**Geteilt:**
- Engine (gh-pages Library Wrapper)
- Builder-Logik
- Kernlogik & Tests

**Eigenständig:**
- README mit Cloudflare-Fokus
- Defaults: `notfound: false` (kein 404.html!)
- Schema.json (ggf. reduziert, ohne GitHub-spezifische Optionen)
- Paketname & Branding

---

## Warum Git-basiert statt Wrangler?

### Option: Direct Upload via Wrangler

```bash
ng build && wrangler pages deploy dist/
```

**Nachteile:**
- Kein Git = keine Build-Historie
- Rollback nur via Cloudflare Dashboard (begrenzt)
- Braucht API Token
- Kein Audit Trail

### Option: Git-basiert (unser Ansatz)

```bash
ng deploy  # → pusht zu Branch → Cloudflare deployed
```

**Vorteile:**
- **Unlimitierte Build-Historie** in Git
- **Rollback** via Git (`git revert`, Branch zurücksetzen)
- **Audit Trail** im Repository
- **Kein API Token** nötig (nur Git-Credentials)
- Bewährte Technik aus angular-cli-ghpages

---

## Vergleich: GitHub Pages vs. Cloudflare Pages

| Kriterium | GitHub Pages | Cloudflare Pages |
|-----------|--------------|------------------|
| SPA Routing | 404.html Hack (404 Status) | Native (200 OK) |
| Performance | OK | Schnelleres CDN |
| Build-Historie | Git | Git |
| Rollback | Git | Git |
| Preview Deploys | Nein | Ja (automatisch) |
| Custom Domains | Ja | Ja |
| HTTPS | Ja | Ja |

---

## User Journey

### Vorher (angular-cli-ghpages für Cloudflare)

1. User sucht "angular cloudflare pages deploy"
2. Findet angular-cli-ghpages nicht (Name!)
3. Oder: Findet es, denkt "das ist für GitHub"
4. Oder: Liest README komplett, findet Cloudflare-Sektion
5. Muss `--no-notfound` verstehen und setzen

### Nachher (@angular-schule/angular-cli-cloudflare-pages)

1. User sucht "angular cloudflare pages deploy"
2. Findet `@angular-schule/angular-cli-cloudflare-pages`
3. `ng add @angular-schule/angular-cli-cloudflare-pages`
4. `ng deploy`
5. Fertig. Richtige Defaults. 200 OK.

---

## README-Struktur (Entwurf)

```markdown
# @angular-schule/angular-cli-cloudflare-pages

Deploy your Angular app to Cloudflare Pages with proper SPA routing!

## Why this package?

| Problem | Solution |
|---------|----------|
| GitHub Pages returns 404 for SPA routes | Cloudflare returns **200 OK** |
| No build history with Wrangler | **Git-based = unlimited history** |
| Complex setup | **One command: `ng deploy`** |

## Quick Start

1. Install:
   ```bash
   ng add @angular-schule/angular-cli-cloudflare-pages
   ```

2. Connect your repo to Cloudflare Pages (Dashboard)

3. Deploy:
   ```bash
   ng deploy
   ```

## How it works

1. `ng deploy` builds your app
2. Pushes build output to a Git branch
3. Cloudflare detects the push and deploys
4. No 404.html = Cloudflare enables SPA mode (200 OK)

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--branch` | Target branch | `cloudflare-pages` |
| `--repo` | Repository URL | auto-detected |
| `--dry-run` | Preview without deploying | `false` |

## Comparison

[Table comparing GitHub Pages, Cloudflare via Wrangler, Cloudflare via this package]

## Powered by

This package is built on top of [angular-cli-ghpages](https://github.com/angular-schule/angular-cli-ghpages),
the battle-tested deployment tool trusted by 50,000+ weekly downloads.

---

Made with ❤️ by [Angular.Schule](https://angular.schule)
```

---

## Technische Umsetzung

### Repo-Struktur

```
angular-cli-cloudflare-pages/
├── .github/
│   └── workflows/
│       └── ci.yml
├── src/
│   ├── core/                    # ← git subrepo: angular-cli-ghpages/src
│   ├── deploy/
│   │   ├── builder.ts           # Re-export mit anderen Defaults
│   │   └── schema.json          # Cloudflare-spezifisch
│   ├── ng-add.ts                # Angepasst für Cloudflare
│   └── index.ts
├── README.md
├── CHANGELOG.md
├── package.json
├── tsconfig.json
└── ...
```

### Defaults ändern

```typescript
// src/deploy/defaults.ts
export const defaults = {
  ...coreDefaults,
  notfound: false,        // KEIN 404.html für Cloudflare!
  branch: 'cloudflare-pages',  // Anderer Default-Branch
};
```

### package.json

```json
{
  "name": "@angular-schule/angular-cli-cloudflare-pages",
  "version": "1.0.0",
  "description": "Deploy Angular to Cloudflare Pages with proper SPA routing (200 OK)",
  "keywords": [
    "angular",
    "cloudflare",
    "cloudflare pages",
    "deploy",
    "ng deploy",
    "SPA"
  ],
  "repository": {
    "type": "git",
    "url": "git+https://github.com/angular-schule/angular-cli-cloudflare-pages.git"
  },
  "author": {
    "name": "Angular.Schule",
    "url": "https://angular.schule"
  }
}
```

---

## Offene Fragen

1. **Subrepo vs. npm dependency?**
   - Subrepo: Mehr Kontrolle, aber komplexeres Setup
   - npm dependency: Einfacher, aber weniger Kontrolle über Internals

2. **Welche Optionen ausblenden?**
   - `--cname`? (Cloudflare hat eigene Domain-Verwaltung)
   - `--nojekyll`? (Irrelevant für Cloudflare)

3. **Default Branch Name?**
   - `cloudflare-pages`?
   - `cf-pages`?
   - `deploy`?

4. **ng add Prompts?**
   - Nach Cloudflare Project Name fragen?
   - Nur Repo-Verbindung erklären?

---

## Nächste Schritte

- [ ] Neues GitHub Repo erstellen: `angular-schule/angular-cli-cloudflare-pages`
- [ ] Basis-Struktur aufsetzen
- [ ] Subrepo oder Dependency entscheiden
- [ ] Schema.json für Cloudflare anpassen
- [ ] Defaults setzen (notfound: false)
- [ ] README schreiben
- [ ] Tests anpassen/übernehmen
- [ ] npm Org `@angular-schule` einrichten (falls nicht vorhanden)
- [ ] Erste Version publishen
- [ ] In angular-cli-ghpages README verlinken

---

## Erfolgskriterien

1. **Auffindbarkeit**: "angular cloudflare pages deploy" → findet unser Paket
2. **Einfachheit**: `ng add` + `ng deploy` = fertig
3. **Korrektheit**: 200 OK für alle SPA-Routen
4. **Wartbarkeit**: Shared Core, minimale Duplikation
5. **Branding**: `@angular-schule/` sichtbar

---

## Ressourcen

- [Cloudflare Pages SPA Routing](https://developers.cloudflare.com/pages/configuration/serving-pages/)
- [Cloudflare Pages Redirects](https://developers.cloudflare.com/pages/configuration/redirects/)
- [angular-cli-ghpages](https://github.com/angular-schule/angular-cli-ghpages)
- [Wrangler Configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)
