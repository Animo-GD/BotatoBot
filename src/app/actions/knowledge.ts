'use server';

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function storeKnowledge(userId: string, filename: string, chunks: string[]) {
  try {
    if (!chunks || chunks.length === 0) throw new Error('No content to store');

    const supabase = createClient(supabaseUrl, supabaseKey);

    const insertData = chunks.map((chunk, idx) => ({
      user_id: userId,
      filename: filename,
      content: chunk,
      metadata: {
        chunk_index: idx,
        total_chunks: chunks.length,
        uploaded_at: new Date().toISOString()
      }
    }));

    const { error } = await supabase
      .schema('batata')
      .from('knowledge')
      .insert(insertData);

    if (error) throw error;

    return { success: true, count: chunks.length };
  } catch (error: any) {
    console.error('STORE_KNOWLEDGE_ERROR:', error.message);
    return { success: false, error: error.message };
  }
}

export async function deleteKnowledge(userId: string, filename: string) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { error } = await supabase
      .schema('batata')
      .from('knowledge')
      .delete()
      .eq('user_id', userId)
      .eq('filename', filename);

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error('DELETE_KNOWLEDGE_ERROR:', error.message);
    return { success: false, error: error.message };
  }
}
