import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export async function POST(request: NextRequest) {
  try {
    const { action, data } = await request.json()
    
    switch (action) {
      case 'register_user': {
        // ユーザー登録
        const { userId, name, company, department, role } = data
        
        if (!userId || !name || !role) {
          return NextResponse.json({
            error: 'Missing required fields'
          }, { status: 400 })
        }
        
        // ユーザー情報保存
        const userInfo = {
          userId,
          name,
          company: company || '',
          department: department || '',
          role,
          registeredAt: new Date().toISOString()
        }
        
        await redis.set(`user:${userId}`, userInfo)
        
        // 役割に応じてリストに追加
        if (role === 'executive' || role === '経営者' || role === 'CEO' || role === '社長') {
          await redis.sadd('executives', userId)
        } else {
          await redis.sadd('employees', userId)
        }
        
        return NextResponse.json({
          message: 'User registered successfully',
          userInfo
        })
      }
      
      case 'update_role': {
        // 役割変更
        const { userId, newRole } = data
        
        const userInfo = await redis.get(`user:${userId}`)
        if (!userInfo) {
          return NextResponse.json({
            error: 'User not found'
          }, { status: 404 })
        }
        
        // 既存のリストから削除
        await redis.srem('executives', userId)
        await redis.srem('employees', userId)
        
        // 新しい役割に応じてリストに追加
        if (newRole === 'executive' || newRole === '経営者') {
          await redis.sadd('executives', userId)
        } else {
          await redis.sadd('employees', userId)
        }
        
        // ユーザー情報更新
        await redis.set(`user:${userId}`, {
          ...(userInfo as Record<string, unknown>),
          role: newRole,
          updatedAt: new Date().toISOString()
        })
        
        return NextResponse.json({
          message: 'Role updated successfully',
          newRole
        })
      }
      
      case 'set_executive_line_id': {
        // 経営者のLINE IDを設定（テスト用）
        const { userId, lineId } = data
        
        await redis.sadd('executives', userId)
        await redis.set(`user:${userId}`, {
          userId,
          lineId,
          name: '経営者',
          role: 'executive',
          registeredAt: new Date().toISOString()
        })
        
        return NextResponse.json({
          message: 'Executive LINE ID set',
          userId
        })
      }
      
      case 'list_users': {
        // ユーザー一覧取得
        const executives = await redis.smembers('executives') || []
        const employees = await redis.smembers('employees') || []
        
        const executiveDetails = []
        for (const execId of executives) {
          const info = await redis.get(`user:${execId}`)
          if (info) executiveDetails.push(info)
        }
        
        const employeeDetails = []
        for (const empId of employees) {
          const info = await redis.get(`user:${empId}`)
          if (info) employeeDetails.push(info)
        }
        
        return NextResponse.json({
          executives: executiveDetails,
          employees: employeeDetails,
          total: executiveDetails.length + employeeDetails.length
        })
      }
      
      default:
        return NextResponse.json({
          error: 'Invalid action'
        }, { status: 400 })
    }
    
  } catch (error) {
    console.error('User setup error:', error)
    return NextResponse.json({
      error: 'Setup failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    const executives = await redis.smembers('executives') || []
    const employees = await redis.smembers('employees') || []
    
    return NextResponse.json({
      status: 'ready',
      user_counts: {
        executives: executives.length,
        employees: employees.length,
        total: executives.length + employees.length
      },
      setup_instructions: {
        register_user: 'POST with action: register_user and data: {userId, name, company, department, role}',
        update_role: 'POST with action: update_role and data: {userId, newRole}',
        set_executive: 'POST with action: set_executive_line_id and data: {userId, lineId}',
        list_users: 'POST with action: list_users'
      }
    })
  } catch {
    return NextResponse.json({
      error: 'Failed to get status'
    }, { status: 500 })
  }
}
