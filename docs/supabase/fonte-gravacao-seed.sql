-- Fonte de gravação do Gravador de Textos CNC (traço simples, 10 mm de altura)
-- Gerada a partir da série ALFA. Unidades em mm; coordenadas absolutas relativas à origem de cada caractere.
-- Regra: uma versão publicada da fonte é imutável. Corrigir um caractere = nova versão (nova linha em engraving_fonts).
-- Ajuste os nomes de tabelas e colunas ao padrão de nomenclatura do Supabase do projeto antes de aplicar.
-- NÃO executar em produção sem testar antes em ambiente de teste.

create table if not exists public.engraving_fonts (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  name text not null,
  version integer not null default 1,
  height_ref numeric not null default 10,
  units text not null default 'mm',
  author text,
  license text,
  source text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (slug, version)
);

create table if not exists public.engraving_glyphs (
  font_id uuid not null references public.engraving_fonts(id) on delete cascade,
  char text not null check (char_length(char) = 1),
  advance numeric not null,
  bbox jsonb not null,
  strokes jsonb not null,
  provisional boolean not null default false,
  primary key (font_id, char)
);

alter table public.engraving_fonts enable row level security;
alter table public.engraving_glyphs enable row level security;

-- Leitura liberada só para autenticados (padrão do app_users; sem anon).
-- Escrita só pelo painel ou service role. NÃO executar ainda (sem Fase 1).
create policy "engraving_fonts_select" on public.engraving_fonts for select to authenticated using (true);
create policy "engraving_glyphs_select" on public.engraving_glyphs for select to authenticated using (true);

