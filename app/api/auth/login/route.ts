import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAME, signToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password } = body;

    const authPassword = process.env.AUTH_PASSWORD;
    const authSecret = process.env.AUTH_SECRET;

    if (!authPassword || !authSecret) {
      return NextResponse.json(
        { success: false, error: '서버 설정 오류' },
        { status: 500 }
      );
    }

    if (password !== authPassword) {
      return NextResponse.json(
        { success: false, error: '비밀번호가 올바르지 않습니다' },
        { status: 401 }
      );
    }

    const token = await signToken(authSecret);

    const response = NextResponse.json({ success: true });
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { success: false, error: '요청 처리 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
