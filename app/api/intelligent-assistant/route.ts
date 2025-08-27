/**
 * 高度なAI秘書機能
 * 経営者の質問の意図分析、タスク・指示の自動判別、承認フローの実装
 */

import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import OpenAI from 'openai'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

// 質問の意図分析結果
interface IntentAnalysis {
  intent: 'task_creation' | 'employee_instruction' | 'information_request' | 'schedule_management' | 'general_inquiry'
  confidence: number
  extractedData: {
    taskTitle?: string
    employeeName?: string
    deadline?: string
    priority?: 'urgent' | 'high' | 'normal' | 'low'
    description?: string
    scheduledDate?: string
    scheduledTime?: string
    estimatedDuration?: number
  }
  suggestedAction: string
  needsConfirmation: boolean
}

// 承認待ちアクション
interface PendingAction {
  id: string
  tenantId: string
  executiveId: string
  type: 'task_creation' | 'employee_instruction' | 'schedule_creation'
  originalMessage: string
  analysisResult: IntentAnalysis
  suggestedAction: string
  createdAt: string
  status: 'pending' | 'approved' | 'rejected'
}

// 経営者の質問を分析して意図を判定
async function analyzeExecutiveIntent(message: string, executiveId: string, tenantId: string): Promise<IntentAnalysis> {
  try {
    // 経営者の過去のパターンを取得
    const learningKey = `tenant:${tenantId}:executive:${executiveId}:thinking`
    const pastPatterns = await redis.lrange(learningKey, 0, 20) || []
    
    const prompt = `あなたは経営者の秘書として、経営者からの指示・質問の意図を分析してください。

経営者からのメッセージ: "${message}"

過去の経営者の傾向:
${pastPatterns.slice(0, 5).join('\n')}

以下の観点で分析し、JSON形式で回答してください：

1. intent（意図の分類）:
   - task_creation: 新しいタスクの作成が必要
   - employee_instruction: 特定の従業員への指示
   - information_request: 情報の照会・確認
   - schedule_management: スケジュール関連の操作
   - general_inquiry: 一般的な質問・相談

2. confidence: 判定の確信度（0-100）

3. extractedData: 抽出されたデータ
   - taskTitle: タスクのタイトル
   - employeeName: 対象の従業員名
   - deadline: 期限（YYYY-MM-DD形式）
   - priority: 優先度
   - description: 詳細説明
   - scheduledDate: 予定日
   - scheduledTime: 予定時刻
   - estimatedDuration: 予想所要時間（分）

4. suggestedAction: 推奨されるアクション（具体的に）

5. needsConfirmation: 実行前に確認が必要かどうか

例：
{
  "intent": "task_creation",
  "confidence": 85,
  "extractedData": {
    "taskTitle": "新商品企画会議の準備",
    "deadline": "2024-01-15",
    "priority": "high"
  },
  "suggestedAction": "「新商品企画会議の準備」というタスクを作成し、期限を1月15日、優先度を「高」で設定します。",
  "needsConfirmation": true
}`

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "あなたは経営者の有能な秘書です。経営者の指示を正確に理解し、適切なアクションを提案してください。"
        },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" }
    })

    return JSON.parse(response.choices[0].message.content || '{}')
    
  } catch (error) {
    console.error('Intent analysis error:', error)
    return {
      intent: 'general_inquiry',
      confidence: 0,
      extractedData: {},
      suggestedAction: '申し訳ございませんが、意図を正確に把握できませんでした。詳細をお聞かせください。',
      needsConfirmation: false
    }
  }
}

// 従業員報告の要約・箇条書き化
async function summarizeEmployeeReport(
  report: string, 
  employeeInfo: Record<string, unknown>,
  tenantId: string
): Promise<{
  summary: string
  bulletPoints: string[]
  actionItems: string[]
  needsExecutiveDecision: boolean
  suggestedResponse: string
}> {
  try {
    const prompt = `従業員からの以下の報告を経営者向けに要約してください。

報告者: ${employeeInfo.name}（${employeeInfo.department || '部署不明'}）
報告内容: "${report}"

以下の形式でJSON回答してください：

{
  "summary": "報告の要約（2-3行）",
  "bulletPoints": ["重要なポイントを箇条書きで", "3-5個程度"],
  "actionItems": ["必要なアクション", "具体的な行動項目"],
  "needsExecutiveDecision": true/false,
  "suggestedResponse": "経営者が従業員に返すべき適切な回答"
}

重点：
- 経営者が素早く状況を把握できる簡潔さ
- 緊急性や重要度の明確化
- 具体的なアクション項目の抽出
- 経営判断が必要な点の特定`

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "あなたは経営者の秘書として、従業員からの報告を経営者が理解しやすい形に整理する専門家です。"
        },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" }
    })

    return JSON.parse(response.choices[0].message.content || '{}')
    
  } catch (error) {
    console.error('Report summarization error:', error)
    return {
      summary: report.substring(0, 100) + '...',
      bulletPoints: ['詳細な分析ができませんでした'],
      actionItems: [],
      needsExecutiveDecision: false,
      suggestedResponse: 'ご報告ありがとうございます。詳細を確認いたします。'
    }
  }
}

