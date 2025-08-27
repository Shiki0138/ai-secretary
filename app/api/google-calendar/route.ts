/**
 * Google Calendar連携API
 * OAuth認証とカレンダーイベントの同期
 */

import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// Google OAuth設定
const GOOGLE_OAUTH_CONFIG = {
  clientId: process.env.GOOGLE_CLIENT_ID || 'your-client-id',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'your-client-secret',
  redirectUri: (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000') + '/api/google-calendar',
  scopes: [
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.events'
  ]
}

// Google Calendar Event型定義
interface GoogleCalendarEvent {
  id: string
  summary: string
  description?: string
  start: {
    dateTime?: string
    date?: string
  }
  end: {
    dateTime?: string
    date?: string
  }
  location?: string
  attendees?: Array<{
    email: string
    displayName?: string
  }>
  status: string
}

// OAuth認証URL生成
function generateAuthUrl(tenantId: string, executiveId: string): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_OAUTH_CONFIG.clientId,
    redirect_uri: GOOGLE_OAUTH_CONFIG.redirectUri,
    response_type: 'code',
    scope: GOOGLE_OAUTH_CONFIG.scopes.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state: `${tenantId}:${executiveId}` // テナントIDとユーザーIDを状態として保存
  })
  
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

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
      client_id: GOOGLE_OAUTH_CONFIG.clientId,
      client_secret: GOOGLE_OAUTH_CONFIG.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: GOOGLE_OAUTH_CONFIG.redirectUri
    }).toString()
  })
  
  if (!response.ok) {
    throw new Error('Failed to get access token')
  }
  
  return response.json()
}

// リフレッシュトークンでアクセストークンを更新
async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string
  expires_in: number
}> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_OAUTH_CONFIG.clientId,
      client_secret: GOOGLE_OAUTH_CONFIG.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    }).toString()
  })
  
  if (!response.ok) {
    throw new Error('Failed to refresh access token')
  }
  
  return response.json()
}

// Google Calendar API呼び出し
async function callGoogleCalendarAPI(
  tenantId: string, 
  executiveId: string, 
  endpoint: string, 
  options: RequestInit = {}
): Promise<Response> {
  // アクセストークン取得
  const tokenData = await redis.get(`tenant:${tenantId}:executive:${executiveId}:google_token`) as {
    access_token: string
    refresh_token: string
    expires_at: number
  } | null
  
  if (!tokenData) {
    throw new Error('Google Calendar not connected')
  }
  
  let accessToken = tokenData.access_token
  
  // トークンの有効期限チェック
  if (Date.now() >= tokenData.expires_at) {
    try {
      const refreshed = await refreshAccessToken(tokenData.refresh_token)
      accessToken = refreshed.access_token
      
      // 更新されたトークンを保存
      await redis.set(
        `tenant:${tenantId}:executive:${executiveId}:google_token`,
        {
          ...tokenData,
          access_token: accessToken,
          expires_at: Date.now() + refreshed.expires_in * 1000
        },
        { ex: 86400 * 30 }
      )
    } catch (error) {
      throw new Error('Failed to refresh Google access token')
    }
  }
  
  return fetch(`https://www.googleapis.com/calendar/v3${endpoint}`, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  })
}

