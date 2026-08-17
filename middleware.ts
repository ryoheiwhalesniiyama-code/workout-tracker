import { NextRequest, NextResponse } from 'next/server'

// 認証不要のパス
const PUBLIC_PATHS = ['/login', '/api/auth']

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // ログイン・認証APIは通す
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const token = req.cookies.get('auth-token')?.value
  const secret = process.env.AUTH_SECRET

  if (!secret || token !== secret) {
    // APIルートは401を返す
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    // ページはログイン画面にリダイレクト
    const loginUrl = new URL('/login', req.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  // 静的ファイルは除外
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|icon\\.png).*)']
}
