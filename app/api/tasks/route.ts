/**
 * Task Management API
 * タスク管理とリマインダー機能
 */

import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// タスク型定義
interface Task {
  id: string
  tenantId: string
  assignedTo: string // userId
  createdBy: string
  title: string
  description?: string
  priority: 'urgent' | 'high' | 'normal' | 'low'
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  category: 'meeting' | 'document' | 'approval' | 'review' | 'other'
  dueDate?: string
  reminder?: {
    enabled: boolean
    timing: string[] // ISO timestamps for reminders
  }
  attachments?: string[]
  comments?: Array<{
    userId: string
    text: string
    timestamp: string
  }>
  createdAt: string
  updatedAt: string
  completedAt?: string
}

// POST - タスク操作
export async function POST(request: NextRequest) {
  try {
    const { action, data } = await request.json()
    
    switch (action) {
      case 'create_task': {
        const {
          tenantId,
          assignedTo,
          createdBy,
          title,
          description,
          priority = 'normal',
          category = 'other',
          dueDate,
          reminder
        } = data
        
        if (!tenantId || !assignedTo || !createdBy || !title) {
          return NextResponse.json({
            error: 'Missing required fields'
          }, { status: 400 })
        }
        
        const task: Task = {
          id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          tenantId,
          assignedTo,
          createdBy,
          title,
          description,
          priority,
          status: 'pending',
          category,
          dueDate,
          reminder,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
        
        // タスク保存
        await redis.set(
          `tenant:${tenantId}:task:${task.id}`,
          task,
          { ex: 86400 * 180 } // 180日間保存
        )
        
        // ユーザー別インデックスに追加
        await redis.sadd(
          `tenant:${tenantId}:user:${assignedTo}:tasks`,
          task.id
        )
        
        // 優先度別インデックスに追加
        await redis.sadd(
          `tenant:${tenantId}:tasks:priority:${priority}`,
          task.id
        )
        
        // 期限がある場合は期限別インデックスに追加
        if (dueDate) {
          const dueDateStr = new Date(dueDate).toISOString().split('T')[0]
          await redis.sadd(
            `tenant:${tenantId}:tasks:due:${dueDateStr}`,
            task.id
          )
        }
        
        // リマインダー設定
        if (reminder?.enabled && reminder.timing) {
          await scheduleReminders(task)
        }
        
        return NextResponse.json({
          message: 'Task created successfully',
          task
        })
      }
      
      case 'update_task': {
        const { tenantId, taskId, updates } = data
        
        if (!tenantId || !taskId) {
          return NextResponse.json({
            error: 'Missing required fields'
          }, { status: 400 })
        }
        
        const task = await redis.get(
          `tenant:${tenantId}:task:${taskId}`
        ) as Task
        
        if (!task) {
          return NextResponse.json({
            error: 'Task not found'
          }, { status: 404 })
        }
        
        // タスク更新
        const updatedTask: Task = {
          ...task,
          ...updates,
          updatedAt: new Date().toISOString()
        }
        
        // ステータスが完了に変更された場合
        if (updates.status === 'completed' && task.status !== 'completed') {
          updatedTask.completedAt = new Date().toISOString()
        }
        
        await redis.set(
          `tenant:${tenantId}:task:${taskId}`,
          updatedTask,
          { ex: 86400 * 180 }
        )
        
        return NextResponse.json({
          message: 'Task updated successfully',
          task: updatedTask
        })
      }
      
      case 'add_comment': {
        const { tenantId, taskId, userId, text } = data
        
        if (!tenantId || !taskId || !userId || !text) {
          return NextResponse.json({
            error: 'Missing required fields'
          }, { status: 400 })
        }
        
        const task = await redis.get(
          `tenant:${tenantId}:task:${taskId}`
        ) as Task
        
        if (!task) {
          return NextResponse.json({
            error: 'Task not found'
          }, { status: 404 })
        }
        
        const comment = {
          userId,
          text,
          timestamp: new Date().toISOString()
        }
        
        task.comments = task.comments || []
        task.comments.push(comment)
        task.updatedAt = new Date().toISOString()
        
        await redis.set(
          `tenant:${tenantId}:task:${taskId}`,
          task,
          { ex: 86400 * 180 }
        )
        
        return NextResponse.json({
          message: 'Comment added successfully',
          comment
        })
      }
      
      case 'get_user_tasks': {
        const { tenantId, userId, status, priority } = data
        
        if (!tenantId || !userId) {
          return NextResponse.json({
            error: 'Missing required fields'
          }, { status: 400 })
        }
        
        // ユーザーのタスクID取得
        const taskIds = await redis.smembers(
          `tenant:${tenantId}:user:${userId}:tasks`
        ) || []
        
        const tasks: Task[] = []
        for (const taskId of taskIds) {
          const task = await redis.get(
            `tenant:${tenantId}:task:${taskId}`
          ) as Task
          
          if (task) {
            // フィルタリング
            if (status && task.status !== status) continue
            if (priority && task.priority !== priority) continue
            
            tasks.push(task)
          }
        }
        
        // 期限順にソート
        tasks.sort((a, b) => {
          if (!a.dueDate) return 1
          if (!b.dueDate) return -1
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
        })
        
        return NextResponse.json({
          tasks,
          total: tasks.length,
          summary: {
            pending: tasks.filter(t => t.status === 'pending').length,
            in_progress: tasks.filter(t => t.status === 'in_progress').length,
            completed: tasks.filter(t => t.status === 'completed').length
          }
        })
      }
      
      case 'get_due_tasks': {
        const { tenantId, date } = data
        
        if (!tenantId || !date) {
          return NextResponse.json({
            error: 'Missing required fields'
          }, { status: 400 })
        }
        
        const dueDateStr = new Date(date).toISOString().split('T')[0]
        const taskIds = await redis.smembers(
          `tenant:${tenantId}:tasks:due:${dueDateStr}`
        ) || []
        
        const tasks: Task[] = []
        for (const taskId of taskIds) {
          const task = await redis.get(
            `tenant:${tenantId}:task:${taskId}`
          ) as Task
          
          if (task && task.status !== 'completed' && task.status !== 'cancelled') {
            tasks.push(task)
          }
        }
        
        return NextResponse.json({
          date: dueDateStr,
          dueTasks: tasks,
          total: tasks.length
        })
      }
      
      case 'get_overdue_tasks': {
        const { tenantId } = data
        
        if (!tenantId) {
          return NextResponse.json({
            error: 'Missing tenant ID'
          }, { status: 400 })
        }
        
        const today = new Date()
        const overdueTasks: Task[] = []
        
        // 過去7日分の期限切れタスクをチェック
        for (let i = 1; i <= 7; i++) {
          const checkDate = new Date(today)
          checkDate.setDate(checkDate.getDate() - i)
          const dateStr = checkDate.toISOString().split('T')[0]
          
          const taskIds = await redis.smembers(
            `tenant:${tenantId}:tasks:due:${dateStr}`
          ) || []
          
          for (const taskId of taskIds) {
            const task = await redis.get(
              `tenant:${tenantId}:task:${taskId}`
            ) as Task
            
            if (task && task.status !== 'completed' && task.status !== 'cancelled') {
              overdueTasks.push(task)
            }
          }
        }
        
        return NextResponse.json({
          overdueTasks,
          total: overdueTasks.length
        })
      }
      
      default:
        return NextResponse.json({
          error: 'Invalid action'
        }, { status: 400 })
    }
    
  } catch (error) {
    console.error('Task API error:', error)
    return NextResponse.json({
      error: 'Task operation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET - タスク情報取得
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenantId')
    
    if (!tenantId) {
      return NextResponse.json({
        error: 'Tenant ID is required'
      }, { status: 400 })
    }
    
    // 統計情報を収集
    const urgentTasks = await redis.smembers(
      `tenant:${tenantId}:tasks:priority:urgent`
    ) || []
    
    const highTasks = await redis.smembers(
      `tenant:${tenantId}:tasks:priority:high`
    ) || []
    
    return NextResponse.json({
      status: 'ready',
      tenant: tenantId,
      statistics: {
        urgentTasks: urgentTasks.length,
        highPriorityTasks: highTasks.length
      },
      actions: {
        create_task: 'Create a new task',
        update_task: 'Update an existing task',
        add_comment: 'Add a comment to a task',
        get_user_tasks: 'Get tasks assigned to a user',
        get_due_tasks: 'Get tasks due on a specific date',
        get_overdue_tasks: 'Get overdue tasks'
      }
    })
    
  } catch (error) {
    console.error('Task GET error:', error)
    return NextResponse.json({
      error: 'Failed to get task status'
    }, { status: 500 })
  }
}

// リマインダースケジュール設定（実装はバックグラウンドジョブが必要）
async function scheduleReminders(task: Task) {
  if (!task.reminder?.timing) return
  
  for (const reminderTime of task.reminder.timing) {
    await redis.set(
      `tenant:${task.tenantId}:reminder:${reminderTime}:${task.id}`,
      {
        taskId: task.id,
        assignedTo: task.assignedTo,
        title: task.title,
        dueDate: task.dueDate,
        scheduledAt: reminderTime
      },
      { ex: 86400 * 7 } // 7日間保存
    )
  }
}