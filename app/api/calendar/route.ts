/**
 * Calendar Integration API
 * Google Calendar連携とスケジュール管理
 */

import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// カレンダーイベント型定義
interface CalendarEvent {
  id: string
  tenantId: string
  executiveId: string
  title: string
  description?: string
  startTime: string
  endTime: string
  location?: string
  attendees?: string[]
  type: 'meeting' | 'task' | 'reminder' | 'other'
  status: 'confirmed' | 'tentative' | 'cancelled'
  createdBy: string
  createdAt: string
  updatedAt: string
}

// 空き時間スロット
interface TimeSlot {
  date: string
  startTime: string
  endTime: string
  duration: number // minutes
  available: boolean
}

// POST - カレンダーイベント作成
export async function POST(request: NextRequest) {
  try {
    const { action, data } = await request.json()
    
    switch (action) {
      case 'create_event': {
        const { 
          tenantId, 
          executiveId, 
          title, 
          description, 
          startTime, 
          endTime, 
          location, 
          attendees,
          type = 'meeting',
          createdBy 
        } = data
        
        if (!tenantId || !executiveId || !title || !startTime || !endTime) {
          return NextResponse.json({
            error: 'Missing required fields'
          }, { status: 400 })
        }
        
        const event: CalendarEvent = {
          id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          tenantId,
          executiveId,
          title,
          description,
          startTime,
          endTime,
          location,
          attendees,
          type,
          status: 'confirmed',
          createdBy,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
        
        // イベント保存
        await redis.set(
          `tenant:${tenantId}:calendar:event:${event.id}`, 
          event,
          { ex: 86400 * 90 } // 90日間保存
        )
        
        // 日付別インデックスに追加
        const eventDate = new Date(startTime).toISOString().split('T')[0]
        await redis.sadd(
          `tenant:${tenantId}:calendar:date:${eventDate}`,
          event.id
        )
        
        // 経営者別インデックスに追加
        await redis.sadd(
          `tenant:${tenantId}:executive:${executiveId}:events`,
          event.id
        )
        
        return NextResponse.json({
          message: 'Event created successfully',
          event
        })
      }
      
      case 'get_available_slots': {
        const { tenantId, executiveId, date, duration = 60 } = data
        
        if (!tenantId || !executiveId || !date) {
          return NextResponse.json({
            error: 'Missing required fields'
          }, { status: 400 })
        }
        
        // 指定日のイベントを取得
        const eventIds = await redis.smembers(
          `tenant:${tenantId}:calendar:date:${date}`
        ) || []
        
        const events: CalendarEvent[] = []
        for (const eventId of eventIds) {
          const event = await redis.get(
            `tenant:${tenantId}:calendar:event:${eventId}`
          ) as CalendarEvent
          
          if (event && event.executiveId === executiveId && event.status === 'confirmed') {
            events.push(event)
          }
        }
        
        // 空き時間を計算（9:00-18:00を営業時間と仮定）
        const slots = calculateAvailableSlots(date, events, duration)
        
        return NextResponse.json({
          date,
          executiveId,
          availableSlots: slots,
          totalSlots: slots.length
        })
      }
      
      case 'get_events': {
        const { tenantId, executiveId, startDate, endDate } = data
        
        if (!tenantId || !startDate || !endDate) {
          return NextResponse.json({
            error: 'Missing required fields'
          }, { status: 400 })
        }
        
        const allEvents: CalendarEvent[] = []
        const start = new Date(startDate)
        const end = new Date(endDate)
        
        // 日付範囲内のイベントを取得
        for (let d = start; d <= end; d.setDate(d.getDate() + 1)) {
          const dateStr = d.toISOString().split('T')[0]
          const eventIds = await redis.smembers(
            `tenant:${tenantId}:calendar:date:${dateStr}`
          ) || []
          
          for (const eventId of eventIds) {
            const event = await redis.get(
              `tenant:${tenantId}:calendar:event:${eventId}`
            ) as CalendarEvent
            
            if (event && (!executiveId || event.executiveId === executiveId)) {
              allEvents.push(event)
            }
          }
        }
        
        // 時間順にソート
        allEvents.sort((a, b) => 
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
        )
        
        return NextResponse.json({
          events: allEvents,
          total: allEvents.length
        })
      }
      
      case 'update_event': {
        const { tenantId, eventId, updates } = data
        
        if (!tenantId || !eventId) {
          return NextResponse.json({
            error: 'Missing required fields'
          }, { status: 400 })
        }
        
        const event = await redis.get(
          `tenant:${tenantId}:calendar:event:${eventId}`
        ) as CalendarEvent
        
        if (!event) {
          return NextResponse.json({
            error: 'Event not found'
          }, { status: 404 })
        }
        
        // イベント更新
        const updatedEvent = {
          ...event,
          ...updates,
          updatedAt: new Date().toISOString()
        }
        
        await redis.set(
          `tenant:${tenantId}:calendar:event:${eventId}`,
          updatedEvent,
          { ex: 86400 * 90 }
        )
        
        return NextResponse.json({
          message: 'Event updated successfully',
          event: updatedEvent
        })
      }
      
      case 'cancel_event': {
        const { tenantId, eventId, reason } = data
        
        if (!tenantId || !eventId) {
          return NextResponse.json({
            error: 'Missing required fields'
          }, { status: 400 })
        }
        
        const event = await redis.get(
          `tenant:${tenantId}:calendar:event:${eventId}`
        ) as CalendarEvent
        
        if (!event) {
          return NextResponse.json({
            error: 'Event not found'
          }, { status: 404 })
        }
        
        // ステータスをキャンセルに更新
        event.status = 'cancelled'
        event.updatedAt = new Date().toISOString()
        
        await redis.set(
          `tenant:${tenantId}:calendar:event:${eventId}`,
          event,
          { ex: 86400 * 90 }
        )
        
        // キャンセル理由を記録
        if (reason) {
          await redis.set(
            `tenant:${tenantId}:calendar:event:${eventId}:cancellation`,
            { reason, cancelledAt: new Date().toISOString() },
            { ex: 86400 * 30 }
          )
        }
        
        return NextResponse.json({
          message: 'Event cancelled successfully',
          eventId
        })
      }
      
      case 'update_event': {
        const { tenantId, eventId, updates } = data
        
        if (!tenantId || !eventId || !updates) {
          return NextResponse.json({
            error: 'Missing required fields'
          }, { status: 400 })
        }
        
        const event = await redis.get(
          `tenant:${tenantId}:calendar:event:${eventId}`
        ) as CalendarEvent
        
        if (!event) {
          return NextResponse.json({
            error: 'Event not found'
          }, { status: 404 })
        }
        
        // 古い日付のインデックスから削除
        const oldDateStr = new Date(event.startTime).toISOString().split('T')[0]
        await redis.srem(
          `tenant:${tenantId}:calendar:date:${oldDateStr}`,
          eventId
        )
        
        // イベント更新
        const updatedEvent: CalendarEvent = {
          ...event,
          ...updates,
          updatedAt: new Date().toISOString()
        }
        
        await redis.set(
          `tenant:${tenantId}:calendar:event:${eventId}`,
          updatedEvent,
          { ex: 86400 * 90 }
        )
        
        // 新しい日付のインデックスに追加
        const newDateStr = new Date(updatedEvent.startTime).toISOString().split('T')[0]
        await redis.sadd(
          `tenant:${tenantId}:calendar:date:${newDateStr}`,
          eventId
        )
        
        return NextResponse.json({
          message: 'Event updated successfully',
          event: updatedEvent
        })
      }
      
      case 'delete_event': {
        const { tenantId, eventId } = data
        
        if (!tenantId || !eventId) {
          return NextResponse.json({
            error: 'Missing required fields'
          }, { status: 400 })
        }
        
        const event = await redis.get(
          `tenant:${tenantId}:calendar:event:${eventId}`
        ) as CalendarEvent
        
        if (!event) {
          return NextResponse.json({
            error: 'Event not found'
          }, { status: 404 })
        }
        
        // イベントを削除
        await redis.del(`tenant:${tenantId}:calendar:event:${eventId}`)
        
        // 日付インデックスから削除
        const dateStr = new Date(event.startTime).toISOString().split('T')[0]
        await redis.srem(
          `tenant:${tenantId}:calendar:date:${dateStr}`,
          eventId
        )
        
        return NextResponse.json({
          message: 'Event deleted successfully',
          deletedEventId: eventId
        })
      }
      
      default:
        return NextResponse.json({
          error: 'Invalid action'
        }, { status: 400 })
    }
    
  } catch (error) {
    console.error('Calendar API error:', error)
    return NextResponse.json({
      error: 'Calendar operation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET - カレンダー情報取得
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenantId')
    
    if (!tenantId) {
      return NextResponse.json({
        error: 'Tenant ID is required'
      }, { status: 400 })
    }
    
    // 本日のイベント数を取得
    const today = new Date().toISOString().split('T')[0]
    const todayEventIds = await redis.smembers(
      `tenant:${tenantId}:calendar:date:${today}`
    ) || []
    
    return NextResponse.json({
      status: 'ready',
      tenant: tenantId,
      todayEvents: todayEventIds.length,
      actions: {
        create_event: 'Create a new calendar event',
        get_events: 'Get events within date range',
        get_available_slots: 'Find available time slots',
        update_event: 'Update an existing event',
        cancel_event: 'Cancel an event'
      }
    })
    
  } catch (error) {
    console.error('Calendar GET error:', error)
    return NextResponse.json({
      error: 'Failed to get calendar status'
    }, { status: 500 })
  }
}

// 空き時間計算関数
function calculateAvailableSlots(
  date: string, 
  events: CalendarEvent[], 
  duration: number
): TimeSlot[] {
  const slots: TimeSlot[] = []
  const workStart = 9 // 9:00
  const workEnd = 18 // 18:00
  
  // 時間をminutes単位で扱う
  const busySlots = events.map(event => ({
    start: getMinutesFromTime(new Date(event.startTime)),
    end: getMinutesFromTime(new Date(event.endTime))
  }))
  
  // 営業時間内でスロットを探す
  let currentTime = workStart * 60
  
  while (currentTime + duration <= workEnd * 60) {
    const slotEnd = currentTime + duration
    
    // 既存イベントと重複しないかチェック
    const isAvailable = !busySlots.some(busy => 
      (currentTime >= busy.start && currentTime < busy.end) ||
      (slotEnd > busy.start && slotEnd <= busy.end) ||
      (currentTime <= busy.start && slotEnd >= busy.end)
    )
    
    if (isAvailable) {
      slots.push({
        date,
        startTime: formatTime(currentTime),
        endTime: formatTime(slotEnd),
        duration,
        available: true
      })
    }
    
    currentTime += 30 // 30分刻みで確認
  }
  
  return slots
}

// 時刻を分に変換
function getMinutesFromTime(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

// 分を時刻文字列に変換
function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
}