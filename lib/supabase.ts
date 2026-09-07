import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
export const supabase = createClient(supabaseUrl, supabaseKey);

export const uploadImage = async (file: File) => {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Math.random()}.${fileExt}`;
  const { error } = await supabase.storage.from('menu-images').upload(fileName, file); 
  if (error) throw error;
  const { data } = supabase.storage.from('menu-images').getPublicUrl(fileName); 
  return data.publicUrl;
};