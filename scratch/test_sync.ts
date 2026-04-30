import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ufdixabfubowxewbphqu.supabase.co',
  'sb_secret_XFiixGDM4Y_xUkWuk7uMNQ_OAPkJP5T'
);

async function test() {
  const testSale = {
    id: 'test-' + Math.random(),
    display_id: '#999',
    date: new Date().toISOString(),
    customer_name: 'Teste Monitor',
    items: [],
    payment_method: 'cash',
    payments: [],
    total: 0,
    cashier_id: 3
  };

  console.log('Tentando inserir venda de teste...');
  const { error } = await supabase.from('sales').insert([testSale]);
  
  if (error) {
    console.error('ERRO NO SUPABASE:', error.message);
    console.error('DETALHES:', error.details);
  } else {
    console.log('Sincronização OK! O banco aceitou os dados.');
  }
}

test();
