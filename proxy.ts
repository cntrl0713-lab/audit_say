import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Supabase 세션 갱신.
//
// 액세스 토큰은 한 시간 정도면 만료된다. 브라우저 클라이언트는 스스로 갱신하지만, 갱신된
// 토큰을 쿠키에 다시 심어주는 주체가 없으면 **서버가 보는 쿠키는 만료된 상태로 남는다.**
// 그러면 답안을 오래 작성한 뒤 제출하는 순간 서버 액션의 assertAuthenticated()가
// Unauthorized를 던지고, 초안 저장이 없으므로 작성한 답안이 통째로 사라진다.
//
// 여기서 매 요청마다 getUser()를 호출하면 @supabase/ssr이 필요할 때 토큰을 갱신하고
// setAll로 새 쿠키를 응답에 실어준다. lib/supabaseServer.ts의 setAll이 조용히 실패해도
// 되는 이유가 바로 이 파일의 존재다.
//
// 이 파일은 Next.js 16의 proxy 규약이다 (구 middleware.ts — 16.0.0에서 이름이 바뀌었고
// 기본 런타임도 Node.js가 됐다). 파일명이나 export 이름이 다르면 조용히 실행되지 않는다.

export async function proxy(request: NextRequest) {
    let response = NextResponse.next({ request });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => {
                        request.cookies.set(name, value);
                    });
                    response = NextResponse.next({ request });
                    cookiesToSet.forEach(({ name, value, options }) => {
                        response.cookies.set(name, value, options);
                    });
                },
            },
        }
    );

    // 이 호출이 갱신을 유발한다. 반환값은 쓰지 않지만 제거하면 안 된다 —
    // 호출이 없으면 토큰이 갱신되지 않고 위 setAll도 실행되지 않는다.
    // 인증 여부로 접근을 막지는 않는다. 권한 판단은 서버 액션이
    // assertAuthenticated/assertAdmin/assertSelf로 수행한다.
    await supabase.auth.getUser();

    return response;
}

export const config = {
    // 정적 자산에는 돌릴 이유가 없다. matcher가 없으면 _next/static과 public의 파일까지
    // 전부 통과하면서 불필요한 Auth 호출이 발생한다.
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
    ],
};
