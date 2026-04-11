-- ================================================
-- JG DASHBOARD — Script SQL Supabase
-- Colle ce script dans Supabase > SQL Editor > Run
-- ================================================

-- Table des conseilleres
CREATE TABLE IF NOT EXISTS conseilleres (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nom TEXT NOT NULL,
  email TEXT,
  telephone TEXT,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table des saisies quotidiennes
CREATE TABLE IF NOT EXISTS saisies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conseillere_id UUID REFERENCES conseilleres(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  leads_bruts INTEGER DEFAULT 0,
  indispos INTEGER DEFAULT 0,
  leads_nets INTEGER DEFAULT 0,
  echanges INTEGER DEFAULT 0,
  rdv INTEGER DEFAULT 0,
  visites INTEGER DEFAULT 0,
  ventes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(conseillere_id, date)
);

-- Table des objectifs par conseillere
CREATE TABLE IF NOT EXISTS objectifs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conseillere_id UUID REFERENCES conseilleres(id) ON DELETE CASCADE UNIQUE,
  obj_productivite NUMERIC DEFAULT 130,
  obj_conversion_tel NUMERIC DEFAULT 65,
  obj_taux_presence NUMERIC DEFAULT 60,
  obj_efficacite_comm NUMERIC DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Activer RLS (Row Level Security) - acces public pour l'instant
ALTER TABLE conseilleres ENABLE ROW LEVEL SECURITY;
ALTER TABLE saisies ENABLE ROW LEVEL SECURITY;
ALTER TABLE objectifs ENABLE ROW LEVEL SECURITY;

-- Politique d'acces : tout le monde peut lire et ecrire (a securiser plus tard avec auth)
CREATE POLICY "Public access conseilleres" ON conseilleres FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access saisies" ON saisies FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access objectifs" ON objectifs FOR ALL USING (true) WITH CHECK (true);

-- Donnees de test (6 conseilleres de base)
INSERT INTO conseilleres (nom, email) VALUES
  ('Sara Benali', 'sara@jg.ma'),
  ('Nadia Chraibi', 'nadia@jg.ma'),
  ('Lina Amrani', 'lina@jg.ma'),
  ('Rim Tazi', 'rim@jg.ma'),
  ('Yasmine Idrissi', 'yasmine@jg.ma'),
  ('Inès Bouali', 'ines@jg.ma')
ON CONFLICT DO NOTHING;
