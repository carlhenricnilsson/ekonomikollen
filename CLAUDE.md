@AGENTS.md

# Arbetsregler

## Tilltal
Använd alltid "du" när du pratar med användaren – aldrig "ni".

## Kontextrapportering
Rapportera vid varje jämnt 10%-inkrement av använd kontextkapacitet (10%, 20%, 30% osv).
Rapporten ska innehålla: aktuell användning i % + kort sammanfattning av vad som gjorts sedan förra rapporten.

# Supabase – Regler för databasbehörigheter

## ALLTID när en ny tabell skapas i en migration:
1. Lägg till explicita GRANT-satser direkt efter `CREATE TABLE` i migrationsfilen:
   ```sql
   GRANT SELECT, INSERT, UPDATE, DELETE ON public.<tabell> TO authenticated;
   ```
2. Kör SQL:en mot live-databasen via Supabase SQL Editor (supabase.com/dashboard/project/adkctbhvitynfptzzpbo/sql/new) med Chrome MCP.

## Bakgrund
Fr.o.m. 2026-10-30 ger Supabase inte längre automatiska grants på nya tabeller.
Befintliga tabeller säkrades 2026-05-14 via migration 003_grant_permissions.sql.
