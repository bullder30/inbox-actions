-- Script de création de la base de données PostgreSQL
-- Pour exécuter : psql -U postgres -f prisma/init-db.sql

-- Créer la base de données (à exécuter en tant que superuser)
DROP DATABASE IF EXISTS inbox_actions;
CREATE DATABASE inbox_actions;

-- Se connecter à la nouvelle base de données
\c inbox_actions;

-- Créer un utilisateur admin pour l'application
DROP USER IF EXISTS inbox_admin;
CREATE USER inbox_admin WITH PASSWORD '#Charlotte2013#';

-- Donner tous les privilèges sur la base de données à l'utilisateur
GRANT ALL PRIVILEGES ON DATABASE inbox_actions TO inbox_admin;
GRANT ALL ON SCHEMA public TO inbox_admin;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO inbox_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO inbox_admin;

-- Permettre à l'utilisateur de créer des tables dans le schéma public
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO inbox_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO inbox_admin;

-- Afficher un message de confirmation
\echo 'Base de données "inbox_actions" créée avec succès'
\echo 'Utilisateur "inbox_admin" créé avec succès'
\echo ''
\echo 'Pour vous connecter :'
\echo 'psql -U inbox_admin -d inbox_actions'
\echo ''
\echo 'Chaîne de connexion DATABASE_URL :'
\echo 'postgresql://inbox_admin:'#Charlotte2013#@localhost:15432/inbox_actions'
