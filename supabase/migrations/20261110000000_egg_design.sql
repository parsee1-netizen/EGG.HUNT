-- Egg designs: the look a business paints onto the eggs it hides.
-- egg_design on businesses is the saved design. Null means the plain EggDrop egg.
-- egg_design on campaigns is an optional per-batch override. Null means use the business design.
-- Safe to re-run. Fresh databases that already have the columns from init skip these.

alter table public.businesses add column if not exists egg_design jsonb;
alter table public.campaigns add column if not exists egg_design jsonb;
