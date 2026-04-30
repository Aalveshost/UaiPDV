import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ufdixabfubowxewbphqu.supabase.co',
  'sb_secret_XFiixGDM4Y_xUkWuk7uMNQ_OAPkJP5T'
);

async function reset() {
  console.log('Limpando tabela sales no Supabase...');
  const { error } = await supabase.from('sales').delete().neq('display_id', '0');
  if (error) console.error(error);
  else console.log('Supabase limpo!');
}

reset();
