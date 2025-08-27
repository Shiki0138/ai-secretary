import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { randomUUID } from 'crypto'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// テナント作成
export async function POST(request: NextRequest) {
  try {
    const { action, data } = await request.json()
    
    switch (action) {
      case 'create_tenant': {
        const { companyName, adminUserId, adminName } = data
        
        if (!companyName || !adminUserId || !adminName) {
          return NextResponse.json({
            error: 'Missing required fields'
          }, { status: 400 })
        }
        
        // テナントID生成（URL-safe）
        const tenantId = `tenant_${companyName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${randomUUID().slice(0, 8)}`
        
        // テナント情報作成
        const tenantInfo = {
          tenantId,
          companyName,
          createdAt: new Date().toISOString(),
          plan: 'free',
          isActive: true,
          settings: {
            notificationHours: { start: 9, end: 22 },
            urgentAlwaysNotify: true,
            language: 'ja'
          }
        }
        
        // テナント情報保存
        await redis.set(`tenant:${tenantId}:info`, tenantInfo)
        await redis.sadd('all_tenants', tenantId)
        
        // 管理者を経営者として登録
        const adminInfo = {
          userId: adminUserId,
          name: adminName,
          tenantId,
          role: 'executive',
          isAdmin: true,
          registeredAt: new Date().toISOString()
        }
        
        // ユーザー情報を保存（グローバルとテナント両方）
        await redis.set(`user:${adminUserId}`, { tenantId, role: 'executive' })
        await redis.set(`tenant:${tenantId}:user:${adminUserId}`, adminInfo)
        await redis.sadd(`tenant:${tenantId}:executives`, adminUserId)
        await redis.sadd(`tenant:${tenantId}:users`, adminUserId)
        
        return NextResponse.json({
          message: 'Tenant created successfully',
          tenantId,
          tenantInfo,
          adminInfo
        })
      }
      
      case 'add_user_to_tenant': {
        const { userId, tenantId, name, department, role } = data
        
        // テナント存在確認
        const tenantInfo = await redis.get(`tenant:${tenantId}:info`)
        if (!tenantInfo) {
          return NextResponse.json({
            error: 'Tenant not found'
          }, { status: 404 })
        }
        
        // ユーザー情報作成
        const userInfo = {
          userId,
          name,
          department: department || '',
          tenantId,
          role: role || 'employee',
          registeredAt: new Date().toISOString()
        }
        
        // 保存
        await redis.set(`user:${userId}`, { tenantId, role: userInfo.role })
        await redis.set(`tenant:${tenantId}:user:${userId}`, userInfo)
        await redis.sadd(`tenant:${tenantId}:users`, userId)
        
        if (role === 'executive') {
          await redis.sadd(`tenant:${tenantId}:executives`, userId)
        } else {
          await redis.sadd(`tenant:${tenantId}:employees`, userId)
        }
        
        return NextResponse.json({
          message: 'User added to tenant',
          userInfo
        })
      }
      
      case 'list_tenant_users': {
        const { tenantId } = data
        
        const userIds = await redis.smembers(`tenant:${tenantId}:users`) || []
        const users = []
        
        for (const userId of userIds) {
          const userInfo = await redis.get(`tenant:${tenantId}:user:${userId}`)
          if (userInfo) users.push(userInfo)
        }
        
        return NextResponse.json({
          tenantId,
          users,
          total: users.length
        })
      }
      
      default:
        return NextResponse.json({
          error: 'Invalid action'
        }, { status: 400 })
    }
    
  } catch (error) {
    console.error('Tenant setup error:', error)
    return NextResponse.json({
      error: 'Setup failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    const allTenants = await redis.smembers('all_tenants') || []
    
    return NextResponse.json({
      status: 'ready',
      tenant_count: allTenants.length,
      actions: {
        create_tenant: 'POST with action: create_tenant and data: {companyName, adminUserId, adminName}',
        add_user: 'POST with action: add_user_to_tenant and data: {userId, tenantId, name, department, role}',
        list_users: 'POST with action: list_tenant_users and data: {tenantId}'
      }
    })
  } catch {
    return NextResponse.json({
      error: 'Failed to get status'
    }, { status: 500 })
  }
}