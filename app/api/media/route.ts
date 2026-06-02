import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const brandId = req.nextUrl.searchParams.get('brandId');

  try {
    const { data, error } = await supabase
      .from('media_items')
      .select('*')
      .eq('brand_id', brandId)
      .order('uploaded_at', { ascending: false });

    if (error) {
      console.error('[api/media] Supabase error:', error.message);
      return NextResponse.json([], { status: 200 });
    }

    return NextResponse.json(Array.isArray(data) ? data : []);
  } catch (err) {
    console.error('[api/media] Unexpected error:', err);
    return NextResponse.json([], { status: 200 });
  }
}