// 承認待ちアクションを作成
async function createPendingAction(
  tenantId: string,
  executiveId: string,
  type: PendingAction['type'],
  originalMessage: string,
  analysisResult: IntentAnalysis
): Promise<string> {
  const actionId = `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  const pendingAction: PendingAction = {
    id: actionId,
    tenantId,
    executiveId,
    type,
    originalMessage,
    analysisResult,
    suggestedAction: analysisResult.suggestedAction,
    createdAt: new Date().toISOString(),
    status: 'pending'
  }
  
  await redis.set(
    `tenant:${tenantId}:pending_action:${actionId}`,
    pendingAction,
    { ex: 86400 * 7 } // 7日間保存
  )
  
  return actionId
}

export async function POST(request: NextRequest) {
  try {
    const { action, data } = await request.json()
    
    switch (action) {
      case 'analyze_executive_message': {
        const { tenantId, executiveId, message } = data
        
        const analysis = await analyzeExecutiveIntent(message, executiveId, tenantId)
        
        if (analysis.needsConfirmation) {
          // 承認待ちアクションを作成
          const actionId = await createPendingAction(
            tenantId,
            executiveId,
            analysis.intent as PendingAction['type'],
            message,
            analysis
          )
          
          return NextResponse.json({
            needsConfirmation: true,
            analysis,
            actionId,
            confirmationMessage: `以下のアクションを実行してよろしいですか？\n\n${analysis.suggestedAction}\n\n「はい」で実行、「いいえ」でキャンセルしてください。`
          })
        } else {
          return NextResponse.json({
            needsConfirmation: false,
            analysis,
            response: analysis.suggestedAction
          })
        }
      }
      
      case 'process_employee_report': {
        const { tenantId, employeeInfo, report } = data
        
        const summary = await summarizeEmployeeReport(report, employeeInfo, tenantId)
        
        // 経営者への通知メッセージを作成
        const executiveNotification = `📋 ${employeeInfo.name}様からの報告\n\n【要約】\n${summary.summary}\n\n【重要ポイント】\n${summary.bulletPoints.map(point => `• ${point}`).join('\n')}\n\n${summary.actionItems.length > 0 ? `【必要なアクション】\n${summary.actionItems.map(item => `• ${item}`).join('\n')}\n\n` : ''}${summary.needsExecutiveDecision ? '⚠️ 経営判断が必要な案件です' : ''}`
        
        return NextResponse.json({
          summary,
          executiveNotification,
          employeeResponse: summary.suggestedResponse
        })
      }
      
      case 'confirm_action': {
        const { actionId, approved } = data
        
        const pendingAction = await redis.get(`tenant:${data.tenantId}:pending_action:${actionId}`) as PendingAction
        
        if (!pendingAction) {
          return NextResponse.json({
            error: 'Action not found'
          }, { status: 404 })
        }
        
        if (approved) {
          // アクションを実行
          let result = ''
          
          switch (pendingAction.type) {
            case 'task_creation':
              // タスク作成APIを呼び出し
              const taskResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/tasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'create_task',
                  data: {
                    tenantId: pendingAction.tenantId,
                    title: pendingAction.analysisResult.extractedData.taskTitle,
                    description: pendingAction.analysisResult.extractedData.description || pendingAction.originalMessage,
                    priority: pendingAction.analysisResult.extractedData.priority || 'normal',
                    dueDate: pendingAction.analysisResult.extractedData.deadline,
                    assignedTo: pendingAction.executiveId
                  }
                })
              })
              
              if (taskResponse.ok) {
                result = `タスク「${pendingAction.analysisResult.extractedData.taskTitle}」を作成しました。`
              }
              break
              
            case 'employee_instruction':
              // 従業員指示APIを呼び出し
              const instructionResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/executive-command`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'send_to_employee',
                  data: {
                    tenantId: pendingAction.tenantId,
                    executiveId: pendingAction.executiveId,
                    message: `${pendingAction.analysisResult.extractedData.employeeName}に${pendingAction.originalMessage}と伝えて`
                  }
                })
              })
              
              if (instructionResponse.ok) {
                result = `${pendingAction.analysisResult.extractedData.employeeName}様に指示を送信しました。`
              }
              break
          }
          
          // ステータス更新
          pendingAction.status = 'approved'
          await redis.set(
            `tenant:${pendingAction.tenantId}:pending_action:${actionId}`,
            pendingAction,
            { ex: 86400 * 7 }
          )
          
          return NextResponse.json({
            message: result || pendingAction.suggestedAction,
            executed: true
          })
        } else {
          // キャンセル
          pendingAction.status = 'rejected'
          await redis.set(
            `tenant:${pendingAction.tenantId}:pending_action:${actionId}`,
            pendingAction,
            { ex: 86400 * 7 }
          )
          
          return NextResponse.json({
            message: 'アクションをキャンセルしました。他にご用件はございますか？',
            executed: false
          })
        }
      }
      
      case 'schedule_task_integration': {
        const { tenantId, executiveId } = data
        
        try {
          // 今後30日のカレンダーイベントを取得
          const today = new Date().toISOString().split('T')[0]
          const thirtyDaysLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          
          const eventResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://ai-secretary-ten.vercel.app'}/api/calendar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'get_events',
              data: {
                tenantId,
                executiveId,
                startDate: today,
                endDate: thirtyDaysLater
              }
            })
          })
          
          if (!eventResponse.ok) {
            throw new Error('カレンダーイベント取得に失敗')
          }
          
          const { events } = await eventResponse.json()
          const tasksCreated = []
          
          // 各イベントに対してタスク作成の必要性を判定
          for (const event of events) {
            if (event.status === 'cancelled') continue
            
            let shouldCreateTask = false
            let taskTitle = ''
            let taskDescription = ''
            let taskPriority = 'normal'
            
            // イベントタイプに基づくタスク生成ロジック
            if (event.type === 'meeting') {
              shouldCreateTask = true
              taskTitle = `${event.title}の事前準備`
              taskDescription = `会議「${event.title}」に向けて資料準備と議題の整理を行う`
              taskPriority = 'high'
            } else if (event.title.includes('プレゼン') || event.title.includes('発表')) {
              shouldCreateTask = true
              taskTitle = `${event.title}の資料作成`
              taskDescription = `${event.title}のプレゼンテーション資料を作成する`
              taskPriority = 'high'
            } else if (event.title.includes('面接') || event.title.includes('面談')) {
              shouldCreateTask = true
              taskTitle = `${event.title}の準備`
              taskDescription = `${event.title}に向けて質問項目と評価基準を準備する`
              taskPriority = 'normal'
            }
            
            if (shouldCreateTask) {
              // イベント開始の2時間前を期限に設定
              const dueDate = new Date(new Date(event.startTime).getTime() - 2 * 60 * 60 * 1000).toISOString()
              
              // 既に同様のタスクが作成されていないかチェック
              const existingTaskResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://ai-secretary-ten.vercel.app'}/api/tasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'get_user_tasks',
                  data: {
                    tenantId,
                    userId: executiveId
                  }
                })
              })
              
              let shouldSkip = false
              if (existingTaskResponse.ok) {
                const { tasks } = await existingTaskResponse.json()
                shouldSkip = tasks.some((task: Record<string, unknown>) => 
                  (task.title as string)?.includes(event.title) || 
                  (task.description as string)?.includes(event.title)
                )
              }
              
              if (!shouldSkip) {
                const taskResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://ai-secretary-ten.vercel.app'}/api/tasks`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    action: 'create_task',
                    data: {
                      tenantId,
                      assignedTo: executiveId,
                      createdBy: 'system',
                      title: taskTitle,
                      description: taskDescription,
                      priority: taskPriority,
                      category: 'meeting',
                      dueDate: dueDate
                    }
                  })
                })
                
                if (taskResponse.ok) {
                  const taskResult = await taskResponse.json()
                  tasksCreated.push({
                    task: taskResult.task,
                    relatedEvent: event.title,
                    eventDate: event.startTime
                  })
                }
              }
            }
          }
          
          return NextResponse.json({
            message: `${tasksCreated.length}件のタスクを自動作成しました。`,
            tasksCreated: tasksCreated.map(t => ({
              title: t.task.title,
              relatedEvent: t.relatedEvent,
              dueDate: t.task.dueDate
            })),
            eventsAnalyzed: events.length
          })
          
        } catch (error) {
          console.error('Schedule task integration error:', error)
          return NextResponse.json({
            error: 'スケジュール連携処理に失敗しました',
            details: error instanceof Error ? error.message : 'Unknown error'
          }, { status: 500 })
        }
      }

      default:
        return NextResponse.json({
          error: 'Invalid action'
        }, { status: 400 })
    }
    
  } catch (error) {
    console.error('Intelligent assistant error:', error)
    return NextResponse.json({
      error: 'Processing failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ready',
    actions: {
      analyze_executive_message: 'Analyze executive message intent',
      process_employee_report: 'Process and summarize employee report',
      confirm_action: 'Confirm or reject pending action'
    }
  })
}