# JG Dashboard — Guide de déploiement

## Étape 1 — Supabase (base de données)

1. Va sur https://supabase.com et connecte-toi
2. Clique **New project**, donne-lui le nom `jg-dashboard`
3. Choisis un mot de passe fort et une région proche (Europe West)
4. Attends que le projet se crée (~2 min)
5. Va dans **SQL Editor** (menu gauche)
6. Copie tout le contenu du fichier `supabase-schema.sql`
7. Colle-le dans l'éditeur et clique **Run**
8. Va dans **Settings > API** et note :
   - **Project URL** (ex: https://xxxxx.supabase.co)
   - **anon public key** (longue clé commençant par eyJ...)

## Étape 2 — GitHub (code)

1. Va sur https://github.com/nadirhk24/JG-dashboard
2. Clique **uploading an existing file** ou **Add file > Upload files**
3. Glisse-dépose TOUS les fichiers du dossier `jg-dashboard`
4. Clique **Commit changes**

## Étape 3 — Vercel (déploiement)

1. Va sur https://vercel.com et connecte-toi
2. Clique **New Project**
3. Sélectionne le repo `JG-dashboard` depuis GitHub
4. Dans **Environment Variables**, ajoute :
   - `VITE_SUPABASE_URL` = ta Project URL Supabase
   - `VITE_SUPABASE_ANON_KEY` = ta anon key Supabase
5. Clique **Deploy**
6. Ton app est en ligne en 2 minutes !

## Mise à jour après corrections

1. Modifie le fichier sur GitHub (bouton crayon)
2. Vercel redéploie automatiquement en ~1 minute

## Structure des fichiers

```
jg-dashboard/
├── index.html
├── package.json
├── vite.config.js
├── supabase-schema.sql    ← Script base de données
├── .env.example           ← Modèle variables d'env
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── lib/
    │   ├── supabase.js    ← Connexion base de données
    │   ├── kpi.js         ← Tous les calculs KPI
    │   └── dates.js       ← Filtres par période
    ├── components/
    │   ├── Sidebar.jsx
    │   ├── KpiCard.jsx
    │   ├── PeriodeFilter.jsx
    │   ├── ConseillereFilter.jsx
    │   ├── PageHeader.jsx
    │   └── SectionTitle.jsx
    └── pages/
        ├── DashboardCentreAppel.jsx
        ├── DashboardMarketing.jsx
        ├── Saisie.jsx
        ├── Conseilleres.jsx
        ├── Objectifs.jsx
        ├── VueCohort.jsx
        └── Historique.jsx
```
