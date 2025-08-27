/**
 * Employee Management API
 * 従業員情報の管理
 */

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
      case 'update_employee': {
        const { tenantId, userId, updates } = data
        
        if (!tenantId || !userId || !updates) {
          return NextResponse.json({
            error: 'Missing required fields'
          }, { status: 400 })
        }
        
        // 従業員情報を取得
        const employee = await redis.hgetall(`user:${userId}`)
        
        if (!employee || employee.tenantId !== tenantId) {
          return NextResponse.json({
            error: 'Employee not found'
          }, { status: 404 })
        }
        
        // 更新
        const updatedEmployee = {
          ...employee,
          ...updates,
          updatedAt: new Date().toISOString()
        }
        
        await redis.hset(`user:${userId}`, updatedEmployee)
        
        return NextResponse.json({
          message: 'Employee updated successfully',
          employee: updatedEmployee
        })
      }
      
      case 'delete_employee': {
        const { tenantId, userId } = data
        
        if (!tenantId || !userId) {
          return NextResponse.json({
            error: 'Missing required fields'
          }, { status: 400 })
        }
        
        // 従業員情報を確認
        const employee = await redis.hgetall(`user:${userId}`)
        
        if (!employee || employee.tenantId !== tenantId) {
          return NextResponse.json({
            error: 'Employee not found'
          }, { status: 404 })
        }
        
        // 従業員のLINE連携を解除
        if (employee.lineUserId) {
          await redis.del(`line:${employee.lineUserId}`)
        }
        
        // 従業員情報を削除
        await redis.del(`user:${userId}`)
        
        // テナントの従業員リストから削除
        await redis.srem(`tenant:${tenantId}:employees`, userId)
        
        // 従業員のタスクリストを削除
        await redis.del(`tenant:${tenantId}:user:${userId}:tasks`)
        
        return NextResponse.json({
          message: 'Employee deleted successfully',
          deletedUserId: userId
        })
      }
      
      case 'get_employee': {
        const { tenantId, userId } = data
        
        if (!tenantId || !userId) {
          return NextResponse.json({
            error: 'Missing required fields'
          }, { status: 400 })
        }
        
        const employee = await redis.hgetall(`user:${userId}`)
        
        if (!employee || employee.tenantId !== tenantId) {
          return NextResponse.json({
            error: 'Employee not found'
          }, { status: 404 })
        }
        
        return NextResponse.json({ employee })
      }
      
      default:
        return NextResponse.json({
          error: 'Invalid action'
        }, { status: 400 })
    }
    
  } catch (error) {
    console.error('Employee API error:', error)
    return NextResponse.json({
      error: 'Failed to process request',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}