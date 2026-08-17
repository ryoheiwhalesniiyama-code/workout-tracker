import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json()
    const secret = process.env.AUTH_SECRET

    if (!secret || password !== secret) {
      return NextResponse.json({ error: 'パスワードが違います' }, { status: 401 })
    }

    const res = NextResponse.json({ ok: true })
    res.cookies.set('auth-token', secret, {
      httpOnly: true,                                    // JSから読み取り不可
      secure: process.env.NODE_ENV === 'production',    // 本番はHTTPSのみ
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,                       // 30日間有効
      path: '/'
    })
    return res
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
