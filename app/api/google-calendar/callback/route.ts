import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// アクセストークン取得
async function getAccessToken(code: string): Promise<{
  access_token: string
  refresh_token: string
  expires_in: number
}> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      code,
      grant_type: 'authorization_code',
      redirect_uri: (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000') + '/api/google-calendar/callback'
    }).toString()
  })
  
  if (!response.ok) {
    const error = await response.text()
    console.error('Token exchange failed:', error)
    throw new Error('Failed to get access token')
  }
  
  return response.json()
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')
    
    // エラーハンドリング
    if (error) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/executive?tab=calendar&error=${error}`
      )
    }
    
    // 認証コードとstateの確認
    if (code && state) {
      try {
        // 認証コードでアクセストークン取得
        const tokenData = await getAccessToken(code)
        
        // stateからテナントIDとユーザーIDを取得
        const [tenantId, executiveId] = state.split(':')
        
        // トークンを保存
        await redis.set(
          `tenant:${tenantId}:executive:${executiveId}:google_token`,
          {
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expires_at: Date.now() + tokenData.expires_in * 1000
          },
          { ex: 86400 * 30 } // 30日間保存
        )
        
        // 成功ページにリダイレクト
        return NextResponse.redirect(
          `${process.env.NEXT_PUBLIC_APP_URL || 'https://ai-secretary-ten.vercel.app'}/executive?tab=calendar&connected=true`
        )
        
      } catch (err) {
        console.error('OAuth callback error:', err)
        return NextResponse.redirect(
          `${process.env.NEXT_PUBLIC_APP_URL || 'https://ai-secretary-ten.vercel.app'}/executive?tab=calendar&error=auth_failed`
        )
      }
    }
    
    // パラメータが不足している場合
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || 'https://ai-secretary-ten.vercel.app'}/executive?tab=calendar&error=missing_params`
    )
    
  } catch (error) {
    console.error('Google Calendar callback error:', error)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || 'https://ai-secretary-ten.vercel.app'}/executive?tab=calendar&error=callback_failed`
    )
  }
}