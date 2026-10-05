import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const maxDuration = 60

type Exercise = { name: string; sets: number | null; reps: number | null; weight: number | null }

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const exercises: Exercise[] = body.exercises
    const notes: string | null = body.notes ?? null

    if (!Array.isArray(exercises)) {
      return NextResponse.json({ error: 'exercises must be an array' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('planned_menus')
      .update({ exercises, notes })
      .eq('id', id)

    if (error) {
      console.error('planned_menus update error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('next-menu PATCH error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
