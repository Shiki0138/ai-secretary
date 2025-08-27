/**
 * 認証API
 * システム管理者と経営者の認証処理
 */

import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// セッション有効期限（7日間）
const SESSION_EXPIRY = 86400 * 7

interface Session {
  sessionId: string
  userId: string
  userType: 'admin' | 'executive'
  tenantId?: string
  createdAt: string
  expiresAt: string
}

export async function POST(request: NextRequest) {
  try {
    const { action, data } = await request.json()
    
    switch (action) {
      case 'login': {
        const { email, password, userType } = data
        
        if (!email || !password || !userType) {
          return NextResponse.json({
            error: 'Missing required fields'
          }, { status: 400 })
        }
        
        // ユーザー情報取得
        let user
        if (userType === 'admin') {
          // システム管理者の認証
          user = await redis.get(`admin:${email}`)
        } else if (userType === 'executive') {
          // 経営者の認証
          user = await redis.get(`executive:${email}`)
        }
        
        if (!user || typeof user !== 'object') {
          return NextResponse.json({
            error: 'Invalid credentials'
          }, { status: 401 })
        }
        
        // パスワード検証
        const userObj = user as Record<string, unknown>
        const isValid = await bcrypt.compare(password, userObj.hashedPassword as string)
        
        if (!isValid) {
          return NextResponse.json({
            error: 'Invalid credentials'
          }, { status: 401 })
        }
        
        // セッション作成
        const sessionId = randomUUID()
        const session: Session = {
          sessionId,
          userId: userObj.userId as string,
          userType,
          tenantId: userObj.tenantId as string | undefined,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + SESSION_EXPIRY * 1000).toISOString()
        }
        
        await redis.set(`session:${sessionId}`, session, { ex: SESSION_EXPIRY })
        
        // ユーザー情報からパスワードを除外して返す
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { hashedPassword, ...safeUser } = userObj
        
        return NextResponse.json({
          message: 'Login successful',
          session: {
            sessionId,
            expiresAt: session.expiresAt
          },
          user: safeUser
        })
      }
      
      case 'register': {
        const { email, password, name, userType, tenantId } = data
        
        if (!email || !password || !name || !userType) {
          return NextResponse.json({
            error: 'Missing required fields'
          }, { status: 400 })
        }
        
        // 既存ユーザーチェック
        const existing = userType === 'admin' 
          ? await redis.get(`admin:${email}`)
          : await redis.get(`executive:${email}`)
          
        if (existing) {
          return NextResponse.json({
            error: 'User already exists'
          }, { status: 409 })
        }
        
        // パスワードハッシュ化
        const hashedPassword = await bcrypt.hash(password, 10)
        
        // ユーザー作成
        const userId = randomUUID()
        const userData = {
          userId,
          email,
          name,
          hashedPassword,
          userType,
          tenantId,
          createdAt: new Date().toISOString()
        }
        
        if (userType === 'admin') {
          await redis.set(`admin:${email}`, userData)
          await redis.sadd('system_admins', email)
        } else if (userType === 'executive') {
          await redis.set(`executive:${email}`, userData)
          if (tenantId) {
            await redis.sadd(`tenant:${tenantId}:executives_web`, email)
          }
        }
        
        // 自動ログイン
        const sessionId = randomUUID()
        const session: Session = {
          sessionId,
          userId,
          userType,
          tenantId,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + SESSION_EXPIRY * 1000).toISOString()
        }
        
        await redis.set(`session:${sessionId}`, session, { ex: SESSION_EXPIRY })
        
        return NextResponse.json({
          message: 'Registration successful',
          session: {
            sessionId,
            expiresAt: session.expiresAt
          },
          user: {
            userId,
            email,
            name,
            userType,
            tenantId
          }
        })
      }
      
      case 'logout': {
        const { sessionId } = data
        
        if (!sessionId) {
          return NextResponse.json({
            error: 'No session provided'
          }, { status: 400 })
        }
        
        await redis.del(`session:${sessionId}`)
        
        return NextResponse.json({
          message: 'Logout successful'
        })
      }
      
      case 'verify': {
        const { sessionId } = data
        
        if (!sessionId) {
          return NextResponse.json({
            error: 'No session provided'
          }, { status: 400 })
        }
        
        const session = await redis.get(`session:${sessionId}`) as Session | null
        
        if (!session) {
          return NextResponse.json({
            error: 'Invalid session'
          }, { status: 401 })
        }
        
        // セッション期限確認
        if (new Date(session.expiresAt) < new Date()) {
          await redis.del(`session:${sessionId}`)
          return NextResponse.json({
            error: 'Session expired'
          }, { status: 401 })
        }
        
        // ユーザー情報取得
        let user
        if (session.userType === 'admin') {
          const admins = await redis.smembers('system_admins') || []
          for (const email of admins) {
            const adminData = await redis.get(`admin:${email}`) as Record<string, unknown>
            if (adminData?.userId === session.userId) {
              user = adminData
              break
            }
          }
        } else if (session.userType === 'executive' && session.tenantId) {
          const executives = await redis.smembers(`tenant:${session.tenantId}:executives_web`) || []
          for (const email of executives) {
            const execData = await redis.get(`executive:${email}`) as Record<string, unknown>
            if (execData?.userId === session.userId) {
              user = execData
              break
            }
          }
        }
        
        if (!user) {
          return NextResponse.json({
            error: 'User not found'
          }, { status: 404 })
        }
        
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { hashedPassword, ...safeUser } = user as Record<string, unknown>
        
        return NextResponse.json({
          valid: true,
          session,
          user: safeUser
        })
      }
      
      default:
        return NextResponse.json({
          error: 'Invalid action'
        }, { status: 400 })
    }
    
  } catch (error) {
    console.error('Auth error:', error)
    return NextResponse.json({
      error: 'Authentication failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ready',
    actions: {
      login: 'POST with action: login and data: {email, password, userType}',
      register: 'POST with action: register and data: {email, password, name, userType, tenantId?}',
      logout: 'POST with action: logout and data: {sessionId}',
      verify: 'POST with action: verify and data: {sessionId}'
    }
  })
}