export async function POST(request: NextRequest) {
  try {
    const { action, data } = await request.json()
    
    switch (action) {
      case 'connect': {
        const { tenantId, executiveId } = data
        
        if (!tenantId || !executiveId) {
          return NextResponse.json({
            error: 'Missing required fields'
          }, { status: 400 })
        }
        
        // OAuth認証URL生成
        const authUrl = generateAuthUrl(tenantId, executiveId)
        
        // デバッグ用ログ
        console.log('Generated OAuth URL:', authUrl)
        console.log('Client ID:', GOOGLE_OAUTH_CONFIG.clientId)
        console.log('Redirect URI:', GOOGLE_OAUTH_CONFIG.redirectUri)
        
        return NextResponse.json({
          authUrl,
          message: 'このURLでGoogleカレンダーと連携してください'
        })
      }
      
      case 'disconnect': {
        const { tenantId, executiveId } = data
        
        if (!tenantId || !executiveId) {
          return NextResponse.json({
            error: 'Missing required fields'
          }, { status: 400 })
        }
        
        // 保存されたトークンを削除
        await redis.del(`tenant:${tenantId}:executive:${executiveId}:google_token`)
        
        return NextResponse.json({
          message: 'Googleカレンダーの連携を解除しました'
        })
      }
      
      case 'sync_events': {
        const { tenantId, executiveId, startDate, endDate } = data
        
        if (!tenantId || !executiveId) {
          return NextResponse.json({
            error: 'Missing required fields'
          }, { status: 400 })
        }
        
        try {
          // Google Calendarからイベント取得
          const params = new URLSearchParams({
            timeMin: startDate || new Date().toISOString(),
            timeMax: endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            singleEvents: 'true',
            orderBy: 'startTime',
            maxResults: '100'
          })
          
          const response = await callGoogleCalendarAPI(
            tenantId,
            executiveId,
            `/calendars/primary/events?${params.toString()}`
          )
          
          if (!response.ok) {
            throw new Error('Google Calendar API error')
          }
          
          const result = await response.json()
          const googleEvents: GoogleCalendarEvent[] = result.items || []
          
          // 内部カレンダーに同期
          const syncedEvents = []
          
          for (const gEvent of googleEvents) {
            if (gEvent.status === 'cancelled') continue
            
            // 内部フォーマットに変換
            const internalEvent = {
              tenantId,
              executiveId,
              title: gEvent.summary || '無題',
              description: gEvent.description,
              startTime: gEvent.start.dateTime || gEvent.start.date,
              endTime: gEvent.end.dateTime || gEvent.end.date,
              location: gEvent.location,
              type: 'meeting' as const,
              status: 'confirmed' as const,
              createdBy: 'google_sync'
            }
            
            // 内部カレンダーAPIに保存
            const syncResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://ai-secretary-ten.vercel.app'}/api/calendar`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'create_event',
                data: internalEvent
              })
            })
            
            if (syncResponse.ok) {
              syncedEvents.push(internalEvent)
            }
          }
          
          return NextResponse.json({
            message: `${syncedEvents.length}件のイベントを同期しました`,
            syncedEvents: syncedEvents.length,
            totalGoogleEvents: googleEvents.length
          })
          
        } catch (error) {
          return NextResponse.json({
            error: 'Google Calendarとの同期に失敗しました',
            details: error instanceof Error ? error.message : 'Unknown error'
          }, { status: 500 })
        }
      }
      
      case 'check_connection': {
        const { tenantId, executiveId } = data
        
        if (!tenantId || !executiveId) {
          return NextResponse.json({
            error: 'Missing required fields'
          }, { status: 400 })
        }
        
        const tokenData = await redis.get(`tenant:${tenantId}:executive:${executiveId}:google_token`)
        
        return NextResponse.json({
          connected: !!tokenData,
          message: tokenData ? 'Googleカレンダーと連携済み' : 'Googleカレンダーと未連携'
        })
      }
      
      default:
        return NextResponse.json({
          error: 'Invalid action'
        }, { status: 400 })
    }
    
  } catch (error) {
    console.error('Google Calendar API error:', error)
    return NextResponse.json({
      error: 'Google Calendar operation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')
    
    // OAuth認証コールバック処理
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
          `${process.env.NEXT_PUBLIC_APP_URL}/executive?tab=calendar&connected=true`
        )
        
      } catch (err) {
        console.error('OAuth callback error:', err)
        return NextResponse.redirect(
          `${process.env.NEXT_PUBLIC_APP_URL}/executive?tab=calendar&error=auth_failed`
        )
      }
    }
    
    if (error) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/executive?tab=calendar&error=${error}`
      )
    }
    
    return NextResponse.json({
      status: 'ready',
      message: 'Google Calendar Integration API',
      actions: {
        connect: 'Connect to Google Calendar',
        disconnect: 'Disconnect from Google Calendar',
        sync_events: 'Sync events from Google Calendar',
        check_connection: 'Check connection status'
      }
    })
    
  } catch (error) {
    console.error('Google Calendar GET error:', error)
    return NextResponse.json({
      error: 'Failed to process request'
    }, { status: 500 })
  }
}