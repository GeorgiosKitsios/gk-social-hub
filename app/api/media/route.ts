import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const brandId = req.nextUrl.searchParams.get('brandId');

  const { data, error } = await supabase
    .from('media_items')
    .select('*')
    .eq('brand_id', brandId)
    .order('uploaded_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