with f as (
  insert into public.engraving_fonts (slug, name, version, height_ref, units, author, license, source)
  values ('traco-simples-10', 'Traço simples 10 mm (série ALFA)', 1, 10, 'mm', 'André (série ALFA, desenhada à mão em Heidenhain)', 'Obra própria do autor', 'Série ALFA desenhada à mão em Heidenhain (um arquivo .H por caractere), convertida em coordenadas absolutas')
  on conflict (slug, version) do nothing
  returning id
)
insert into public.engraving_glyphs (font_id, char, advance, bbox, strokes, provisional)
select f.id, v.char, v.advance, v.bbox, v.strokes, v.provisional
from f, (values
  ('0', 7.0, '[0.0, 0.0, 5.0, 10.0]'::jsonb, $j$[{"from":[0.0,2.5],"segs":[{"t":"A","to":[5.0,2.5],"c":[2.5,2.5],"cw":false},{"t":"L","to":[5.0,7.5]},{"t":"A","to":[0.0,7.5],"c":[2.5,7.5],"cw":false},{"t":"L","to":[0.0,2.5]}]}]$j$::jsonb, true),
  ('1', 4.5, '[1.0, 0.0, 2.5, 10.0]'::jsonb, $j$[{"from":[1.0,7.5],"segs":[{"t":"A","to":[2.5,10.0],"c":[-0.4984,10.099],"cw":false},{"t":"L","to":[2.5,0.0]}]}]$j$::jsonb, false),
  ('2', 7.0, '[0.0, 0.0, 5.0, 10.0]'::jsonb, $j$[{"from":[0.0,7.5],"segs":[{"t":"A","to":[4.2678,5.7322],"c":[2.5,7.5],"cw":true},{"t":"L","to":[0.0,0.0]},{"t":"L","to":[5.0,0.0]}]}]$j$::jsonb, false),
  ('3', 7.0, '[0.0, 0.0, 5.0, 10.0]'::jsonb, $j$[{"from":[0.0,7.5],"segs":[{"t":"A","to":[2.5,5.0],"c":[2.5,7.5],"cw":true},{"t":"A","to":[0.0,2.5],"c":[2.5,2.5],"cw":true}]}]$j$::jsonb, false),
  ('4', 7.5, '[0.0, 0.0, 5.0, 10.0]'::jsonb, $j$[{"from":[2.5,10.0],"segs":[{"t":"L","to":[0.0,5.0]},{"t":"L","to":[5.0,5.0]}]},{"from":[3.0,8.0],"segs":[{"t":"L","to":[3.0,0.0]}]}]$j$::jsonb, false),
  ('5', 7.0, '[0.0, 0.0, 5.0, 10.0]'::jsonb, $j$[{"from":[0.0,2.5],"segs":[{"t":"A","to":[5.0,2.5],"c":[2.5,2.5],"cw":false},{"t":"L","to":[5.0,3.5]},{"t":"A","to":[2.5,6.0],"c":[2.5,3.5],"cw":false},{"t":"L","to":[0.0,6.0]},{"t":"L","to":[0.0,10.0]},{"t":"L","to":[5.0,10.0]}]}]$j$::jsonb, false),
  ('6', 7.0, '[0.0, 0.0, 5.0, 10.0]'::jsonb, $j$[{"from":[5.0,7.5],"segs":[{"t":"A","to":[0.0,7.5],"c":[2.5,7.5],"cw":false},{"t":"L","to":[0.0,2.5]},{"t":"A","to":[5.0,2.5],"c":[2.5,2.5],"cw":true},{"t":"A","to":[0.0,2.5],"c":[2.5,2.5],"cw":true}]}]$j$::jsonb, false),
  ('7', 7.0, '[0.0, 0.0, 5.0, 10.0]'::jsonb, $j$[{"from":[0.0,10.0],"segs":[{"t":"L","to":[5.0,10.0]},{"t":"L","to":[5.0,8.0]},{"t":"A","to":[2.5,4.0],"c":[7.4887,3.6633],"cw":false},{"t":"L","to":[2.5,0.0]}]}]$j$::jsonb, false),
  ('8', 7.0, '[0.0, 0.0, 5.0, 10.0]'::jsonb, $j$[{"from":[2.5,5.0],"segs":[{"t":"A","to":[2.5,10.0],"c":[2.5,7.5],"cw":false},{"t":"A","to":[2.5,5.0],"c":[2.5,7.5],"cw":false},{"t":"A","to":[2.5,0.0],"c":[2.5,2.5],"cw":false},{"t":"A","to":[2.5,5.0],"c":[2.5,2.5],"cw":false}]}]$j$::jsonb, false),
  ('9', 7.0, '[0.0, 0.0, 5.0, 10.0]'::jsonb, $j$[{"from":[0.0,2.5],"segs":[{"t":"A","to":[5.0,2.5],"c":[2.5,2.5],"cw":false},{"t":"L","to":[5.0,7.5]},{"t":"A","to":[0.0,7.5],"c":[2.5,7.5],"cw":true},{"t":"A","to":[5.0,7.5],"c":[2.5,7.5],"cw":true}]}]$j$::jsonb, false),
  ('A', 7.0, '[0.0, 0.0, 5.0, 10.0]'::jsonb, $j$[{"from":[0.0,0.0],"segs":[{"t":"L","to":[2.5,10.0]},{"t":"L","to":[5.0,0.0]},{"t":"L","to":[3.75,5.0]},{"t":"L","to":[1.25,5.0]}]}]$j$::jsonb, false),
  ('B', 7.0, '[0.0, 0.0, 4.0, 10.0]'::jsonb, $j$[{"from":[0.0,0.0],"segs":[{"t":"L","to":[0.0,10.0]},{"t":"L","to":[1.5,10.0]},{"t":"A","to":[1.5,5.0],"c":[1.5,7.5],"cw":true},{"t":"A","to":[1.5,0.0],"c":[1.5,2.5],"cw":true},{"t":"L","to":[0.0,0.0]}]}]$j$::jsonb, false),
  ('C', 7.0, '[0.0, 0.0, 5.0, 10.0]'::jsonb, $j$[{"from":[5.0,10.0],"segs":[{"t":"L","to":[2.5,10.0]},{"t":"A","to":[0.0,7.5],"c":[2.5,7.5],"cw":false},{"t":"L","to":[0.0,2.5]},{"t":"A","to":[2.5,0.0],"c":[2.5,2.5],"cw":false},{"t":"L","to":[5.0,0.0]}]}]$j$::jsonb, false),
  ('D', 7.0, '[0.0, 0.0, 5.0, 10.0]'::jsonb, $j$[{"from":[0.0,0.0],"segs":[{"t":"L","to":[2.0,0.0]},{"t":"A","to":[5.0,3.0],"c":[2.0,3.0],"cw":false},{"t":"L","to":[5.0,7.0]},{"t":"A","to":[2.0,10.0],"c":[2.0,7.0],"cw":false},{"t":"L","to":[0.0,10.0]},{"t":"L","to":[0.0,0.0]}]}]$j$::jsonb, false),
  ('E', 7.0, '[0.0, 0.0, 5.0, 10.0]'::jsonb, $j$[{"from":[5.0,0.0],"segs":[{"t":"L","to":[0.0,0.0]},{"t":"L","to":[0.0,10.0]},{"t":"L","to":[5.0,10.0]},{"t":"L","to":[0.0,10.0]},{"t":"L","to":[0.0,5.0]},{"t":"L","to":[3.0,5.0]}]}]$j$::jsonb, false),
  ('F', 7.0, '[0.0, 0.0, 5.0, 10.0]'::jsonb, $j$[{"from":[0.0,0.0],"segs":[{"t":"L","to":[0.0,5.0]},{"t":"L","to":[3.0,5.0]},{"t":"L","to":[0.0,5.0]},{"t":"L","to":[0.0,10.0]},{"t":"L","to":[5.0,10.0]}]}]$j$::jsonb, false),
  ('G', 7.0, '[0.0, 0.0, 5.0, 10.0]'::jsonb, $j$[{"from":[5.0,10.0],"segs":[{"t":"L","to":[2.5,10.0]},{"t":"A","to":[0.0,7.5],"c":[2.5,7.5],"cw":false},{"t":"L","to":[0.0,2.5]},{"t":"A","to":[2.5,0.0],"c":[2.5,2.5],"cw":false},{"t":"L","to":[5.0,0.0]},{"t":"L","to":[5.0,5.0]},{"t":"L","to":[2.0,5.0]},{"t":"L","to":[2.0,3.0]}]}]$j$::jsonb, false),
  ('H', 7.0, '[0.0, 0.0, 5.0, 10.0]'::jsonb, $j$[{"from":[0.0,0.0],"segs":[{"t":"L","to":[0.0,10.0]},{"t":"L","to":[0.0,5.0]},{"t":"L","to":[5.0,5.0]},{"t":"L","to":[5.0,10.0]},{"t":"L","to":[5.0,0.0]}]}]$j$::jsonb, false),
  ('I', 2.0, '[0.0, 0.0, 0.0, 10.0]'::jsonb, $j$[{"from":[0.0,0.0],"segs":[{"t":"L","to":[0.0,10.0]}]}]$j$::jsonb, false),
  ('J', 7.0, '[0.0, 0.0, 5.0, 10.0]'::jsonb, $j$[{"from":[0.0,2.5],"segs":[{"t":"A","to":[5.0,2.5],"c":[2.5,2.5],"cw":false},{"t":"L","to":[5.0,10.0]}]}]$j$::jsonb, false),
  ('K', 7.0, '[0.0, 0.0, 5.0, 10.0]'::jsonb, $j$[{"from":[0.0,0.0],"segs":[{"t":"L","to":[0.0,10.0]}]},{"from":[5.0,10.0],"segs":[{"t":"L","to":[0.0,4.0]},{"t":"L","to":[0.833,5.0]},{"t":"L","to":[5.0,0.0]}]}]$j$::jsonb, false),
  ('L', 7.0, '[0.0, 0.0, 5.0, 10.0]'::jsonb, $j$[{"from":[0.0,10.0],"segs":[{"t":"L","to":[0.0,0.0]},{"t":"L","to":[5.0,0.0]}]}]$j$::jsonb, false),
  ('M', 7.0, '[0.0, 0.0, 5.0, 10.0]'::jsonb, $j$[{"from":[0.0,0.0],"segs":[{"t":"L","to":[0.0,10.0]},{"t":"L","to":[2.5,5.0]},{"t":"L","to":[5.0,10.0]},{"t":"L","to":[5.0,0.0]}]}]$j$::jsonb, false),
  ('N', 7.0, '[0.0, 0.0, 5.0, 10.0]'::jsonb, $j$[{"from":[0.0,0.0],"segs":[{"t":"L","to":[0.0,10.0]},{"t":"L","to":[5.0,0.0]},{"t":"L","to":[5.0,10.0]}]}]$j$::jsonb, false),
  ('O', 7.0, '[0.0, 0.0, 5.0, 10.0]'::jsonb, $j$[{"from":[0.0,2.5],"segs":[{"t":"A","to":[5.0,2.5],"c":[2.5,2.5],"cw":false},{"t":"L","to":[5.0,7.5]},{"t":"A","to":[0.0,7.5],"c":[2.5,7.5],"cw":false},{"t":"L","to":[0.0,2.5]}]}]$j$::jsonb, false),
  ('P', 7.0, '[0.0, 0.0, 5.0, 10.0]'::jsonb, $j$[{"from":[0.0,0.0],"segs":[{"t":"L","to":[0.0,10.0]},{"t":"L","to":[2.0,10.0]},{"t":"A","to":[2.0,4.0],"c":[2.0,7.0],"cw":true},{"t":"L","to":[0.0,4.0]}]}]$j$::jsonb, false),
  ('Q', 7.0, '[0.0, 0.0, 5.0, 10.0]'::jsonb, $j$[{"from":[0.0,2.5],"segs":[{"t":"A","to":[5.0,2.5],"c":[2.5,2.5],"cw":false},{"t":"L","to":[5.0,7.5]},{"t":"A","to":[0.0,7.5],"c":[2.5,7.5],"cw":false},{"t":"L","to":[0.0,2.5]}]},{"from":[2.5,2.5],"segs":[{"t":"L","to":[5.0,0.0]}]}]$j$::jsonb, false),
  ('R', 7.0, '[0.0, 0.0, 5.0, 10.0]'::jsonb, $j$[{"from":[0.0,0.0],"segs":[{"t":"L","to":[0.0,10.0]},{"t":"L","to":[2.0,10.0]},{"t":"A","to":[2.0,4.0],"c":[2.0,7.0],"cw":true},{"t":"L","to":[0.0,4.0]},{"t":"L","to":[2.0,4.0]},{"t":"L","to":[5.0,0.0]}]}]$j$::jsonb, false),
  ('S', 7.0, '[0.0, 0.0, 5.0, 10.0]'::jsonb, $j$[{"from":[5.0,7.5],"segs":[{"t":"A","to":[2.5,5.0],"c":[2.5,7.5],"cw":false},{"t":"A","to":[0.0,2.5],"c":[2.5,2.5],"cw":true}]}]$j$::jsonb, false),
  ('T', 7.0, '[0.0, 0.0, 5.0, 10.0]'::jsonb, $j$[{"from":[2.5,0.0],"segs":[{"t":"L","to":[2.5,10.0]},{"t":"L","to":[0.0,10.0]},{"t":"L","to":[5.0,10.0]}]}]$j$::jsonb, false),
  ('U', 7.0, '[0.0, 0.0, 5.0, 10.0]'::jsonb, $j$[{"from":[0.0,10.0],"segs":[{"t":"L","to":[0.0,2.5]},{"t":"A","to":[5.0,2.5],"c":[2.5,2.5],"cw":false},{"t":"L","to":[5.0,10.0]}]}]$j$::jsonb, false),
  ('V', 7.0, '[0.0, 0.0, 5.0, 10.0]'::jsonb, $j$[{"from":[0.0,10.0],"segs":[{"t":"L","to":[2.5,0.0]},{"t":"L","to":[5.0,10.0]}]}]$j$::jsonb, false),
  ('W', 7.0, '[0.0, 0.0, 5.0, 10.0]'::jsonb, $j$[{"from":[0.0,10.0],"segs":[{"t":"L","to":[0.0,0.0]},{"t":"L","to":[2.5,5.0]},{"t":"L","to":[5.0,0.0]},{"t":"L","to":[5.0,10.0]}]}]$j$::jsonb, false),
  ('X', 7.0, '[0.0, 0.0, 5.0, 10.0]'::jsonb, $j$[{"from":[0.0,0.0],"segs":[{"t":"L","to":[5.0,10.0]}]},{"from":[0.0,10.0],"segs":[{"t":"L","to":[5.0,0.0]}]}]$j$::jsonb, false),
  ('Y', 8.0, '[0.0, 0.0, 5.0, 10.0]'::jsonb, $j$[{"from":[0.0,10.0],"segs":[{"t":"L","to":[2.5,6.0]},{"t":"L","to":[5.0,10.0]},{"t":"L","to":[2.5,6.0]},{"t":"L","to":[2.5,0.0]}]}]$j$::jsonb, false),
  ('Z', 7.0, '[0.0, 0.0, 5.0, 10.0]'::jsonb, $j$[{"from":[0.0,10.0],"segs":[{"t":"L","to":[5.0,10.0]},{"t":"L","to":[0.0,0.0]},{"t":"L","to":[5.0,0.0]}]}]$j$::jsonb, false),
  (' ', 5.0, '[0, 0, 0, 0]'::jsonb, $j$[]$j$::jsonb, false)
) as v(char, advance, bbox, strokes, provisional);
