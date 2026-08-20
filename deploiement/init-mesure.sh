#!/bin/sh
# ============================================================
#  LA SECONDE BASE, POUR LA MESURE
# ============================================================
#
#  Umami veut une base à lui. Il la prend dans la même instance, sous un
#  nom à lui : deux moteurs Postgres sur un VPS d'une personne, c'est
#  deux fois la mémoire et deux sauvegardes, pour une isolation que deux
#  bases donnent déjà. Ce qui compte est qu'aucune migration d'Umami ne
#  touche aux tables du classeur, et ça, deux bases le garantissent.
#
#  CE SCRIPT NE TOURNE QU'UNE FOIS : Postgres ne joue ce répertoire que
#  sur un volume VIDE. Sur une installation qui tourne déjà, la base se
#  crée à la main :
#
#      docker compose exec base createdb -U <utilisateur> mesure
# ============================================================
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
	CREATE DATABASE mesure;
EOSQL
